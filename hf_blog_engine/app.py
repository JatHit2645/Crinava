import json
import os
import re
import hashlib
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import feedparser
import requests
import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
from openai import OpenAI
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer


# Configuration
# Hugging Face Spaces: set these in Settings -> Variables and secrets.
AI_API_KEY = (os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
AI_BASE_URL = (os.getenv("AI_BASE_URL") or "https://api.openai.com/v1").strip().rstrip("/")
AI_MODEL_ENV = (os.getenv("AI_MODEL") or "").strip()
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"
NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b"


def is_nvidia_endpoint(base_url: str) -> bool:
    return "integrate.api.nvidia.com" in base_url.lower()


def default_model_for_base_url(base_url: str) -> str:
    if is_nvidia_endpoint(base_url):
        return NVIDIA_DEFAULT_MODEL
    return OPENAI_DEFAULT_MODEL


AI_MODEL = AI_MODEL_ENV or default_model_for_base_url(AI_BASE_URL)


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


AI_TIMEOUT_SECONDS = env_float("AI_TIMEOUT_SECONDS", 180)
AI_MAX_RETRIES = env_int("AI_MAX_RETRIES", 2)
MAX_DRAFTS_PER_RUN = env_int("MAX_DRAFTS_PER_RUN", 20)
MAX_SOURCES_PER_DRAFT = env_int("MAX_SOURCES_PER_DRAFT", 8)
MAX_SUMMARY_CHARS = env_int("MAX_SUMMARY_CHARS", 900)
PIPELINE_INTERVAL_MINUTES = env_int("PIPELINE_INTERVAL_MINUTES", 30)
API_DEFAULT_LIMIT = env_int("API_DEFAULT_LIMIT", 20)
API_MAX_LIMIT = env_int("API_MAX_LIMIT", 100)
DRAFT_RETENTION_LIMIT = env_int("DRAFT_RETENTION_LIMIT", 0)


def default_drafts_db_path() -> str:
    persistent_dir = Path("/data")
    if persistent_dir.exists():
        return str(persistent_dir / "crinava_drafts.sqlite3")
    return str(Path(__file__).with_name("crinava_drafts.sqlite3"))


DRAFTS_DB_PATH = os.getenv("DRAFTS_DB_PATH", default_drafts_db_path()).strip()

RSS_FEEDS = [
    "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
    "https://www.cricbuzz.com/cricket-news/rss",
    "https://news.google.com/rss/search?q=cricket%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=IPL%20OR%20BCCI%20OR%20ICC%20cricket%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=cricket%20analysis%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=India%20cricket%20team%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=women%27s%20cricket%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "https://news.google.com/rss/search?q=Test%20cricket%20OR%20T20%20OR%20ODI%20when:1d&hl=en-IN&gl=IN&ceid=IN:en",
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    )
}

app = FastAPI(title="Crinava Blog Engine")

# Logs and runtime state reset when the Space restarts. Drafts are stored in SQLite.
pipeline_logs: List[str] = []
scheduler: Optional[BackgroundScheduler] = None
pipeline_lock = threading.Lock()
db_lock = threading.Lock()
ai_client: Optional[OpenAI] = None
pipeline_state: Dict[str, Any] = {
    "running": False,
    "last_started_at": None,
    "last_finished_at": None,
    "last_result": None,
}


