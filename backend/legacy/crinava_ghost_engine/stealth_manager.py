import random
import time

def get_stealth_headers():
    """
    Generates a set of headers that perfectly mimics a real human user 
    browsing from a Windows 11 PC.
    """
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ]
    
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.9,en-US;q=0.7",
        "Referer": "https://www.skyinplay.club/", # Mimics the source site
        "Origin": "https://www.skyinplay.club",
        "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "DNT": "1", # Do Not Track
        "Connection": "keep-alive"
    }
    return headers

def jitter_delay():
    """
    Adds a tiny random delay (0.1 to 0.4 seconds) to your requests.
    This prevents the server from seeing a 'perfect' 1.000s robot pulse.
    """
    time.sleep(random.uniform(0.1, 0.4))

if __name__ == "__main__":
    # Test if it works
    print("\ud83d\udee1\ufe0f Stealth Headers Generated:")
    print(get_stealth_headers())
