from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from dotenv import load_dotenv
import backend.services.engine

# --- LOAD CENTRAL SECRETS ---
env_path = Path(r"C:\Users\hp\.gemini\antigravity\scratch\Crinava-main\.env")
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# --- PROTECTION ---
ENGINE_SECRET_KEY = os.getenv("ENGINE_SECRET_KEY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_signature(x_signature: str = Header(None)):
    if x_signature != ENGINE_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return True

@app.get("/")
def status():
    return {"status": "Online", "active_matches": len(engine.active_robots)}

@app.get("/live-matches")
def list_matches():
    return [{"id": m_id, "teams": robot.teams} for m_id, robot in engine.active_robots.items()]

@app.get("/score/{match_id}")
def get_match_data(match_id: str):
    if match_id not in engine.live_data_store:
        raise HTTPException(status_code=404, detail="Match not found")
    return engine.live_data_store[match_id]

if __name__ == "__main__":
    import uvicorn
    print("Crinava API Bridge is Live on Port 8000")
    print(f"Loading secrets from: {env_path}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