def log_event(message: str) -> None:
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg, flush=True)
    pipeline_logs.append(msg)
    if len(pipeline_logs) > 100:
        pipeline_logs.pop(0)


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def get_db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DRAFTS_DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def init_draft_store() -> None:
    Path(DRAFTS_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with db_lock:
        with get_db_connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS drafts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    content TEXT NOT NULL,
                    sources_json TEXT NOT NULL,
                    cluster_signature TEXT UNIQUE NOT NULL,
                    source_count INTEGER NOT NULL,
                    model TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    image_url TEXT
                )
                """
            )
            try:
                connection.execute("ALTER TABLE drafts ADD COLUMN image_url TEXT")
            except sqlite3.OperationalError:
                pass
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC)"
            )
            connection.commit()


def draft_from_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "content": row["content"],
        "sources": json.loads(row["sources_json"]),
        "source_count": row["source_count"],
        "model": row["model"],
        "created_at": row["created_at"],
        "image_url": row["image_url"] if "image_url" in row.keys() else None,
    }


def get_stored_drafts(limit: int = API_DEFAULT_LIMIT, offset: int = 0) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, API_MAX_LIMIT))
    safe_offset = max(0, offset)
    with db_lock:
        with get_db_connection() as connection:
            rows = connection.execute(
                """
                SELECT id, title, category, content, sources_json, source_count, model, created_at, image_url
                FROM drafts
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (safe_limit, safe_offset),
            ).fetchall()
    return [draft_from_row(row) for row in rows]


def count_stored_drafts() -> int:
    with db_lock:
        with get_db_connection() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM drafts").fetchone()
    return int(row["count"]) if row else 0


def make_cluster_signature(cluster_articles: List[Dict[str, str]]) -> str:
    keys = []
    for article in cluster_articles:
        link = article.get("link", "").strip().lower()
        title = re.sub(r"\s+", " ", article.get("title", "").strip().lower())
        keys.append(link or title)
    payload = json.dumps(sorted(keys), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def cluster_signature_exists(cluster_signature: str) -> bool:
    with db_lock:
        with get_db_connection() as connection:
            row = connection.execute(
                "SELECT 1 FROM drafts WHERE cluster_signature = ? LIMIT 1",
                (cluster_signature,),
            ).fetchone()
    return row is not None


def prune_old_drafts(connection: sqlite3.Connection) -> None:
    if DRAFT_RETENTION_LIMIT <= 0:
        return

    connection.execute(
        """
        DELETE FROM drafts
        WHERE id NOT IN (
            SELECT id FROM drafts
            ORDER BY created_at DESC
            LIMIT ?
        )
        """,
        (DRAFT_RETENTION_LIMIT,),
    )


def save_draft(draft: Dict[str, Any], cluster_signature: str) -> bool:
    with db_lock:
        with get_db_connection() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO drafts (
                    id, title, category, content, sources_json,
                    cluster_signature, source_count, model, created_at, image_url
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    draft["id"],
                    draft["title"],
                    draft["category"],
                    draft["content"],
                    json.dumps(draft.get("sources", []), ensure_ascii=True),
                    cluster_signature,
                    len(draft.get("sources", [])),
                    AI_MODEL,
                    draft["created_at"],
                    draft.get("image_url"),
                ),
            )
            saved = cursor.rowcount == 1
            prune_old_drafts(connection)
            connection.commit()

    if not saved:
        log_event(f"Skipped duplicate topic: {draft.get('title', 'untitled draft')}")
    return saved


def get_ai_config_warnings() -> List[str]:
    warnings = []
    if is_nvidia_endpoint(AI_BASE_URL) and AI_MODEL.startswith("gpt-"):
        warnings.append(
            "AI_BASE_URL points to NVIDIA NIM, but AI_MODEL is an OpenAI model name. "
            f"Use a NVIDIA model such as {NVIDIA_DEFAULT_MODEL}."
        )
    return warnings


def get_ai_client() -> Optional[OpenAI]:
    """Create one reusable OpenAI-compatible client for OpenAI, Groq, Together, etc."""
    global ai_client

    if not AI_API_KEY:
        log_event("AI client not initialized: AI_API_KEY or OPENAI_API_KEY is missing.")
        return None

    for warning in get_ai_config_warnings():
        log_event(f"AI configuration warning: {warning}")

    if ai_client is None:
        ai_client = OpenAI(
            api_key=AI_API_KEY,
            base_url=AI_BASE_URL,
            timeout=AI_TIMEOUT_SECONDS,
            max_retries=AI_MAX_RETRIES,
        )
        log_event(f"AI client initialized with base_url={AI_BASE_URL}, model={AI_MODEL}.")

    return ai_client


