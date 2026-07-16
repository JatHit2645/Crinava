import random
import time

def get_stealth_headers():
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.skyinplay.club/",
        "Origin": "https://www.skyinplay.club",
        "Connection": "keep-alive"
    }

def jitter_delay():
    time.sleep(random.uniform(0.1, 0.4))
