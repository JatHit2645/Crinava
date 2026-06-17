# CRINAVA_TELEMETRY_UPGRADE_REVISION_1
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from engine import discovery_engine
from crinava_worker import CrexMatchWorker
import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from contextlib import asynccontextmanager  # noqa: E402
from hub import load_cache, save_cache, match_hub  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[System] Crinava Hub starting background services...")
    load_cache()
    # Start Discovery Engine in background
    print("[System] Initializing Discovery Engine...")
    asyncio.create_task(discovery_engine.run_discovery_loop())
    # Start Orchestrator in background
    print("[System] Initializing Orchestrator...")
    asyncio.create_task(orchestrator())
    print("[System] Background services initiated.")
    yield
    print("[System] Shutting down...")
    save_cache()


app = FastAPI(lifespan=lifespan)

# Step 8: Enable CORS for Website Integration
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
env_origins = os.environ.get("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Get AI Key from Secrets
AI_API_KEY = os.environ.get("NVIDIA_API_KEY") or os.environ.get("HF_TOKEN")
SECRET_KEY = os.environ.get("CRINAVA_SECRET", "crinava_ultra_secure_123")


@app.middleware("http")
async def verify_crinava_secret(request: Request, call_next):
    # Allow home page, all public API paths, CORS preflight OPTIONS, and diagnostic files
    public_prefixes = [
        "/",
        "/favicon.ico",
        "/matches",
        "/scorecard/",
        "/history/",
        "/stream/",
    ]
    if request.method == "OPTIONS" or any(
        request.url.path == p or request.url.path.startswith(p) for p in public_prefixes
    ):
        return await call_next(request)

    # Check header or query parameter for the secret key
    client_key = request.headers.get("x-crinava-key") or request.query_params.get("key")

    # Secure bypass for local development/trusted origins and same-site dashboard requests
    origin = request.headers.get("origin") or ""
    referer = request.headers.get("referer") or ""
    host = request.headers.get("host") or ""

    is_local = (
        "localhost" in origin
        or "127.0.0.1" in origin
        or "localhost" in referer
        or "127.0.0.1" in referer
    )
    is_same_host = host and (host in origin or host in referer)

    # Allow multiple known keys for flexibility (both the configured secret and frontend hardcoded values)
    allowed_keys = {
        SECRET_KEY,
        "crinava_ultra_secure_123",
        "CRINAVA_2645_JATHIT_LIVE_SCORING_071108",
    }

    if not (is_local or is_same_host) and client_key not in allowed_keys:
        print(
            f"[Security] Access Denied for {request.url.path} from client key: {client_key}"
        )
        return JSONResponse(
            status_code=403,
            content={
                "error": "Access Denied: Unrecognized Client. Anti-Scraping Active."
            },
        )

    return await call_next(request)


def _ext_id(internal_id: str) -> str:
    """Strip internal prefixes for external API responses."""
    for prefix in ["CREX_", "CB_", "NDTV_"]:
        if internal_id.startswith(prefix):
            return internal_id[len(prefix) :]
    return internal_id


def _resolve_id(ext_id: str) -> str:
    """Resolve an external match ID back to internal format."""
    if ext_id in match_hub:
        return ext_id
    for prefix in ["CREX_", "CB_", "NDTV_"]:
        candidate = f"{prefix}{ext_id}"
        if candidate in match_hub:
            return candidate
    return ext_id


@app.get("/")
async def home():
    if os.path.exists("diagnostic.html"):
        return FileResponse("diagnostic.html")

    # Graceful fallback: return engine status report to prevent health check failures
    active_workers = [
        {"match_id": mid, "state": data.get("state")}
        for mid, data in match_hub.items()
        if data.get("worker") is not None
    ]
    return {
        "status": "online",
        "message": "Crinava Engine is fully functional",
        "discovered_matches_count": len(discovery_engine.live_matches),
        "active_workers_count": len(active_workers),
        "active_workers": active_workers,
    }


@app.get("/matches")
async def list_matches():
    """Returns a directory of all live matches currently being tracked."""
    match_list = []
    emitted_ids = set()
    for match in discovery_engine.live_matches:
        if "match_id" in match:
            mid = match["match_id"]
            emitted_ids.add(mid)

            # Smart Filtering: Hide if worker checked and said it's dead (unless it's completed)
            if mid in match_hub:
                worker = match_hub[mid].get("worker")
                state_in_hub = match_hub[mid].get("state")
                if worker and not worker.is_running and state_in_hub != "Completed":
                    continue

            state = match.get("state", "Live")
            if mid in match_hub:
                if match_hub[mid].get("state") == "Completed":
                    state = match_hub[mid]["state"]
                else:
                    history = match_hub[mid].get("history", [])
                    if history:
                        last = history[-1]
                        score = str(last.get("score", "")).lower()
                        comm = str(last.get("commentary", "")).lower()
                        if (
                            "won by" in score
                            or "won by" in comm
                            or "result" in score
                            or "match tied" in score
                        ):
                            state = "Completed"
                        elif (
                            "yet to begin" in comm
                            or "upcoming" in comm
                            or "match not started" in score
                        ):
                            state = "Upcoming"

            match_list.append(
                {
                    "title": match["title"],
                    "match_id": _ext_id(mid),
                    "source": "crinava",
                    "state": state,
                    "is_tracked": mid in match_hub,
                }
            )

    for mid, data in match_hub.items():
        if mid in emitted_ids or data.get("state") != "Completed":
            continue
        match_list.append(
            {
                "title": data.get("title") or mid,
                "match_id": _ext_id(mid),
                "source": data.get("source") or "cache",
                "state": "Completed",
                "is_tracked": False,
            }
        )

    match_list.sort(
        key=lambda x: (
            0 if x["state"] == "Live" else 1 if x["state"] == "Upcoming" else 2
        )
    )
    return match_list


@app.get("/cache_status")
async def cache_status():
    """Returns the current cache state for diagnostic purposes."""
    status = {}
    for mid, data in match_hub.items():
        status[mid] = {
            "history_count": len(data.get("history", [])),
            "has_scorecard": bool(data.get("scorecard")),
            "state": data.get("state", "Unknown"),
            "has_worker": data.get("worker") is not None,
            "queue_count": len(data.get("queues", set())),
            "last_event": data["history"][-1].get("over_ball")
            if data.get("history")
            else None,
        }
    return {"total_matches_cached": len(status), "matches": status}


@app.get("/debug/discovery")
async def debug_discovery():
    """Diagnostic endpoint to see raw discovery data."""
    return {
        "live_matches": discovery_engine.live_matches,
        "match_hub_keys": list(match_hub.keys()),
        "discovery_cycle": "active",
    }


@app.get("/history/{match_id}")
async def get_match_history(match_id: str):
    """Returns the last 5 balls for polling fallback."""
    resolved = _resolve_id(match_id)
    if resolved in match_hub:
        return match_hub[resolved]["history"]
    return []


@app.get("/scorecard/{match_id}")
async def get_match_scorecard(match_id: str):
    """Returns the full cached batting and bowling scorecard."""
    resolved = _resolve_id(match_id)
    if resolved in match_hub:
        return match_hub[resolved].get("scorecard", {})
    return {}


@app.get("/stream/{match_id}")
async def stream_match(match_id: str):
    """Step 7: High-Reliability SSE Stream."""
    resolved = _resolve_id(match_id)
    if resolved not in match_hub:
        match_hub[resolved] = {"clients": set(), "history": [], "queues": set()}

    if "queues" not in match_hub[resolved]:
        match_hub[resolved]["queues"] = set()

    async def event_generator():
        # Create a private queue for this specific client
        queue = asyncio.Queue()
        match_hub[resolved]["queues"].add(queue)

        # Send history first
        for packet in match_hub[resolved]["history"]:
            yield f"data: {json.dumps(packet)}\n\n"

        # Send latest scorecard if available
        if "scorecard" in match_hub[resolved]:
            yield f"data: {json.dumps(match_hub[resolved]['scorecard'])}\n\n"

        try:
            while True:
                # Wait for new data from the worker
                packet = await queue.get()
                yield f"data: {json.dumps(packet)}\n\n"
        except asyncio.CancelledError:
            match_hub[resolved]["queues"].remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable buffering for Nginx/Proxies
        },
    )


