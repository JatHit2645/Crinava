from stealth import stealth_session
import re

url = "https://crex.com/cricket-live-score/match-updates-11HI"
print(f"Fetching {url}...")
response = stealth_session.request("GET", url)
print(f"Status: {response.status_code}")
print(f"Content Length: {len(response.text)}")
print("First 500 chars:")
print(response.text[:500])

# Search for ANY token-like string
tokens = re.findall(r'"[a-zA-Z0-9_\-]{20,}"', response.text)
print(f"Found {len(tokens)} potential tokens.")
for t in tokens[:10]:
    # Mask token to avoid logging sensitive data in plaintext
    masked_t = f"{t[:5]}...{t[-5:]}" if len(t) > 10 else "..."
    print(f"Token?: {masked_t}")

if "socketToken" in response.text:
    print("SUCCESS: socketToken found in text!")
    match = re.search(r'socketToken":"([^"]+)"', response.text)
    raw_token = match.group(1)
    masked_token = (
        f"{raw_token[:5]}...{raw_token[-5:]}" if len(raw_token) > 10 else "..."
    )
    print(f"Extracted: {masked_token}")
else:
    print("FAILURE: socketToken NOT found.")
