import os
import zipfile
import json
import psycopg2
import pymysql
import time
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from pathlib import Path

# Load secrets
env_path = Path(r"C:\Users\hp\.gemini\antigravity\scratch\Crinava-main\.env")
load_dotenv(dotenv_path=env_path)

# Shared progress variable
progress = {
    "status": "Standby",
    "current": 0,
    "total": 0,
    "start_time": 0,
    "cr_status": "\ud83d\udd34",
    "ti_status": "\ud83d\udd34",
    "eta": "N/A"
}

def migrate():
    global progress
    progress["status"] = "RESCUE_ACTIVE"
    progress["start_time"] = time.time()
    
    COCKROACH_URL = os.getenv("COCKROACH_URL")
    TIDB_URL = os.getenv("TIDB_URL")
    ZIP_FILE_NAME = "matches.zip"

    print("[SYSTEM] Initializing Dual-Engine Migration...")
    
    conn_cr = None
    conn_ti = None

    try:
        # 1. CockroachDB Connection
        if COCKROACH_URL:
            try:
                conn_cr = psycopg2.connect(COCKROACH_URL)
                cur_cr = conn_cr.cursor()
                cur_cr.execute("CREATE TABLE IF NOT EXISTS match_deliveries (match_id TEXT, ball_number FLOAT, runs_scored INT, metadata JSONB, UNIQUE(match_id, ball_number))")
                conn_cr.commit()
                progress["cr_status"] = "\ud83d\udfe2 ACTIVE"
                print("[DB] CockroachDB Tunnel Opened.")
            except Exception as e:
                print(f"[DB] CockroachDB Error: {e}")

        # 2. TiDB Connection
        if TIDB_URL:
            try:
                import urllib.parse as urlparse
                url = urlparse.urlparse(TIDB_URL)
                conn_ti = pymysql.connect(
                    host=url.hostname, user=url.username, password=url.password,
                    port=url.port or 4000, database=url.path[1:],
                    ssl={'ca': '/etc/ssl/certs/ca-certificates.crt'}
                )
                cur_ti = conn_ti.cursor()
                cur_ti.execute("CREATE TABLE IF NOT EXISTS match_deliveries (match_id VARCHAR(100), ball_number FLOAT, runs_scored INT, metadata JSON, PRIMARY KEY (match_id, ball_number))")
                conn_ti.commit()
                progress["ti_status"] = "\ud83d\udfe2 ACTIVE"
                print("[DB] TiDB Cloud Tunnel Opened.")
            except Exception as e:
                print(f"[DB] TiDB Error: {e}")

        # 3. Process Zip
        with zipfile.ZipFile(ZIP_FILE_NAME, 'r') as z:
            all_files = [f for f in z.namelist() if f.endswith('.json')]
            progress["total"] = len(all_files)
            print(f"[SCAN] Found {len(all_files)} matches in Zip Archive.")

            for i, file_name in enumerate(all_files):
                start_match_time = time.time()
                with z.open(file_name) as f:
                    data = json.load(f)
                    match_id = str(data.get('match_id', file_name)) # Force String
                    deliveries = data.get('deliveries', [])
                    
                    rows = []
                    for d in deliveries:
                        rows.append((match_id, d.get('ball'), d.get('runs'), json.dumps(d)))
                    
                    # UPSERT CockroachDB
                    if conn_cr:
                        execute_values(cur_cr, """
                            INSERT INTO match_deliveries VALUES %s 
                            ON CONFLICT (match_id, ball_number) DO UPDATE SET runs_scored = EXCLUDED.runs_scored
                        """, rows)
                        conn_cr.commit()

                    # UPSERT TiDB
                    if conn_ti:
                        cur_ti.executemany("""
                            INSERT INTO match_deliveries (match_id, ball_number, runs_scored, metadata) 
                            VALUES (%s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE runs_scored = VALUES(runs_scored)
                        """, rows)
                        conn_ti.commit()

                # Progress Logic
                progress["current"] = i + 1
                elapsed = time.time() - progress["start_time"]
                matches_per_sec = (i + 1) / elapsed
                remaining = progress["total"] - progress["current"]
                eta_sec = remaining / matches_per_sec
                progress["eta"] = f"{int(eta_sec // 60)}m {int(eta_sec % 60)}s"

                # FUN LOGS
                if (i + 1) % 10 == 0 or i == 0:
                    print(f"[\ud83d\udce6 RESCUE] {match_id} | {i+1}/{progress['total']} | Speed: {round(matches_per_sec, 2)} m/s | Time: {progress['eta']}")

        progress["status"] = "FINISHED"
        print("[\ud83c\udfc6 SUCCESS] All matches successfully relocated.")

    except Exception as e:
        progress["status"] = "FAILED"
        print(f"[\ud83d\udca5 FATAL] {e}")
    finally:
        if conn_cr: conn_cr.close()
        if conn_ti: conn_ti.close()
