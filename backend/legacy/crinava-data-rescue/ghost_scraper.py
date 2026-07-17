import requests
import psycopg2
import json
import time
import os
from datetime import datetime
from psycopg2.extras import execute_values

# --- ⚙️ CONFIGURATION ---
COCKROACH_URL = os.environ.get("COCKROACH_URL", "")
TARGET_TABLE = "match_deliveries_v3"
POLL_INTERVAL = 3  # Seconds between live updates

def transform_to_detailed_url(url):
    """Swaps scorecard for all_deliveries to get the 23-column rich data."""
    if "get_scorecard" in url:
        return url.replace("get_scorecard", "get_all_deliveries")
    return url

def scrape_match_v6(target_url, cur):
    """
    ULTRA ENGINE v6.0: Live Ball-by-Ball to Master Schema (v3)
    Supports: Registry IDs, DRS, Wickets, and Multi-Fielder data.
    """
    detailed_url = transform_to_detailed_url(target_url)
    
    try:
        match_id = detailed_url.split('/get_all_deliveries/')[1].split('?')[0]
    except:
        try:
            match_id = detailed_url.split('/get_scorecard/')[1].split('?')[0]
        except:
            return False, "Invalid URL format"
            
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://scorecard.oddstrad.com/",
        "Origin": "https://scorecard.oddstrad.com"
    }

    try:
        response = requests.get(detailed_url, headers=headers, timeout=5)
        data = response.json()
        
        # Check for Sportradar API Errors
        if "doc" in data and data["doc"][0].get("event") == "exception":
            return False, f"TOKEN EXPIRED or RESTRICTED for {match_id}"

        # Root of Sportradar Match Data
        match_doc = data["doc"][0]["data"]
        
        # 1. Extract Registry (People IDs)
        # Sportradar usually provides this in the 'info' or 'teams' section for live feeds
        reg = {}
        if "teams" in match_doc:
            for team in match_doc["teams"]:
                for player in team.get("players", []):
                    p_name = player.get("name")
                    p_id = player.get("id") # Usually numeric STRING
                    if p_name and p_id:
                        reg[p_name] = p_id

        # 2. Extract Match Metadata
        info = match_doc.get("matchInfo", {})
        ctx = {
            'date': info.get("startDate", datetime.now().strftime("%Y-%m-%d")),
            'venue': info.get("venue", {}).get("name", "Unknown Venue"),
            'city': info.get("venue", {}).get("city", "Unknown City"),
            'type': info.get("matchType", "T20"),
            'gender': "male" # Defaulting for live feeds unless specified
        }

        # 3. Process Innings & Deliveries
        # Note: Sportradar Live JSON structure can slightly differ from Archive JSON
        # but 'innings' -> 'overs' -> 'deliveries' is the standard pattern.
        innings_data = match_doc.get("innings", [])
        if not innings_data:
            return False, f"No innings data yet for {match_id}"

        all_balls = []
        for i_idx, inning in enumerate(innings_data):
            inn_no = i_idx + 1
            for over_data in inning.get("overs", []):
                over_no = over_data.get("overNumber", 0)
                for b_idx, d in enumerate(over_data.get("deliveries", [])):
                    # Extract IDs with robust fallback
                    batter = d.get("batter", "none")
                    bowler = d.get("bowler", "none")
                    non_striker = d.get("nonStriker", "none")
                    
                    b_id = reg.get(batter, batter)
                    bw_id = reg.get(bowler, bowler)
                    ns_id = reg.get(non_striker, non_striker)
                    
                    # Wicket Logic
                    wicket = d.get("wicket", {})
                    w_p_name = wicket.get("playerOut", "none")
                    w_p_id = reg.get(w_p_name, w_p_name)
                    w_kind = wicket.get("kind", "none")
                    
                    # Multi-Fielder Support
                    w_f_list = []
                    for f_name in wicket.get("fielders", []):
                        f_id = reg.get(f_name, f_name)
                        if f_id: w_f_list.append(str(f_id))
                    w_f = ",".join(w_f_list) if w_f_list else "none"
                    
                    # Runs & Extras
                    runs_b = d.get("runs", 0)
                    runs_e = d.get("extras", 0)
                    runs_t = runs_b + runs_e
                    ex_type = d.get("extraType", "none")
                    
                    # DRS / Review
                    is_rev = bool(d.get("review"))
                    rev_out = d.get("reviewDecision", "none")
                    
                    # Replacements
                    repl = json.dumps(d.get("replacements", {}))

                    # Unique ID for Live Stream
                    delivery_id = f"LIVE_{match_id}_{inn_no}_{over_no}_{b_idx+1}"

                    all_balls.append((
                        delivery_id, match_id, inn_no, over_no, b_idx+1,
                        b_id, bw_id, ns_id,
                        runs_b, runs_e, runs_t,
                        w_p_id, w_kind, ex_type, w_f,
                        ctx['date'], ctx['venue'], ctx['city'], ctx['type'], ctx['gender'],
                        is_rev, rev_out, repl
                    ))

        if all_balls:
            execute_values(cur, f"""
                INSERT INTO {TARGET_TABLE} (
                    delivery_id, match_id, innings, over, ball,
                    batter_id, bowler_id, non_striker_id,
                    runs_batter, runs_extras, runs_total,
                    wicket_player_out, wicket_kind, extra_type, wicket_fielder_id,
                    match_date, venue, city, match_type, gender,
                    is_reviewed, review_outcome, replacements
                ) VALUES %s 
                ON CONFLICT (delivery_id) DO UPDATE SET
                    runs_batter = EXCLUDED.runs_batter,
                    runs_extras = EXCLUDED.runs_extras,
                    runs_total = EXCLUDED.runs_total,
                    wicket_player_out = EXCLUDED.wicket_player_out,
                    wicket_kind = EXCLUDED.wicket_kind,
                    wicket_fielder_id = EXCLUDED.wicket_fielder_id,
                    review_outcome = EXCLUDED.review_outcome
            """, all_balls)
            
        return True, f"Synced {len(all_balls)} balls for Match {match_id}"

    except Exception as e:
        return False, f"Error on {match_id}: {str(e)}"

if __name__ == "__main__":
    print(f"--- 📡 GHOST ENGINE v6.0: MASTER SCHEMA SYNC ---")
    print(f"Target Table: {TARGET_TABLE}")
    
    while True:
        now = datetime.now().strftime("%H:%M:%S")
        
        # Load URLs from discovery engine output
        urls = []
        if os.path.exists("live_urls.txt"):
            with open("live_urls.txt", "r") as f:
                urls = [line.strip() for line in f if line.strip()]
        
        if not urls:
            print(f"[{now}] 😴 No live matches in live_urls.txt. Waiting...")
            time.sleep(10)
            continue

        try:
            conn = psycopg2.connect(COCKROACH_URL)
            cur = conn.cursor()
            
            for url in urls:
                success, msg = scrape_match_v6(url, cur)
                if success:
                    print(f"[{now}] ✅ {msg}")
                else:
                    print(f"[{now}] ⚠️ {msg}")
            
            conn.commit()
            conn.close()
        except Exception as conn_err:
            print(f"[{now}] ❌ DB ERROR: {conn_err}")
            
        time.sleep(POLL_INTERVAL) 
