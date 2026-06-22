import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";

console.log("Server file is being executed...");
import OpenAI from "openai";
console.log("OpenAI imported.");
import { runMonteCarloSimulation } from "./src/services/simulationService";
console.log("simulationService imported.");
import {
  getPlayersToEnrich,
  upsertPlayerStyles,
  countPlayersToEnrich,
} from "./src/scripts/enrichPlayers";
console.log("enrichPlayers imported.");
import { supabase } from "./src/lib/supabaseServer";
console.log("supabaseServer imported.");
import { aiClient } from "./src/lib/ai";
console.log("aiClient imported.");
import { generateVerdict } from "./src/services/verdictService";
import Razorpay from "razorpay";
console.log("Razorpay imported.");

console.log("Initializing Razorpay...");
let razorpay: any;
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });
  console.log("Razorpay initialized successfully.");
} catch (err) {
  console.error("Razorpay initialization failed:", err);
  // We don't throw here to allow the server to start even if Razorpay fails
}

// --- Global State for Background Enrichment ---
interface EnrichmentState {
  status: "idle" | "running" | "paused" | "error" | "completed";
  processedCount: number;
  totalCount: number;
  lastMessage: string;
  startTime: number | null;
  error: string | null;
  lastPlayerName: string | null;
  lastStyles: string | null;
}

let enrichmentState: EnrichmentState = {
  status: "idle",
  processedCount: 0,
  totalCount: 0,
  lastMessage: "System ready.",
  startTime: null,
  error: null,
  lastPlayerName: null,
  lastStyles: null,
};

let stopEnrichmentRequested = false;
let pauseEnrichmentRequested = false;

const isStopRequested = () => stopEnrichmentRequested;
const isPauseRequested = () => pauseEnrichmentRequested;

const debates = [
  {
    id: "1",
    claim: "Virat Kohli is the greatest ODI batsman of all time.",
    arguments: {
      for: "Unmatched consistency, 50 centuries, and incredible chasing record.",
      against:
        "Viv Richards and Sachin Tendulkar played in tougher eras with different rules.",
    },
    votes: { for: 1240, against: 850 },
    status: "open",
    createdAt: new Date().toISOString(),
    trending: true,
  },
  {
    id: "2",
    claim: "IPL has improved the quality of international cricket.",
    arguments: {
      for: "Exposure to high-pressure situations and global talent sharing.",
      against: "Workload issues and dilution of traditional techniques.",
    },
    votes: { for: 3200, against: 1100 },
    status: "open",
    createdAt: new Date().toISOString(),
    trending: true,
  },
];

