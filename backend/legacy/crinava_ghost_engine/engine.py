import requests
import json
import threading
import time
import os
from pathlib import Path
from dotenv import load_dotenv
from stealth_manager import get_stealth_headers, jitter_delay

# --- LOAD CENTRAL SECRETS ---
env_path = Path(r"C:\Users\hp\.gemini\antigravity\scratch\Crinava-main\.env")
load_dotenv(dotenv_path=env_path)

# --- SETTINGS ---
AI_API_URL = os.getenv("AI_API_URL")
AI_API_KEY = os.getenv("AI_API_KEY")
MASTER_DISCOVERY_URL = os.getenv("MASTER_DISCOVERY_URL")
MAX_HISTORY = int(os.getenv("MAX_HISTORY", 18))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", 60))

# Global storage
live_data_store = {}
active_robots = {}

class MatchRobot:
    def __init__(self, match_id, teams):
        self.match_id = match_id
        self.teams = teams
        self.history = []
        self.is_running = True
        
        live_data_store[match_id] = {
            "teams": teams,
            "score": "Awaiting first ball...",
            "win_probability": 50.0,
            "momentum": 50.0,
            "status": "LIVE"
        }

    def run(self):
        print(f"[ROBOT {self.match_id}] Tracking {self.teams}")
        while self.is_running:
            try:
                jitter_delay()
                if len(self.history) > 0:
                    self.call_ai_engine()
                time.sleep(2)
            except Exception as e:
                print(f"Robot {self.match_id} error: {e}")
                time.sleep(5)

    def call_ai_engine(self):
        try:
            headers = {"X-API-Key": AI_API_KEY, "Content-Type": "application/json"}
            payload = self.history[-MAX_HISTORY:]
            response = requests.post(AI_API_URL, json=payload, headers=headers, timeout=5)
            result = response.json()
            live_data_store[self.match_id].update({
                "win_probability": result.get("win_probability", 50.0),
                "momentum": result.get("momentum_score", 50.0),
                "history_used": result.get("history_used", 0)
            })
        except Exception as e:
            print(f"AI Call Failed for {self.match_id}: {e}")

def scan_for_matches():
    global active_robots
    print("Scanning Master Link...")
    try:
        response = requests.get(MASTER_DISCOVERY_URL, headers=get_stealth_headers(), timeout=10)
        matches = response.json()
        if isinstance(matches, list):
            for match in matches:
                m_id = str(match.get('id') or match.get('eventId'))
                if m_id not in active_robots:
                    t1 = match.get('team1') or match.get('t1') or "Team 1"
                    t2 = match.get('team2') or match.get('t2') or "Team 2"
                    robot = MatchRobot(m_id, f"{t1} vs {t2}")
                    t = threading.Thread(target=robot.run)
                    t.daemon = True
                    t.start()
                    active_robots[m_id] = robot
    except Exception as e:
        print(f"Scanner error: {e}")

if __name__ == "__main__":
    print("Crinava Stealth Engine Active")
    print(f"Loading secrets from: {env_path}")
    while True:
        scan_for_matches()
        time.sleep(POLL_INTERVAL)
