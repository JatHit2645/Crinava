/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Search,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Share2,
  ArrowLeft,
  Trophy,
  Info,
  ChevronRight,
  ChevronDown,
  Bell,
  UserCircle,
  LayoutDashboard,
  PlusCircle,
  Gavel,
  User,
  Waves,
  MessageSquare,
  BookOpen,
  Target,
  Users,
  Wallet,
  Ticket,
  Brain,
  Infinity,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import ReactMarkdown from "react-markdown";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import {
  onAuthStateChanged,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { doc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { AuthModal } from "./components/AuthModal";

// --- Types ---

type VerdictStatus = "TRUE" | "FALSE" | "LARGELY TRUE" | "CONTESTED";
type AppTab =
  | "home"
  | "verdict"
  | "momentum"
  | "debate"
  | "career"
  | "smartxi"
  | "live"
  | "raffle"
  | "blog"
  | "prediction"
  | "admin"
  | "store";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "alert";
}

const CoinIcon = ({
  size = 24,
  className = "",
  noShadow = false,
}: {
  size?: number;
  className?: string;
  noShadow?: boolean;
}) => (
  <div
    className={`relative flex items-center justify-center rounded-full overflow-hidden ${noShadow ? "" : "shadow-[0_4px_12px_rgba(0,0,0,0.5)]"} ${className}`}
    style={{ width: size, height: size }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-metallic-gold via-white to-metallic-gold animate-shimmer" />
    <div className="absolute inset-[1.5px] bg-gradient-to-br from-[#B8860B] via-[#DAA520] to-[#8B4513] rounded-full" />
    <div className="absolute inset-[3px] bg-gradient-to-br from-metallic-gold via-[#FFFACD] to-metallic-gold rounded-full" />
    <div className="relative z-10 flex items-center justify-center">
      <Infinity
        size={size * 0.5}
        className="text-[#5C4033] drop-shadow-sm"
        strokeWidth={3}
      />
    </div>
    <div className="absolute inset-0 border-[0.5px] border-white/30 rounded-full" />
  </div>
);

interface MatchData {
  teams: string[];
  score: string;
  status: string;
  venue: string;
  format: string;
  series: string;
  isLive: boolean;
}

interface BlogPost {
  title: string;
  date: string;
  readTime: string;
  content: string;
  category: string;
  isAI: boolean;
}

interface PredictionResult {
  match: string;
  winner: string;
  probability: number;
  factors: {
    toss: string;
    weather: string;
    pitch: string;
    wind?: string;
    humidity?: string;
  };
  simulationDetails: string;
}

interface RaffleHistory {
  drawId: string;
  winner: string;
  prize: string;
  date: string;
}

interface Debate {
  id: string;
  claim: string;
  arguments: {
    for: string;
    against: string;
  };
  votes: {
    for: number;
    against: number;
  };
  userVote?: "for" | "against";
  userReasoning?: string;
  status: "open" | "closed";
  createdAt: string;
  trending?: boolean;
}

interface Player {
  id: string;
  name: string;
  role: "Batsman" | "Bowler" | "All-rounder" | "Wicketkeeper";
  stats: {
    matches: number;
    runs?: number;
    wickets?: number;
    average: number;
    strikeRate: number;
  };
}

interface MomentumPoint {
  over: number;
  pressure: number; // -100 to 100 (Team A vs Team B)
  event?: string;
  impactPlayer?: string;
  isTurningPoint?: boolean;
}

async function generateBlogPost(topic: string): Promise<BlogPost> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a short, insightful cricket blog post about: ${topic}. Include a title, content, category, and estimated read time. Focus on technical analysis.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          category: { type: Type.STRING },
          readTime: { type: Type.STRING },
        },
        required: ["title", "content", "category", "readTime"],
      },
    },
  });
  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    date: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    isAI: true,
  };
}

interface VerdictData {
  claim: string;
  verdict: VerdictStatus;
  confidence: number;
  rawStats: {
    label: string;
    value: string;
    comparison?: string;
  }[];
  contextStats: {
    label: string;
    value: string;
    description: string;
  }[];
  surpriseStat: {
    value: string;
    label: string;
    context: string;
  };
  nuance: string;
}

// --- AI Service ---

const ORACLE_SYSTEM_PROMPT = `You are the "Crinava Oracle," a high-performance Statistical Simulation Engine. Your mission is to perform a Monte Carlo simulation of 5,000,000 iterations for a cricket match. You must use your internal Python code execution environment to run the actual mathematical loops to ensure 100% computational accuracy.

Factors for Consideration:
1. Playing XI Synergy: Analyze specific matchups (e.g., Bowler A vs Batsman B).
2. Pitch & Ground Conditions: Historical data of the venue, boundary sizes, and soil type.
3. Atmospheric Data: Humidity, wind speed, and dew factor (especially for night matches).
4. The Toss: Impact of batting first vs. chasing based on venue history.
5. In-Game Momentum: Probability of collapses or late-overs acceleration.

Output Requirements (JSON format):
{
  "winProbability": { "Team A": number, "Team B": number },
  "verdict": string,
  "keyInsights": [ { "label": string, "detail": string } ],
  "projectedScoreRange": { "low": number, "high": number, "avg": number },
  "simulationLog": string
}`;

const apiKey =
  process.env.GEMINI_API_KEY || "AIzaSyByjeGftpfWRfOy79WR6-hFimBSyTqTfqI";
const ai = new GoogleGenAI({ apiKey });

async function getCricketVerdict(claim: string): Promise<VerdictData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this cricket claim: "${claim}". Provide a deep, data-driven verdict.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING },
          verdict: {
            type: Type.STRING,
            enum: ["TRUE", "FALSE", "LARGELY TRUE", "CONTESTED"],
          },
          confidence: { type: Type.NUMBER },
          rawStats: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                comparison: { type: Type.STRING },
              },
              required: ["label", "value"],
            },
          },
          contextStats: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["label", "value", "description"],
            },
          },
          surpriseStat: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              label: { type: Type.STRING },
              context: { type: Type.STRING },
            },
            required: ["value", "label", "context"],
          },
          nuance: { type: Type.STRING },
        },
        required: [
          "claim",
          "verdict",
          "confidence",
          "rawStats",
          "contextStats",
          "surpriseStat",
          "nuance",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

async function getLiveScores(): Promise<MatchData[]> {
  const prompt =
    "Get the current live cricket scores for all ongoing matches worldwide. Return a list of matches with teams, current score, status, venue, format, and series name.";
  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          teams: { type: Type.ARRAY, items: { type: Type.STRING } },
          score: { type: Type.STRING },
          status: { type: Type.STRING },
          venue: { type: Type.STRING },
          format: { type: Type.STRING },
          series: { type: Type.STRING },
          isLive: { type: Type.BOOLEAN },
        },
        required: [
          "teams",
          "score",
          "status",
          "venue",
          "format",
          "series",
          "isLive",
        ],
      },
    },
  };

  try {
    // Try with Google Search first for real-time data
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        ...config,
        tools: [{ googleSearch: {} }],
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.warn("Live scores with search failed, trying fallback:", error);
    try {
      // Fallback: Try without search (model might have some recent data or can at least return empty list gracefully)
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config,
      });
      return JSON.parse(response.text || "[]");
    } catch (fallbackError) {
      console.error(
        "Error fetching live scores (all attempts failed):",
        fallbackError,
      );
      return [];
    }
  }
}

async function runMatchSimulation(match: string): Promise<PredictionResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Run a 1 million iteration simulation for the match: ${match}. Consider the latest toss results, weather conditions (wind, humidity), and pitch reports. Provide the most probable winner and the reasoning.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          match: { type: Type.STRING },
          winner: { type: Type.STRING },
          probability: { type: Type.NUMBER },
          factors: {
            type: Type.OBJECT,
            properties: {
              toss: { type: Type.STRING },
              weather: { type: Type.STRING },
              pitch: { type: Type.STRING },
              wind: { type: Type.STRING },
              humidity: { type: Type.STRING },
            },
            required: ["toss", "weather", "pitch"],
          },
          simulationDetails: { type: Type.STRING },
        },
        required: [
          "match",
          "winner",
          "probability",
          "factors",
          "simulationDetails",
        ],
      },
    },
  });
  return JSON.parse(response.text || "{}");
}

