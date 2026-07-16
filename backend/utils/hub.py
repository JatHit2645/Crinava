# CRINAVA_TELEMETRY_UPGRADE_REVISION_1
import json
import os

# Central Hub for match data and history
# match_id -> { "worker": worker_obj, "history": [], "queues": set() }
match_hub = {}

CACHE_FILE = "match_cache.json"


def load_cache():
    """Loads previous match data from disk into RAM (runs on startup)"""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                data = json.load(f)
                for mid, match_data in data.items():
                    match_hub[mid] = {
                        "history": match_data.get("history", []),
                        "state": match_data.get("state", "Live"),
                        "scorecard": match_data.get("scorecard", {}),
                        "telemetry": match_data.get("telemetry", {}),
                        "completed_at": match_data.get("completed_at"),
                        "title": match_data.get("title"),
                        "source": match_data.get("source"),
                        "queues": set(),
                        "worker": None,
                    }
            print(
                f"[Cache] Successfully loaded {len(data)} matches into memory from {CACHE_FILE}."
            )
        except Exception as e:
            print(f"[Cache] Error loading cache: {e}")


def save_cache():
    """Saves current RAM match data to disk (runs on shutdown)"""
    try:
        cache_data = {}
        for mid, data in match_hub.items():
            cache_data[mid] = {
                "history": data.get("history", []),
                "state": data.get("state", "Live"),
                "scorecard": data.get("scorecard", {}),
                "telemetry": data.get("telemetry", {}),
                "completed_at": data.get("completed_at"),
                "title": data.get("title"),
                "source": data.get("source"),
            }
        with open(CACHE_FILE, "w") as f:
            json.dump(cache_data, f)
        print(
            f"[Cache] Successfully saved {len(cache_data)} matches to disk ({CACHE_FILE})."
        )
    except Exception as e:
        print(f"[Cache] Error saving cache: {e}")
