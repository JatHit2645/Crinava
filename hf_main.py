"""Module docstring."""

from fastapi import FastAPI
import sqlite3
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

from cors_config import get_allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    """Docstring for get_db."""
    conn = sqlite3.connect("crinava.db")
    # Attach the metadata database
    try:
        conn.execute("ATTACH DATABASE 'meta.db' AS meta")
    except Exception:
        pass
    conn.row_factory = sqlite3.Row
    return conn


@app.get("/")
def home():
    """Docstring for home."""
    return {"status": "Crinava Engine Online (Hybrid Mode)"}


@app.get("/series")
def get_series():
    """Docstring for get_series."""
    conn = get_db()
    cur = conn.cursor()
    # Pull series from the tiny meta table (much faster!)
    try:
        cur.execute(
            "SELECT event as event_name, season, COUNT(*) as match_count FROM meta.matches GROUP BY event, season ORDER BY season DESC"
        )
    except Exception:
        cur.execute(
            "SELECT event_name, season, COUNT(DISTINCT match_id) as match_count FROM deliveries GROUP BY event_name, season ORDER BY season DESC"
        )

    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


@app.get("/matches")
def get_matches(event: str, season: str):
    """Docstring for get_matches."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT match_id, date as match_date, team_1, team_2, winner, result, by_runs, by_wickets, venue, city
            FROM meta.matches 
            WHERE event = ? AND season = ?
            ORDER BY date DESC
        """,
            (event, season),
        )
    except Exception:
        cur.execute(
            "SELECT DISTINCT match_id, match_date, venue_name FROM deliveries WHERE event_name = ? AND season = ?",
            (event, season),
        )

    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


@app.get("/match/{match_id}")
def get_match_details(match_id: str):
    """Docstring for get_match_details."""
    conn = get_db()
    cur = conn.cursor()

    # Fetch deliveries
    cur.execute(
        "SELECT * FROM deliveries WHERE match_id = ? ORDER BY innings_no, over_no, ball_no",
        (match_id,),
    )
    deliveries = [dict(row) for row in cur.fetchall()]

    # Fetch metadata for this match
    meta = {}
    try:
        cur.execute("SELECT * FROM meta.matches WHERE match_id = ?", (match_id,))
        meta = dict(cur.fetchone())
    except Exception:
        pass

    conn.close()
    return {"deliveries": deliveries, "info": meta}
