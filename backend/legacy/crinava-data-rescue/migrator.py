import os
import zipfile
import json
import psycopg2
import pymysql
import time
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# CLOUD SMART: This detects your Hugging Face Secrets automatically
load_dotenv() 

# Shared progress variable
progress = {
    "status": "Standby",
    "current": 0,
    "total": 0,
    "start_time": 0,
    "cr_status": "OFF",
    "ti_status": "OFF",
    "eta": "N/A"
}

def migrate():
    global progress
    progress["status"] = "RESCUE_ACTIVE"
    progress["start_time"] = time.time()
    
    # FETCH SECRETS FROM HUGGING FACE
    COCKROACH_URL = os.getenv("COCKROACH_URL")
    TIDB_URL = os.getenv("TIDB_URL")
    ZIP_FILE_NAME = "matches.zip"

    # FORCE SSL MODE (Fixes the root.crt error on Hugging Face)
    if COCKROACH_URL and "sslmode=" in COCKROACH_URL:
        base_url = COCKROACH_URL.split("?")[0]
        COCKROACH_URL = f"{base_url}?sslmode=require"

    print(f"--- [HEARTBEAT 1] Engine Started ---")
    
    conn_cr = None
    conn_ti = None

    try:
        # 1. CockroachDB Connection (With 5s Timeout)
        if COCKROACH_URL:
            try:
                print(f"--- [HEARTBEAT 2] Trying CockroachDB... ---")
                conn_cr = psycopg2.connect(COCKROACH_URL, connect_timeout=5)
                cur_cr = conn_cr.cursor()
                cur_cr.execute("CREATE TABLE IF NOT EXISTS match_deliveries (match_id TEXT, ball_number FLOAT, runs_scored INT, metadata JSONB, UNIQUE(match_id, ball_number))")
                conn_cr.commit()
                progress["cr_status"] = "ACTIVE"
                print(f"--- [HEARTBEAT 3] CockroachDB SUCCESS! ---")
            except Exception as e:
                print(f"[SKIP] CockroachDB Connection failed: {e}")

        # 2. TiDB Connection (Backup)
        if TIDB_URL:
            try:
                print(f"--- [HEARTBEAT 3b] Trying TiDB Cloud... ---")
                import urllib.parse as urlparse
                url = urlparse.urlparse(TIDB_URL)
                conn_ti = pymysql.connect(
                    host=url.hostname, user=url.username, password=url.password,
                    port=url.port or 4000, database=url.path[1:],
                    ssl={'ca': '/etc/ssl/certs/ca-certificates.crt'},
                    connect_timeout=5
                )
                cur_ti = conn_ti.cursor()
                cur_ti.execute("CREATE TABLE IF NOT EXISTS match_deliveries (match_id VARCHAR(100), ball_number FLOAT, runs_scored INT, metadata JSON, PRIMARY KEY (match_id, ball_number))")
                conn_ti.commit()
                progress["ti_status"] = "ACTIVE"
                print(f"--- [HEARTBEAT 3c] TiDB SUCCESS! ---")
            except Exception as e:
                print(f"[SKIP] TiDB failed: {e}")

        if not conn_cr and not conn_ti:
            print("[FATAL] NO DATABASES COULD CONNECT.")
            progress["status"] = "DB_FAILED"
            return

        # 3. Zip File Processing
        print(f"--- [HEARTBEAT 4] Opening {ZIP_FILE_NAME}... ---")
        if not os.path.exists(ZIP_FILE_NAME):
            print(f"[ERROR] {ZIP_FILE_NAME} NOT FOUND!")
            progress["status"] = "ZIP_MISSING"
            return

        with zipfile.ZipFile(ZIP_FILE_NAME, 'r') as z:
            all_files = [f for f in z.namelist() if f.endswith('.json')]
            progress["total"] = len(all_files)
            print(f"--- [HEARTBEAT 5] Found {len(all_files)} files. Starting first insert... ---")

            for i, file_name in enumerate(all_files):
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
                    
                    rows = []
                    for d in deliveries:
                        ball_num = d.get('ball', 0)
                        runs = 0
                        if isinstance(d.get('runs'), dict):
                            runs = d.get('runs', {}).get('total', 0)
                        else:
                            runs = d.get('runs', 0)
                        rows.append((match_id, ball_num, runs, json.dumps(d)))
                    
                    if conn_cr and len(rows) > 0:
                        execute_values(cur_cr, "INSERT INTO match_deliveries (match_id, ball_number, runs_scored, metadata) VALUES %s ON CONFLICT (match_id, ball_number) DO UPDATE SET runs_scored = EXCLUDED.runs_scored", rows)
                        conn_cr.commit()

                    if conn_ti and len(rows) > 0:
                        cur_ti.executemany("INSERT INTO match_deliveries (match_id, ball_number, runs_scored, metadata) VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE runs_scored = VALUES(runs_scored)", rows)
                        conn_ti.commit()

                progress["current"] = i + 1
                elapsed = time.time() - progress["start_time"]
                m_per_sec = (i + 1) / elapsed if elapsed > 0 else 0
                if (i + 1) % 20 == 0 or i == 0:
                    print(f"[RESCUE] Match {i+1}/{progress['total']} | Speed: {round(m_per_sec, 1)} m/s")

        progress["status"] = "FINISHED"
        print("--- MISSION COMPLETE ---")

    except Exception as e:
        progress["status"] = "FAILED"
        print(f"[FATAL] {e}")
    finally:
        if conn_cr: conn_cr.close()
        if conn_ti: conn_ti.close()
