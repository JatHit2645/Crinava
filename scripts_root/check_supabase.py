import os
import urllib.request
import json

# Manually parse .env
env_vars = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("=", 1)
        if len(parts) == 2:
            key = parts[0].strip()
            val = parts[1].strip().strip('"').strip("'")
            env_vars[key] = val

url = env_vars.get("VITE_SUPABASE_URL")
key = env_vars.get("VITE_SUPABASE_ANON_KEY")

if not url or not key:
    print("Missing env variables in parsed .env")
    exit(1)

req = urllib.request.Request(
    f"{url}/rest/v1/badges?select=*",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        print("Success! Table exists.")
        print(html[:200])
except Exception as e:
    print("Error querying table:")
    print(e)
