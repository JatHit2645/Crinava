"""Probe script to find where Crex stores player ID -> name mappings.

Tests multiple API endpoints and HTML extraction methods.
"""

import json
import re
import sys
import os

sys.path.insert(0, ".")
from stealth import stealth_session
import curl_cffi.requests as reqs

MATCH_KEY = "11ZJ"  # A recently finished match for testing

print("=" * 60)
print("PROBE 1: getSC4 (Scorecard API) - check response structure")
print("=" * 60)
try:
    r = stealth_session.request(
        "GET", f"https://api.goscorer.com/api/v3/getSC4?key={MATCH_KEY}", timeout=10
    )
    sc = r.json()
    print(f"Type: {type(sc)}, Length: {len(sc) if isinstance(sc, list) else 'N/A'}")
    if isinstance(sc, list) and len(sc) > 0:
        inn = sc[0]
        print(f"Innings keys: {list(inn.keys())}")
        if "b" in inn:
            print(f"First 3 batting entries: {inn['b'][:3]}")
        if "a" in inn:
            print(f"First 3 bowling entries: {inn['a'][:3]}")
        # Check if there's a player map key in the response itself
        for k in inn.keys():
            if k not in ("a", "b", "d", "e", "p", "f"):
                print(f"  Extra key '{k}': {str(inn[k])[:200]}")
except Exception as e:
    print(f"Error: {e}")

print()
print("=" * 60)
print("PROBE 2: getSV3 (Live Score API) - check for player data")
print("=" * 60)
try:
    r = stealth_session.request(
        "GET", f"https://api.goscorer.com/api/v3/getSV3?key={MATCH_KEY}", timeout=10
    )
    sv = r.json()
    print(f"Top-level keys: {list(sv.keys())}")
    # Print all keys and short values to find player names
    for k, v in sv.items():
        val_str = str(v)
        if len(val_str) > 200:
            val_str = f"{val_str[:200]}..."
        print(f"  {k}: {val_str}")
except Exception as e:
    print(f"Error: {e}")

print()
print("=" * 60)
print("PROBE 3: getMapData / getMatchMapData endpoints")
print("=" * 60)
map_urls = [
    f"https://oc.crickapi.com/mapping/getMapData?key={MATCH_KEY}",
    f"https://oc.crickapi.com/mapping/getMatchMapData?key={MATCH_KEY}",
    f"https://api.goscorer.com/api/v3/getMapData?key={MATCH_KEY}",
    "https://oc.crickapi.com/mapping/getHomeMapData",
    f"https://api.goscorer.com/api/v3/getMatchInfo?key={MATCH_KEY}",
]
for url in map_urls:
    try:
        r = stealth_session.request("GET", url, timeout=5)
        print(f"  {url}")
        print(f"    Status: {r.status_code}")
        if r.status_code == 200:
            try:
                d = r.json()
                txt = json.dumps(d)
                print(f"    Response ({len(txt)} chars): {txt[:300]}...")
            except Exception:
                print(f"    Text: {r.text[:300]}")
    except Exception as e:
        print(f"  {url} -> Error: {e}")

print()
print("=" * 60)
print("PROBE 4: getBallFeeds - check for player names in commentary")
print("=" * 60)
try:
    feeds_url = "https://content.crickapi.com/commentary/v3/getBallFeeds"
    payload = {"matchKey": MATCH_KEY, "lastDocId": None, "filters": {}}
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "authorization": os.environ.get("CREX_AUTHORIZATION_TOKEN", ""),
        "cc": "IN",
        "Origin": "https://crex.com",
        "Referer": "https://crex.com/",
    }
    r = reqs.post(
        feeds_url, json=payload, headers=headers, impersonate="chrome120", timeout=5
    )
    if r.status_code == 200:
        feeds = r.json()
        if isinstance(feeds, list) and len(feeds) > 0:
            print(f"Got {len(feeds)} feed items")
            # Look for items with player-name-like content
            for item in feeds[:5]:
                print(f"  type={item.get('type')}, keys={list(item.keys())}")
                # Print the 'c' or 'cc1' field if present
                for field in ("c", "cc1", "cc2", "n", "pn", "playerName"):
                    if field in item:
                        print(f"    {field}: {str(item[field])[:200]}")
    else:
        print(f"Status: {r.status_code}")
except Exception as e:
    print(f"Error: {e}")

print()
print("=" * 60)
print("PROBE 5: Crex HTML __NEXT_DATA__ extraction")
print("=" * 60)
try:
    match_url = f"https://crex.com/cricket-live-score/swe-vs-mlt-15th-match-mens-t20-world-cup-europe-sub-regional-qualifier-a-2026-match-updates-{MATCH_KEY}"
    r = stealth_session.request("GET", match_url, timeout=10)
    html = r.text
    print(f"HTML length: {len(html)}")

    # Check __NEXT_DATA__
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if m:
        nd = json.loads(m.group(1))
        print(f"__NEXT_DATA__ keys: {list(nd.keys())}")

        # Drill into props -> pageProps
        props = nd.get("props", {})
        pp = props.get("pageProps", {})
        print(f"  pageProps keys: {list(pp.keys())}")

        # Look for any key that looks like player data
        for k, v in pp.items():
            val_str = json.dumps(v) if not isinstance(v, str) else v
            if len(val_str) > 500:
                print(f"  pageProps.{k}: ({len(val_str)} chars) {val_str[:300]}...")
            else:
                print(f"  pageProps.{k}: {val_str}")
    else:
        print("No __NEXT_DATA__ found")

    # Check __crexData
    m2 = re.search(r"__crexData\s*=\s*({[^}]*})[;\n]", html)
    if m2:
        print(f"__crexData found: {m2.group(1)[:300]}")
    else:
        print("No __crexData found")

except Exception as e:
    print(f"Error: {e}")

print()
print("=" * 60)
print("PROBE 6: Try Crex scorecard page (not match-updates)")
print("=" * 60)
try:
    sc_url = f"https://crex.com/cricket-live-score/swe-vs-mlt-15th-match-mens-t20-world-cup-europe-sub-regional-qualifier-a-2026-scorecard-{MATCH_KEY}"
    r = stealth_session.request("GET", sc_url, timeout=10)
    html = r.text
    print(f"Scorecard page HTML length: {len(html)}")

    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if m:
        nd = json.loads(m.group(1))
        pp = nd.get("props", {}).get("pageProps", {})
        print(f"  pageProps keys: {list(pp.keys())}")

        for k, v in pp.items():
            val_str = json.dumps(v) if not isinstance(v, str) else v
            if len(val_str) > 500:
                print(f"  pageProps.{k}: ({len(val_str)} chars) {val_str[:300]}...")
            else:
                print(f"  pageProps.{k}: {val_str}")
    else:
        print("No __NEXT_DATA__ found on scorecard page")
except Exception as e:
    print(f"Error: {e}")