def fetch_cricket_news() -> List[Dict[str, str]]:
    """Fetch cricket news from configured RSS sources."""
    log_event("Fetching latest cricket news...")
    articles: List[Dict[str, str]] = []
    seen_links = set()
    seen_titles = set()

    for url in RSS_FEEDS:
        try:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
            response.raise_for_status()
            parsed = feedparser.parse(response.content)

            if getattr(parsed, "bozo", 0):
                log_event(f"Feed warning for {url}: {getattr(parsed, 'bozo_exception', 'unknown parse issue')}")

            for entry in parsed.entries[:30]:
                title = str(getattr(entry, "title", "")).strip()
                summary = str(getattr(entry, "summary", "")).strip()
                link = str(getattr(entry, "link", "")).strip()

                if not title or not link:
                    continue

                normalized_title = re.sub(r"\s+", " ", title.lower())
                if link in seen_links or normalized_title in seen_titles:
                    continue

                clean_summary = re.sub(r"<[^>]+>", "", summary)
                seen_links.add(link)
                seen_titles.add(normalized_title)
                articles.append(
                    {
                        "title": title,
                        "summary": clean_summary,
                        "link": link,
                        "text": f"{title} {clean_summary}",
                    }
                )
        except Exception as exc:
            log_event(f"Error fetching feed {url}: {exc}")

    log_event(f"Found {len(articles)} unique raw articles.")
    return articles


def cluster_articles(articles: List[Dict[str, str]]) -> Dict[int, List[Dict[str, str]]]:
    """Vectorize and cluster articles to group similar topics together."""
    if not articles:
        return {}

    log_event("Vectorizing and clustering articles...")
    try:
        texts = [article["text"] for article in articles]
        vectorizer = TfidfVectorizer(stop_words="english", max_features=1000, min_df=1)
        matrix = vectorizer.fit_transform(texts)

        clustering = DBSCAN(eps=0.72, min_samples=1, metric="cosine").fit(matrix)

        clusters: Dict[int, List[Dict[str, str]]] = {}
        for idx, label in enumerate(clustering.labels_):
            clusters.setdefault(int(label), []).append(articles[idx])

        log_event(f"Formed {len(clusters)} topic clusters.")
        return clusters
    except Exception as exc:
        log_event(f"Clustering error: {exc}")
        return {}


def build_sources_text(cluster_articles: List[Dict[str, str]]) -> str:
    source_blocks = []
    selected_articles = cluster_articles[:MAX_SOURCES_PER_DRAFT]
    for idx, article in enumerate(selected_articles, start=1):
        summary = article.get("summary", "").strip()
        if len(summary) > MAX_SUMMARY_CHARS:
            summary = summary[:MAX_SUMMARY_CHARS].rsplit(" ", 1)[0] + "..."

        source_blocks.append(
            "\n".join(
                [
                    f"Source {idx}",
                    f"Title: {article.get('title', '').strip()}",
                    f"Summary: {summary}",
                    f"URL: {article.get('link', '').strip()}",
                ]
            )
        )

    if len(cluster_articles) > len(selected_articles):
        source_blocks.append(
            f"Note: {len(cluster_articles) - len(selected_articles)} additional related articles were omitted to keep the prompt concise."
        )

    return "\n\n".join(source_blocks)


def extract_json_object(raw_text: str) -> Dict[str, Any]:
    """Parse strict JSON, fenced JSON, or the first JSON object embedded in text."""
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("AI returned an empty response.")

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise
        parsed = json.loads(match.group(0))

    if not isinstance(parsed, dict):
        raise ValueError("AI response JSON must be an object.")
    return parsed


