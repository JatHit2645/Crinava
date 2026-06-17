import httpx

target = "socket.crex.com"
url = f"https://dns.google/resolve?name={target}"

print(f"Resolving {target} via Google DNS API...")
try:
    resp = httpx.get(url)
    data = resp.json()
    answers = data.get("Answer", [])
    if answers:
        ip = answers[0]["data"]
        print(f"IP FOUND: {ip}")
        # Store it for the worker
        with open("socket_ip.txt", "w") as f:
            f.write(ip)
    else:
        print("No A record found.")
except Exception as e:
    print(f"API Resolution Failed: {e}")
