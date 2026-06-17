import sqlite3
import json
import os
from tqdm import tqdm

# Settings
JSON_DIR = "./all_matches_json"
DB_NAME = "crinava.db"


def build_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    # 1. Create the high-speed table with FULL DETAIL
    print("🏗️ Building detailed table structure...")
    cur.execute("DROP TABLE IF EXISTS deliveries;")
    cur.execute(
        """
        CREATE TABLE deliveries (
            match_id TEXT,
            event_name TEXT,
            season TEXT,
            match_date TEXT,
            venue_name TEXT,
            city TEXT,
            match_type TEXT,
            innings_no INTEGER,
            over_no INTEGER,
            ball_no INTEGER,
            batter_id TEXT,
            bowler_id TEXT,
            runs_batter INTEGER,
            runs_extras INTEGER,
            runs_total INTEGER,
            wicket_player_out TEXT,
            wicket_kind TEXT
        );
    """
    )

    # 2. Process JSONs and Insert in Bulk
    all_files = [f for f in os.listdir(JSON_DIR) if f.endswith(".json")]
    batch = []

    for filename in tqdm(all_files, desc="Processing Matches"):
        try:
            with open(os.path.join(JSON_DIR, filename), "r") as f:
                data = json.load(f)
                mid = filename.split(".")[0]
                info = data.get("info", {})
                event = info.get("event", {}).get("name") or info.get(
                    "series_name", "Unknown"
                )
                season = str(info.get("season", "Unknown"))
                date = info.get("dates", [""])[0]
                venue = info.get("venue", "Unknown")
                city = info.get("city", "Unknown")
                m_type = info.get("match_type", "T20")

                for inning in data.get("innings", []):
                    inn_no = (
                        1
                        if inning.get("team") == info.get("teams", [None, None])[0]
                        else 2
                    )
                    for over in inning.get("overs", []):
                        o_no = over.get("over")
                        for b_no, delivery in enumerate(over.get("deliveries", []), 1):
                            runs = delivery.get("runs", {})
                            wicket = delivery.get("wicket", {})
                            batch.append(
                                (
                                    mid,
                                    event,
                                    season,
                                    date,
                                    venue,
                                    city,
                                    m_type,
                                    inn_no,
                                    o_no,
                                    b_no,
                                    delivery.get("batter"),
                                    delivery.get("bowler"),
                                    runs.get("batter", 0),
                                    runs.get("extras", 0),
                                    runs.get("total", 0),
                                    wicket.get("player_out"),
                                    wicket.get("kind"),
                                )
                            )

            if len(batch) > 100000:
                cur.executemany(
                    "INSERT INTO deliveries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    batch,
                )
                batch = []
                conn.commit()
        except Exception:
            continue

    if batch:
        cur.executemany(
            "INSERT INTO deliveries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", batch
        )
        conn.commit()

    # 3. Create Indexes for Millisecond Speed
    print("⚡ Creating lightning-fast indexes...")
    cur.execute("CREATE INDEX idx_match ON deliveries(match_id);")
    cur.execute("CREATE INDEX idx_series ON deliveries(event_name, season);")
    cur.execute("CREATE INDEX idx_player ON deliveries(batter_id);")

    print(f"✅ DONE! {DB_NAME} created successfully.")
    conn.close()


if __name__ == "__main__":
    build_db()
