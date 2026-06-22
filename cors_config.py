import os

def get_allowed_origins():
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    env_origins = os.environ.get("ALLOWED_ORIGINS")
    if env_origins:
        allowed_origins.extend([origin.strip() for origin in env_origins.split(",")])
    return allowed_origins
