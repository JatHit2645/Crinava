"""Module docstring."""

import json
import time
import re
from backend.utils.stealth import stealth_session
import websockets
import httpx


class CrexMatchWorker:
    """Step 3, 4, 5, 6, 7: Final Production Worker (No Mocks).

    Uses Socket.io protocol logic to stay invisible and fast.
    """

    def __init__(self, match_data, ai_api_key):
        """Docstring for __init__."""
        self.match = match_data
        self.crex_id = match_data.get("crex_id").replace("CREX_", "")
        self.ai_api_key = ai_api_key
        self.is_running = True
        self.ws_url = "wss://socket.crex.com/socket.io/?EIO=4&transport=websocket"
        self.keywords = [
            "yorker",
            "bouncer",
            "drive",
            "pull",
            "sweep",
            "cutter",
            "slow-ball",
            "edge",
            "straight",
            "length",
        ]

    async def get_socket_token(self):
        """Visits the match page to extract the live authentication token."""
        match_url = f"https://crex.com/live-scorecard/{self.crex_id}"
        print(f"[Stealth] Fetching token from {match_url}")

        try:
            response = stealth_session.request("GET", match_url)
            # Find the token in the script tags using Regex
            token_match = re.search(r'socketToken":"([^"]+)"', response.text)
            if token_match:
                return token_match.group(1)
            return None
        except Exception as e:
            print(f"[Error] Token extraction failed: {e}")
            return None

    async def listen(self):
        """The main listener loop using Step 3/4/5 logic."""
        token = await self.get_socket_token()
        if not token:
            print(
                f"[Error] Could not find token for {self.crex_id}. Retrying in 60s..."
            )
            return

        final_ws_url = f"{self.ws_url}&token={token}"

        async with websockets.connect(
            final_ws_url, extra_headers=stealth_session.get_headers()
        ) as ws:
            print(f"[Worker] Connection established for {self.match['title']}")

            # Socket.io Handshake (Step 3: The Ghost Pipe)
            await ws.send("40")  # Basic Socket.io connect message

            while self.is_running:
                message = await ws.recv()

                # Socket.io message types:
                # 2 = Heartbeat (must reply with 3)
                # 42 = Data packet
                if message.startswith("2"):
                    await ws.send(
                        "3"
                    )  # Keep connection alive (Mirroring human behavior)

                elif message.startswith("42"):
                    # Step 4: Detail Mining
                    data = json.loads(message[2:])  # Strip the '42' prefix
                    # We look for the 'scorecardUpdate' event in the list
                    if data[0] == "scorecardUpdate":
                        ball_info = data[1]
                        await self.process_ball_update(ball_info)

    async def process_ball_update(self, ball_info):
        """Step 4 & 5: Mining and AI Generation."""
        # Extract flavor from commentary field
        raw_comm = ball_info.get("commentary", "").lower()
        flavor = [kw for kw in self.keywords if kw in raw_comm]

        # Step 5: AI Commentary Synthesis
        # (This calls the HF Inference API)
        ai_commentary = await self.generate_ai_commentary(ball_info, flavor)

        packet = {
            "match_id": self.crex_id,
            "score": f"{ball_info.get('runs')}/{ball_info.get('wickets')}",
            "ball": ball_info.get("over_ball"),
            "flavor": flavor,
            "commentary": ai_commentary,
            "timestamp": time.time(),
        }

        # Step 6 & 7: Log and Broadcast
        print(f"[Engine] Ball {packet['ball']}: {packet['commentary']}")
        # (Hooked into main.py broadcast system)

    async def generate_ai_commentary(self, ball, flavor):
        """Step 5: Calls Hugging Face Inference API to generate 100% original
        content."""
        url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
        headers = {"Authorization": f"Bearer {self.ai_api_key}"}

        prompt = f"Context: Cricket match update. Ball: {ball.get('over_ball')}. Runs: {ball.get('runs_scored')}. Details: {', '.join(flavor)}. \nInstruction: Write one professional, high-energy commentary sentence describing this ball. Do not copy others. Be original. Commentary:"

        try:
            # We use stealth_session for the API call too, or standard httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json={
                        "inputs": prompt,
                        "parameters": {"max_new_tokens": 50, "temperature": 0.7},
                    },
                    timeout=10,
                )
                result = response.json()

                if isinstance(result, list) and len(result) > 0:
                    text = result[0].get("generated_text", "")
                    # Extract only the commentary part
                    commentary = text.split("Commentary:")[-1].strip()
                    return commentary
            return f"Ball {ball.get('over_ball')} bowled. Score: {ball.get('runs_scored')} runs."
        except Exception as e:
            print(f"[AI Error] Match {self.crex_id}: {e}")
            return f"Live update: {ball.get('runs_scored')} runs scored."


# The rest of the logic...
