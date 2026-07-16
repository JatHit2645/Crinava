"""Module docstring."""

from curl_cffi import requests
import secrets

# Pool of desktop User-Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]


class ShadowSession:
    """Docstring for ShadowSession class."""

    _instance = None

    def __new__(cls):
        """Docstring for __new__."""
        if cls._instance is None:
            print("[System] Creating ShadowSession Singleton...")
            cls._instance = super(ShadowSession, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Docstring for __init__."""
        if not hasattr(self, "session"):
            self.session = None

    def init_session(self):
        """Docstring for init_session."""
        if self.session is None:
            print("[System] Initializing curl_cffi Session...")
            self.session = requests.Session(impersonate="chrome120")
            self.user_agent = secrets.choice(USER_AGENTS)
            self.session.headers.update(
                {
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Connection": "keep-alive",
                }
            )

    def get_headers(self):
        """Docstring for get_headers."""
        self.init_session()
        return dict(self.session.headers)

    @property
    def cookies(self):
        """Docstring for cookies."""
        self.init_session()
        return self.session.cookies

    def request(self, method, url, **kwargs):
        """Docstring for request."""
        self.init_session()
        return self.session.request(method=method, url=url, **kwargs)


# Lazy-loaded session
stealth_session = ShadowSession()
