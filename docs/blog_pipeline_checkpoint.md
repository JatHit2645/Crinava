# Crinava Blog Pipeline Checkpoint

> [!IMPORTANT]
> **RESUME KEYWORD:** `CRINAVA_IMAGE_PIPELINE`
> Mention this keyword to the AI in any future session to instantly reload this context and continue working.

---

## 📋 Project Status Summary
This document summarizes the state of the **Automated AI Blog Image Pipeline** as of June 26, 2026. All technical WAF blocks, UI features, and clustering issues have been resolved.

### 1. WAF & Scraping Bypass (`app.py`)
* **Dual Header System:** Split traffic into `RSS_HEADERS` (disguised as Google Chrome to prevent RSS feed blocks from Cricbuzz) and `PAGE_HEADERS` (disguised as the Facebook link crawler to fetch Open Graph details).
* **Proxy Fallback:** Integrated a fallback mechanism using the `allorigins.win` public proxy inside `extract_page_image_urls`. If a target website returns a `403 Forbidden` block (common on cloud hosting like Hugging Face), the engine automatically routes the request through the proxy to fetch the HTML and extract `og:image` successfully.
* **Strict Clustering:** Changed DBSCAN `eps` parameter from `0.72` to `0.45` to prevent mixing unrelated matches (e.g., Men's and Women's T20 series) into the same draft.
* **Limit Upgrades:** Increased the drafts run limit to `150` and the API serving limit to `250` so that all generated drafts are visible.

### 2. Admin Control Center UI (`AdminControlCenter.tsx`)
* **Dynamic Article Counters:** Added live counters on all blog subtabs: `New (X)`, `Old (X)`, `Approved (X)`, and `Revoked (X)` for real-time tracking.
* **Draft Discarding:** Added a **Trash Can icon** on all pending drafts to allow admins to delete unwanted or duplicate drafts instantly before publishing.
* **Manual Uploader:** Added a **"Local File"** button to allow admins to upload images directly from their system.
* **Multi-Image Insertion:** Added an **"Insert Selected Image Into Article Content"** button, enabling admins to insert any selected image link directly into the Markdown editor at the cursor position.

---

## 🛠️ Next Steps / Backlog
* Run a full test of the automatic scraper pipeline by navigating to `/api/run-background` on the blog engine.
* Verify database persistence when publishing custom local file images (Base64 vs URLs).