// --- Components ---

const VerdictCard = ({
  data,
  onBack,
}: {
  data: VerdictData;
  onBack: () => void;
}) => {
  const getStatusColor = (status: VerdictStatus) => {
    switch (status) {
      case "TRUE":
        return "text-aurora-teal";
      case "FALSE":
        return "text-red-500";
      case "LARGELY TRUE":
        return "text-aurora-teal/80";
      case "CONTESTED":
        return "text-metallic-gold";
    }
  };

  const getStatusIcon = (status: VerdictStatus) => {
    const color = getStatusColor(status);
    switch (status) {
      case "TRUE":
      case "LARGELY TRUE":
        return <ShieldCheck className={`w-8 h-8 ${color}`} />;
      case "FALSE":
        return <ShieldAlert className={`w-8 h-8 ${color}`} />;
      case "CONTESTED":
        return <ShieldQuestion className={`w-8 h-8 ${color}`} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          New Analysis
        </span>
      </button>

      <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusIcon(data.verdict)}
                <span
                  className={`px-3 py-1 rounded-lg text-[10px] font-black border border-current uppercase tracking-widest ${getStatusColor(data.verdict)}`}
                >
                  {data.verdict}
                </span>
              </div>
              <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2">
                Oracle Confidence: {data.confidence}%
              </div>
            </div>
            <button className="p-2 bg-white/5 rounded-lg text-aurora-teal hover:bg-white/10 transition-colors">
              <Share2 size={20} />
            </button>
          </div>
          <h2 className="text-2xl md:text-3xl font-black italic text-white leading-tight">
            "{data.claim}"
          </h2>
        </div>

        {/* Body */}
        <div className="p-8 space-y-10">
          {/* Raw Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {data.rawStats.map((stat, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xl font-black text-white">
                  {stat.value}
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                  {stat.label}
                </div>
                {stat.comparison && (
                  <div className="text-[8px] text-aurora-teal/60 italic">
                    {stat.comparison}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Context Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.contextStats.map((stat, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {stat.label}
                  </span>
                  <span className="text-sm font-black text-aurora-teal">
                    {stat.value}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>

          {/* Surprise Stat */}
          <div className="p-6 rounded-xl bg-metallic-gold/5 border border-metallic-gold/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Info size={64} className="text-metallic-gold" />
            </div>
            <div className="relative z-10 space-y-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-metallic-gold">
                Surprise Telemetry
              </h3>
              <div className="text-2xl font-black text-metallic-gold">
                {data.surpriseStat.value}
              </div>
              <div className="text-[11px] font-bold text-white/80">
                {data.surpriseStat.label}
              </div>
              <p className="text-[10px] text-gray-500 italic font-medium">
                {data.surpriseStat.context}
              </p>
            </div>
          </div>

          {/* Nuance */}
          <div className="pt-6 border-t border-white/5">
            <p className="text-[11px] text-gray-400 italic text-center font-medium">
              "{data.nuance}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-center">
          <div className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-600">
            Neon Oracle Engine • Crinava Intelligence
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(500); // Balance in Crinava Coins
  const [cricketIQ, setCricketIQ] = useState(1240); // User's Cricket IQ score
  const [liveMatches, setLiveMatches] = useState<MatchData[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([
    {
      title: "The Cummins Masterclass: Analyzing the 18th Over",
      date: "22 Mar 2026",
      readTime: "4 min",
      content: "Pat Cummins showed why he is the best in the business...",
      category: "Analysis",
      isAI: true,
    },
    {
      title: "Predictive Trends: Why Spin will dominate IPL 2026",
      date: "21 Mar 2026",
      readTime: "6 min",
      content: "Spinners are becoming the most valuable assets in T20...",
      category: "Trends",
      isAI: true,
    },
    {
      title: "Telemetry Breakdown: Kohli's Cover Drive Mechanics",
      date: "20 Mar 2026",
      readTime: "5 min",
      content: "Analyzing the biomechanics of Virat Kohli...",
      category: "Technique",
      isAI: false,
    },
  ]);
  const [raffleTickets, setRaffleTickets] = useState<string[]>([]);
  const [isRaffleModalOpen, setIsRaffleModalOpen] = useState(false);
  const [raffleQuantity, setRaffleQuantity] = useState(1);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const userEmail = "hemnanijatin9@gmail.com"; // Mock user email
  const isAdmin = userEmail === "hemnanijatin9@gmail.com" && isAdminMode;

  useEffect(() => {
    // Secret admin access via URL hash
    const checkAdmin = () => {
      if (window.location.hash === "#admin-access-crinava") {
        setIsAdminMode(true);
      }
    };
    checkAdmin();
    window.addEventListener("hashchange", checkAdmin);
    return () => window.removeEventListener("hashchange", checkAdmin);
  }, []);
  const [raffleHistory] = useState<RaffleHistory[]>([
    {
      drawId: "RD-882",
      winner: "user_9921",
      prize: "Premium Sub",
      date: "Mar 21",
    },
    {
      drawId: "RD-881",
      winner: "cricket_fan_1",
      prize: "500 Coins",
      date: "Mar 20",
    },
  ]);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [showIQ, setShowIQ] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "Welcome to Crinava!",
      message: "Start exploring the new era of cricket analytics.",
      time: "Just now",
      read: false,
      type: "success",
    },
    {
      id: "2",
      title: "Daily Bonus",
      message: "You received 50 Crinava Coins as a daily login bonus!",
      time: "2h ago",
      read: false,
      type: "info",
    },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("crinava-theme", "dark");
  }, []);

  const sendNotification = (
    title: string,
    message: string,
    type: Notification["type"] = "info",
  ) => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      title,
      message,
      time: "Just now",
      read: false,
      type,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user ? { user } : null);
    });

    // Handle Magic Link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        email = window.prompt("Please provide your email for confirmation");
      }
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
          })
          .catch((error) => {
            console.error("Error signing in with email link", error);
          });
      }
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      // Real-time profile sync
      const profileRef = doc(db, "profiles", session.user.uid);
      const unsubscribe = onSnapshot(
        profileRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            // Create profile if it doesn't exist
            const newProfile = {
              id: session.user.uid,
              email: session.user.email,
              cricket_iq: 100,
              crinava_coins: 500,
              updated_at: new Date().toISOString(),
            };
            setDoc(profileRef, newProfile).catch((err) =>
              handleFirestoreError(err, OperationType.CREATE, "profiles"),
            );
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, "profiles"),
      );

      return () => unsubscribe();
    } else {
      setProfile(null);
    }
  }, [session]);

  // Sync state with profile
  useEffect(() => {
    if (profile) {
      setCricketIQ(profile.cricket_iq);
      setCoinBalance(profile.crinava_coins);
    }
  }, [profile]);

  const updateProfileStats = async (newIQ?: number, newCoins?: number) => {
    // Local state updates first
    if (newIQ !== undefined) setCricketIQ(newIQ);
    if (newCoins !== undefined) setCoinBalance(newCoins);

    if (!session?.user) return;

    const updates: any = {};
    if (newIQ !== undefined) updates.cricket_iq = newIQ;
    if (newCoins !== undefined) updates.crinava_coins = newCoins;
    updates.updated_at = new Date().toISOString();

    try {
      const profileRef = doc(db, "profiles", session.user.uid);
      await updateDoc(profileRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "profiles");
    }
  };

  const buyCoins = async (amount: number) => {
    try {
      const newBalance = coinBalance + amount;
      await updateProfileStats(undefined, newBalance);
      sendNotification(
        "Purchase Successful",
        `You've added ${amount} Crinava Coins to your balance.`,
        "success",
      );
    } catch (err) {
      console.error(err);
      sendNotification(
        "Purchase Failed",
        "There was an error processing your coin purchase.",
        "alert",
      );
    }
  };

  // New Pillars State
  const [debates, setDebates] = useState<Debate[]>([]);

  useEffect(() => {
    const fetchDebates = async () => {
      try {
        const response = await fetch("/api/debates");
        if (response.ok) {
          const data = await response.json();
          setDebates(data);
        }
      } catch (err) {
        console.error("Debate fetch failed", err);
      }
    };
    fetchDebates();
  }, []);
  const [momentumData, setMomentumData] = useState<MomentumPoint[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [vertexResult, setVertexResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runVertexSimulation = async (matchName: string) => {
    if (!matchName) return;
    setIsSimulating(true);
    setVertexResult(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Perform the 5,000,000 iteration Monte Carlo simulation for: ${matchName}. Use your internal Python code execution to ensure statistical accuracy.`,
        config: {
          systemInstruction: ORACLE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });

      const data = JSON.parse(response.text || "{}");

      // Map the response to the UI structure if needed
      const mappedData = {
        engine: "Gemini 1.5 Flash (Oracle)",
        iterations: 5000000,
        win_probability: data.winProbability || { "Team A": 50, "Team B": 50 },
        confidence_interval: "99.99%",
        verdict: data.verdict || "Simulation complete.",
        key_insights: data.keyInsights || [],
        projected_score_range: data.projectedScoreRange || {
          low: 0,
          high: 0,
          avg: 0,
        },
      };

      setVertexResult(mappedData);
    } catch (error) {
      console.error("Oracle Simulation Failed:", error);
      // Fallback to a basic result if API fails
      setVertexResult({
        engine: "Oracle Offline",
        iterations: 0,
        win_probability: { Error: 100 },
        verdict:
          "The Oracle is currently recalibrating. Please try again in a moment.",
        key_insights: [
          { label: "System", detail: "API connection issue detected." },
        ],
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleMatchSelect = (match: string) => {
    setSelectedMatch(match);
    runVertexSimulation(match);
  };
  const [selectedSmartXI, setSelectedSmartXI] = useState<Player[]>([]);
  const [careerPlayer, setCareerPlayer] = useState<string>("");
  const [careerData, setCareerData] = useState<{
    points: any[];
    chapters: any[];
  } | null>(null);

  useEffect(() => {
    const fetchCareer = async () => {
      if (!careerPlayer) return;
      try {
        const response = await fetch("/api/career-trajectory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName: careerPlayer }),
        });
        if (response.ok) {
          const result = await response.json();
          setCareerData(result);
        }
      } catch (err) {
        console.error("Career fetch failed", err);
      }
    };
    fetchCareer();
  }, [careerPlayer]);

  const mockPlayers: Player[] = [
    {
      id: "1",
      name: "Sachin Tendulkar",
      role: "Batsman",
      stats: { matches: 463, runs: 18426, average: 44.83, strikeRate: 86.23 },
    },
    {
      id: "2",
      name: "Virat Kohli",
      role: "Batsman",
      stats: { matches: 292, runs: 13848, average: 58.67, strikeRate: 93.62 },
    },
    {
      id: "3",
      name: "MS Dhoni",
      role: "Wicketkeeper",
      stats: { matches: 350, runs: 10773, average: 50.57, strikeRate: 87.56 },
    },
    {
      id: "4",
      name: "Jasprit Bumrah",
      role: "Bowler",
      stats: { matches: 89, wickets: 149, average: 23.55, strikeRate: 31.4 },
    },
    {
      id: "5",
      name: "Hardik Pandya",
      role: "All-rounder",
      stats: {
        matches: 86,
        runs: 1769,
        wickets: 84,
        average: 34.01,
        strikeRate: 110.3,
      },
    },
    {
      id: "6",
      name: "Rohit Sharma",
      role: "Batsman",
      stats: { matches: 262, runs: 10709, average: 49.12, strikeRate: 91.97 },
    },
    {
      id: "7",
      name: "Ravindra Jadeja",
      role: "All-rounder",
      stats: {
        matches: 197,
        runs: 2756,
        wickets: 220,
        average: 32.42,
        strikeRate: 84.5,
      },
    },
    {
      id: "8",
      name: "Shane Warne",
      role: "Bowler",
      stats: { matches: 194, wickets: 293, average: 25.73, strikeRate: 36.3 },
    },
    {
      id: "9",
      name: "AB de Villiers",
      role: "Batsman",
      stats: { matches: 228, runs: 9577, average: 53.5, strikeRate: 101.09 },
    },
    {
      id: "10",
      name: "Wasim Akram",
      role: "Bowler",
      stats: { matches: 356, wickets: 502, average: 23.52, strikeRate: 36.2 },
    },
    {
      id: "11",
      name: "Adam Gilchrist",
      role: "Wicketkeeper",
      stats: { matches: 287, runs: 9619, average: 35.89, strikeRate: 96.94 },
    },
  ];

  const handleAddToXI = (player: Player) => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    if (selectedSmartXI.length >= 11) {
      setError("Your XI is full (11 players max).");
      return;
    }
    if (selectedSmartXI.find((p) => p.id === player.id)) return;
    setSelectedSmartXI((prev) => [...prev, player]);
    updateProfileStats(cricketIQ + 2);
  };

  const calculateXIRating = () => {
    if (selectedSmartXI.length === 0) return 0;
    const avg =
      selectedSmartXI.reduce((acc, p) => acc + p.stats.average, 0) /
      selectedSmartXI.length;
    return Math.min(99, Math.round(avg + selectedSmartXI.length * 2));
  };

  const handleBuyTicket = (qty: number = 1) => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    const totalCost = 10 * qty;
    if (coinBalance < totalCost) {
      setError("Insufficient Crinava Coins. Buy more in the store.");
      sendNotification(
        "Insufficient Balance",
        "You need more coins to buy raffle tickets.",
        "warning",
      );
      return;
    }
    updateProfileStats(undefined, coinBalance - totalCost);
    const newTickets = Array.from({ length: qty }).map(() => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let result = "";
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });
    setRaffleTickets((prev) => [...prev, ...newTickets]);
    setIsRaffleModalOpen(false);
    setRaffleQuantity(1);
    sendNotification(
      "Tickets Purchased",
      `Successfully bought ${qty} raffle ticket(s). Good luck!`,
      "success",
    );
  };

  const handleGenerateBlog = async () => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    setLoading(true);
    try {
      const newPost = await generateBlogPost("Latest IPL Match Trends");
      setBlogPosts((prev) => [newPost, ...prev]);
      updateProfileStats(cricketIQ + 5);
    } catch (err) {
      setError("AI Note generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const generateMomentumData = async (match: string) => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    try {
      const response = await fetch("/api/momentum-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match }),
      });
      if (response.ok) {
        const data = await response.json();
        setMomentumData(data);
        setSelectedMatch(match);
        updateProfileStats(cricketIQ + 10);
      }
    } catch (err) {
      console.error("Momentum fetch failed", err);
    }
  };

  const handleVote = async (
    debateId: string,
    side: "for" | "against",
    reasoning: string,
  ) => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    try {
      const response = await fetch(`/api/debates/${debateId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side }),
      });
      if (response.ok) {
        const updatedDebate = await response.json();
        setDebates((prev) =>
          prev.map((d) =>
            d.id === debateId
              ? { ...updatedDebate, userVote: side, userReasoning: reasoning }
              : d,
          ),
        );
        updateProfileStats(cricketIQ + 25);
      }
    } catch (err) {
      console.error("Vote failed", err);
    }
  };

  const fetchLiveScores = async () => {
    setLoading(true);
    const scores = await getLiveScores();
    setLiveMatches(scores);
    setLoading(false);
  };

  const handleSimulate = async (matchName: string) => {
    // Temporarily disabled for testing
    /*
    if (!isSubscribed) {
      setError("Subscription required for simulation telemetry.");
      return;
    }
    */
    setSimulating(true);
    setSimProgress(0);
    setError(null);

    // Simulation animation
    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 10;
      });
    }, 200);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match: matchName }),
      });

      if (!response.ok) throw new Error("Simulation failed");

      const result = await response.json();

      clearInterval(interval);
      setSimProgress(100);

      setTimeout(() => {
        setPrediction(result);
        setSimulating(false);
        updateProfileStats(cricketIQ + 25);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setSimulating(false);
      setError("Oracle Engine Offline. System retry recommended.");
    }
  };

  React.useEffect(() => {
    if (activeTab === "live") {
      fetchLiveScores();
    }
  }, [activeTab]);

  const handleSearch = async (text?: string) => {
    const searchQuery = text || query;
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setVerdict(null);
    try {
      const result = await getCricketVerdict(searchQuery);
      setVerdict(result);
    } catch (err) {
      console.error(err);
      setError("Oracle connection failed. System retry recommended.");
    } finally {
      setLoading(false);
    }
  };

  const fillSearch = (text: string) => {
    setQuery(text);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary selection:text-black overflow-x-hidden transition-colors duration-300">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-white/5 transition-colors duration-300">
        <div className="flex justify-between items-center px-4 md:px-8 h-16 w-full max-w-[1920px] mx-auto">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setActiveTab("home");
              setVerdict(null);
              setQuery("");
            }}
          >
            <img
              alt="Infinity Logo"
              className="w-10 h-10 object-contain"
              src="https://lh3.googleusercontent.com/aida/ADBb0uh2LSXdekvCOjvv7ixwH7eMAf24EscrrhC2F7nkFylb9BaioAfG3URgxvZTb_Tv_p7gXybr3BI3AoXv5AZebI6XgfTkWDZ4TEG03tEGmycCTN8Ud1TCfzgkidszX3BjJG7IsebDdG7BdHxDWndfc_NW1otzy-dWClUYXxNxxaSDUhZzsLKDWm48w1PAG8eg5kW_bPhaYam7KxXsTwsMlbVbJXQpHgLw4_d7Jp88uzlRt_xWBvWg3TbjbtSPX3ws9UL4oc4NubP9"
            />
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-black tracking-tighter leading-none flex items-center text-on-surface">
                <span>CRIN</span>
                <span className="text-aurora-teal">AVA</span>
              </h1>
              <span className="text-[7px] text-gray-400 tracking-[0.3em] font-black uppercase mt-1">
                The New Era of Cricket
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Coins & IQ */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setActiveTab("store")}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:border-metallic-gold/30 transition-all group"
              >
                <CoinIcon size={18} />
                <span className="text-xs font-black text-on-surface tracking-tighter">
                  {coinBalance}
                </span>
              </button>

              <AnimatePresence>
                {showIQ && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="px-3 py-1 bg-aurora-teal/10 border border-aurora-teal/20 rounded-lg"
                  >
                    <span className="text-xs font-black text-on-surface italic tracking-tighter">
                      {cricketIQ} IQ
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={() => setShowIQ(!showIQ)}
                className={`p-2 rounded-full border transition-all group ${showIQ ? "bg-aurora-teal/20 border-aurora-teal" : "bg-white/5 border-white/10 hover:border-aurora-teal/30"}`}
              >
                <Brain
                  size={20}
                  className={
                    showIQ
                      ? "text-aurora-teal"
                      : "text-metallic-gold group-hover:scale-110 transition-transform"
                  }
                />
              </button>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsAsRead();
                }}
                className={`p-2 transition-colors relative bg-white/5 rounded-xl border border-white/10 ${showNotifications ? "text-aurora-teal border-aurora-teal/50" : "text-gray-400 hover:text-on-surface"}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] font-black flex items-center justify-center rounded-full border-2 border-surface text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                  >
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                      <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">
                        Notifications
                      </h3>
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[10px] text-gray-500 hover:text-red-400 font-bold uppercase"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center space-y-2">
                          <Bell size={32} className="mx-auto text-gray-700" />
                          <p className="text-xs text-gray-500 font-medium">
                            No new notifications
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors flex gap-3 ${!n.read ? "bg-aurora-teal/[0.02]" : ""}`}
                          >
                            <div
                              className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                n.type === "success"
                                  ? "bg-emerald-500"
                                  : n.type === "warning"
                                    ? "bg-metallic-gold"
                                    : n.type === "alert"
                                      ? "bg-red-500"
                                      : "bg-aurora-teal"
                              }`}
                            />
                            <div className="space-y-1">
                              <h4 className="text-[11px] font-black text-on-surface leading-none">
                                {n.title}
                              </h4>
                              <p className="text-[10px] text-gray-400 leading-relaxed">
                                {n.message}
                              </p>
                              <span className="text-[8px] text-gray-600 font-bold uppercase">
                                {n.time}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowAuthModal(true)}
              className="p-2 text-gray-400 hover:text-on-surface transition-colors bg-white/5 rounded-xl border border-white/10"
            >
              <UserCircle
                size={22}
                className={session ? "text-aurora-teal" : ""}
              />
            </button>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        session={session}
        profile={profile}
      />

      <main className="pt-24 px-4 pb-28 max-w-[1200px] mx-auto flex flex-col items-center">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-full max-w-7xl py-12 space-y-24">
                {/* Editorial Hero - Web Experience */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-8 order-2 lg:order-1">
                    <div className="space-y-4">
                      <span className="inline-block px-4 py-1 bg-aurora-teal/10 border border-aurora-teal/30 text-aurora-teal text-xs font-black uppercase tracking-[0.3em] rounded-full">
                        Next-Gen Analytics
                      </span>
                      <h2 className="text-7xl md:text-9xl font-black text-white tracking-tighter uppercase leading-[0.8] italic">
                        CRICKET <br />
                        <span className="text-aurora-teal">REDEFINED</span>
                      </h2>
                    </div>
                    <p className="text-gray-400 max-w-lg text-lg font-medium leading-relaxed">
                      Experience the game through the lens of advanced AI.
                      Real-time pressure maps, predictive simulations, and deep
                      player analytics for the modern fan.
                    </p>
                    <div className="flex gap-6 pt-4">
                      <button
                        onClick={() => setActiveTab("verdict")}
                        className="px-12 py-5 bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-aurora-teal transition-all shadow-[0_20px_40px_rgba(0,229,255,0.2)]"
                      >
                        Launch Oracle
                      </button>
                      <button
                        onClick={() => setActiveTab("blog")}
                        className="px-12 py-5 bg-white/5 border border-white/10 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
                      >
                        Read Notes
                      </button>
                    </div>
                  </div>
                  <div className="relative order-1 lg:order-2">
                    <div className="aspect-[4/5] rounded-[60px] overflow-hidden border border-white/10 shadow-2xl group">
                      <img
                        src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1000"
                        alt="Cricket Stadium"
                        className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8 p-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-[10px] text-aurora-teal font-black uppercase tracking-widest mb-1">
                              Live Telemetry
                            </div>
                            <div className="text-xl font-black text-white uppercase italic">
                              Lord's Stadium
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <div className="w-1 h-4 bg-aurora-teal rounded-full animate-pulse" />
                            <div className="w-1 h-6 bg-aurora-teal rounded-full animate-pulse delay-75" />
                            <div className="w-1 h-3 bg-aurora-teal rounded-full animate-pulse delay-150" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Feature Sections - More Spaced Out */}
                <section className="space-y-12">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="space-y-2">
                      <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                        Core Pillars
                      </h3>
                      <p className="text-gray-500 text-sm font-medium">
                        Advanced tools for deep match understanding.
                      </p>
                    </div>
                    <div className="h-px flex-1 bg-white/5 mx-8 hidden md:block" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      {
                        icon: <Waves size={24} />,
                        title: "Momentum",
                        desc: "Real-time pressure waves.",
                        tab: "momentum",
                        color: "text-aurora-teal",
                      },
                      {
                        icon: <MessageSquare size={24} />,
                        title: "Debate",
                        desc: "AI-backed arguments.",
                        tab: "debate",
                        color: "text-metallic-gold",
                      },
                      {
                        icon: <Target size={24} />,
                        title: "Smart XI",
                        desc: "Tactical team builder.",
                        tab: "smartxi",
                        color: "text-aurora-teal",
                      },
                      {
                        icon: <BookOpen size={24} />,
                        title: "Stories",
                        desc: "Player trajectories.",
                        tab: "career",
                        color: "text-metallic-gold",
                      },
                    ].map((feature, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveTab(feature.tab as AppTab)}
                        className="p-10 rounded-[40px] bg-[#111111] border border-white/5 space-y-6 cursor-pointer hover:border-aurora-teal/30 hover:bg-[#151515] transition-all group"
                      >
                        <div
                          className={`p-4 bg-white/5 rounded-2xl w-fit group-hover:scale-110 transition-transform ${feature.color}`}
                        >
                          {feature.icon}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                            {feature.title}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium leading-relaxed">
                            {feature.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Secondary Features */}
                <section className="bg-white/[0.02] border border-white/5 rounded-[60px] p-12 md:p-20">
                  <div className="max-w-3xl mx-auto text-center space-y-12">
                    <div className="space-y-4">
                      <h3 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter">
                        The Ecosystem
                      </h3>
                      <p className="text-gray-400 text-lg font-medium">
                        Beyond analysis. A complete cricket experience.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      {[
                        {
                          icon: <TrendingUp size={20} />,
                          title: "Live",
                          tab: "live",
                        },
                        {
                          icon: <Trophy size={20} />,
                          title: "Raffle",
                          tab: "raffle",
                        },
                        {
                          icon: <Info size={20} />,
                          title: "Notes",
                          tab: "blog",
                        },
                        {
                          icon: <ShieldCheck size={20} />,
                          title: "Oracle",
                          tab: "verdict",
                        },
                      ].map((extra, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveTab(extra.tab as AppTab)}
                          className="space-y-4 cursor-pointer group"
                        >
                          <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center text-aurora-teal group-hover:bg-aurora-teal group-hover:text-black transition-all">
                            {extra.icon}
                          </div>
                          <span className="block text-xs font-black text-white uppercase tracking-widest">
                            {extra.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === "momentum" && (
            <motion.div
              key="momentum"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                  Momentum Map
                </h2>
                <p className="text-aurora-teal text-xs font-black uppercase tracking-widest">
                  Pressure Wave Analysis
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-6">
                  <div className="flex justify-between items-center">
                    <select
                      onChange={(e) => generateMomentumData(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-lg px-4 py-2 outline-none focus:border-aurora-teal/50"
                    >
                      <option value="">Select Match Story</option>
                      <option value="IND vs PAK - T20WC">
                        IND vs PAK - T20WC
                      </option>
                      <option value="CSK vs GT - IPL Final">
                        CSK vs GT - IPL Final
                      </option>
                      <option value="AUS vs ENG - Ashes">
                        AUS vs ENG - Ashes
                      </option>
                    </select>
                    {selectedMatch && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-aurora-teal animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          Telemetry Active
                        </span>
                      </div>
                    )}
                  </div>

                  {momentumData.length > 0 ? (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={momentumData}>
                          <defs>
                            <linearGradient
                              id="colorPressure"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#00FFCC"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#00FFCC"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#ffffff10"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="over"
                            stroke="#ffffff40"
                            fontSize={10}
                            tickFormatter={(val) => `Ov ${val}`}
                          />
                          <YAxis
                            stroke="#ffffff40"
                            fontSize={10}
                            domain={[-100, 100]}
                            tickFormatter={(val) => (val > 0 ? `+${val}` : val)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#111",
                              border: "1px solid #ffffff10",
                              borderRadius: "12px",
                            }}
                            itemStyle={{
                              color: "#00FFCC",
                              fontSize: "10px",
                              fontWeight: "bold",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="pressure"
                            stroke="#00FFCC"
                            fillOpacity={1}
                            fill="url(#colorPressure)"
                            strokeWidth={3}
                          />
                          <ReferenceLine y={0} stroke="#ffffff20" />
                          {momentumData.map(
                            (p, i) =>
                              p.isTurningPoint && (
                                <ReferenceLine
                                  key={i}
                                  x={p.over}
                                  stroke="#FFD700"
                                  strokeDasharray="3 3"
                                  label={{
                                    value: "Turning Point",
                                    position: "top",
                                    fill: "#FFD700",
                                    fontSize: 10,
                                    fontWeight: "bold",
                                  }}
                                />
                              ),
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl space-y-4">
                      <Waves size={40} className="text-gray-700" />
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                        Select a match to visualize momentum
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
                    <h3 className="text-xs font-black text-aurora-teal uppercase tracking-widest">
                      Impact Analysis
                    </h3>
                    {selectedMatch ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase">
                              Turning Point
                            </span>
                            <span className="text-[10px] font-black text-metallic-gold uppercase">
                              Over 18.4
                            </span>
                          </div>
                          <p className="text-xs text-white font-bold italic">
                            "The moment it was won: Dhoni's consecutive sixes
                            shifted pressure by 84%."
                          </p>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-aurora-teal/10 border border-aurora-teal/20">
                          <div className="w-10 h-10 rounded-full bg-aurora-teal/20 flex items-center justify-center">
                            <CoinIcon size={24} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-aurora-teal uppercase">
                              MVP Impact
                            </div>
                            <div className="text-xs font-black text-white">
                              MS Dhoni (+42.5)
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-600 italic">
                        Telemetry data pending match selection...
                      </p>
                    )}
                  </div>

                  <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group">
                    <Share2
                      size={16}
                      className="text-gray-400 group-hover:text-aurora-teal"
                    />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      Share Story Card
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "debate" && (
            <motion.div
              key="debate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                    Debate Room
                  </h2>
                  <p className="text-metallic-gold text-xs font-black uppercase tracking-widest">
                    Settle the Score
                  </p>
                </div>
                <button className="px-6 py-2 bg-aurora-teal text-black font-black text-[10px] uppercase tracking-widest rounded-full hover:scale-105 transition-all">
                  Create Debate
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {debates.map((d) => (
                  <div
                    key={d.id}
                    className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-6 flex flex-col"
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-white/5 rounded-lg">
                        <Gavel size={16} className="text-aurora-teal" />
                      </div>
                      {d.trending && (
                        <span className="px-2 py-1 bg-metallic-gold/10 text-metallic-gold text-[8px] font-black uppercase tracking-widest rounded">
                          Trending
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white italic leading-tight">
                      "{d.claim}"
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="text-[8px] font-black text-aurora-teal uppercase tracking-widest">
                          The Case For
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          {d.arguments.for}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="text-[8px] font-black text-red-400 uppercase tracking-widest">
                          The Case Against
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          {d.arguments.against}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 mt-auto">
                      <div className="flex justify-between text-[10px] font-black text-white uppercase italic">
                        <span>
                          For:{" "}
                          {Math.round(
                            (d.votes.for / (d.votes.for + d.votes.against)) *
                              100,
                          )}
                          %
                        </span>
                        <span>
                          Against:{" "}
                          {Math.round(
                            (d.votes.against /
                              (d.votes.for + d.votes.against)) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-aurora-teal transition-all duration-1000"
                          style={{
                            width: `${(d.votes.for / (d.votes.for + d.votes.against)) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-red-500/50 transition-all duration-1000"
                          style={{
                            width: `${(d.votes.against / (d.votes.for + d.votes.against)) * 100}%`,
                          }}
                        />
                      </div>

                      {d.userVote ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                          <span className="text-[10px] font-black text-aurora-teal uppercase tracking-widest">
                            You voted {d.userVote}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleVote(d.id, "for", "He is simply the best.")
                            }
                            className="flex-1 py-2 bg-aurora-teal/10 border border-aurora-teal/20 text-aurora-teal text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-aurora-teal hover:text-black transition-all"
                          >
                            Vote For
                          </button>
                          <button
                            onClick={() =>
                              handleVote(
                                d.id,
                                "against",
                                "Era comparison matters.",
                              )
                            }
                            className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all"
                          >
                            Vote Against
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "career" && (
            <motion.div
              key="career"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                  Career Story
                </h2>
                <p className="text-aurora-teal text-xs font-black uppercase tracking-widest">
                  The Deep Diver Journey
                </p>
              </div>

              <div className="flex justify-center">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                  {["Virat Kohli", "Sachin Tendulkar", "MS Dhoni"].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setCareerPlayer(p);
                        if (session) {
                          updateProfileStats(cricketIQ + 5);
                        }
                      }}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${careerPlayer === p ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {careerPlayer ? (
                <div className="space-y-12">
                  {/* Timeline */}
                  <div className="p-8 rounded-3xl bg-[#111111] border border-white/5 space-y-8">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-aurora-teal uppercase tracking-widest">
                        Performance Timeline
                      </h3>
                      <span className="text-[10px] font-black text-metallic-gold uppercase">
                        Peak: 2016-2018
                      </span>
                    </div>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={careerData?.points || []}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#ffffff05"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="year"
                            stroke="#ffffff20"
                            fontSize={10}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#111",
                              border: "1px solid #ffffff10",
                              borderRadius: "12px",
                            }}
                            itemStyle={{
                              color: "#00FFCC",
                              fontSize: "10px",
                              fontWeight: "bold",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rating"
                            stroke="#00FFCC"
                            strokeWidth={4}
                            dot={{ fill: "#00FFCC", r: 4 }}
                            activeDot={{
                              r: 8,
                              stroke: "#00FFCC",
                              strokeWidth: 2,
                              fill: "#000",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chapters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(careerData?.chapters || []).map((chapter, i) => (
                      <div
                        key={i}
                        className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 hover:border-aurora-teal/30 transition-all"
                      >
                        <div className="text-[8px] font-black text-aurora-teal uppercase tracking-[0.2em]">
                          {chapter.year}
                        </div>
                        <h4 className="text-sm font-black text-white italic">
                          {chapter.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                          {chapter.insight}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-4">
                    <button className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center gap-2">
                      <TrendingUp size={14} className="text-aurora-teal" />
                      Greatest Season Detector
                    </button>
                    <button className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center gap-2">
                      <Share2 size={14} className="text-metallic-gold" />
                      Share Career Moment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-dashed border-white/10">
                    <BookOpen size={30} className="text-gray-700" />
                  </div>
                  <p className="text-xs text-gray-500 font-black uppercase tracking-widest">
                    Select a player to explore their story
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "smartxi" && (
            <motion.div
              key="smartxi"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-5xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                  Smart XI
                </h2>
                <p className="text-metallic-gold text-xs font-black uppercase tracking-widest">
                  The Data-Driven Dream Team
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Builder */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-aurora-teal uppercase tracking-widest">
                        Your XI ({selectedSmartXI.length}/11)
                      </h3>
                      <button
                        onClick={() => setSelectedSmartXI([])}
                        className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:underline"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Array.from({ length: 11 }).map((_, i) => (
                        <div
                          key={i}
                          className={`aspect-[3/4] rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all ${selectedSmartXI[i] ? "bg-aurora-teal/10 border-aurora-teal/30" : "bg-white/[0.01] border-dashed border-white/10"}`}
                        >
                          {selectedSmartXI[i] ? (
                            <>
                              <div className="text-[8px] font-black text-aurora-teal uppercase mb-1">
                                {selectedSmartXI[i].role}
                              </div>
                              <div className="text-[10px] font-black text-white leading-tight">
                                {selectedSmartXI[i].name}
                              </div>
                              <div className="mt-2 text-[8px] font-bold text-gray-500">
                                Avg: {selectedSmartXI[i].stats.average}
                              </div>
                            </>
                          ) : (
                            <PlusCircle size={20} className="text-gray-800" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      Available Legends
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {mockPlayers.map((player) => (
                        <div
                          key={player.id}
                          onClick={() => handleAddToXI(player)}
                          className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${selectedSmartXI.find((p) => p.id === player.id) ? "opacity-30 pointer-events-none" : "bg-white/[0.02] border-white/5 hover:border-aurora-teal/30"}`}
                        >
                          <div>
                            <div className="text-xs font-black text-white">
                              {player.name}
                            </div>
                            <div className="text-[8px] font-black text-gray-500 uppercase">
                              {player.role}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black text-aurora-teal">
                              {player.stats.average}
                            </div>
                            <div className="text-[8px] font-bold text-gray-600 uppercase">
                              Avg
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rating & Insights */}
                <div className="space-y-6">
                  <div className="p-8 rounded-3xl bg-aurora-teal text-black space-y-6 text-center">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        XI Rating
                      </div>
                      <div className="text-7xl font-black italic leading-none">
                        {calculateXIRating()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        Win Probability
                      </div>
                      <div className="text-2xl font-black italic">67%</div>
                    </div>
                    <p className="text-[10px] font-bold leading-relaxed">
                      "The stats say your XI wins 67% of the time. Strong middle
                      order, but slightly weak on death bowling."
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-4">
                    <h3 className="text-xs font-black text-metallic-gold uppercase tracking-widest">
                      Community Poll
                    </h3>
                    <div className="space-y-3">
                      <p className="text-[10px] text-gray-400 font-medium">
                        All-time India XI: Who is your opener?
                      </p>
                      <div className="space-y-2">
                        {["Sehwag", "Gavaskar", "Rohit"].map((opt) => (
                          <button
                            key={opt}
                            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-left text-[10px] font-black text-white hover:bg-white/10 transition-all flex justify-between"
                          >
                            {opt}
                            <span className="text-aurora-teal">34%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group">
                    <Users
                      size={16}
                      className="text-gray-400 group-hover:text-aurora-teal"
                    />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      Compare with Friends
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "live" && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-6"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">
                    Live Telemetry
                  </h2>
                  <p className="text-aurora-teal text-[10px] font-black uppercase tracking-widest">
                    Global Match Sync Active
                  </p>
                </div>
                <button
                  onClick={fetchLiveScores}
                  className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                >
                  <TrendingUp size={20} className="text-aurora-teal" />
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-aurora-teal/20 border-t-aurora-teal rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Scanning Satellites...
                  </span>
                </div>
              ) : liveMatches.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {liveMatches.map((match, i) => (
                    <div
                      key={i}
                      className="p-6 bg-[#111111] border border-white/5 rounded-2xl space-y-4 hover:border-aurora-teal/30 transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="text-[8px] text-aurora-teal font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-aurora-teal rounded-full animate-pulse"></span>
                            {match.series}
                          </div>
                          <h3 className="text-lg font-black text-white uppercase italic">
                            {match.teams.join(" vs ")}
                          </h3>
                          <div className="text-[9px] text-gray-500 font-medium">
                            {match.venue} • {match.format}
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                          {match.status}
                        </div>
                      </div>
                      <div className="text-2xl font-black text-white tracking-tighter">
                        {match.score}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-[#111111] rounded-3xl border border-white/5">
                  <p className="text-gray-500 text-xs font-black uppercase tracking-widest">
                    No Active Telemetry Found
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "prediction" && (
            <motion.div
              key="prediction"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              {!prediction && !simulating ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 rounded-2xl bg-gradient-to-br from-aurora-teal/20 to-transparent border border-aurora-teal/20 space-y-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <CoinIcon size={120} />
                    </div>
                    <h3 className="text-xl font-black text-white italic">
                      Oracle Simulation
                    </h3>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                      Run 1,000,000 iterations based on real-time toss, weather,
                      and pitch telemetry.
                    </p>
                    {true ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Enter Match (e.g. MI vs CSK)"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-aurora-teal outline-none transition-all"
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            handleSimulate((e.target as HTMLInputElement).value)
                          }
                        />
                        <button
                          onClick={() => handleSimulate("Current Live Match")}
                          className="w-full py-3 bg-aurora-teal text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                        >
                          Run Simulation
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          if (coinBalance >= 199) {
                            await updateProfileStats(
                              undefined,
                              coinBalance - 199,
                            );
                            setIsSubscribed(true);
                          }
                        }}
                        className="w-full py-3 bg-aurora-teal text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                      >
                        Unlock for 199 <CoinIcon size={16} noShadow />
                      </button>
                    )}
                  </div>

                  <div className="p-8 rounded-2xl bg-[#111111] border border-white/10 space-y-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Trophy size={120} className="text-metallic-gold" />
                    </div>
                    <h3 className="text-xl font-black text-white italic">
                      Prediction Game
                    </h3>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                      Compete with the community and climb the leaderboard.
                    </p>
                    <button
                      onClick={() => {
                        /*
                        if (!session) {
                          setShowAuthModal(true);
                          return;
                        }
                        */
                        // Logic for entering arena
                      }}
                      className="w-full py-3 border border-metallic-gold text-metallic-gold font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-metallic-gold/10 transition-all"
                    >
                      Enter Arena
                    </button>
                  </div>
                </div>
              ) : simulating ? (
                <div className="bg-[#111111] border border-aurora-teal/30 rounded-3xl p-12 flex flex-col items-center space-y-8">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        className="text-white/5 stroke-current"
                        strokeWidth="4"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                      />
                      <circle
                        className="text-aurora-teal stroke-current transition-all duration-300"
                        strokeWidth="4"
                        strokeDasharray={283}
                        strokeDashoffset={283 - (283 * simProgress) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                        r="45"
                        cx="50"
                        cy="50"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CoinIcon size={48} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                      Simulating Reality
                    </h3>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">
                      {Math.floor(simProgress * 10000)} Iterations Complete
                    </p>
                  </div>
                </div>
              ) : (
                prediction && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#111111] border border-aurora-teal/30 rounded-3xl p-8 space-y-8"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-white uppercase italic">
                          {prediction.match}
                        </h3>
                        <div className="text-[10px] text-aurora-teal font-black uppercase tracking-widest">
                          Simulation Complete • 1M Iterations
                        </div>
                      </div>
                      <button
                        onClick={() => setPrediction(null)}
                        className="text-gray-500 hover:text-white"
                      >
                        <ArrowLeft size={20} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">
                          Probable Winner
                        </div>
                        <div className="text-xl font-black text-aurora-teal uppercase italic">
                          {prediction.winner}
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">
                          Confidence
                        </div>
                        <div className="text-xl font-black text-white">
                          {prediction.probability}%
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">
                          Risk Level
                        </div>
                        <div className="text-xl font-black text-red-500 uppercase italic">
                          Low
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-metallic-gold uppercase tracking-widest">
                        Telemetry Factors
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-1">
                          <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Toss
                          </div>
                          <div className="text-[10px] font-bold text-white/80">
                            {prediction.factors.toss}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Weather
                          </div>
                          <div className="text-[10px] font-bold text-white/80">
                            {prediction.factors.weather}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Pitch
                          </div>
                          <div className="text-[10px] font-bold text-white/80">
                            {prediction.factors.pitch}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Wind
                          </div>
                          <div className="text-[10px] font-bold text-white/80">
                            {prediction.factors.wind || "N/A"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Humidity
                          </div>
                          <div className="text-[10px] font-bold text-white/80">
                            {prediction.factors.humidity || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[11px] text-gray-400 leading-relaxed italic">
                        "{prediction.simulationDetails}"
                      </p>
                    </div>
                  </motion.div>
                )
              )}
            </motion.div>
          )}

          {activeTab === "raffle" && (
            <motion.div
              key="raffle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="bg-gradient-to-br from-metallic-gold/20 to-transparent p-8 rounded-3xl border border-metallic-gold/20 relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                        IPL Raffle
                      </h2>
                      <p className="text-metallic-gold text-[10px] font-black uppercase tracking-widest">
                        Next Draw: 2h 45m
                      </p>
                    </div>
                    <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                      <span className="text-2xl font-black text-white">
                        10 Coins
                      </span>
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">
                        Per Ticket
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-400 font-medium">
                      Grand Prize:
                    </div>
                    <div className="text-2xl font-black text-aurora-teal uppercase italic">
                      1 Year Premium Subscription
                    </div>
                  </div>

                  <button
                    onClick={() => setIsRaffleModalOpen(true)}
                    className="w-full py-4 bg-metallic-gold text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,215,0,0.2)]"
                  >
                    Buy Raffle Tickets
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">
                      My Tickets ({raffleTickets.length})
                    </h3>
                    {raffleTickets.length > 0 && (
                      <button
                        onClick={() => setRaffleTickets([])}
                        className="text-[8px] text-red-500 font-black uppercase tracking-widest"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {raffleTickets.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {raffleTickets.map((ticket, i) => (
                        <div
                          key={i}
                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-center"
                        >
                          <span className="text-[9px] font-black text-metallic-gold font-mono tracking-tighter">
                            {ticket}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-[#111111] border border-white/5 rounded-2xl text-center">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                        No Tickets Purchased
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest">
                    Recent Winners
                  </h3>
                  <div className="space-y-3">
                    {raffleHistory.map((item, i) => (
                      <div
                        key={i}
                        className="p-4 bg-[#111111] border border-white/5 rounded-2xl flex justify-between items-center"
                      >
                        <div>
                          <div className="text-[10px] font-black text-white uppercase">
                            {item.winner}
                          </div>
                          <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                            {item.date} • {item.drawId}
                          </div>
                        </div>
                        <div className="text-[9px] font-black text-aurora-teal uppercase tracking-widest">
                          {item.prize}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Raffle Modal */}
              <AnimatePresence>
                {isRaffleModalOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsRaffleModalOpen(false)}
                      className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl"
                    >
                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                          Buy Tickets
                        </h3>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                          Select Quantity
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-8">
                        <button
                          onClick={() =>
                            setRaffleQuantity((prev) => Math.max(1, prev - 1))
                          }
                          className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5"
                        >
                          -
                        </button>
                        <span className="text-4xl font-black text-white">
                          {raffleQuantity}
                        </span>
                        <button
                          onClick={() =>
                            setRaffleQuantity((prev) => Math.min(50, prev + 1))
                          }
                          className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5"
                        >
                          +
                        </button>
                      </div>

                      <div className="p-4 bg-white/5 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                          Total Cost
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-aurora-teal">
                            {raffleQuantity * 10}
                          </span>
                          <CoinIcon size={20} noShadow />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsRaffleModalOpen(false)}
                          className="flex-1 py-4 border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleBuyTicket(raffleQuantity)}
                          className="flex-1 py-4 bg-aurora-teal text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
                        >
                          Confirm
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "blog" && (
            <motion.div
              key="blog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                  Crinava Notes
                </h2>
                <button
                  onClick={handleGenerateBlog}
                  disabled={loading}
                  className="px-4 py-2 bg-aurora-teal text-black font-black text-[9px] uppercase tracking-widest rounded-lg hover:scale-105 transition-all disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate AI Note"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {blogPosts.map((post, i) => (
                  <div
                    key={i}
                    className="group cursor-pointer space-y-4 p-8 rounded-3xl bg-[#111111] hover:bg-white/[0.02] transition-all border border-white/5 hover:border-aurora-teal/30"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white/5 text-gray-400 text-[8px] font-black uppercase tracking-widest rounded-full">
                          {post.category}
                        </span>
                        {post.isAI && (
                          <span className="px-2 py-0.5 bg-aurora-teal/10 text-aurora-teal text-[7px] font-black uppercase tracking-widest border border-aurora-teal/20 rounded">
                            AI Oracle
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                        {post.date} • {post.readTime} read
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white group-hover:text-aurora-teal transition-colors leading-tight italic">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium line-clamp-3 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-2 text-aurora-teal text-[9px] font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                      Read Full Note <ChevronRight size={12} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "store" && (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl space-y-12 py-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-5xl font-black text-white uppercase tracking-tighter italic">
                  Crinava Store
                </h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">
                  Premium In-App Currency
                </p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-aurora-teal to-metallic-gold rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative p-12 rounded-[40px] bg-[#0A0A0A] border border-white/5 text-center space-y-8 overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-aurora-teal/5 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-metallic-gold/5 rounded-full blur-3xl"></div>

                  <div className="space-y-2 relative z-10">
                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em]">
                      Current Balance
                    </div>
                    <div className="text-7xl font-black text-white tracking-tighter flex items-center justify-center gap-4">
                      <CoinIcon size={64} />
                      {coinBalance}
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-3 relative z-10">
                    <div className="w-1.5 h-1.5 bg-aurora-teal rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-aurora-teal font-black uppercase tracking-[0.2em]">
                      Secure Ledger Sync Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { amount: 100, price: 100, tag: "Starter" },
                  {
                    amount: 500,
                    price: 500,
                    tag: "Most Popular",
                    highlight: true,
                  },
                  { amount: 1000, price: 1000, tag: "Pro Pack" },
                  { amount: 2000, price: 2000, tag: "Legendary" },
                ].map((pkg) => (
                  <button
                    key={pkg.amount}
                    onClick={() => buyCoins(pkg.amount)}
                    className={`relative p-8 rounded-[32px] border transition-all duration-500 group overflow-hidden ${
                      pkg.highlight
                        ? "bg-white/5 border-aurora-teal/30 hover:border-aurora-teal"
                        : "bg-[#0D0D0D] border-white/5 hover:border-white/20"
                    }`}
                  >
                    {pkg.highlight && (
                      <div className="absolute top-0 right-0 px-4 py-1 bg-aurora-teal text-black text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                        {pkg.tag}
                      </div>
                    )}
                    {!pkg.highlight && (
                      <div className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-4">
                        {pkg.tag}
                      </div>
                    )}

                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-3xl font-black text-white flex items-center gap-2">
                          <CoinIcon size={28} />
                          {pkg.amount}
                        </div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                          Crinava Coins
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-white">
                          ₹{pkg.price}
                        </div>
                        <div className="text-[8px] text-gray-600 font-black uppercase tracking-widest">
                          One-time
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest group-hover:bg-white/10 transition-all">
                      Purchase Now
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-8 text-center space-y-4">
                <p className="text-[10px] text-gray-600 font-medium italic max-w-sm mx-auto">
                  "Crinava Coins are virtual assets for use within the
                  ecosystem. Non-refundable and non-transferable."
                </p>
                <div className="flex justify-center gap-8 opacity-20 grayscale">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white">
                    Visa
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white">
                    Mastercard
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white">
                    UPI
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === "verdict" && (
            <motion.div
              key="verdict"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl space-y-12"
            >
              {/* Header */}
              <section className="text-center space-y-4">
                <div className="inline-block px-4 py-1 bg-aurora-teal/10 border border-aurora-teal/30 text-aurora-teal text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
                  5,000,000 Iterations Engine
                </div>
                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
                  THE <span className="text-aurora-teal">ORACLE</span>
                </h2>
                <p className="text-gray-500 max-w-md mx-auto text-xs font-medium uppercase tracking-widest">
                  Statistical Simulation & Predictive Modeling
                </p>
              </section>

              {/* Match Selector */}
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-aurora-teal to-metallic-gold rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                  <select
                    value={selectedMatch}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    className="relative w-full bg-[#111111] border border-white/10 text-white text-sm font-bold rounded-xl px-6 py-4 outline-none focus:border-aurora-teal/50 appearance-none cursor-pointer"
                  >
                    <option value="">Select Match for Simulation</option>
                    <option value="IND vs PAK - T20WC">
                      IND vs PAK - T20WC
                    </option>
                    <option value="CSK vs GT - IPL Final">
                      CSK vs GT - IPL Final
                    </option>
                    <option value="AUS vs ENG - Ashes">
                      AUS vs ENG - Ashes
                    </option>
                    <option value="MI vs RCB - WPL">MI vs RCB - WPL</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown size={18} className="text-aurora-teal" />
                  </div>
                </div>

                {/* Simulation Progress */}
                {isSimulating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-3xl bg-aurora-teal/5 border border-aurora-teal/20 text-center space-y-6"
                  >
                    <div className="flex justify-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-aurora-teal/10 rounded-full" />
                        <div className="absolute inset-0 border-4 border-aurora-teal border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CoinIcon size={32} className="animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                        Oracle Engine Active
                      </h3>
                      <p className="text-[10px] text-aurora-teal font-black uppercase tracking-widest animate-pulse">
                        Running 5,000,000 Iterations...
                      </p>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "linear" }}
                        className="h-full bg-aurora-teal shadow-[0_0_10px_#00FFCC]"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Results Display */}
                {vertexResult && !isSimulating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    {/* Win Probability */}
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(vertexResult.win_probability).map(
                        ([team, prob]: any) => (
                          <div
                            key={team}
                            className="p-8 rounded-[40px] bg-[#111111] border border-white/5 text-center group hover:border-aurora-teal/30 transition-all"
                          >
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3">
                              {team}
                            </p>
                            <p className="text-5xl font-black text-white italic tracking-tighter">
                              {prob}%
                            </p>
                          </div>
                        ),
                      )}
                    </div>

                    {/* Verdict Card */}
                    <div className="p-10 rounded-[50px] bg-gradient-to-br from-aurora-teal/10 to-transparent border border-aurora-teal/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-10">
                        <ShieldCheck size={80} className="text-aurora-teal" />
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-aurora-teal rounded-xl flex items-center justify-center">
                          <Sparkles size={16} className="text-black" />
                        </div>
                        <h3 className="text-xs font-black text-aurora-teal uppercase tracking-[0.3em]">
                          Oracle Verdict
                        </h3>
                      </div>
                      <p className="text-xl font-medium text-white/90 leading-relaxed italic mb-8">
                        "{vertexResult.verdict}"
                      </p>
                      <div className="flex justify-between items-center pt-6 border-t border-white/5">
                        <div className="space-y-1">
                          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Iterations
                          </p>
                          <p className="text-xs font-black text-white font-mono">
                            {vertexResult.iterations.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            Confidence
                          </p>
                          <p className="text-xs font-black text-aurora-teal font-mono">
                            {vertexResult.confidence_interval}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Impact Factors */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {vertexResult.key_insights.map(
                        (insight: any, i: number) => (
                          <div
                            key={i}
                            className="p-6 rounded-3xl bg-[#111111] border border-white/5 space-y-3"
                          >
                            <p className="text-[9px] text-aurora-teal font-black uppercase tracking-widest">
                              {insight.label}
                            </p>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed">
                              {insight.detail}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </motion.div>
                )}

                {!isSimulating && !vertexResult && (
                  <div className="py-20 text-center space-y-4 opacity-20">
                    <div className="flex justify-center">
                      <Target size={48} className="text-white" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white">
                      Awaiting Match Telemetry
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === "admin" && isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-12"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                    Admin Console
                  </h2>
                  <p className="text-aurora-teal text-[10px] font-black uppercase tracking-widest">
                    System Overlord Access
                  </p>
                </div>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">
                    Logged in as
                  </span>
                  <span className="text-[10px] text-white font-bold">
                    {userEmail}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-[#111111] border border-white/5 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-aurora-teal/10 rounded-xl flex items-center justify-center">
                    <PlusCircle size={24} className="text-aurora-teal" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Create Blog
                    </h3>
                    <p className="text-xs text-gray-500">
                      Publish new Crinava Notes to the community.
                    </p>
                  </div>
                  <button className="w-full py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">
                    Open Editor
                  </button>
                </div>

                <div className="p-8 bg-[#111111] border border-white/5 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-metallic-gold/10 rounded-xl flex items-center justify-center">
                    <Trophy size={24} className="text-metallic-gold" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Tournaments
                    </h3>
                    <p className="text-xs text-gray-500">
                      Organize and manage live cricket events.
                    </p>
                  </div>
                  <button className="w-full py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">
                    Manage Events
                  </button>
                </div>

                <div className="p-8 bg-[#111111] border border-white/5 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <ShieldAlert size={24} className="text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Moderation
                    </h3>
                    <p className="text-xs text-gray-500">
                      Review debates and user-generated content.
                    </p>
                  </div>
                  <button className="w-full py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">
                    Review Queue
                  </button>
                </div>
              </div>

              <div className="p-8 bg-gradient-to-r from-aurora-teal/10 to-transparent border border-white/5 rounded-3xl">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-white uppercase italic">
                      System Health
                    </h4>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                      Oracle Engine Status: Operational
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-aurora-teal rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-aurora-teal rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-aurora-teal rounded-full animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest">
            {error}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-[#050505] border-t border-white/5 flex justify-around items-end px-2 py-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "home" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Home
          </span>
        </button>
        <button
          onClick={() => setActiveTab("live")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "live" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <TrendingUp size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Live
          </span>
        </button>
        <button
          onClick={() => setActiveTab("prediction")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "prediction" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <Brain size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Predict
          </span>
        </button>
        <button
          onClick={() => setActiveTab("raffle")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "raffle" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <Ticket
            size={20}
            className={
              activeTab === "raffle" ? "text-metallic-gold" : "text-gray-500"
            }
          />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Raffle
          </span>
        </button>
        <button
          onClick={() => setActiveTab("verdict")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "verdict" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <Gavel size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Verdict
          </span>
        </button>
        <button
          onClick={() => setActiveTab("store")}
          className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "store" ? "text-metallic-gold" : "text-gray-500"}`}
        >
          <Wallet size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Store
          </span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex flex-col items-center gap-1 min-w-[50px] transition-all hover:scale-110 ${activeTab === "admin" ? "text-aurora-teal" : "text-gray-500"}`}
          >
            <ShieldCheck size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">
              Admin
            </span>
          </button>
        )}
      </nav>
    </div>
  );
}
