import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as fflate from "fflate";
import yaml from "js-yaml";
import * as admin from "firebase-admin";

// Load Firebase config for server-side use
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  // Note: firebase-admin doesn't support named databases in the same way as the client SDK 
  // without specific configuration, but for default databases it works fine.
  // If a specific databaseId is needed, it's usually handled via the settings.
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Oracle Simulation API (Your Own Logic) ---
  // Removed in favor of direct frontend Gemini integration

  // --- Momentum Analytics API ---
  app.post("/api/momentum-map", (req, res) => {
    const { matchId } = req.body;
    
    const points = [];
    for (let i = 1; i <= 20; i++) {
      const pressure = Math.sin(i / 2) * 50 + (Math.random() * 40 - 20);
      points.push({
        over: i,
        pressure: Math.round(pressure),
        event: i === 12 ? 'Wicket: Kohli' : i === 18 ? '4 Sixes: Dhoni' : undefined,
        impactPlayer: i === 12 ? 'Zampa' : i === 18 ? 'Dhoni' : undefined,
        isTurningPoint: i === 18
      });
    }

    res.json(points);
  });

  // --- Debate Room API ---
  const debates = [
    {
      id: '1',
      claim: "Virat Kohli is the greatest ODI batsman of all time.",
      arguments: {
        for: "Unmatched consistency, 50 centuries, and incredible chasing record.",
        against: "Viv Richards and Sachin Tendulkar played in tougher eras with different rules."
      },
      votes: { for: 1240, against: 850 },
      status: 'open',
      createdAt: new Date().toISOString(),
      trending: true
    },
    {
      id: '2',
      claim: "IPL has improved the quality of international cricket.",
      arguments: {
        for: "Exposure to high-pressure situations and global talent sharing.",
        against: "Workload issues and dilution of traditional techniques."
      },
      votes: { for: 3200, against: 1100 },
      status: 'open',
      createdAt: new Date().toISOString(),
      trending: true
    }
  ];

  app.get("/api/debates", (req, res) => {
    res.json(debates);
  });

  app.post("/api/debates/:id/vote", (req, res) => {
    const { id } = req.params;
    const { side } = req.body;
    const debate = debates.find(d => d.id === id);
    if (debate) {
      debate.votes[side as 'for' | 'against']++;
      res.json(debate);
    } else {
      res.status(404).json({ error: "Debate not found" });
    }
  });

  // --- Career Trajectory API ---
  app.post("/api/career-trajectory", (req, res) => {
    const { playerName } = req.body;
    
    // Mock data for different players
    const points = [];
    const startYear = playerName === 'Sachin Tendulkar' ? 1989 : playerName === 'MS Dhoni' ? 2004 : 2008;
    const endYear = 2024;
    
    for (let year = startYear; year <= endYear; year += 2) {
      points.push({
        year: year.toString(),
        rating: 40 + Math.random() * 55
      });
    }

    const chapters = [
      { year: `${startYear}-${startYear+4}`, title: "The Genesis", insight: "Early breakthrough and establishing presence." },
      { year: `${startYear+5}-${startYear+12}`, title: "The Golden Era", insight: "Peak performance and record-breaking consistency." },
      { year: `${startYear+13}-Present`, title: "The Legacy", insight: "Transitioning into a mentor role and tactical mastery." }
    ];

    res.json({ points, chapters });
  });

  // --- Vertex AI Super-Computer Bridge with Caching ---
  // Removed in favor of direct frontend Gemini integration

  // --- Claude Verdict Engine API ---
  app.post("/api/verdict", async (req, res) => {
    try {
      const { claim, contextData } = req.body;
      
      if (!process.env.CLAUDE_API_KEY) {
        return res.status(500).json({ error: "CLAUDE_API_KEY is not set in environment variables." });
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY,
      });

      const prompt = `
You are an expert cricket analyst and statistician. You are powering a "Verdict Engine".
The user has provided a claim about cricket, and some statistical context extracted from a database of 21,357 matches.

Context Data:
${JSON.stringify(contextData, null, 2)}

Claim: "${claim}"

Based on the context data and your expert knowledge, provide a verdict.
You must respond in EXACTLY this JSON format, nothing else:
{
  "claim": "The original claim",
  "verdict": "TRUE" | "FALSE" | "LARGELY TRUE" | "CONTESTED",
  "confidence": <number between 0 and 100>,
  "rawStats": [
    { "label": "Stat Name", "value": "Stat Value", "comparison": "Contextual comparison" }
  ],
  "contextStats": [
    { "label": "Context Name", "value": "Context Value", "description": "Why this matters" }
  ],
  "surpriseStat": {
    "value": "Surprising value",
    "label": "Surprising label",
    "context": "Why it's surprising"
  },
  "nuance": "A paragraph explaining the nuance of the verdict"
}
`;

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        temperature: 0.2,
        system: "You are a cricket verdict engine. Always respond in valid JSON.",
        messages: [
          { role: "user", content: prompt }
        ]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      
      try {
        // Find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        res.json(parsed);
      } catch (e) {
        console.error("Failed to parse Claude response:", text);
        res.status(500).json({ error: "Failed to parse verdict from AI." });
      }

    } catch (error: any) {
      console.error("Verdict Engine Error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // --- Local Ingestion API ---
  app.post("/api/ingest-local", async (req, res) => {
    const filePath = path.join(process.cwd(), "cricket_data.zip");
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "cricket_data.zip not found in root directory. Please upload it via the file explorer." });
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const zip = fflate.unzipSync(new Uint8Array(buffer));
      
      const files = Object.keys(zip).filter(name => name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml'));
      const totalFiles = files.length;
      
      const playerStats: Record<string, any> = {};
      const teamStats: Record<string, any> = {};
      let matchCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const fileName = files[i];
        const fileData = zip[fileName];
        const text = fflate.strFromU8(fileData);
        
        try {
          let matchData: any;
          if (fileName.endsWith('.json')) {
            matchData = JSON.parse(text);
          } else {
            matchData = yaml.load(text);
          }

          if (matchData?.info) {
            matchCount++;
            const teams = matchData.info.teams || [];
            teams.forEach((t: string) => {
              if (!teamStats[t]) teamStats[t] = { matches: 0, wins: 0 };
              teamStats[t].matches++;
              if (matchData.info.outcome?.winner === t) teamStats[t].wins++;
            });

            if (matchData.innings) {
              matchData.innings.forEach((inning: any) => {
                const overs = inning.overs || [];
                overs.forEach((over: any) => {
                  const deliveries = over.deliveries || [];
                  deliveries.forEach((ball: any) => {
                    const batter = ball.batter;
                    const bowler = ball.bowler;
                    const runs = ball.runs?.batter || 0;
                    const extras = ball.runs?.extras || 0;
                    const isWicket = !!ball.wickets;

                    if (!playerStats[batter]) playerStats[batter] = { matches: 0, runs: 0, balls: 0, outs: 0 };
                    playerStats[batter].runs += runs;
                    playerStats[batter].balls += 1;
                    if (isWicket && ball.wickets.some((w: any) => w.player_out === batter)) {
                      playerStats[batter].outs += 1;
                    }

                    if (!playerStats[bowler]) playerStats[bowler] = { matches: 0, runs_conceded: 0, balls_bowled: 0, wickets: 0 };
                    playerStats[bowler].runs_conceded += (runs + extras);
                    playerStats[bowler].balls_bowled += 1;
                    if (isWicket && ball.wickets.some((w: any) => w.kind !== 'run out')) {
                      playerStats[bowler].wickets += 1;
                    }
                  });
                });
              });
            }

            if (matchData.info.players) {
              Object.values(matchData.info.players).forEach((teamPlayers: any) => {
                teamPlayers.forEach((p: string) => {
                  if (!playerStats[p]) playerStats[p] = { matches: 0, runs: 0, balls: 0, outs: 0, wickets: 0, balls_bowled: 0 };
                  playerStats[p].matches++;
                });
              });
            }
          }
        } catch (err) {
          console.warn(`Failed to parse ${fileName}`, err);
        }
      }

      const topPlayers = Object.entries(playerStats)
        .sort((a: any, b: any) => b[1].matches - a[1].matches)
        .slice(0, 1000)
        .map(([name, s]: [string, any]) => {
          const avg = s.outs > 0 ? (s.runs / s.outs).toFixed(2) : s.runs;
          const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(2) : 0;
          const econ = s.balls_bowled > 0 ? ((s.runs_conceded / (s.balls_bowled / 6))).toFixed(2) : 0;
          const bowlAvg = s.wickets > 0 ? (s.runs_conceded / s.wickets).toFixed(2) : 0;
          
          return [name, {
            ...s,
            bat_avg: avg,
            bat_sr: sr,
            bowl_econ: econ,
            bowl_avg: bowlAvg
          }];
        })
        .reduce((acc, [k, v]) => ({ ...acc, [k as string]: v }), {});

      await db.collection('verdict_engine').doc('summary').set({
        totalMatches: matchCount,
        totalPlayers: Object.keys(playerStats).length,
        totalTeams: Object.keys(teamStats).length,
        lastUpdated: new Date().toISOString()
      });

      await db.collection('verdict_engine').doc('top_players').set(topPlayers);

      res.json({ success: true, matches: matchCount, players: Object.keys(playerStats).length });
      
    } catch (error: any) {
      console.error("Local Ingestion Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite Middleware for Development ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Oracle Engine running on http://localhost:${PORT}`);
  });
}

startServer();
