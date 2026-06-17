from fastapi import FastAPI, Query
import sqlite3
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]
env_origins = os.environ.get("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect("crinava.db")
    # Attach the metadata database
    try:
        conn.execute("ATTACH DATABASE 'meta.db' AS meta")
    except:
        pass
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/")
def home():
    return {"status": "Crinava Engine Online (Hybrid Mode)"}

@app.get("/series")
def get_series():
    conn = get_db()
    cur = conn.cursor()
    # Pull series from the tiny meta table (much faster!)
    try:
        cur.execute("SELECT event as event_name, season, COUNT(*) as match_count FROM meta.matches GROUP BY event, season ORDER BY season DESC")
    except:
        cur.execute("SELECT event_name, season, COUNT(DISTINCT match_id) as match_count FROM deliveries GROUP BY event_name, season ORDER BY season DESC")
    
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

@app.get("/matches")
def get_matches(event: str, season: str):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT match_id, date as match_date, team_1, team_2, winner, result, by_runs, by_wickets, venue, city
            FROM meta.matches 
            WHERE event = ? AND season = ?
            ORDER BY date DESC
        """, (event, season))
    except:
        cur.execute("SELECT DISTINCT match_id, match_date, venue_name FROM deliveries WHERE event_name = ? AND season = ?", (event, season))
    
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

@app.get("/match/{match_id}")
def get_match_details(match_id: str):
    conn = get_db()
    cur = conn.cursor()
    
    # Fetch deliveries
    cur.execute("SELECT * FROM deliveries WHERE match_id = ? ORDER BY innings_no, over_no, ball_no", (match_id,))
    deliveries = [dict(row) for row in cur.fetchall()]
    
    # Fetch metadata for this match
    meta = {}
    try:
        cur.execute("SELECT * FROM meta.matches WHERE match_id = ?", (match_id,))
        meta = dict(cur.fetchone())
    except:
        pass
        
    conn.close()
    return {"deliveries": deliveries, "info": meta}
