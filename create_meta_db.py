import sqlite3
import json
import os
from tqdm import tqdm

# Directory where raw match JSON files are stored (adjust if needed)
JSON_DIR = "./all_matches_json"  # <-- place your JSON files here
DB_PATH = "meta.db"

def create_meta_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS matches")
    cur.execute(
        """
        CREATE TABLE matches (
            match_id TEXT PRIMARY KEY,
            event_name TEXT,
            season TEXT,
            team_1 TEXT,
            team_2 TEXT,
            winner TEXT,
            result TEXT,
            by_runs INTEGER,
            by_wickets INTEGER,
            toss_winner TEXT,
            toss_decision TEXT,
            venue TEXT,
            city TEXT,
            date TEXT,
            player_of_match TEXT,
            umpires TEXT
        )
        """
    )

    files = [f for f in os.listdir(JSON_DIR) if f.endswith('.json')]
    batch = []
    for fn in tqdm(files, desc="Extracting metadata"):
        try:
            with open(os.path.join(JSON_DIR, fn), 'r') as f:
                data = json.load(f)
            info = data.get('info', {})
            outcome = info.get('outcome', {})
            teams = info.get('teams', [None, None])
            team_1, team_2 = teams[0], teams[1]
            winner = outcome.get('winner')
            result = outcome.get('result')
            by = outcome.get('by', {})
            by_runs = by.get('runs')
            by_wickets = by.get('wickets')
            toss = info.get('toss', {})
            venue = info.get('venue')
            city = info.get('city')
            date = info.get('dates', [None])[0]
            season = str(info.get('season')) if info.get('season') is not None else None
            potm = ", ".join(info.get('player_of_match', []))
            umpires = ", ".join(info.get('officials', {}).get('umpires', []))
            match_id = fn.replace('.json', '')
            batch.append((match_id, info.get('event_name') or info.get('series_name'), season, team_1, team_2, winner, result, by_runs, by_wickets,
                         toss.get('winner'), toss.get('decision'), venue, city, date, potm, umpires))
        except Exception:
            continue
    cur.executemany(
        "INSERT INTO matches VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", batch)
    conn.commit()
    conn.close()
    print(f"✅ meta.db created with {len(batch)} records (size ~ {os.path.getsize(DB_PATH)/1024/1024:.2f} MB)")

if __name__ == "__main__":
    create_meta_db()
