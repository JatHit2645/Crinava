# Crinava — Data Polishing Architecture Plan
> **Keyword Trigger:** "Data Polishing"
> **Purpose:** Scalable PostgreSQL Database & Multi-Tier Caching Architecture for Crinava's Launch on Oracle Cloud Always Free VM (₹0 / 24GB RAM / 200GB SSD).

Whenever the user triggers **"Data Polishing"**, we will execute the following plan to migrate, optimize, and cache the database:

---

## 1. Database Tier: PostgreSQL on Oracle VM
*   **Hosting:** Deploy a native PostgreSQL instance on the Oracle Always Free VM.
*   **Storage:** Use the **200 GB SSD block storage** allocated to the VM.
*   **Optimization (Indexing):** Run SQL scripts to index critical fields to prevent table-scan lags:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_deliveries_match_id ON deliveries(match_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_event_season ON deliveries(event_name, season);
    CREATE INDEX IF NOT EXISTS idx_matches_event_season ON matches(event, season);
    ```
*   **De-normalization:** When a match is marked `Completed`, pre-calculate the scorecard once and save it in a single JSON text column in a `match_scorecards` table, instead of running live aggregations over millions of rows of deliveries.

---

## 2. Server Caching Tier: In-Memory Redis Cache
*   **Hosting:** Install a local Redis instance on the Oracle VM (highly efficient in-memory key-value store).
*   **RAM Allocation:** Allocate up to 1 GB of the server's 24 GB RAM for caching.
*   **Logic:**
    1. Read Request → Check Redis cache for `scorecard:match_id`.
    2. Cache Hit → Return scorecard instantly (0.01 seconds).
    3. Cache Miss → Query PostgreSQL database → Save result in Redis → Return scorecard.
*   **TTL (Time To Live):** Completed match caches live forever (never change). Live match caches expire every 10 seconds.

---

## 3. Client Caching Tier: Browser IndexedDB Cache
*   **Hosting:** Browser-side local storage using `IndexedDB` on the user's device (phone/laptop).
*   **Logic:**
    1. Frontend checks browser IndexedDB for the match ID.
    2. If found, load scorecard instantly (0 seconds) without hitting the Oracle server.
    3. If not found, fetch from Oracle server once and save to IndexedDB.
*   **Benefit:** Saves bandwidth, drops server load to near zero for repeat users, and works for users of any age.

---

## How to Resume/Execute:
1. Setup the Oracle Cloud VM.
2. Provide terminal/SSH credentials or host IP.
3. Migrate the local 8 GB database to the VM.
4. Implement the Redis and IndexedDB caching blocks.
