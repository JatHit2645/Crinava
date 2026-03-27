import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  console.log("Starting server...");
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
    console.log("Received request for /api/debates");
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

  // --- Debate Chat API ---
  const debateMessages: Record<string, any[]> = {
    '1': [
      { id: 'm1', user: 'CricketFan99', text: 'Kohli is definitely the GOAT in ODIs.', vote: 'for', timestamp: new Date().toISOString() },
      { id: 'm2', user: 'OldSchoolLover', text: 'Sachin played in a different era, you can\'t compare.', vote: 'against', timestamp: new Date().toISOString() }
    ],
    '2': [
      { id: 'm3', user: 'T20Specialist', text: 'IPL has brought so much innovation.', vote: 'for', timestamp: new Date().toISOString() }
    ]
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
      timestamp: new Date().toISOString()
    };
    
    debateMessages[id].push(newMessage);
    res.json(newMessage);
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
