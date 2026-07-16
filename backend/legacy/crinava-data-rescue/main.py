import os
import time
import threading
import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from stealth_manager import get_stealth_headers, jitter_delay
import migrator 

app = FastAPI()

# PROTECTION
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ENGINE_SECRET_KEY = os.getenv("ENGINE_SECRET_KEY")

# --- DASHBOARD ---
@app.get("/", response_class=HTMLResponse)
def dashboard():
    prog = migrator.progress
    percent = (prog["current"] / prog["total"] * 100) if prog["total"] > 0 else 0
    
    return f"""
    <html>
        <head>
            <title>Crinava Data Rescue</title>
            <meta http-equiv="refresh" content="3"> 
            <style>
                body {{ background: #020617; color: #38bdf8; font-family: 'Courier New', monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }}
                .console {{ background: #0f172a; padding: 30px; border-radius: 12px; border: 1px solid #1e293b; box-shadow: 0 0 30px rgba(56,189,248,0.3); width: 500px; }}
                h1 {{ color: #f1f5f9; font-size: 1.3rem; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-top: 0; text-align: center; }}
                .stat {{ display: flex; justify-content: space-between; margin: 12px 0; font-size: 0.9rem; }}
                .value {{ color: #10b981; font-weight: bold; text-shadow: 0 0 8px #10b981; }}
                .progress-bg {{ background: #1e293b; height: 25px; border-radius: 5px; margin-top: 25px; overflow: hidden; border: 1px solid #334155; }}
                .progress-fill {{ background: linear-gradient(90deg, #2563eb, #10b981); height: 100%; width: {percent}%; transition: width 1s ease; }}
                .eta-box {{ text-align: center; font-size: 0.8rem; margin-top: 12px; color: #94a3b8; }}
                .db-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 25px; font-size: 0.75rem; }}
                .db-card {{ background: #020617; padding: 12px; border-radius: 6px; border: 1px solid #1e293b; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="console">
                <h1>CRINAVA DATA RESCUE</h1>
                <div class="stat"><span>RESCUE STATUS:</span> <span class="value">{prog["status"]}</span></div>
                <div class="stat"><span>MATCHES SAVED:</span> <span class="value">{prog["current"]} / {prog["total"]}</span></div>
                <div class="progress-bg"><div class="progress-fill"></div></div>
                <div class="eta-box">ESTIMATED TIME REMAINING: <span style="color:#f1f5f9">{prog["eta"]}</span></div>
                <div class="db-grid">
                    <div class="db-card"><p style="margin:0; color:#94a3b8">COCKROACH DB</p><p style="margin:5px 0 0 0; color:#10b981">{prog["cr_status"]}</p></div>
                    <div class="db-card"><p style="margin:0; color:#94a3b8">TiDB CLOUD</p><p style="margin:5px 0 0 0; color:#10b981">{prog["ti_status"]}</p></div>
                </div>
                <p style="font-size:0.6rem; color:#475569; text-align:center; margin-top:25px;">
                    <a href="/start-migration" style="color:#3b82f6; text-decoration:none; font-weight:bold; font-size:0.9rem;">[ INITIATE CLOUD RESCUE ]</a>
                </p>
            </div>
        </body>
    </html>
    """

@app.get("/start-migration")
def start_migration():
    if migrator.progress["status"] == "RESCUE_ACTIVE":
        return {"status": "Already running"}
    thread = threading.Thread(target=migrator.migrate)
    thread.daemon = True
    thread.start()
    return {"status": "Migration Started", "message": "Hugging Face is now rescuing your data."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