async function startServer() {
  console.log("startServer: Function called.");
  try {
    const app = express();
    const PORT = 3000;
    console.log(`startServer: Using PORT ${PORT}`);

    app.use(cors());
    app.use(express.json());
    console.log("startServer: express.json() middleware added.");

    app.get("/api/debates", (req, res) => {
      console.log("Received request for /api/debates");
      console.log("Global debates array length:", debates.length);
      res.json(debates);
    });

    app.post("/api/verdict", async (req, res) => {
      const { query, scope, context } = req.body;

      try {
        console.log("====================================================");
        console.log("VERDICT REQUEST RECEIVED");
        console.log(
          "generateVerdict source:",
          generateVerdict.toString().substring(0, 300),
        );
        console.log("====================================================");
        const result = await generateVerdict(query, scope, context);
        res.json(result);
      } catch (error: any) {
        console.error("CRITICAL VERDICT ERROR:", error);
        console.error("Verdict error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack,
          baseURL: aiClient?.baseURL,
        });

        let errorMessage = error.message || "Verdict generation failed";
        if (error.status === 404) {
          errorMessage = `AI API returned 404. Please check your NVIDIA_API_URL in the Secrets panel. Current baseURL: ${aiClient?.baseURL}`;
        }

        res.status(error.status || 500).json({ error: errorMessage });
      }
    });

    app.get("/api/ping", (req, res) => {
      console.log("GET /api/ping called");
      res.json({ status: "pong", time: new Date().toISOString() });
    });

    app.get("/api/health", (req, res) => {
      console.log("GET /api/health called");
      res.json({
        status: "ok",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV,
        config: {
          hasNvidiaKey: !!process.env.NVIDIA_API_KEY,
          hasMistralKey: !!process.env.MISTRAL_API_KEY,
          nvidiaUrl: process.env.NVIDIA_API_URL || "DEFAULT",
          nvidiaModel: process.env.NVIDIA_MODEL_NAME || "DEFAULT",
        },
      });
    });

    app.get("/api/debug-connection", async (req, res) => {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key =
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      const mistralKey = process.env.MISTRAL_API_KEY?.trim().replace(
        /^["']|["']$/g,
        "",
      );
      const nvidiaKey = process.env.NVIDIA_API_KEY?.trim().replace(
        /^["']|["']$/g,
        "",
      );

      const activeKey = nvidiaKey || mistralKey;
      const isNvidiaFormat = activeKey?.startsWith("nvapi-");

      let tableCheck = null;
      if (url && key) {
        try {
          const { count, error } = await supabase
            .from("players")
            .select("*", { count: "exact", head: true });
          tableCheck = error
            ? { error: error.message || String(error) }
            : { count };
        } catch (e: any) {
          tableCheck = { error: e.message };
        }
      }

      res.json({
        hasUrl: !!url,
        hasKey: !!key,
        hasMistralKey: !!mistralKey,
        hasNvidiaKey: !!nvidiaKey,
        activeKeyType: nvidiaKey
          ? "NVIDIA_API_KEY"
          : mistralKey
            ? "MISTRAL_API_KEY"
            : "NONE",
        isNvidiaFormat,
        keyPrefix: activeKey ? activeKey.substring(0, 10) : null,
        urlPrefix: url ? url.substring(0, 10) : null,
        envKeys: Object.keys(process.env).filter(
          (k) =>
            k.includes("SUPABASE") ||
            k.includes("MISTRAL") ||
            k.includes("NVIDIA"),
        ),
        tableCheck,
      });
    });

    app.get("/api/test-nvidia-direct", async (req, res) => {
      const apiKey = (process.env.NVIDIA_API_KEY || process.env.MISTRAL_API_KEY)
        ?.trim()
        .replace(/^["']|["']$/g, "");
      const baseURL = (
        process.env.NVIDIA_API_URL || "https://integrate.api.nvidia.com/v1"
      )
        .trim()
        .replace(/\/+$/, "");
      const url = `${baseURL}/chat/completions`;
      const model =
        process.env.NVIDIA_MODEL_NAME || "meta/llama-3.1-8b-instruct";

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });

        const status = response.status;
        const body = await response.text();
        res.json({ url, status, body, model });
      } catch (err: any) {
        res.status(500).json({ error: err.message, url });
      }
    });

    const mistralClient = process.env.MISTRAL_API_KEY
      ? new OpenAI({
          apiKey: process.env.MISTRAL_API_KEY,
          baseURL: "https://integrate.api.nvidia.com/v1",
        })
      : null;

    // --- Oracle Simulation API (Your Own Logic) ---
    const simulationCache: Record<string, any> = {};

    app.post("/api/simulate", async (req, res) => {
      const { matchId, teamA, teamB, venue, pitchType, weather } = req.body;

      if (simulationCache[matchId]) {
        return res.json({ ...simulationCache[matchId], cached: true });
      }

      try {
        const result = await runMonteCarloSimulation({
          matchId,
          teamA,
          teamB,
          venue,
          pitchType,
          weather,
        });

        simulationCache[matchId] = { ...result, cached: false };
        res.json(simulationCache[matchId]);
      } catch (error) {
        console.error("Simulation error:", error);
        res.status(500).json({ error: "Simulation failed" });
      }
    });

    // --- Historical Match Archive (CockroachDB) ---
    app.get("/api/matches/archive", async (req, res) => {
      const { limit = 20, offset = 0 } = req.query;
      try {
        const { getMatchArchive } =
          await import("./src/services/cockroachService");
        const matches = await getMatchArchive(Number(limit), Number(offset));
        res.json(matches);
      } catch (error: any) {
        console.error("Match archive error:", error);
        res.status(500).json({
          error: "Failed to fetch match archive. Ensure 'pg' is installed.",
        });
      }
    });

    app.get("/api/matches/:id/details", async (req, res) => {
      const { id } = req.params;
      try {
        const { getMatchDetails } =
          await import("./src/services/cockroachService");
        const details = await getMatchDetails(id);
        res.json(details);
      } catch (error: any) {
        console.error("Match details error:", error);
        res.status(500).json({ error: "Failed to fetch match details." });
      }
    });

    app.get("/api/series", async (req, res) => {
      try {
        const { getSeriesList } =
          await import("./src/services/cockroachService");
        const series = await getSeriesList();
        res.json(series);
      } catch (error: any) {
        console.error("Series list error:", error);
        res.status(500).json({ error: "Failed to fetch series list." });
      }
    });

    app.get("/api/series/matches", async (req, res) => {
      const { eventName, season } = req.query;
      try {
        const { getMatchesBySeries } =
          await import("./src/services/cockroachService");
        const matches = await getMatchesBySeries(
          String(eventName),
          String(season),
        );
        res.json(matches);
      } catch (error: any) {
        console.error("Series matches error:", error);
        res.status(500).json({ error: "Failed to fetch matches for series." });
      }
    });

    // --- Momentum Analytics API ---
    app.post("/api/momentum-map", (req, res) => {
      const { matchId } = req.body;

      const points = [];
      for (let i = 1; i <= 20; i++) {
        const pressure = Math.sin(i / 2) * 50 + (Math.random() * 40 - 20);
        points.push({
          over: i,
          pressure: Math.round(pressure),
          event:
            i === 12
              ? "Wicket: Kohli"
              : i === 18
                ? "4 Sixes: Dhoni"
                : undefined,
          impactPlayer: i === 12 ? "Zampa" : i === 18 ? "Dhoni" : undefined,
          isTurningPoint: i === 18,
        });
      }

      res.json(points);
    });

    // --- Data Enrichment API ---
    // --- Player Enrichment Background Worker ---
    const sleep = (ms: number) => {
      return new Promise((resolve) => { setTimeout(resolve, ms); });
    };

    /* eslint-disable no-await-in-loop */
    const runEnrichmentBackground = async () => {
      if (enrichmentState.status === "running") return;

      enrichmentState.status = "running";
      enrichmentState.startTime = Date.now();
      enrichmentState.error = null;
      stopEnrichmentRequested = false;
      pauseEnrichmentRequested = false;

      try {
        if (!aiClient) {
          enrichmentState.status = "error";
          enrichmentState.error =
            "NVIDIA_API_KEY or MISTRAL_API_KEY missing in environment.";
          enrichmentState.lastMessage = "Configuration error: API Key missing.";
          return;
        }

        // Get total count first
        try {
          console.log("Enrichment: Fetching total count...");
          const total = await countPlayersToEnrich();
          enrichmentState.totalCount = total;
          console.log("Enrichment: Total count:", total);
        } catch (countErr: any) {
          console.error("Enrichment: Failed to get initial count:", countErr);
          enrichmentState.lastMessage =
            "Warning: Could not fetch total count. Starting anyway...";
        }

        let hasMore = true;
        const batchSize = 20; // Reduced to prevent timeouts
        const concurrencyLimit = 4; // User requested concurrency

        while (hasMore && !isStopRequested()) {
          console.log(
            `Enrichment: Loop iteration start. hasMore=${hasMore}, stopRequested=${stopEnrichmentRequested}`,
          );
          enrichmentState.lastMessage = "Starting batch fetch...";

          // Handle Pause
          while (isPauseRequested() && !isStopRequested()) {
            enrichmentState.status = "paused";
            enrichmentState.lastMessage = "Enrichment paused by user.";
            await sleep(2000);
          }
          if (isStopRequested()) break;

          enrichmentState.status = "running";
          enrichmentState.lastMessage = `Fetching next batch... (Processed: ${enrichmentState.processedCount})`;

          let players: any[] = [];
          try {
            players = (await Promise.race([
              getPlayersToEnrich(),
              new Promise((_, reject) => {
                setTimeout(
                  () => reject(new Error("Supabase query timed out after 45s")),
                  45000,
                );
              }),
            ])) as any[];
          } catch (fetchErr: any) {
            console.error("Enrichment: Batch fetch failed:", fetchErr);
            enrichmentState.error = fetchErr.message || String(fetchErr);
            enrichmentState.lastMessage = `Fetch failed: ${enrichmentState.error}. Retrying in 10s...`;
            await sleep(10000);
            continue;
          }

          console.log(`Enrichment: Fetched ${players?.length || 0} players`);
          if (!players || players.length === 0) {
            hasMore = false;
            break;
          }

          // Split players into batches
          console.log(
            `Enrichment: Splitting ${players.length} players into batches of ${batchSize}...`,
          );
          const batches = [];
          for (let i = 0; i < players.length; i += batchSize) {
            batches.push(players.slice(i, i + batchSize));
          }
          console.log(`Enrichment: Created ${batches.length} batches.`);

          // Process batches with concurrency limit
          console.log(
            `Enrichment: Starting parallel processing with concurrency limit ${concurrencyLimit}...`,
          );

          // Use a simple queue to process batches
          const queue = [...batches];
          const workers = Array(concurrencyLimit)
            .fill(null)
            .map(async () => {
              while (queue.length > 0 && !isStopRequested()) {
                const chunk = queue.shift();
                if (!chunk) continue;

                console.log(
                  `Enrichment: Worker starting batch of ${chunk.length} players...`,
                );

                let retryCount = 0;
                const maxRetries = 2;
                let success = false;

                while (
                  !success &&
                  retryCount < maxRetries &&
                  !isStopRequested()
                ) {
                  try {
                    const playerList = chunk
                      .map(
                        (p: any, idx: number) =>
                          `${idx + 1}. ${p.player_name} (Gender: ${p.gender}, ID: ${p.player_id})`,
                      )
                      .join("\n");

                    console.log(`Enrichment: Sending batch to AI...`);
                    const response = await aiClient!.chat.completions.create({
                      model: "mistralai/mistral-large-3-675b-instruct-2512",
                      messages: [
                        {
                          role: "system",
                          content:
                            'You are a cricket data expert. Return ONLY a JSON object with a "players" key containing an array of objects with "id", "bowling", and "batting" keys. If unsure about a player, return "Unknown" for styles. Do not guess.',
                        },
                        {
                          role: "user",
                          content: `Enrich the following players:\n${playerList}`,
                        },
                      ],
                      response_format: { type: "json_object" },
                      temperature: 0.1,
                      max_tokens: 4000,
                    } as any);
                    console.log(`Enrichment: AI response received.`);

                    const content = response.choices?.[0]?.message?.content;
                    if (!content) throw new Error("No content from AI");

                    // Log the raw content for debugging
                    console.log(
                      `Enrichment: Raw AI response: ${content.substring(0, 200)}...`,
                    );

                    let results: any;
                    try {
                      // Attempt to find JSON within the content if it's wrapped in markdown
                      const jsonMatch =
                        content.match(/\[.*\]/s) || content.match(/\{.*\}/s);
                      const jsonString = jsonMatch ? jsonMatch[0] : content;
                      results = JSON.parse(jsonString);
                    } catch (parseErr) {
                      console.error(
                        "Enrichment: Failed to parse AI response. Raw content:",
                        content,
                      );
                      throw new Error("Invalid JSON response from AI");
                    }

                    if (
                      !Array.isArray(results) &&
                      typeof results === "object" &&
                      results !== null
                    ) {
                      const keys = Object.keys(results);
                      for (const key of keys) {
                        if (Array.isArray(results[key])) {
                          results = results[key];
                          break;
                        }
                      }
                    }

                    if (!Array.isArray(results)) results = [];

                    const updateData = results.map((res: any) => {
                      const resId =
                        res.id || res.player_id || res.ID || res.PlayerID;
                      const originalPlayer = chunk.find(
                        (p: any) => String(p.player_id) === String(resId),
                      );
                      return {
                        player_id: originalPlayer
                          ? originalPlayer.player_id
                          : resId,
                        player_name: originalPlayer
                          ? originalPlayer.player_name
                          : "Unknown",
                        bowling_style:
                          res.bowling || res.bowling_style || "Unknown",
                        batting_style:
                          res.batting || res.batting_style || "Unknown",
                      };
                    });

                    const validUpdateData = updateData.filter((d: any) =>
                      chunk.some(
                        (p: any) => String(p.player_id) === String(d.player_id),
                      ),
                    );

                    if (validUpdateData.length > 0) {
                      console.log(
                        `Enrichment: Upserting ${validUpdateData.length} player styles`,
                      );
                      await Promise.race([
                        upsertPlayerStyles(validUpdateData),
                        new Promise((_, reject) => {
                          setTimeout(
                            () =>
                              reject(
                                new Error(
                                  "Supabase upsert timed out after 30s",
                                ),
                              ),
                            30000,
                          );
                        }),
                      ]);
                      console.log(`Enrichment: Upsert completed`);
                    }

                    enrichmentState.processedCount += chunk.length;
                    enrichmentState.lastMessage = `Processed ${enrichmentState.processedCount} players...`;
                    success = true;
                    console.log(`Enrichment: Batch completed successfully.`);
                  } catch (err: any) {
                    retryCount++;
                    console.error(
                      `Enrichment: Batch error (Retry ${retryCount}/${maxRetries}):`,
                      err,
                    );
                    if (retryCount < maxRetries) {
                      await sleep(2000 * retryCount); // Exponential backoff
                    } else {
                      console.error(
                        `Enrichment: Batch failed after ${maxRetries} retries.`,
                      );
                      enrichmentState.error = `Batch failed: ${err.message}`;
                    }
                  }
                }
              }
            });

          await Promise.all(workers);

          if (players.length < 1000) hasMore = false;
        }

        if (stopEnrichmentRequested) {
          enrichmentState.status = "idle";
          enrichmentState.lastMessage = "Enrichment stopped by user.";
        } else {
          enrichmentState.status = "completed";
          enrichmentState.lastMessage = "All players enriched successfully!";
        }
      } catch (err: any) {
        console.error("Background enrichment fatal error:", err);
        enrichmentState.status = "error";
        enrichmentState.error = err.message || String(err);
        enrichmentState.lastMessage = `Fatal error: ${enrichmentState.error}`;
      }
    }

    app.post("/api/enrich-start", (req, res) => {
      console.log("POST /api/enrich-start received");
      if (enrichmentState.status === "running") {
        return res.json({ message: "Already running", state: enrichmentState });
      }
      // Reset if starting fresh
      if (
        enrichmentState.status === "completed" ||
        enrichmentState.status === "idle" ||
        enrichmentState.status === "error"
      ) {
        enrichmentState.processedCount = 0;
        enrichmentState.lastPlayerName = null;
        enrichmentState.lastStyles = null;
      }
      runEnrichmentBackground(); // Don't await, run in background
      res.json({
        message: "Enrichment started in background",
        state: enrichmentState,
      });
    });

    app.get("/api/enrich-status", (req, res) => {
      console.log("GET /api/enrich-status received");
      res.json(enrichmentState);
    });

    app.post("/api/enrich-pause", (req, res) => {
      pauseEnrichmentRequested = true;
      res.json({ message: "Pause requested" });
    });

    app.post("/api/enrich-resume", (req, res) => {
      pauseEnrichmentRequested = false;
      if (enrichmentState.status === "paused") {
        enrichmentState.status = "running";
      }
      res.json({ message: "Resume requested" });
    });

    app.post("/api/enrich-stop", (req, res) => {
      stopEnrichmentRequested = true;
      pauseEnrichmentRequested = false;
      res.json({ message: "Stop requested" });
    });

    app.post("/api/enrich-force-reset", (req, res) => {
      enrichmentState.status = "idle";
      enrichmentState.lastMessage = "Enrichment force-reset by user.";
      enrichmentState.error = null;
      stopEnrichmentRequested = false;
      pauseEnrichmentRequested = false;
      res.json({ message: "Force reset successful", state: enrichmentState });
    });

    app.post("/api/ai-chat", async (req, res) => {
      console.log(
        "POST /api/ai-chat called with body:",
        JSON.stringify(req.body).substring(0, 200),
      );
      const {
        messages,
        model = "mistralai/mistral-large-3-675b-instruct-2512",
        temperature = 0.7,
        max_tokens = 1000,
      } = req.body;

      if (!aiClient) {
        console.error("AI client not initialized.");
        return res
          .status(500)
          .json({ error: "AI client not initialized. Check NVIDIA_API_KEY." });
      }

      try {
        console.log("Calling AI client...");
        const response = await aiClient.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens,
        });
        console.log("AI client response received.");

        res.json({
          text: response.choices[0]?.message?.content || "",
          usage: response.usage,
        });
      } catch (error: any) {
        console.error("AI Chat error:", error);
        res.status(500).json({ error: error.message || "AI request failed" });
      }
    });

    app.get("/api/enrich-count", async (req, res) => {
      try {
        const count = await countPlayersToEnrich();
        res.json({ count });
      } catch (error) {
        console.error("Enrichment count error:", error);
        res.status(500).json({ error: "Failed to get enrichment count" });
      }
    });

    app.get("/api/debug-schema", async (req, res) => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          res.json({ columns: Object.keys(data[0]), sample: data[0] });
        } else {
          res.json({ message: "No players found in table." });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message || String(error) });
      }
    });

    // --- Razorpay Endpoints ---
    app.post("/api/create-order", async (req, res) => {
      try {
        const { amount } = req.body; // amount in INR
        const options = {
          amount: amount * 100, // amount in the smallest currency unit
          currency: "INR",
          receipt: "order_rcptid_" + Date.now(),
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
      } catch (error) {
        console.error("Razorpay order creation error:", error);
        res.status(500).json({ error: "Failed to create order" });
      }
    });

    app.post("/api/verify-payment", async (req, res) => {
      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          userId,
        } = req.body;

        // Note: In production, you MUST verify the signature using crypto
        if (razorpay_signature) {
          // Update Supabase
          const { error } = await supabase
            .from("profiles")
            .update({ is_subscribed: true })
            .eq("id", userId);

          if (error) throw error;

          res.json({ success: true });
        } else {
          res.status(400).json({ error: "Invalid signature" });
        }
      } catch (error) {
        console.error("Razorpay verification error:", error);
        res.status(500).json({ error: "Failed to verify payment" });
      }
    });

    app.get("/api/players-to-enrich", async (req, res) => {
      console.log("GET /api/players-to-enrich called");
      try {
        const players = await getPlayersToEnrich();
        console.log(`Found ${players.length} players to enrich`);
        res.json(players);
      } catch (error) {
        console.error("Failed to fetch players:", error);
        res.status(500).json({ error: "Failed to fetch players" });
      }
    });

    app.post("/api/update-player-styles", async (req, res) => {
      try {
        const { data } = req.body;
        if (!data || !Array.isArray(data)) {
          return res
            .status(400)
            .json({ error: "Invalid data format. Expected an array." });
        }
        await upsertPlayerStyles(data);
        res.json({ success: true });
      } catch (error: any) {
        console.error("Failed to update player styles:", error);
        // More robust error extraction
        let errorMsg = "Unknown error";
        if (typeof error === "string") {
          errorMsg = error;
        } else if (error.message) {
          errorMsg = error.message;
        } else if (error.details) {
          errorMsg = error.details;
        } else {
          try {
            errorMsg = JSON.stringify(error);
          } catch (e) {
            errorMsg = String(error);
          }
        }
        res.status(500).json({ error: `Update failed: ${errorMsg}` });
      }
    });

    app.post("/api/enrich-batch-mistral", async (req, res) => {
      const { players } = req.body;
      // Prefer NVIDIA_API_KEY if available, fallback to MISTRAL_API_KEY
      // Clean key of any accidental quotes or whitespace
      const apiKey = (process.env.NVIDIA_API_KEY || process.env.MISTRAL_API_KEY)
        ?.trim()
        .replace(/^["']|["']$/g, "");

      if (!apiKey) {
        return res.status(500).json({
          error:
            "NVIDIA_API_KEY or MISTRAL_API_KEY not configured on server. Please set NVIDIA_API_KEY in the Secrets panel.",
        });
      }

      // Create a fresh client for every request to ensure we use the latest key
      const client = new OpenAI({
        apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
        timeout: 60000, // 60s timeout for larger batches
      } as any);

      try {
        const playerList = players
          .map(
            (p: any, idx: number) =>
              `${idx + 1}. ${p.player_name} (ID: ${p.player_id})`,
          )
          .join("\n");

        const response = await client.chat.completions.create({
          model: "mistralai/mistral-large-3-675b-instruct-2512",
          messages: [
            {
              role: "system",
              content:
                "You are a cricket data expert. Your task is to extract the player name from the input and provide their official styles.",
            },
            {
              role: "user",
              content: `For each entry below, extract the actual cricket player's name (removing noise like team names or roles like (c), (wk)) and provide their official "bowling" and "batting" styles. Use "Unknown" if not found. Return exactly as: [{"id": "...", "bowling": "...", "batting": "..."}]\n\nPlayers:\n${playerList}`,
            },
          ],
          response_format: { type: "json_object" },
        } as any);

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("No content from Mistral");

        let results = [];
        try {
          results = JSON.parse(content as string);
        } catch (e) {
          console.error("JSON Parse Error from Mistral:", content);
          // Try to extract JSON if it's wrapped in markdown
          const jsonMatch = (content as string).match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            results = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Mistral returned invalid JSON format");
          }
        }

        // Handle cases where Mistral wraps the array in an object
        if (
          !Array.isArray(results) &&
          typeof results === "object" &&
          results !== null
        ) {
          const keys = Object.keys(results);
          let foundArray = false;
          for (const key of keys) {
            if (Array.isArray(results[key])) {
              results = results[key];
              foundArray = true;
              break;
            }
          }
          if (!foundArray) {
            results = []; // Fallback to empty array if no array found in object
          }
        } else if (!Array.isArray(results)) {
          results = [];
        }

        res.json(results);
      } catch (error: any) {
        console.error("Mistral enrichment error:", error);

        // Handle "Rate exceeded" or other non-JSON text responses from NVIDIA
        const errorMsg = error.message || String(error);
        if (
          error.status === 429 ||
          errorMsg.includes("Rate exceeded") ||
          errorMsg.includes("Unexpected token")
        ) {
          return res.status(429).json({
            error:
              "NVIDIA Rate Limit Exceeded. The app will automatically retry in 10 seconds.",
          });
        }

        res
          .status(500)
          .json({ error: `Mistral enrichment failed: ${errorMsg}` });
      }
    });

    // --- Debate Room API ---
    app.post("/api/debates/:id/vote", (req, res) => {
      const { id } = req.params;
      const { side } = req.body;
      const debate = debates.find((d) => d.id === id);
      if (debate) {
        debate.votes[side as "for" | "against"]++;
        res.json(debate);
      } else {
        res.status(404).json({ error: "Debate not found" });
      }
    });

    // --- Debate Chat API ---
    const debateMessages: Record<string, any[]> = {
      "1": [
        {
          id: "m1",
          user: "CricketFan99",
          text: "Kohli is definitely the GOAT in ODIs.",
          vote: "for",
          timestamp: new Date().toISOString(),
        },
        {
          id: "m2",
          user: "OldSchoolLover",
          text: "Sachin played in a different era, you can't compare.",
          vote: "against",
          timestamp: new Date().toISOString(),
        },
      ],
      "2": [
        {
          id: "m3",
          user: "T20Specialist",
          text: "IPL has brought so much innovation.",
          vote: "for",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    app.get("/api/debates/:id/messages", (req, res) => {
      const { id } = req.params;
      res.json(debateMessages[id] || []);
    });

    app.post("/api/debates/:id/messages", (req, res) => {
      const { id } = req.params;
      const { user, text, vote } = req.body;

      if (!debateMessages[id]) {
        debateMessages[id] = [];
      }

      const newMessage = {
        id: Math.random().toString(36).substr(2, 9),
        user,
        text,
        vote,
        timestamp: new Date().toISOString(),
      };

      debateMessages[id].push(newMessage);
      res.json(newMessage);
    });

    // --- Career Trajectory API ---
    app.post("/api/career-trajectory", (req, res) => {
      const { playerName } = req.body;

      // Mock data for different players
      const points = [];
      const startYear =
        playerName === "Sachin Tendulkar"
          ? 1989
          : playerName === "MS Dhoni"
            ? 2004
            : 2008;
      const endYear = 2024;

      for (let year = startYear; year <= endYear; year += 2) {
        points.push({
          year: year.toString(),
          rating: 40 + Math.random() * 55,
        });
      }

      const chapters = [
        {
          year: `${startYear}-${startYear + 4}`,
          title: "The Genesis",
          insight: "Early breakthrough and establishing presence.",
        },
        {
          year: `${startYear + 5}-${startYear + 12}`,
          title: "The Golden Era",
          insight: "Peak performance and record-breaking consistency.",
        },
        {
          year: `${startYear + 13}-Present`,
          title: "The Legacy",
          insight: "Transitioning into a mentor role and tactical mastery.",
        },
      ];

      res.json({ points, chapters });
    });

    // --- Vertex AI Super-Computer Bridge with Caching ---
    // Removed in favor of direct frontend Gemini integration

    // --- Global Error Handler ---
    app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        console.error("GLOBAL ERROR HANDLER:", err);
        res.status(500).json({
          error: "Internal Server Error",
          message: err.message || String(err),
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
      },
    );

    // Catch-all for unmatched /api routes to prevent them from falling through to Vite
    app.all("/api/*", (req, res) => {
      console.warn(`Unmatched API route: ${req.method} ${req.url}`);
      res.status(404).json({
        error: "API route not found",
        method: req.method,
        url: req.url,
      });
    });

    // --- Vite Middleware for Development ---
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Oracle Engine running on http://0.0.0.0:${PORT}`);
    });
    console.log("startServer: app.listen called.");
  } catch (err) {
    console.error("startServer: Fatal error during initialization:", err);
    throw err;
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

startServer().catch((err) => {
  console.error("Fatal error during server startup:", err);
});
