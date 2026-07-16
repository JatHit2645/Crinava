# --- CRINAVA GHOST ENGINE CONFIGURATION ---

# 1. Hugging Face AI Predictor
# Paste your Hugging Face /predict URL here
AI_API_URL = "PASTE_YOUR_HF_URL_HERE"
# Paste your X-API-Key here
AI_API_KEY = "PASTE_YOUR_HF_KEY_HERE"

# 2. Security (The "Secret Handshake" with your website)
# Change this to a long random string. 
# Both your website and this engine must share this key.
ENGINE_SECRET_KEY = "PASTE_A_RANDOM_SECRET_KEY_HERE"

# 3. Source Data (SkyExchange/SkyFair)
# The "Master Link" for finding matches
MASTER_DISCOVERY_URL = "https://api.nginx0.com/api8/getskyfairallevents/4"
# The "Live Pulse" WebSocket source
LIVE_PULSE_WS = "wss://api.nginx0.com/pubsub/socket.io/"

# 4. Engine Settings
MAX_HISTORY = 18
POLL_INTERVAL = 60 # Seconds
