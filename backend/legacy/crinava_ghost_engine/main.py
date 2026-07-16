import os
import time
import threading
import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from stealth_manager import get_stealth_headers
import migrator 

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ENGINE_SECRET_KEY = os.getenv("ENGINE_SECRET_KEY")
active_robots = {}

# --- ENDPOINTS ---
@app.get("/", response_class=HTMLResponse)
def dashboard():
    prog = migrator.progress
    percent = (prog["current"] / prog["total"] * 100) if prog["total"] > 0 else 0
    
    return f"""
    <html>
        <head>
            <title>Crinava Ghost Console</title>
            <meta http-equiv="refresh" content="3"> 
            <style>
                body {{ background: #0b0f19; color: #60a5fa; font-family: 'Courier New', monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }}
                .console {{ background: #111827; padding: 25px; border-radius: 8px; border: 1px solid #1e293b; box-shadow: 0 0 20px rgba(0,0,0,0.7); width: 500px; }}
                h1 {{ color: #f8fafc; font-size: 1.2rem; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-top: 0; }}
                .stat {{ display: flex; justify-content: space-between; margin: 10px 0; font-size: 0.85rem; }}
                .value {{ color: #10b981; font-weight: bold; }}
                
                /* Progress Bar */
                .progress-bg {{ background: #1e293b; height: 20px; border-radius: 10px; margin-top: 20px; overflow: hidden; border: 1px solid #334155; }}
                .progress-fill {{ background: linear-gradient(90deg, #3b82f6, #10b981); height: 100%; width: {percent}%; transition: width 1s ease-in-out; }}
                
                .eta-box {{ text-align: center; font-size: 0.75rem; margin-top: 10px; color: #94a3b8; }}
                .db-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; font-size: 0.7rem; }}
                .db-card {{ background: #0b0f19; padding: 10px; border-radius: 4px; border: 1px solid #1e293b; }}
            </style>
        </head>
        <body>
            <div class="console">
                <h1>CRINAVA GHOST CONSOLE v1.5</h1>
                <div class="stat"><span>RESCUE STATUS:</span> <span class="value">{prog["status"]}</span></div>
                <div class="stat"><span>MATCHES SAVED:</span> <span class="value">{prog["current"]} / {prog["total"]}</span></div>
                
                <div class="progress-bg"><div class="progress-fill"></div></div>
                <div class="eta-box">ESTIMATED TIME REMAINING: <span style="color:#f8fafc">{prog["eta"]}</span></div>

                <div class="db-grid">
                    <div class="db-card">
                        <p style="margin:0; color:#94a3b8">COCKROACH DB</p>
                        <p style="margin:5px 0 0 0; color:#10b981">{prog["cr_status"]}</p>
                    </div>
                    <div class="db-card">
                        <p style="margin:0; color:#94a3b8">TiDB CLOUD</p>
                        <p style="margin:5px 0 0 0; color:#10b981">{prog["ti_status"]}</p>
                    </div>
                </div>
                
                <p style="font-size:0.6rem; color:#475569; text-align:center; margin-top:20px;">
                    <a href="/start-migration" style="color:#3b82f6; text-decoration:none;">[ CLICK HERE TO START 4GB RESCUE ]</a>
                </p>
            </div>
        </body>
    </html>
    """

@app.get("/start-migration")
def start_migration():
    if migrator.progress["status"] == "Processing":
        return {"status": "Already running"}
    thread = threading.Thread(target=migrator.migrate)
    thread.daemon = True
    thread.start()
    return {"status": "Migration Started", "message": "The cloud is now rescuing your data."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
