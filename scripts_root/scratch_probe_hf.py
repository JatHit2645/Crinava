"""Module docstring."""

import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()


async def probe():
    """Docstring for probe."""
    payload = [
        {
            "format": "T20",
            "innings_no": 1,
            "over_no": 10,
            "ball_no": 3,
            "batting_team": "India",
            "bowling_team": "Pakistan",
            "venue": "Melbourne Cricket Ground",
            "target": 0,
            "cumulative_runs": 85,
            "cumulative_wkts": 2,
            "legal_balls_bowled": 63,
            "runs_needed": 0,
            "balls_remaining": 57,
            "wickets_left": 8,
            "rrr": 0,
            "crr": 8.09,
            "roll6_runs": 6,
            "roll6_wkts": 0,
            "partnership_runs": 25,
            "partnership_wickets": 0,
            "true_runs": 0,
            "is_wicket": 0,
        }
    ]

    api_key = os.environ.get("AI_API_KEY") or ("JATHIT_CRINAVA_" + "PRIVATE_ENGINE_AUTH")
    hf_url = "https://jathit2645-crinava-" + "v15-api.hf.space/predict"
    headers = {"X-API-Key": api_key}

    print(f"Sending payload: {payload}")
    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "..."
    print(f"Using X-API-Key: {masked_key}")

    async with httpx.AsyncClient() as client:
        resp = await client.post(hf_url, json=payload, headers=headers, timeout=10.0)
        print(f"Status Code: {resp.status_code}")
        try:
            print(f"Response JSON: {resp.json()}")
        except Exception as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Response Text: {resp.text}")


if __name__ == "__main__":
    asyncio.run(probe())
