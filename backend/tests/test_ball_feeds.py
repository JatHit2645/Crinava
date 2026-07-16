"""Module docstring."""

import sys
import os

# Add current dir to path to import stealth
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.utils.stealth import stealth_session

match_id = "1199"

print("--- TESTING GET REQUEST WITH QUERY PARAM ---")
get_url = f"https://content.crickapi.com/commentary/v1/getBallFeeds?matchId={match_id}"
try:
    resp = stealth_session.request("GET", get_url, timeout=10)
    print(f"Status Code: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")
    print(f"Body: {resp.text[:1000]}")
except Exception as e:
    print(f"GET Error: {e}")

print("\n--- TESTING POST REQUEST WITH JSON BODY ---")
post_url = "https://content.crickapi.com/commentary/v1/getBallFeeds"
payload = {"matchId": match_id}
headers = {
    "Content-Type": "application/json",
    "Origin": "https://crex.com",
    "Referer": "https://crex.com/",
}
try:
    resp = stealth_session.request(
        "POST", post_url, json=payload, headers=headers, timeout=10
    )
    print(f"Status Code: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")
    print(f"Body: {resp.text[:1000]}")
except Exception as e:
    print(f"POST Error: {e}")

print("\n--- TESTING POST REQUEST WITH key (goscorer format) ---")
payload = {"key": match_id}
try:
    resp = stealth_session.request(
        "POST", post_url, json=payload, headers=headers, timeout=10
    )
    print(f"Status Code: {resp.status_code}")
    print(f"Body: {resp.text[:1000]}")
except Exception as e:
    print(f"POST key Error: {e}")