def normalize_draft(raw_draft: Dict[str, Any], cluster_articles: List[Dict[str, str]]) -> Dict[str, Any]:
    title = str(raw_draft.get("title") or cluster_articles[0].get("title") or "Cricket Analysis").strip()
    category = str(raw_draft.get("category") or "News").strip()
    content = str(raw_draft.get("content") or "").strip()

    allowed_categories = {"Tactical Analysis", "Match Review", "News", "Trends"}
    if category not in allowed_categories:
        category = "News"

    if len(content) < 300:
        raise ValueError("Generated draft content is too short or missing.")

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "category": category,
        "content": content,
        "sources": [
            {
                "title": article.get("title", ""),
                "link": article.get("link", ""),
            }
            for article in cluster_articles
        ],
        "created_at": utc_now(),
    }


def is_unsupported_parameter_error(exc: Exception, parameter_name: str) -> bool:
    error_text = str(exc).lower()
    parameter_name = parameter_name.lower()
    return (
        parameter_name in error_text
        and any(
            phrase in error_text
            for phrase in [
                "unsupported",
                "not supported",
                "unknown parameter",
                "unrecognized",
                "extra inputs are not permitted",
                "invalid request",
            ]
        )
    )


def create_chat_completion(client: OpenAI, request_payload: Dict[str, Any]) -> Any:
    """Call chat completions with careful fallbacks for OpenAI-compatible providers."""
    variants = [
        ("JSON mode", True, True),
        ("JSON mode without temperature", True, False),
        ("prompt-only JSON", False, True),
        ("prompt-only JSON without temperature", False, False),
    ]
    last_error: Optional[Exception] = None

    for label, use_json_mode, use_temperature in variants:
        payload = dict(request_payload)
        if not use_temperature:
            payload.pop("temperature", None)
        if use_json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            if label != "JSON mode":
                log_event(f"Retrying AI generation with {label}.")
            return client.chat.completions.create(**payload)
        except Exception as exc:
            last_error = exc
            if "404" in str(exc) and is_nvidia_endpoint(AI_BASE_URL) and AI_MODEL.startswith("gpt-"):
                raise RuntimeError(
                    "NVIDIA NIM returned 404 because the configured model is not available on NVIDIA. "
                    f"Set AI_MODEL={NVIDIA_DEFAULT_MODEL} or another model from the NVIDIA NIM catalog."
                ) from exc

            response_format_failed = use_json_mode and is_unsupported_parameter_error(exc, "response_format")
            json_object_failed = use_json_mode and is_unsupported_parameter_error(exc, "json_object")
            temperature_failed = use_temperature and is_unsupported_parameter_error(exc, "temperature")

            if response_format_failed or json_object_failed or temperature_failed:
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("AI generation failed before a request was attempted.")


def extract_og_image(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=8)
        if response.status_code == 200:
            match = re.search(r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', response.text)
            if match:
                return match.group(1)
            match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', response.text)
            if match:
                return match.group(1)
    except Exception:
        pass
    return None


def generate_blog_draft(cluster_articles: List[Dict[str, str]]) -> Optional[Dict[str, Any]]:
    """Generate one Markdown blog draft from a cluster of related cricket articles."""
    client = get_ai_client()
    if client is None:
        return None

    if not cluster_articles:
        log_event("Skipping AI generation: empty cluster.")
        return None

    log_event(
        f"Generating blog draft for cluster of {len(cluster_articles)} articles "
        f"using up to {MAX_SOURCES_PER_DRAFT} sources..."
    )

    sources_text = build_sources_text(cluster_articles)

    system_prompt = (
        "You are an expert cricket tactical analyst and professional sports journalist "
        "writing for Crinava, a premium cricket analysis platform. Write with authority, "
        "context, tactical detail, and clean Markdown formatting."
    )

    user_prompt = f"""
Use the recent cricket news sources below to write one original analysis blog post.

Requirements:
- Return only a valid JSON object. Do not wrap it in Markdown fences.
- JSON keys must be exactly: title, category, content.
- category must be one of: Tactical Analysis, Match Review, News, Trends.
- content must be a complete Markdown article with an introduction, analysis section, and conclusion.
- Do not mention phrases like "Source 1", "provided text", "according to the sources", or "as an AI".
- Do not invent unsupported facts, quotes, scores, injuries, or announcements.
- If reports differ, explain the uncertainty naturally.
- Keep the tone professional, engaging, and suitable for cricket fans.

News Sources:
{sources_text}
""".strip()

    request_payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.65,
    }

    try:
        response = create_chat_completion(client, request_payload)
        content = response.choices[0].message.content
        draft = normalize_draft(extract_json_object(content), cluster_articles)
        
        primary_link = cluster_articles[0].get("link", "")
        img_url = None
        if primary_link:
            log_event(f"Attempting to extract og:image from: {primary_link}")
            img_url = extract_og_image(primary_link)
            
        if not img_url:
            img_url = "https://images.unsplash.com/photo-1531415080290-bc9b899ddfb6?w=800&auto=format&fit=crop&q=60"
            
        draft["image_url"] = img_url
        log_event(f"Successfully generated blog: {draft['title']} with image: {img_url}")
        return draft
    except Exception as exc:
        log_event(f"AI Generation Error: {exc}")
        return None


