# Crinava — Enterprise Control Center (Secure Admin Specs)

This document contains the complete engineering specification for the Crinava Enterprise Control Center. It details the security mechanisms, the custom URL routing architecture, and the command dashboard features.

---

## 1. Security & Access Architecture

### A. Custom Obscure URL Route (Security by Obscurity)
*   **The Problem:** Hackers and automated bots constantly scan standard paths like `/admin`, `/login`, or `/dashboard` looking for vulnerabilities.
*   **The Solution:** The admin portal will not exist at a static `/admin` path. Instead, the route is dynamically set in your environment configuration (`.env`):
    ```env
    ADMIN_PORTAL_PATH="control-center-9842-jathit-secure"
    ```
    This registers the route as `https://crinava.com/control-center-9842-jathit-secure`. Anyone visiting the standard `/admin` will receive a standard `404 Not Found` page, keeping the entry point hidden.

### B. Dual-Lock Authentication (TOTP + Telegram Push Approval) — **₹0 Cost**
1. **Initial Login:** You enter the password on the custom URL.
2. **TOTP Challenge:** The portal prompts you for the 6-digit code from your **Google Authenticator** app.
3. **Telegram Push:** Simultaneously, the backend uses a free Telegram Bot API to send a verification message to your phone: *"Admin login attempt from IP 123.45.67.89. Authorize session? [Approve] [Deny]"*.
4. **Login Complete:** Once you tap **[Approve]** on your phone and enter the correct TOTP code, the session cookie is created.

---

## 2. Dynamic Content Management (Admin to Web)

### A. Live Debate Publisher
*   **Purpose:** Easily introduce new topics for user debates on the main site.
*   **Mechanism:**
    *   An admin interface with fields: `Debate Question`, `Team Tags` (e.g. IND, PAK), and `Starting Points`.
    *   Clicking **"Publish Debate"** immediately inserts the debate topic into the database and broadcasts it to all active users on the main website via WebSockets/SSE.

### B. AI-Assisted Blog Publisher (With "Manual Touch" Editor)
*   **Purpose:** Rapidly generate SEO-rich blog articles while retaining editorial control.
*   **Workflow:**
    1. **Generate Draft:** Input a topic or select a recent match in the admin panel (e.g. *"Analyze Rohit Sharma's captaincy in today's match"*). Click **"AI Draft"**.
    2. **AI Generation:** The backend calls the Gemini/NVIDIA API to generate a structured, SEO-optimized blog draft in Markdown format.
    3. **The Manual Touch (WYSIWYG Editor):** The draft is rendered inside a rich-text markdown editor on your admin screen. You can review the AI text, add your personal voice, correct stats, or insert custom images.
    4. **Publish Live:** Click **"Publish Article"** to write the record to your database and push the blog live on the public website instantly.

---

## 3. Enterprise Pillars (AIOps, SecOps, DevOps)

### A. AI Engine & Prompt Playground (AIOps)
*   **Live Prompt Editor:** Tweak the core instructions for the AI predictions engine in real-time. If you want the AI to write more analytical or dramatic predictions, update the prompt here without rewriting code.
*   **Cost & Rate Limiter:** Set caps on how many AI queries free vs premium users can run daily to control your API billing.
*   **Model Failover Switch:** In one click, swap the backend AI model provider (e.g. from NVIDIA Mixtral to Gemini 1.5 Flash) if one goes offline.

### B. Live Logs Terminal & SQL Console (DevOps)
*   **Real-time Server Terminal:** A terminal that streams live logs (`stdout`/`stderr`) from your Oracle VM using WebSockets, color-coded for quick debugging.
*   **Interactive SQL Panel:** Execute database queries directly from the dashboard to fix database tables on the fly without opening external database editors.
*   **Canary Features Toggling:** Toggle new features for a small percentage of users (e.g. 5% of web traffic) to test stability before a full release.

### C. SecOps & Audit Logs
*   **Cryptographic Audit Trail:** A permanent ledger tracking all admin actions (e.g. *"Banned User @abc"*, *"Published Debate #4"*, *"Rotated API Keys"*). Every log entry registers the user ID, timestamp, IP, and action.
*   **Access Profiles:** Support for future staff tiers (e.g., moderators can view tickets and edit blogs, but cannot see API keys or billing stats).

### D. Obsidian Telemetry UI (Vercel-Style)
*   **Obsidian Dark Mode:** Glassmorphic dashboard utilizing semi-transparent card boundaries, deep dark backdrops, and neon status indicators.
*   **Recharts Integration:** Animated line and bar charts tracking real-time traffic, page views, and API usage stats.
*   **Command Bar (Ctrl + K):** Hit a keyboard hotkey to search users, jump to matches, or trigger settings instantly from anywhere in the portal.
