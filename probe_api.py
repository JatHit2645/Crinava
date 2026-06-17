from stealth import stealth_session

endpoints = [
    "https://crex.com/api/v1/auth/token",
    "https://crex.com/api/v1/common/config",
    "https://crex.com/api/v1/matches/live-token",
    "https://crex.com/api/v1/auth/guest-login",
]

for url in endpoints:
    print(f"Testing {url}...")
    try:
        response = stealth_session.request("GET", url)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

# Try a POST request for guest login (common in apps)
print("Testing Guest Login POST...")
try:
    response = stealth_session.request(
        "POST", "https://crex.com/api/v1/auth/guest-login", json={}
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