def run_scraping_pipeline() -> Dict[str, Any]:
    """Run the full fetch -> cluster -> generate pipeline."""
    if not pipeline_lock.acquire(blocking=False):
        log_event("Pipeline skipped: another run is already in progress.")
        return {"status": "already_running", "new_drafts": 0}

    pipeline_state["running"] = True
    pipeline_state["last_started_at"] = utc_now()
    pipeline_state["last_result"] = None
    log_event("Starting Scheduled Scraping Pipeline...")
    try:
        articles = fetch_cricket_news()
        if not articles:
            log_event("Pipeline stopped: no articles found.")
            pipeline_state["last_result"] = {"status": "no_articles", "new_drafts": 0}
            return pipeline_state["last_result"]

        clusters = cluster_articles(articles)
        if not clusters:
            log_event("Pipeline stopped: no clusters formed.")
            pipeline_state["last_result"] = {"status": "no_clusters", "new_drafts": 0}
            return pipeline_state["last_result"]

        new_drafts_count = 0
        skipped_duplicates = 0
        attempted_generations = 0
        sorted_clusters = sorted(
            clusters.values(),
            key=lambda cluster: (len(cluster), sum(len(article.get("summary", "")) for article in cluster)),
            reverse=True,
        )[:MAX_DRAFTS_PER_RUN]

        for cluster in sorted_clusters:
            cluster_signature = make_cluster_signature(cluster)
            if cluster_signature_exists(cluster_signature):
                skipped_duplicates += 1
                log_event(f"Skipping duplicate topic cluster with {len(cluster)} articles.")
                continue

            attempted_generations += 1
            draft = generate_blog_draft(cluster)
            if draft and save_draft(draft, cluster_signature):
                new_drafts_count += 1

        total_drafts = count_stored_drafts()
        if new_drafts_count:
            log_event(f"Pipeline complete. {new_drafts_count} new drafts saved. Total stored drafts: {total_drafts}.")
            pipeline_state["last_result"] = {
                "status": "completed",
                "new_drafts": new_drafts_count,
                "attempted_generations": attempted_generations,
                "skipped_duplicates": skipped_duplicates,
                "total_drafts": total_drafts,
            }
        else:
            log_event(
                "Pipeline complete. No new drafts were generated "
                f"({skipped_duplicates} duplicate clusters skipped)."
            )
            pipeline_state["last_result"] = {
                "status": "completed_no_new_drafts",
                "new_drafts": 0,
                "attempted_generations": attempted_generations,
                "skipped_duplicates": skipped_duplicates,
                "total_drafts": total_drafts,
            }
        return pipeline_state["last_result"]
    except Exception as exc:
        log_event(f"Pipeline execution failed: {exc}")
        pipeline_state["last_result"] = {
            "status": "failed",
            "new_drafts": 0,
            "error": str(exc),
            "total_drafts": count_stored_drafts(),
        }
        return pipeline_state["last_result"]
    finally:
        pipeline_state["running"] = False
        pipeline_state["last_finished_at"] = utc_now()
        pipeline_lock.release()


