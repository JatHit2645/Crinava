import os
import zipfile
import json
import psycopg2
import time
from psycopg2.extras import execute_values

# YOUR COCKROACH URL
COCKROACH_URL = os.environ.get("COCKROACH_URL", "")

def find_zip():
    options = ["matches.zip.zip", "matches.zip"]
    for opt in options:
        if os.path.exists(opt):
            return opt
    return None

def start_rescue():
    print("--- 🚀 LOCAL TURBO RESCUE 2.0 STARTED ---")
    
    zip_to_use = find_zip()
    if not zip_to_use:
        print(f"❌ ERROR: Zip file not found!")
        return

    try:
        print("🔗 Connecting to CockroachDB...")
        conn = psycopg2.connect(COCKROACH_URL)
        cur = conn.cursor()
        
        cur.execute("CREATE TABLE IF NOT EXISTS match_deliveries (match_id TEXT, ball_number FLOAT, runs_scored INT, metadata JSONB, UNIQUE(match_id, ball_number))")
        conn.commit()
        print("✅ Database Ready!")

        start_time = time.time()
        
        with zipfile.ZipFile(zip_to_use, 'r') as z:
            all_files = [f for f in z.namelist() if f.endswith('.json')]
            total = len(all_files)
            print(f"🚀 Processing {total} matches...")

            for i, file_name in enumerate(all_files):
                try:
                    with z.open(file_name) as f:
                        data = json.load(f)
                        match_id = str(data.get('match_id', file_name))
                        
                        deliveries = []
                        if 'deliveries' in data:
                            deliveries = data['deliveries']
                        elif 'innings' in data:
                            for inning in data['innings']:
                                for over in inning.get('overs', []):
                                    for ball in over.get('deliveries', []):
                                        deliveries.append(ball)
                        
                        seen_balls = set()
                        rows = []
                        for d in deliveries:
                            ball_num = float(d.get('ball', 0))
                            
                            # CRITICAL: Skip if we already saw this ball in this specific match
                            if ball_num in seen_balls:
                                continue
                            seen_balls.add(ball_num)
                            
                            runs = d.get('runs', {}).get('total', 0) if isinstance(d.get('runs'), dict) else d.get('runs', 0)
                            rows.append((match_id, ball_num, runs, json.dumps(d)))
                        
                        if len(rows) > 0:
                            execute_values(cur, "INSERT INTO match_deliveries (match_id, ball_number, runs_scored, metadata) VALUES %s ON CONFLICT (match_id, ball_number) DO UPDATE SET runs_scored = EXCLUDED.runs_scored", rows)
                            conn.commit()

                    if (i + 1) % 10 == 0 or i == 0:
                        elapsed = time.time() - start_time
                        speed = (i + 1) / elapsed if elapsed > 0 else 0
                        print(f"⚡ Progress: {i+1}/{total} | Speed: {round(speed, 1)} matches/sec")
                
                except Exception as match_err:
                    print(f"⚠️ Warning: Skipping {file_name} | Error: {match_err}")
                    # RESET THE CONNECTION STATE SO THE NEXT MATCH CAN WORK
                    conn.rollback()
                    continue

        print("\n--- 🎉 MISSION COMPLETE! ---")

    except Exception as e:
        print(f"❌ FATAL ERROR: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    start_rescue()
