"""Module docstring."""

import socket
import httpx

target = "socket.crex.com"
print(f"Resolving {target}...")
try:
    ip = socket.gethostbyname(target)
    print(f"IP: {ip}")
except Exception as e:
    print(f"DNS Resolution Failed: {e}")

# Try direct HTTP check
print("Testing HTTPS connection to crex.com...")
try:
    with httpx.Client() as client:
        resp = client.get("https://crex.com", timeout=10)
        print(f"crex.com Status: {resp.status_code}")
except Exception as e:
    print(f"crex.com unreachable: {e}")