@app.on_event("startup")
def start_scheduler() -> None:
    global scheduler

    if scheduler and scheduler.running:
        return

    init_draft_store()
    log_event(f"Draft store ready at {DRAFTS_DB_PATH}. Stored drafts: {count_stored_drafts()}.")

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        run_scraping_pipeline,
        "interval",
        minutes=PIPELINE_INTERVAL_MINUTES,
        id="cricket-news-pipeline",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()

    threading.Timer(5.0, run_scraping_pipeline).start()
    log_event(
        f"Scheduler started. It will run every {PIPELINE_INTERVAL_MINUTES} minutes. "
        "First pipeline run will start shortly."
    )


@app.on_event("shutdown")
def stop_scheduler() -> None:
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        log_event("Scheduler stopped.")


@app.get("/api/hf-drafts")
def get_drafts(
    limit: int = Query(API_DEFAULT_LIMIT, ge=1, le=API_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    return get_stored_drafts(limit=limit, offset=offset)


@app.get("/api/hf-drafts/meta")
def get_drafts_meta() -> Dict[str, Any]:
    return {
        "total_drafts": count_stored_drafts(),
        "default_limit": API_DEFAULT_LIMIT,
        "max_limit": API_MAX_LIMIT,
        "retention_limit": DRAFT_RETENTION_LIMIT,
        "storage": "sqlite",
        "db_path": DRAFTS_DB_PATH,
    }


@app.get("/preview", response_class=HTMLResponse)
def preview_page() -> HTMLResponse:
    preview_path = Path(__file__).with_name("preview.html")
    if preview_path.exists():
        return HTMLResponse(preview_path.read_text(encoding="utf-8"))

    return HTMLResponse(
        "<!doctype html><title>Crinava Draft Preview</title>"
        "<h1>Crinava Draft Preview</h1>"
        "<p>preview.html was not found next to app.py.</p>",
        status_code=500,
    )


@app.get("/api/run")
def trigger_pipeline() -> Dict[str, Any]:
    """Manually trigger the pipeline synchronously for testing."""
    result = run_scraping_pipeline()
    return {
        "status": result["status"],
        "drafts_count": count_stored_drafts(),
        "pipeline": pipeline_state,
        "logs": pipeline_logs,
    }


@app.get("/api/run-background")
def trigger_pipeline_background() -> Dict[str, Any]:
    """Start the pipeline in the background and return immediately."""
    if pipeline_lock.locked():
        log_event("Background trigger skipped: another run is already in progress.")
        return {
            "status": "already_running",
            "drafts_count": count_stored_drafts(),
            "pipeline": pipeline_state,
            "logs": pipeline_logs,
        }

    threading.Thread(target=run_scraping_pipeline, daemon=True).start()
    return {
        "status": "started",
        "drafts_count": count_stored_drafts(),
        "pipeline": pipeline_state,
        "logs": pipeline_logs,
    }


@app.get("/")
def health_check() -> Dict[str, Any]:
    stored_drafts = count_stored_drafts()
    return {
        "status": "Crinava Blog Engine Active",
        "drafts_in_memory": stored_drafts,
        "drafts_stored": stored_drafts,
        "pipeline": pipeline_state,
        "ai_configured": bool(AI_API_KEY),
        "ai_base_url": AI_BASE_URL,
        "ai_model": AI_MODEL,
        "ai_config_warnings": get_ai_config_warnings(),
        "max_drafts_per_run": MAX_DRAFTS_PER_RUN,
        "pipeline_interval_minutes": PIPELINE_INTERVAL_MINUTES,
        "draft_retention_limit": DRAFT_RETENTION_LIMIT,
        "drafts_db_path": DRAFTS_DB_PATH,
        "preview_url": "/preview",
        "trigger_url": "/api/run",
        "background_trigger_url": "/api/run-background",
        "drafts_url": "/api/hf-drafts",
        "drafts_meta_url": "/api/hf-drafts/meta",
        "logs": pipeline_logs,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