async def orchestrator():
    """Orchestrates the start/stop of workers based on discovery."""
    while True:
        # Step 1 & 2 happened in discovery_engine
        # Prune inactive matches from hub
        current_ids = {
            m.get("match_id") for m in discovery_engine.live_matches if "match_id" in m
        }
        for mid in list(match_hub.keys()):
            if mid not in current_ids:
                if match_hub[mid].get("state") == "Completed":
                    if "worker" in match_hub[mid] and match_hub[mid]["worker"]:
                        match_hub[mid]["worker"].is_running = False
                        match_hub[mid]["worker"] = None
                    continue
                print(f"[Orchestrator] Pruning inactive non-completed match: {mid}")
                if "worker" in match_hub[mid] and match_hub[mid]["worker"]:
                    match_hub[mid]["worker"].is_running = False
                del match_hub[mid]

        for match in discovery_engine.live_matches:
            if "match_id" not in match:
                continue

            match_id = match["match_id"]
            if match_id not in match_hub or not match_hub[match_id].get("worker"):
                if match_id not in match_hub:
                    match_hub[match_id] = {
                        "clients": set(),
                        "history": [],
                        "queues": set(),
                    }
                match_hub[match_id]["title"] = match.get("title")
                match_hub[match_id]["source"] = match.get("source")
                previous_state = match_hub[match_id].get("state")
                match_hub[match_id]["state"] = (
                    "Completed"
                    if previous_state == "Completed"
                    else match.get("state", "Live")
                )

                if match_hub[match_id].get("state") == "Completed":
                    continue

                print(
                    f"[Orchestrator] Starting new worker for {match['title']} ({match['source']})..."
                )

                if match["source"] == "crex":
                    worker = CrexMatchWorker(match, AI_API_KEY)
                    match_hub[match_id]["worker"] = worker
                    asyncio.create_task(worker.listen())
                else:
                    from crinava_worker import HierarchyScraperWorker

                    worker = HierarchyScraperWorker(match, AI_API_KEY)
                    match_hub[match_id]["worker"] = worker
                    asyncio.create_task(worker.listen())

        await asyncio.sleep(5)


# Check for new matches every 5 seconds

# (Old startup event removed in favor of lifespan)

if __name__ == "__main__":
    import uvicorn
    import os

    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=7860)
