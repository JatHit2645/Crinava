import sys
import json
import curl_cffi.requests as reqs

# Let's test calling oc.crickapi.com/mapping/getHomeMapData with player IDs
url = "https://oc.crickapi.com/mapping/getHomeMapData"
headers = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://crex.com",
    "Referer": "https://crex.com/",
}

# The IDs from the user's scorecard
test_ids = ["T1", "7L2", "7N4", "7LZ", "B2L", "D8T", "GOW", "7M1", "S2", "7LH", "7L7", "B85", "GBA", "1GX", "B5Q", "7GG", "DQ4"]

payload = {
    "p": test_ids,
    "t": [],
    "s": [],
    "u": [],
    "v": [],
    "lc": "en"
}

print("Sending payload:", payload)

try:
    resp = reqs.post(url, json=payload, headers=headers, impersonate="chrome120", timeout=10)
    print("Status code:", resp.status_code)
    if resp.status_code == 200:
        data = resp.json()
        print("Response data:")
        print(json.dumps(data, indent=2))
    else:
        print("Response text:", resp.text[:500])
except Exception as e:
    print("Error:", e)
