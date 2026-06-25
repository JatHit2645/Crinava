/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Share2,
  ArrowLeft,
  Trophy,
  Info,
  ChevronRight,
  Bell,
  UserCircle,
  PlusCircle,
  Gavel,
  User,
  Waves,
  MessageSquare,
  BookOpen,
  Users,
  Brain,
  Infinity,
  Sparkles,
  Award,
  Medal,
  Zap,
  HelpCircle,
  X,
  Menu,
  LogOut,
  BarChart3,
  ArrowUpRight,
  Activity,
  TrendingUp as TrendingUpIcon,
  Home,
  Swords,
  ShoppingCart,
  Library,
  MessageCircle,
  Gift,
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
import { supabase } from "./lib/supabaseClient";
import { AuthModal } from "./components/AuthModal";
import { UsernameModal } from "./components/UsernameModal";
import { PredictionGame } from "./components/PredictionGame";
import { MatchesSection } from "./components/MatchesSection";
import { VerdictTool } from "./components/VerdictTool";
import { VerdictTray } from "./components/VerdictTray";
import { PlayerProfile } from "./pages/PlayerProfile";
import { AdminControlCenter } from "./pages/AdminControlCenter";

// --- Celestial Organic Elements ---

/**
 * Renders a full-screen animated canvas background with twinkling stars and occasional shooting stars.
 * @example
 * StarFieldBackground()
 * <canvas ... />
 * @param {void} No arguments.
 * @returns {JSX.Element} A fixed, full-screen canvas element used as a decorative animated background.
 **/
const StarfieldCanvas = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Static Stars
    type Star = {
      x: number;
      y: number;
      size: number;
      alpha: number;
      speed: number;
    };
    const stars: Star[] = Array.from({ length: 300 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.02 + 0.005,
    }));

    // Shooting Stars
    type ShootingStar = {
      x: number;
      y: number;
      len: number;
      speed: number;
      size: number;
      wait: number;
      active: boolean;
    };
    const shootingStars: ShootingStar[] = Array.from({ length: 4 }).map(() => ({
      x: 0,
      y: 0,
      len: 0,
      speed: 0,
      size: 0,
      wait: Math.random() * 200,
      active: false,
    }));

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    /**
    * Animates a starry background with twinkling static stars and intermittent shooting stars.
    * @example
    * draw()
    * undefined
    * @returns {void} Starts the animation loop and draws the next frame.
    **/
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw static stars
      stars.forEach((star) => {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0) star.speed *= -1;

        ctx.globalAlpha = Math.abs(star.alpha) * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw shooting stars
      ctx.globalAlpha = 1;
      shootingStars.forEach((ss) => {
        if (!ss.active) {
          ss.wait -= 1;
          if (ss.wait <= 0) {
            ss.active = true;
            ss.x = Math.random() * width * 1.5; // Start further right to cross screen
            ss.y = -50;
            ss.len = Math.random() * 100 + 40;
            ss.speed = Math.random() * 15 + 10;
            ss.size = Math.random() * 1.5 + 0.5;
          }
        } else {
          ss.x -= ss.speed;
          ss.y += ss.speed;

          const grad = ctx.createLinearGradient(
            ss.x,
            ss.y,
            ss.x + ss.len,
            ss.y - ss.len,
          );
          grad.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
          grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

          ctx.beginPath();
          ctx.strokeStyle = grad;
          ctx.lineWidth = ss.size;
          ctx.lineCap = "round";
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x + ss.len, ss.y - ss.len);
          ctx.stroke();

          if (ss.x < -ss.len || ss.y > height + ss.len) {
            ss.active = false;
            ss.wait = Math.random() * 300 + 100;
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-2] mix-blend-screen"
    />
  );
};

/**
 * Renders a custom animated cursor with a glowing torch effect, trailing ring, and ink-like particles that react to mouse movement and hover targets.
 * @example
 * CustomCursor()
 * null
 * @returns {JSX.Element | null} The custom cursor overlay elements, or null when the cursor is not visible.
 **/

const CelestialCursor = () => {
  if (window.location.pathname.includes("adminjatincontrolcentre")) {
    return null;
  }
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [trail, setTrail] = React.useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);

  const inkParticles = React.useRef<{ x: number; y: number; alpha: number }[]>(
    [],
  );
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let animationFrameId: number;
    let currentX = position.x;
    let currentY = position.y;

    /**
    * Updates cursor position, visibility, hover state, and ink particle trail on mouse movement.
    * @example
    * handleMouseMove(e)
    * undefined
    * @param {MouseEvent} e - Mouse event containing the current pointer position and target element.
    * @returns {void} This function does not return a value.
    **/
    const handleMouseMove = (e: MouseEvent) => {
      currentX = e.clientX;
      currentY = e.clientY;
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);

      // Check if hovering over interactive element
      const target = e.target as HTMLElement;
      const computedStyle = window.getComputedStyle(target);
      if (
        computedStyle.cursor === "pointer" ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }

      // Add ink particle
      inkParticles.current.push({ x: e.clientX, y: e.clientY, alpha: 0.5 });
      if (inkParticles.current.length > 15) {
        inkParticles.current.shift();
      }
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    /**
    * Updates and animates the ink trail position and particle rendering on the canvas.
    * @example
    * updateTrail()
    * void
    * @returns {void} No return value.
    **/
    const updateTrail = () => {
      setTrail((prev) => {
        const dx = currentX - prev.x;
        const dy = currentY - prev.y;
        return {
          x: prev.x + dx * 0.15, // Easing equivalent
          y: prev.y + dy * 0.15,
        };
      });

      // Draw ink trail
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          inkParticles.current.forEach((p, i) => {
            p.alpha *= 0.85; // decay
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = "#d4af37";
            ctx.beginPath();
            ctx.arc(p.x, p.y, (i / 15) * 3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      animationFrameId = requestAnimationFrame(updateTrail);
    };
    updateTrail();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
      />

      {/* Interactive Torch (Secondary Light Source) */}
      <div
        className="fixed inset-0 pointer-events-none z-[-1] transition-all duration-75 ease-out"
        style={{
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(212, 175, 55, 0.08), transparent 100%)`,
        }}
      />
      {/* The Lag-Ring */}
      <div
        className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full border border-mercury/30 hidden md:block"
        style={{
          left: `${trail.x}px`,
          top: `${trail.y}px`,
          width: isHovering ? "80px" : "40px",
          height: isHovering ? "80px" : "40px",
          borderColor: isHovering ? "#d4af37" : "rgba(212,175,55,0.3)",
          transition:
            "width 0.2s cubic-bezier(0.23, 1, 0.32, 1), height 0.2s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.2s",
        }}
      />
      {/* The Core */}
      <div
        className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4af37] hidden md:block"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: "4px",
          height: "4px",
        }}
      />
    </>
  );
};

/**
 * Renders a 3D-tilting interactive card that rotates based on mouse movement.
 * @example
 * ArtifactResonance({ children: <div>Content</div>, onClick: () => console.log("clicked"), className: "custom" })
 * <div>Content</div>
 * @param {{children: React.ReactNode, onClick?: () => void, className?: string}} props - Component props including content, click handler, and optional CSS classes.
 * @returns {JSX.Element} A styled div element that applies a perspective rotation effect and displays the provided children.
 **/
const ArtifactCard = ({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = React.useState({ x: 0, y: 0 });

  /**
  * Handles mouse movement over the card to calculate and set a tilt rotation based on cursor position.
  * @example
  * handleMouseMove(event)
  * void
  * @param {React.MouseEvent<HTMLDivElement>} e - Mouse event triggered by moving over the card element.
  * @returns {void} Updates the card rotation state based on the cursor position.
  **/
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normalize -1 to 1
    const normalizedX = (x / rect.width) * 2 - 1;
    const normalizedY = (y / rect.height) * 2 - 1;

    // Max rotation 5 deg
    setRotation({
      x: normalizedY * -5,
      y: normalizedX * 5,
    });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`artifact-resonance radar-pulse transition-transform duration-100 ease-out ${className}`}
      style={{
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
};

// --- Types ---

type VerdictStatus = "TRUE" | "FALSE" | "LARGELY TRUE" | "CONTESTED";
type AppTab =
  | "home"
  | "verdict"
  | "momentum"
  | "debate"
  | "career"
  | "smartxi"
  | "matches"
  | "raffle"
  | "blog"
  | "prediction"
  | "admin"
  | "store"
  | "stories"
  | "player-profile";

/**
 * Renders a circular metallic gold icon badge with an infinity symbol and optional shadow.
 * @example
 * MetallicInfinityBadge({ size: 24, className: "my-class", noShadow: false })
 * <div>...</div>
 * @param {{number}} size - The width and height of the badge in pixels.
 * @param {{string}} className - Additional CSS classes to apply to the outer container.
 * @param {{boolean}} noShadow - Whether to disable the drop shadow around the badge.
 * @returns {{JSX.Element}} A styled circular badge component.
 **/
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

/**
* Generates a short AI-powered cricket blog post with a title, content, category, read time, and current date.
* @example
* generateBlogPost("India vs Australia Test analysis")
* { title: "…", content: "…", category: "…", readTime: "…", date: "23 Jun 2026", isAI: true }
* @param {string} topic - The cricket topic to generate the blog post about.
* @returns {Promise<BlogPost>} A promise that resolves to the generated blog post object.
**/
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

/**
* Analyzes a cricket-related claim using AI and returns a structured verdict with supporting statistics and nuance.
* @example
* getCricketVerdict("Virat Kohli averages over 50 in ODIs")
* Promise resolving to a VerdictData object containing verdict, confidence, stats, and context.
* @param {string} claim - Cricket claim to analyze and verify.
* @returns {Promise<VerdictData>} Promise resolving to a verdict object with analysis results.
**/
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

/**
 * Fetches the current live cricket scores worldwide and returns a list of match details.
 * @example
 * getLiveScores()
 * [{ teams: ["Team A", "Team B"], score: "150/3", status: "Live", venue: "Stadium Name", format: "ODI", series: "Series Name", isLive: true }]
 * @returns {Promise<MatchData[]>} A promise that resolves to an array of live match data objects, or an empty array if fetching fails.
 **/
async function getLiveScores(): Promise<MatchData[]> {
  const prompt =
    "Get the current cricket matches worldwide. Return a list of matches with teams, score, status, venue, format, and series name.";
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
        "Error fetching matches scores (all attempts failed):",
        fallbackError,
      );
      return [];
    }
  }
}

/**
 * Runs an AI-powered match simulation to predict the most probable winner using current match conditions.
 * @example
 * runMatchSimulation("India vs Australia")
 * Promise<{ match: string, winner: string, probability: number, factors: { toss: string, weather: string, pitch: string, wind: string, humidity: string }, simulationDetails: string }>
 * @param {string} match - The match description or fixture to simulate.
 * @returns {Promise<PredictionResult>} A promise that resolves to the predicted match result and simulation details.
 */
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

/**
 * Renders a verdict analysis card with status, confidence, statistics, and supporting context.
 * @example
 * VerdictResults({ data, onBack })
 * <div>Analysis view rendered with verdict details</div>
 * @param {Object} data - Verdict data used to display the claim, status, confidence, and statistics.
 * @param {() => void} onBack - Callback invoked when the user clicks the back button.
 * @returns {JSX.Element} The rendered verdict results view.
 **/
const VerdictCard = ({
  data,
  onBack,
}: {
  data: VerdictData;
  onBack: () => void;
}) => {
  /**
   * Maps a verdict status to a corresponding Tailwind text color class.
   * @example
   * getVerdictTextClass("TRUE")
   * "text-mercury"
   * @param {VerdictStatus} status - The verdict status to convert into a CSS class.
   * @returns {string | undefined} The Tailwind text color class for the given status, or undefined if no match is found.
   */
  const getStatusColor = (status: VerdictStatus) => {
    switch (status) {
      case "TRUE":
        return "text-mercury";
      case "FALSE":
        return "text-red-500";
      case "LARGELY TRUE":
        return "text-mercury/80";
      case "CONTESTED":
        return "text-iris";
    }
  };

  /**
   * Returns a status-specific shield icon component styled with the corresponding color.
   * @example
   * getStatusIcon("TRUE")
   * <ShieldCheck className="size-8 text-green-500" />
   * @param {VerdictStatus} status - The verdict status used to determine which icon to render.
   * @returns {JSX.Element | undefined} The shield icon element for the given status, or undefined if no match is found.
   */
  const getStatusIcon = (status: VerdictStatus) => {
    const color = getStatusColor(status);
    switch (status) {
      case "TRUE":
      case "LARGELY TRUE":
        return <ShieldCheck className={`size-8 ${color}`} />;
      case "FALSE":
        return <ShieldAlert className={`size-8 ${color}`} />;
      case "CONTESTED":
        return <ShieldQuestion className={`size-8 ${color}`} />;
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
        className="flex items-center gap-2 text-[#948f96] hover:text-mercury transition-colors duration-500 mb-4"
      >
        <ArrowLeft size={18} />
        <span className="text-label">New Analysis</span>
      </button>

      <div className="glass-surface border border-hairline overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="p-8 border-b border-hairline bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusIcon(data.verdict)}
                <span
                  className={`px-3 py-1 text-label border border-current ${getStatusColor(data.verdict)}`}
                >
                  {data.verdict}
                </span>
              </div>
              <div className="text-meta text-[#948f96] mt-2">
                Oracle Confidence: {data.confidence}%
              </div>
            </div>
            <button className="p-2 border border-hairline text-mercury hover:bg-mercury/10 transition-colors">
              <Share2 size={20} />
            </button>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-on-surface leading-tight tracking-[-0.02em]">
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
                  <div className="text-[8px] text-metallic-gold/60 italic">
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
                  <span className="text-sm font-black text-metallic-gold">
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
        <div className="p-4 bg-white/[0.01] border-t border-hairline flex justify-center">
          <div className="text-meta text-[#948f96] tracking-[0.3em]">
            ORACLE_ENGINE • CRINAVA_INTELLIGENCE
          </div>
        </div>
      </div>
    </motion.div>
  );
};

import { useVerdictStore } from "./store/verdictStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const { playerProfileId, setPlayerProfileId } = useVerdictStore();
  const [isMatchesContext, setIsMatchesContext] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(0); // Balance in Crinava Coins
  const [cricketIQ, setCricketIQ] = useState(1240); // User's Cricket IQ score
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
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

  useEffect(() => {
    const fetchBlogs = () => {
      fetch("/api/blogs")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setBlogPosts(data);
        })
        .catch(console.error);
    };
    fetchBlogs();
    const interval = setInterval(fetchBlogs, 5000);
    return () => clearInterval(interval);
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showCareerInfo, setShowCareerInfo] = useState(false);
  const [showProInfo, setShowProInfo] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  const badges = [
    {
      id: "early-bird",
      name: "Early Bird",
      description: "Joined Crinava in its inaugural month.",
      icon: "🌟",
      requirement: "Join before April 2026",
      progress: 100,
    },
    {
      id: "strategist",
      name: "Strategist",
      description: "Master of tactical debates.",
      icon: "🧠",
      requirement: "Win 10 community debates",
      progress: 40,
    },
    {
      id: "oracle",
      name: "Oracle",
      description: "Uncanny ability to predict match outcomes.",
      icon: "🔮",
      requirement: "80% accuracy over 50 predictions",
      progress: 15,
    },
    {
      id: "iron-man",
      name: "Iron Man",
      description: "Unwavering consistency.",
      icon: "🛡️",
      requirement: "30-day login streak",
      progress: 60,
    },
    {
      id: "mastermind",
      name: "Mastermind",
      description: "Advanced simulation expert.",
      icon: "⚡",
      requirement: "Score > 90 in 5 advanced simulations",
      progress: 0,
    },
  ];

  const careerLevels = [
    { name: "Rookie", range: "0 - 500 CP", actions: "Daily Login: +10 CP" },
    {
      name: "Amateur",
      range: "501 - 1500 CP",
      actions: "Correct Prediction: +50 CP",
    },
    {
      name: "Professional",
      range: "1501 - 3500 CP",
      actions: "Debate Win: +100 CP",
    },
    {
      name: "Elite",
      range: "3501 - 7500 CP",
      actions: "Simulation Mastery: +150 CP",
    },
    {
      name: "Legend",
      range: "7501+ CP",
      actions: "Difficulty increases exponentially",
    },
  ];

  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Match Alert",
      message: "IND vs PAK starting in 30 mins!",
      time: "10m ago",
      read: false,
    },
    {
      id: "2",
      title: "New Analysis",
      message: "The Oracle has a new verdict on Kohli's form.",
      time: "1h ago",
      read: true,
    },
    {
      id: "3",
      title: "Raffle Draw",
      message: "Draw RD-882 completed. Check winners!",
      time: "2h ago",
      read: true,
    },
  ]);
  const [session, setSession] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPredictionGame, setShowPredictionGame] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [activeDebateChat, setActiveDebateChat] = useState<string | null>(null);
  const [debateMessages, setDebateMessages] = useState<any[]>([]);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(
    null,
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDebateChat) {
      /**
       * Fetches the latest messages for the active debate chat and updates the message state.
       * @example
       * sync()
       * void
       * @param {void} None - This function takes no arguments.
       * @returns {Promise<void>} A promise that resolves after the debate messages are fetched and state is updated.
       **/
      const fetchMessages = async () => {
        try {
          const response = await fetch(
            `/api/debates/${activeDebateChat}/messages`,
          );
          const data = await response.json();
          if (Array.isArray(data)) {
            setDebateMessages(data);
            if (data.length > 0) {
              setLastReadMessageId(data[data.length - 1].id);
            }
          }
        } catch (err) {
          console.error("Failed to fetch debate messages", err);
        }
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeDebateChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debateMessages]);

  /**
   * Sends a new message to the active debate chat and appends the server-created message on success.
   * @example
   * sync("I agree with this point.")
   * undefined
   * @param {string} text - The message text to send to the current debate chat.
   * @returns {void} No return value.
   **/
  const sendDebateMessage = async (text: string) => {
    if (!activeDebateChat || !text.trim()) return;
    const debate = debates.find((d) => d.id === activeDebateChat);
    const vote = debate?.userVote || "none";
    try {
      const response = await fetch(
        `/api/debates/${activeDebateChat}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: session?.user?.email?.split("@")[0] || "Anonymous",
            text,
            vote,
          }),
        },
      );
      if (response.ok) {
        const newMessage = await response.json();
        setDebateMessages((prev) => [...prev, newMessage]);
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const addNotification = (title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: "Just now",
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  useEffect(() => {
    // Real-time Notification Bell Logic
    const deliveriesSub = supabase
      .channel("public:deliveries")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deliveries" },
        (payload) => {
          const d = payload.new;
          if (d.runs_batter === 4 || d.runs_batter === 6) {
            addNotification(
              "Live Boundary!",
              `${d.striker} smashed a ${d.runs_batter} off ${d.bowler}!`,
            );
          } else if (d.player_dismissed) {
            addNotification(
              "WICKET!",
              `${d.player_dismissed} was dismissed by ${d.bowler} (${d.dismissal_kind})!`,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveriesSub);
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ? { user: session.user } : null);
      if (!session) {
        setIsProfileLoading(false);
        setProfile(null);
      }
    });

    // Handle Magic Link (Supabase handles this differently, but for now let's just keep the session check)
    setIsProfileLoading(false);

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      setIsProfileLoading(true);
      // Real-time profile sync
      /**
       * Syncs the current user's profile from Supabase and updates UI state accordingly.
       * @example
       * sync()
       * undefined
       * @returns {Promise<void>} Resolves after the profile data is loaded and state is updated.
       **/
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.uid)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 is 'no rows returned'
          console.error("Profile sync error:", error);
        } else if (data) {
          setProfile(data);
          if (!data.username) {
            setShowUsernameModal(true);
          }
        } else {
          // Profile doesn't exist, show username modal
          setShowUsernameModal(true);
        }
        setIsProfileLoading(false);
      };
      fetchProfile();
    }
  }, [session]);

  useEffect(() => {
    if (session && !isProfileLoading && !profile?.username) {
      const timer = setTimeout(() => {
        setShowUsernameModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [session, profile, isProfileLoading]);

  // Sync state with profile
  useEffect(() => {
    if (profile) {
      setCricketIQ(profile.cricket_iq);
      setCoinBalance(profile.crinava_coins);
    }
  }, [profile]);

  /**
  * Synchronizes local and remote profile state for cricket IQ and coin balance updates.
  * @example
  * sync(1200, 500)
  * undefined
  * @param {number} [newIQ] - Optional new cricket IQ value to persist.
  * @param {number} [newCoins] - Optional new coin balance value to persist.
  * @returns {Promise<void>} Resolves when the sync operation completes.
  **/
  const updateProfileStats = async (newIQ?: number, newCoins?: number) => {
    // Local state updates first
    if (newIQ !== undefined) setCricketIQ(newIQ);
    if (newCoins !== undefined) {
      setCoinBalance(newCoins);
      // Ensure the profile state is also updated if it exists
      if (profile) {
        setProfile((prev: any) => ({ ...prev, crinava_coins: newCoins }));
      }
    }

    if (!session?.user) return;

    const updates: any = {};
    if (newIQ !== undefined) updates.cricket_iq = newIQ;
    if (newCoins !== undefined) updates.crinava_coins = newCoins;
    updates.updated_at = new Date().toISOString();

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", session.user.uid);
      if (error) throw error;
    } catch (error) {
      console.error("Profile update error:", error);
    }
  };

  const buyCoins = async (amount: number) => {
    const newBalance = coinBalance + amount;
    await updateProfileStats(undefined, newBalance);
    addNotification(
      "Coins Purchased",
      `Successfully added ${amount} Crinava Coins to your wallet.`,
    );
  };

  // New Pillars State
  const [debates, setDebates] = useState<Debate[]>([]);

  useEffect(() => {
    /**
    * Fetches debate data from the API and updates the debates state.
    * @example
    * sync()
    * undefined
    * @returns {Promise<void>} A promise that resolves after the fetch attempt completes.
    **/
    const fetchDebates = async () => {
      console.log("Fetching debates...");
      try {
        const response = await fetch("/api/debates");
        console.log("Response status:", response.status);
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries()),
        );
        if (response.ok) {
          const data = await response.json();
          console.log("Debates data:", data);
          setDebates(data);
        } else {
          const text = await response.text();
          console.error(
            "Failed to fetch debates. Status:",
            response.status,
            "Body:",
            text,
          );
          throw new Error(`Failed to fetch: ${response.status} ${text}`);
        }
      } catch (err) {
        console.error("Debate fetch failed", err);
      }
    };
    fetchDebates();
    const interval = setInterval(fetchDebates, 5000);
    return () => clearInterval(interval);
  }, []);
  const [momentumData, setMomentumData] = useState<MomentumPoint[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [vertexResult, setVertexResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  /**
   * Runs a Monte Carlo-based AI simulation for a given match name and updates the UI with the results.
   * @example
   * sync("Lakers vs Celtics")
   * undefined
   * @param {string} matchName - The name of the match to simulate.
   * @returns {void} No return value.
   **/
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
    /**
     * Fetches career trajectory data for the selected player and updates state.
     * @example
     * sync()
     * undefined
     * @param {void} None - This function does not accept any arguments.
     * @returns {Promise<void>} A promise that resolves after the API request completes and state is updated.
     **/
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

  /**
   * Adds a player to the selected Smart XI if the XI is not full and the player is not already selected.
   * @example
   * addPlayerToSmartXI(player)
   * undefined
   * @param {Player} player - The player to add to the Smart XI.
   * @returns {void} Does not return a value.
   **/
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

  /**
   * Purchases one or more raffle tickets, updates coin balance, and generates ticket codes.
   * @example
   * purchaseRaffleTickets(3)
   * undefined
   * @param {number} qty - Number of raffle tickets to purchase.
   * @returns {void} No return value.
   **/
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
      return;
    }
    updateProfileStats(undefined, coinBalance - totalCost);
    addNotification(
      "Ticket Purchased",
      `Successfully bought ${qty} Raffle Ticket${qty > 1 ? "s" : ""}. Good luck!`,
    );
    const newTickets = Array.from({ length: qty }).map(() => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let result = "";
      for (let i = 0; i < 12; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });
    setRaffleTickets((prev) => [...prev, ...newTickets]);
    setIsRaffleModalOpen(false);
    setRaffleQuantity(1);
  };

  /**
   * Generates a new AI blog post, prepends it to the current list, and updates profile stats.
   * @example
   * sync()
   * undefined
   * @returns {Promise<void>} A promise that resolves after the post generation flow completes, or after an error is handled.
   **/
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

  /**
  * Fetches momentum map data for a given match ID and updates related UI state.
  * @example
  * sync("match_123")
  * void
  * @param {string} match - Match identifier used to request momentum map data.
  * @returns {Promise<void>} Resolves when the request completes and state is updated, if successful.
  **/
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

  /**
  * Submits a vote for a debate, updates the debate state, and increments profile stats on success.
  * @example
  * sync("debate123", "for", "I agree with this position because...")
  * undefined
  * @param {string} debateId - The ID of the debate to vote on.
  * @param {"for" | "against"} side - The vote side to cast.
  * @param {string} reasoning - The user's reasoning for the vote.
  * @returns {Promise<void>} A promise that resolves when the vote submission and state update complete.
  **/
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
    setMatches(scores);
    setLoading(false);
  };

  /**
   * Simulates a cricket match prediction request, updates progress state, and stores the returned result.
   * @example
   * sync("IND vs AUS")
   * { prediction: "India wins", confidence: 0.87 }
   * @param {string} matchName - The match name or identifier to simulate.
   * @returns {Promise<void>} A promise that resolves after the simulation completes or fails.
   **/
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
    if (activeTab === "matches") {
      fetchLiveScores();
    }
  }, [activeTab]);

  // Scroll Progress Indicator (Celestial Organic)
  React.useEffect(() => {
    const handleScroll = () => {
      const el = document.getElementById("scrollProgress");
      if (!el) return;
      const winScroll = document.documentElement.scrollTop;
      const height =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      el.style.height = `${scrolled}%`;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /**
   * Performs a cricket verdict lookup for the provided text or current query, updating loading, error, and verdict state.
   * @example
   * sync("Will India win the match?")
   * undefined
   * @param {string} text - Optional search text to use instead of the current query.
   * @returns {Promise<void>} A promise that resolves after the verdict request completes and state is updated.
   **/
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

  if (
    window.location.pathname === "/adminjatincontrolcentre260109071108" ||
    window.location.hash === "#adminjatincontrolcentre260109071108"
  ) {
    return <AdminControlCenter />;
  }

  return (
    <div className="min-h-screen bg-transparent text-on-surface font-body selection:bg-mercury selection:text-void overflow-x-hidden relative">
      {/* Volumetric Atmospheric Fog */}
      <div
        className="fixed inset-0 pointer-events-none z-[-3]"
        style={{
          background:
            "linear-gradient(to bottom left, rgba(212, 175, 55, 0.03) 0%, transparent 100%)",
        }}
      />

      {/* Celestial Organic Ambient Effects */}
      <StarfieldCanvas />
      <CelestialCursor />
      <div
        id="scrollProgress"
        className="fixed right-0 top-0 w-[1px] z-50 transition-all duration-100"
        style={{
          height: "0%",
          background: "#D4AF37",
          boxShadow: "0 0 10px rgba(212, 175, 55, 0.5)",
        }}
      />
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-obsidian border-b border-hairline">
        <div className="relative flex justify-between items-center px-5 md:px-16 h-16 w-full max-w-[1920px] mx-auto">
          {/* Left: Hamburger Menu */}
          <div className="flex items-center">
            <button
              onClick={() => setShowSideMenu(true)}
              className="p-2 text-[#948f96] hover:text-mercury transition-colors duration-500 group"
            >
              <Menu
                size={22}
                className="group-hover:scale-95 transition-transform"
              />
            </button>
          </div>

          {/* Middle: Logo Text Only */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer"
            onClick={() => {
              setActiveTab("home");
              setIsMatchesContext(false);
              setVerdict(null);
              setQuery("");
            }}
          >
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-[-0.05em] leading-none text-white">
              ORBITAL_OS
            </h1>
          </div>

          {/* Right: Notification Bell */}
          <div className="w-10 md:w-12 flex justify-end">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-[#948f96] hover:text-mercury transition-colors duration-500 relative"
            >
              <Bell size={20} />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-2 right-2 size-2 bg-mercury rounded-full pulse-mercury" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {showSideMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSideMenu(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 150 }}
              className="fixed inset-y-0 left-0 w-[85vw] max-w-[420px] bg-[#020203] z-[101] shadow-[50px_0_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden border-r border-white/5"
            >
              {/* Massive Watermark */}
              <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden pointer-events-none select-none z-0">
                <div className="absolute -right-[150px] top-[10%] text-[200px] font-black text-white/[0.015] -rotate-90 font-display leading-none whitespace-nowrap">
                  SYSTEM
                </div>
              </div>

              {/* Minimal Header */}
              <div className="p-8 pb-4 flex items-center justify-between relative z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-8 bg-white flex items-center justify-center rounded-[4px]">
                    <span className="text-[#020203] font-display font-black text-xl tracking-tighter">
                      C
                    </span>
                  </div>
                  <span className="text-white text-xs font-black tracking-[0.3em] uppercase opacity-40">
                    Command_Deck
                  </span>
                </div>
                <button
                  onClick={() => setShowSideMenu(false)}
                  className="p-2 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-all active:scale-95"
                >
                  <X size={24} strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 relative z-10 flex flex-col gap-10">
                {/* Profile Identity Block */}
                <div className="flex items-center gap-6">
                  <div className="relative size-20 shrink-0">
                    <div className="absolute inset-0 border-2 border-aurora-teal/30 rounded-full animate-pulse" />
                    <div className="absolute inset-[4px] border border-aurora-teal/50 rounded-full border-t-aurora-teal rotate-45" />
                    <div className="absolute inset-[8px] bg-[#111113] rounded-full overflow-hidden flex items-center justify-center">
                      {profile?.photoURL ? (
                        <img
                          src={profile.photoURL}
                          alt="Profile"
                          className="size-full object-cover grayscale opacity-80"
                        />
                      ) : (
                        <UserCircle size={40} className="text-aurora-teal/50" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2 truncate">
                      {profile?.username ||
                        (session ? profile?.email?.split("@")[0] : "GUEST_UXR")}
                    </h2>
                    <div className="inline-flex items-center gap-2">
                      <div className="size-2 bg-aurora-teal rounded-full shadow-[0_0_8px_rgba(46,213,115,1)]" />
                      <span className="text-[10px] font-black text-aurora-teal uppercase tracking-[0.2em] truncate">
                        {profile?.expertise_badge || "Initiate Status"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cyberpunk Grid Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-xl relative group overflow-hidden">
                    <div className="absolute top-0 right-0 size-16 bg-metallic-gold/10 blur-xl group-hover:bg-metallic-gold/20 transition-all" />
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">
                      Core Balance
                    </p>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-black text-white font-display leading-none">
                        {coinBalance}
                      </span>
                      <span className="text-[10px] font-black text-metallic-gold mb-1">
                        CRN
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-xl relative group overflow-hidden">
                    <div className="absolute top-0 right-0 size-16 bg-aurora-teal/10 blur-xl group-hover:bg-aurora-teal/20 transition-all" />
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">
                      Intelligence
                    </p>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-black text-white font-display leading-none">
                        {cricketIQ}
                      </span>
                      <span className="text-[10px] font-black text-aurora-teal mb-1">
                        IQ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Massive Typographic Menu */}
                <div className="flex flex-col -mx-4">
                  {[
                    { id: "home", label: "DASHBOARD", num: "01" },
                    { id: "store", label: "THE STORE", num: "02" },
                    { id: "prediction", label: "PREDICTIONS", num: "03" },
                    { id: "raffle", label: "RAFFLE ROOM", num: "04" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as AppTab);
                        setShowSideMenu(false);
                      }}
                      className="group relative flex items-center justify-between px-4 py-5 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/[0.02] scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-300" />
                      <div className="flex items-center gap-6 relative z-10">
                        <span
                          className={`text-[10px] font-black font-mono transition-colors duration-300 ${activeTab === item.id ? "text-aurora-teal" : "text-gray-600"}`}
                        >
                          {item.num}
                        </span>
                        <span
                          className={`text-2xl font-black tracking-widest transition-colors duration-300 ${activeTab === item.id ? "text-white" : "text-gray-500 group-hover:text-white"}`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <ArrowUpRight
                        size={24}
                        className={`relative z-10 transition-all duration-300 ${activeTab === item.id ? "text-aurora-teal rotate-45" : "text-gray-700 group-hover:text-white group-hover:rotate-45"}`}
                      />
                    </button>
                  ))}
                </div>

                {/* Neural Match Profile */}
                <div className="bg-[#0a0a0c] border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                  <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity translate-x-4 translate-y-4">
                    <User size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        Neural Pro Match
                      </p>
                      <Info
                        size={14}
                        className="text-gray-600 hover:text-white cursor-pointer transition-colors"
                        onClick={() => setShowProInfo(true)}
                      />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-4">
                      {profile?.professional_comparison?.match || "Virat Kohli"}
                    </h3>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-aurora-teal/10 border border-aurora-teal/20 rounded-sm">
                      <div className="size-1.5 bg-aurora-teal rounded-full animate-pulse" />
                      <span className="text-[9px] font-black text-aurora-teal uppercase tracking-[0.2em]">
                        92% DNA MATCH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Minimal Badges & Career Row */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-[#0a0a0c] border border-white/5 rounded-xl p-4">
                    <div className="flex justify-between items-end mb-4">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        Career Path
                      </span>
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">
                        {profile?.career_path || "Rookie"}
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden">
                      <div
                        className="h-full bg-metallic-gold"
                        style={{
                          width: `${session ? Math.min((cricketIQ / 7500) * 100, 100) : 5}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 bg-[#0a0a0c] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        Honor Core
                      </span>
                      <button
                        onClick={() => {
                          setShowBadgesModal(true);
                          setShowSideMenu(false);
                        }}
                        className="text-[9px] font-black text-aurora-teal hover:text-white uppercase tracking-widest transition-colors"
                      >
                        All
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      {badges.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          title={b.name}
                          className={`size-8 rounded-[4px] flex items-center justify-center text-xs border ${b.progress === 100 ? "bg-metallic-gold/10 border-metallic-gold/30 text-metallic-gold" : "bg-white/5 border-white/5 text-gray-600 grayscale"}`}
                        >
                          {b.icon}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Secure Footer */}
              {session ? (
                <div className="p-8 pt-4 relative z-10 shrink-0">
                  <button
                    onClick={() => {
                      supabase.auth.signOut();
                      setShowSideMenu(false);
                    }}
                    className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors group"
                  >
                    <div className="size-8 rounded-full border border-gray-800 flex items-center justify-center group-hover:border-red-500/50 group-hover:bg-red-500/10 transition-colors">
                      <LogOut
                        size={12}
                        className="group-hover:-translate-x-0.5 transition-transform"
                      />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                      Terminate Session
                    </span>
                  </button>
                </div>
              ) : (
                <div className="p-8 pt-4 relative z-10 shrink-0">
                  <button
                    onClick={() => {
                      setShowAuthModal(true);
                      setShowSideMenu(false);
                    }}
                    className="w-full py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Authenticate
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[85vw] max-w-sm bg-void border-l border-hairline z-[101] shadow-[-20px_0_60px_rgba(0,0,0,0.8)] flex flex-col"
            >
              <div className="p-6 border-b border-hairline flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-mercury" />
                  <span className="font-display text-lg font-bold tracking-[-0.02em] text-on-surface">
                    ALERTS
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2 text-[#948f96] hover:text-mercury transition-colors duration-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-2xl border transition-all ${notification.read ? "bg-white/[0.02] border-white/5 opacity-60" : "bg-aurora-teal/5 border-aurora-teal/20"}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-[11px] font-black text-white uppercase tracking-wider">
                          {notification.title}
                        </h4>
                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                          {notification.time}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                    <Bell size={48} className="text-gray-600" />
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      No new notifications
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5">
                <button
                  onClick={() =>
                    setNotifications(
                      notifications.map((n) => ({ ...n, read: true })),
                    )
                  }
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all"
                >
                  Mark All as Read
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        session={session}
      />

      {/* Info Modals */}
      <AnimatePresence>
        {showCareerInfo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 relative"
            >
              <button
                onClick={() => setShowCareerInfo(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                <TrendingUpIcon className="text-aurora-teal" size={20} />
                Career Progression
              </h3>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <h4 className="text-[10px] font-black text-aurora-teal uppercase tracking-widest mb-2">
                    How to earn CP (Cricket IQ)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-[9px] font-bold text-gray-400">
                      Daily Login: <span className="text-white">+10 CP</span>
                    </div>
                    <div className="text-[9px] font-bold text-gray-400">
                      Correct Prediction:{" "}
                      <span className="text-white">+50 CP</span>
                    </div>
                    <div className="text-[9px] font-bold text-gray-400">
                      Debate Win: <span className="text-white">+100 CP</span>
                    </div>
                    <div className="text-[9px] font-bold text-gray-400">
                      Simulation Mastery:{" "}
                      <span className="text-white">+150 CP</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-metallic-gold uppercase tracking-widest">
                    Difficulty Curve
                  </h4>
                  {careerLevels.map((level) => (
                    <div
                      key={level.name}
                      className="flex justify-between items-center p-2 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">
                        {level.name}
                      </span>
                      <span className="text-[9px] font-bold text-gray-500">
                        {level.range}
                      </span>
                    </div>
                  ))}
                  <p className="text-[8px] text-gray-600 font-medium italic mt-2">
                    Difficulty increases exponentially as you reach higher
                    tiers.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showProInfo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 relative"
            >
              <button
                onClick={() => setShowProInfo(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                <UserCircle className="text-aurora-teal" size={20} />
                Pro Comparison
              </h3>
              <div className="space-y-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Our advanced AI engine analyzes your performance across all
                  Crinava activities to determine which professional cricketer
                  your style most closely resembles.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-1.5 rounded-full bg-aurora-teal mt-1.5" />
                    <p className="text-[10px] text-gray-300 font-medium">
                      <span className="text-white font-black">
                        Predictions:
                      </span>{" "}
                      Accuracy in match outcomes and player performances.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-1.5 rounded-full bg-aurora-teal mt-1.5" />
                    <p className="text-[10px] text-gray-300 font-medium">
                      <span className="text-white font-black">Debates:</span>{" "}
                      Quality of tactical arguments and community consensus.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-1.5 rounded-full bg-aurora-teal mt-1.5" />
                    <p className="text-[10px] text-gray-300 font-medium">
                      <span className="text-white font-black">
                        Simulations:
                      </span>{" "}
                      Decision-making speed and strategic depth in Smart XI
                      scenarios.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showBadgesModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 relative max-h-[80vh] overflow-hidden flex flex-col"
            >
              <button
                onClick={() => setShowBadgesModal(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                <Award className="text-metallic-gold" size={28} />
                Hall of Fame
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-4 group hover:border-aurora-teal/30 transition-all"
                  >
                    <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {badge.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-[11px] font-black text-white uppercase tracking-widest">
                          {badge.name}
                        </h4>
                        <span className="text-[8px] font-black text-metallic-gold uppercase tracking-widest">
                          Locked
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium mb-2">
                        {badge.description}
                      </p>
                      <div className="flex items-center gap-1.5 mb-3">
                        <HelpCircle size={10} className="text-gray-600" />
                        <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                          Req: {badge.requirement}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                          <span className="text-gray-600">Progress</span>
                          <span
                            className={
                              badge.progress === 100
                                ? "text-metallic-gold"
                                : "text-gray-400"
                            }
                          >
                            {badge.progress}%
                          </span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${badge.progress}%` }}
                            className={`h-full ${badge.progress === 100 ? "bg-metallic-gold" : "bg-gray-600"}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UsernameModal
        isOpen={showUsernameModal}
        uid={session?.user?.uid}
        email={session?.user?.email}
        onComplete={(username) => {
          setShowUsernameModal(false);
          // Profile will be updated by onSnapshot
        }}
        onClose={() => {
          setShowUsernameModal(false);
          supabase.auth.signOut();
        }}
      />

      <main className="pt-24 px-5 md:px-16 pb-28 max-w-[1200px] mx-auto flex flex-col items-center">
        {playerProfileId ? (
          <PlayerProfile
            playerId={playerProfileId}
            onBack={() => setPlayerProfileId(null)}
          />
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center"
              >
                <div className="w-full max-w-7xl py-12 space-y-32">
                  {/* Hero Section */}
                  <motion.section
                    initial={{ opacity: 0, y: 60 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    viewport={{ once: false, amount: 0.3, margin: "-50px" }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative"
                  >
                    {/* Image Shard */}
                    <div className="flex justify-center relative">
                      <div className="relative w-full max-w-sm aspect-[4/5]">
                        <ArtifactCard className="absolute inset-0 z-10 p-0 overflow-visible border-0 bg-transparent hover:bg-transparent">
                          <div className="size-full relative z-10 shadow-[20px_20px_60px_rgba(0,0,0,0.8)] overflow-hidden artifact-resonance">
                            <img
                              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                              alt="Brutalist Structure"
                              className="size-full object-cover mix-blend-luminosity grayscale contrast-125 hover:scale-105 transition-transform duration-1000"
                            />
                          </div>
                        </ArtifactCard>
                        {/* Geometric Shadow */}
                        <div className="absolute inset-0 bg-void border border-hairline translate-x-8 translate-y-8 -z-10" />
                      </div>
                    </div>

                    {/* Text Column */}
                    <div className="flex flex-col gap-6 z-20 text-left">
                      <h2 className="font-display font-black text-white text-6xl md:text-8xl leading-[0.8] tracking-tighter">
                        CELESTIAL
                        <br />
                        <span className="text-[#D4AF37]">ORGANIC</span>
                      </h2>
                      <div className="space-y-2 mt-4">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                          // THE MANIFESTO OF FLUID GEOMETRY
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                          // V 1.0.0
                        </p>
                      </div>
                    </div>
                  </motion.section>

                  {/* Manifesto Typography Reveal */}
                  <section className="flex justify-end pr-0 md:pr-16 clip-reveal visible">
                    <h3 className="font-display font-bold text-white text-3xl md:text-5xl max-w-2xl leading-[1.1] tracking-tight">
                      We sculpt the void.
                      <br />
                      Through high-
                      <br />
                      contrast fragments
                      <br />
                      and liquid obsidian,
                      <br />
                      we forge digital
                      <br />
                      artifacts that
                      <br />
                      breathe. The
                      <br />
                      tension between
                      <br />
                      stark geometry and
                      <br />
                      organic fluidity
                      <br />
                      defines our reality.
                    </h3>
                  </section>

                  {/* Feature Sections */}
                  <motion.section
                    initial="hidden"
                    whileInView="visible"
                    exit="hidden"
                    viewport={{ once: false, amount: 0.2, margin: "-100px" }}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.25,
                          delayChildren: 0.2,
                        },
                      },
                    }}
                    className="space-y-16"
                  >
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 40, scale: 0.98 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
                        },
                      }}
                      className="flex flex-col justify-between gap-8"
                    >
                      <h3 className="text-3xl md:text-5xl font-display font-black text-white tracking-[-0.03em] leading-tight">
                        DIGITAL_ARTIFACTS
                      </h3>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 max-w-4xl mx-auto px-4 md:px-0">
                      {[
                        {
                          title: "Momentum",
                          tab: "momentum",
                          code: "FRAG_01_CORE",
                          img: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
                        },
                        {
                          title: "Smart XI",
                          tab: "smartxi",
                          code: "FRAG_02_TACT",
                          img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
                        },
                      ].map((feature, i) => (
                        <motion.div
                          key={i}
                          variants={{
                            hidden: { opacity: 0, scale: 0.92, y: 60 },
                            visible: {
                              opacity: 1,
                              scale: 1,
                              y: 0,
                              transition: {
                                duration: 1.2,
                                ease: [0.22, 1, 0.36, 1],
                              },
                            },
                          }}
                          className="relative"
                        >
                          <ArtifactCard
                            onClick={() => setActiveTab(feature.tab as AppTab)}
                            className="w-full aspect-[4/5] cursor-pointer border-0 bg-transparent hover:bg-transparent p-0"
                          >
                            <div className="size-full relative z-10 shadow-[10px_10px_40px_rgba(0,0,0,0.9)] overflow-hidden artifact-resonance">
                              <img
                                src={feature.img}
                                alt={feature.title}
                                className="size-full object-cover grayscale contrast-125"
                              />
                            </div>
                          </ArtifactCard>
                          <div className="flex justify-between items-center mt-6">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] group-hover:text-[#D4AF37] transition-colors">
                              {feature.code}
                            </span>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] group-hover:text-[#D4AF37] transition-colors">
                              BRUTAL / LIGHT
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>

                  {/* Terminal Bottom Links */}
                  <section className="pt-24 pb-12 flex flex-col items-center gap-12 border-t border-hairline relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-12 bg-gradient-to-b from-mercury to-transparent" />

                    <div className="flex flex-wrap justify-center items-center gap-6 text-xl md:text-3xl font-display font-black tracking-tight text-white">
                      <button
                        onClick={() => setActiveTab("debate")}
                        className="hover:text-[#D4AF37] transition-colors"
                      >
                        LIQUID_INK
                      </button>
                      <span className="text-gray-700 font-light">/</span>
                      <button
                        onClick={() => setActiveTab("blog")}
                        className="hover:text-[#D4AF37] transition-colors"
                      >
                        SYSTEM_LOGS
                      </button>
                      <span className="text-gray-700 font-light">/</span>
                      <button
                        onClick={() => setActiveTab("verdict")}
                        className="text-[#D4AF37] hover:text-white transition-colors border-b-2 border-[#D4AF37] pb-1"
                      >
                        TERMINAL
                      </button>
                    </div>

                    <p className="text-[10px] text-[#D4AF37] uppercase tracking-[0.3em] font-black text-center max-w-md">
                      // INITIATING QUANTUM PARALLAX ROUTINE [OK]
                    </p>
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
                <div className="text-center space-y-3">
                  <span className="text-label text-mercury tracking-[0.3em]">
                    [TELEMETRY_ACTIVE]
                  </span>
                  <h2 className="text-headline-lg text-on-surface tracking-[-0.03em]">
                    MOMENTUM_MAP
                  </h2>
                  <p className="text-meta text-mercury tracking-widest">
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
                          <div className="size-2 rounded-full bg-aurora-teal animate-pulse" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">
                            Telemetry Active
                          </span>
                        </div>
                      )}
                    </div>

                    {momentumData?.length > 0 ? (
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
                              tickFormatter={(val) =>
                                val > 0 ? `+${val}` : val
                              }
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
                            {momentumData?.map(
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
                            <div className="size-10 rounded-full bg-aurora-teal/20 flex items-center justify-center">
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
                        <div className="flex gap-2">
                          <div className="p-2 bg-white/5 rounded-lg">
                            <Gavel size={16} className="text-aurora-teal" />
                          </div>
                          <button
                            onClick={() => setActiveDebateChat(d.id)}
                            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all group"
                          >
                            <MessageSquare
                              size={16}
                              className="text-gray-400 group-hover:text-aurora-teal"
                            />
                          </button>
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
                          <div
                            className={`p-3 rounded-xl bg-white/5 border border-white/10 text-center ${d.userVote === "for" ? "border-blue-500/30" : "border-red-500/30"}`}
                          >
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${d.userVote === "for" ? "text-blue-400" : "text-red-400"}`}
                            >
                              You voted{" "}
                              {d.userVote === "for" ? "For" : "Against"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleVote(
                                  d.id,
                                  "for",
                                  "He is simply the best.",
                                )
                              }
                              className="flex-1 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-all"
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
            )}{" "}
            {activeTab === "career" && (
              <motion.div
                key="career"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-4xl space-y-12 pb-20"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">
                    Crinava Career
                  </h2>
                  <p className="text-aurora-teal text-[10px] font-black uppercase tracking-widest">
                    Your Path to Cricket Immortality
                  </p>
                </div>

                {/* 1. Crinava Career Path */}
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} className="text-aurora-teal" />
                        Career Path
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium italic">
                        Level up your cricket intelligence
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-aurora-teal uppercase tracking-widest">
                      Stage: {profile?.career_path || "Rookie"}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {["Rookie", "Amateur", "Semi-Pro", "Pro", "Legend"].map(
                      (stage, idx) => {
                        const stages = [
                          "Rookie",
                          "Amateur",
                          "Semi-Pro",
                          "Pro",
                          "Legend",
                        ];
                        const currentIdx = stages.indexOf(
                          profile?.career_path || "Rookie",
                        );
                        const isActive = idx <= currentIdx;
                        return (
                          <div key={stage} className="space-y-3">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${isActive ? "bg-aurora-teal shadow-[0_0_10px_rgba(0,255,200,0.3)]" : "bg-white/5"}`}
                            />
                            <p
                              className={`text-[8px] font-black uppercase text-center tracking-tighter ${isActive ? "text-white" : "text-gray-600"}`}
                            >
                              {stage}
                            </p>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 2. Expertise Badge */}
                  <div className="p-8 rounded-3xl bg-[#111111] border border-white/5 space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Award size={80} className="text-aurora-teal" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Medal size={14} className="text-aurora-teal" />
                        Expertise Badge
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium italic">
                        Your current mastery level
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="size-24 rounded-full bg-gradient-to-br from-aurora-teal/20 to-transparent border border-aurora-teal/30 flex items-center justify-center">
                          <Zap className="text-aurora-teal" size={40} />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-white text-black text-[8px] font-black px-2 py-1 rounded-full uppercase italic">
                          {profile?.expertise_badge || "Novice"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-white font-bold italic uppercase tracking-tighter">
                          {profile?.expertise_badge === "Novice"
                            ? "The Journey Begins"
                            : profile?.expertise_badge === "Analyst"
                              ? "The Data Master"
                              : "The Oracle"}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          Complete 5 more correct predictions to unlock the{" "}
                          <span className="text-aurora-teal font-bold">
                            Analyst
                          </span>{" "}
                          badge.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Professional Comparison */}
                  <div className="p-8 rounded-3xl bg-[#111111] border border-white/5 space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={14} className="text-aurora-teal" />
                        Pro Comparison
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium italic">
                        You vs. The Elite
                      </p>
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          label: "Batting IQ",
                          user: profile?.professional_comparison?.batting || 45,
                          pro: 92,
                        },
                        {
                          label: "Bowling IQ",
                          user: profile?.professional_comparison?.bowling || 30,
                          pro: 88,
                        },
                        {
                          label: "Strategy",
                          user:
                            profile?.professional_comparison?.strategy || 40,
                          pro: 95,
                        },
                      ].map((stat) => (
                        <div key={stat.label} className="space-y-2">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                            <span className="text-gray-400">{stat.label}</span>
                            <span className="text-white">
                              {stat.user}%{" "}
                              <span className="text-gray-600">
                                / {stat.pro}%
                              </span>
                            </span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-aurora-teal"
                              style={{ width: `${stat.user}%` }}
                            />
                            <div
                              className="h-full bg-white/10"
                              style={{ width: `${stat.pro - stat.user}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Original Career Story Section (Integrated) */}
                <div className="space-y-8">
                  <div className="flex justify-center">
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                      {["Virat Kohli", "Sachin Tendulkar", "MS Dhoni"].map(
                        (p) => (
                          <button
                            key={p}
                            onClick={() => setCareerPlayer(p)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${careerPlayer === p ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {careerPlayer ? (
                    <div className="p-8 rounded-3xl bg-[#111111] border border-white/5 space-y-8">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black text-aurora-teal uppercase tracking-widest">
                          {careerPlayer} Performance Timeline
                        </h3>
                        <span className="text-[10px] font-black text-metallic-gold uppercase">
                          Historical Data
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
                            <YAxis stroke="#ffffff20" fontSize={10} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0A0A0A",
                                border: "1px solid #ffffff10",
                                borderRadius: "12px",
                              }}
                              itemStyle={{
                                color: "#FFD700",
                                fontSize: "10px",
                                fontWeight: "bold",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="runs"
                              stroke="#FFD700"
                              strokeWidth={3}
                              dot={{ fill: "#FFD700", r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                      <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-dashed border-white/10">
                        <BookOpen size={30} className="text-gray-700" />
                      </div>
                      <p className="text-xs text-gray-500 font-black uppercase tracking-widest">
                        Select a player to explore their story
                      </p>
                    </div>
                  )}

                  {/* Chapters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(careerData?.chapters || []).map((chapter, i) => (
                      <div
                        key={i}
                        className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 hover:border-metallic-gold/30 transition-all"
                      >
                        <div className="text-[8px] font-black text-metallic-gold uppercase tracking-[0.2em]">
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
                      <TrendingUp size={14} className="text-metallic-gold" />
                      Greatest Season Detector
                    </button>
                    <button className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center gap-2">
                      <Share2 size={14} className="text-metallic-gold" />
                      Share Career Moment
                    </button>
                  </div>
                </div>
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
                        <h3 className="text-xs font-black text-metallic-gold uppercase tracking-widest">
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
                            className={`aspect-[3/4] rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all ${selectedSmartXI[i] ? "bg-metallic-gold/10 border-metallic-gold/30" : "bg-white/[0.01] border-dashed border-white/10"}`}
                          >
                            {selectedSmartXI[i] ? (
                              <>
                                <div className="text-[8px] font-black text-metallic-gold uppercase mb-1">
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
                            className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${selectedSmartXI.find((p) => p.id === player.id) ? "opacity-30 pointer-events-none" : "bg-white/[0.02] border-white/5 hover:border-metallic-gold/30"}`}
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
                              <div className="text-[10px] font-black text-metallic-gold">
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
                    <div className="p-8 rounded-3xl bg-metallic-gold text-black space-y-6 text-center">
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
                        "The stats say your XI wins 67% of the time. Strong
                        middle order, but slightly weak on death bowling."
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
                              <span className="text-metallic-gold">34%</span>
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
            {activeTab === "matches" && (
              <motion.div
                key="matches"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-2xl space-y-6"
              >
                <MatchesSection
                  onBackToHome={() => {
                    setIsMatchesContext(false);
                    setActiveTab("home");
                  }}
                />
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
                {showPredictionGame ? (
                  <PredictionGame onBack={() => setShowPredictionGame(false)} />
                ) : !prediction && !simulating ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 rounded-2xl bg-gradient-to-br from-aurora-teal/20 to-transparent border border-aurora-teal/20 space-y-6 relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CoinIcon size={120} />
                      </div>
                      <h3 className="text-xl font-black text-white italic">
                        Oracle Simulation
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        Run 1,000,000 iterations based on real-time toss,
                        weather, and pitch telemetry.
                      </p>
                      {session ? (
                        <div className="space-y-4">
                          <input
                            type="text"
                            placeholder="Enter Match (e.g. MI vs CSK)"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-aurora-teal outline-none transition-all"
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              handleSimulate(
                                (e.target as HTMLInputElement).value,
                              )
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
                        onClick={() => setShowPredictionGame(true)}
                        className="w-full py-3 border border-metallic-gold text-metallic-gold font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-metallic-gold/10 transition-all"
                      >
                        Enter Arena
                      </button>
                    </div>
                  </div>
                ) : simulating ? (
                  <div className="bg-[#111111] border border-aurora-teal/30 rounded-3xl p-12 flex flex-col items-center space-y-8">
                    <div className="relative size-32">
                      <svg className="size-full" viewBox="0 0 100 100">
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
                <div className="bg-gradient-to-br from-metallic-gold/20 to-transparent p-8 rounded-3xl border border-metallic-gold/20 relative">
                  <div className="relative z-10 space-y-6">
                    <div className="relative">
                      <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                          IPL Raffle
                        </h2>
                        <p className="text-metallic-gold text-[10px] font-black uppercase tracking-widest">
                          Next Draw: 2h 45m
                        </p>
                      </div>
                      <div className="absolute -top-2 -right-6 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                        <div className="flex items-center gap-1">
                          <span className="text-2xl font-black text-white">
                            10
                          </span>
                          <CoinIcon size={20} />
                        </div>
                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block mt-1">
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
                        My Tickets ({raffleTickets?.length || 0})
                      </h3>
                      {raffleTickets?.length > 0 && (
                        <button
                          onClick={() => setRaffleTickets([])}
                          className="text-[8px] text-red-500 font-black uppercase tracking-widest"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {raffleTickets?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {raffleTickets?.map((ticket, i) => (
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
                            className="size-12 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5"
                          >
                            -
                          </button>
                          <span className="text-4xl font-black text-white">
                            {raffleQuantity}
                          </span>
                          <button
                            onClick={() =>
                              setRaffleQuantity((prev) =>
                                Math.min(50, prev + 1),
                              )
                            }
                            className="size-12 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/5"
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
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic">
                    <span className="bg-gradient-to-r from-[#FFD700] via-white to-[#00FFFF] bg-clip-text text-transparent">
                      CRINAVA
                    </span>{" "}
                    NOTES
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
                  <h2 className="text-5xl font-black uppercase tracking-tighter italic">
                    <span className="bg-gradient-to-r from-[#FFD700] via-white to-[#00FFFF] bg-clip-text text-transparent">
                      CRINAVA
                    </span>{" "}
                    STORE
                  </h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">
                    Premium In-App Currency
                  </p>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-aurora-teal to-metallic-gold rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                  <div className="relative p-12 rounded-[40px] bg-[#0A0A0A] border border-white/5 text-center space-y-8 overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 bg-aurora-teal/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 size-64 bg-metallic-gold/5 rounded-full blur-3xl"></div>

                    <div className="space-y-2 relative z-10">
                      <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em]">
                        Current Balance
                      </div>
                      <div className="text-7xl font-black text-white tracking-tighter flex items-center justify-center gap-4">
                        {coinBalance}
                        <CoinIcon size={64} />
                      </div>
                    </div>

                    <div className="flex justify-center items-center gap-3 relative z-10">
                      <div className="size-1.5 bg-aurora-teal rounded-full animate-pulse"></div>
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
                            {pkg.amount}
                            <CoinIcon size={28} />
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest">
                            <span className="bg-gradient-to-r from-[#FFD700] via-white to-[#00FFFF] bg-clip-text text-transparent">
                              CRINAVA
                            </span>{" "}
                            COINS
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
                className="w-full max-w-4xl space-y-12 pb-20"
              >
                <section className="text-center space-y-4">
                  <div className="inline-block px-4 py-1 bg-aurora-teal/10 border border-aurora-teal/30 text-aurora-teal text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
                    AI-Powered Verdict Engine
                  </div>
                  <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
                    THE <span className="text-aurora-teal">VERDICT</span>
                  </h2>
                  <p className="text-gray-500 max-w-md mx-auto text-xs font-medium uppercase tracking-widest">
                    Universal Cricket Intelligence & Data-Backed Analysis
                  </p>
                </section>

                <VerdictTool scope="global" />
              </motion.div>
            )}
            {activeTab === "stories" && (
              <motion.div
                key="stories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-4xl space-y-8"
              >
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                      Stories
                    </h2>
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">
                      Crinava Exclusive Insights
                    </p>
                  </div>
                  <BookOpen size={32} className="text-blue-400 opacity-20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-64 bg-[#111111] border border-white/5 rounded-3xl overflow-hidden relative group cursor-wait"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10" />
                      <div className="absolute bottom-6 inset-x-6 z-20 space-y-2">
                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 w-1/3" />
                        </div>
                        <div className="h-4 bg-white/5 rounded w-3/4" />
                        <div className="h-3 bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
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
                    <div className="size-12 bg-aurora-teal/10 rounded-xl flex items-center justify-center">
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
                    <div className="size-12 bg-metallic-gold/10 rounded-xl flex items-center justify-center">
                      <Trophy size={24} className="text-metallic-gold" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-white uppercase italic">
                        Tournaments
                      </h3>
                      <p className="text-xs text-gray-500">
                        Organize and manage cricket events.
                      </p>
                    </div>
                    <button className="w-full py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">
                      Manage Events
                    </button>
                  </div>

                  <div className="p-8 bg-[#111111] border border-white/5 rounded-3xl space-y-6">
                    <div className="size-12 bg-red-500/10 rounded-xl flex items-center justify-center">
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
                      <div className="size-2 bg-aurora-teal rounded-full animate-pulse"></div>
                      <div className="size-2 bg-aurora-teal rounded-full animate-pulse delay-75"></div>
                      <div className="size-2 bg-aurora-teal rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {activeDebateChat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-aurora-teal/10 rounded-lg">
                    <MessageSquare size={20} className="text-aurora-teal" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase italic tracking-widest">
                      Debate Chat
                    </h3>
                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.2em]">
                      Community Pulse
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDebateChat(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {debateMessages?.map((msg) => {
                  const isUnread =
                    lastReadMessageId &&
                    msg.id !== lastReadMessageId &&
                    new Date(msg.timestamp) >
                      new Date(
                        debateMessages.find((m) => m.id === lastReadMessageId)
                          ?.timestamp || 0,
                      );
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${msg.vote === "for" ? "text-blue-400" : msg.vote === "against" ? "text-red-400" : "text-gray-400"}`}
                        >
                          {msg.user}
                        </span>
                        <span className="text-[8px] text-gray-600 font-black uppercase">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isUnread && (
                          <span className="size-1.5 bg-aurora-teal rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="p-3 bg-white/5 rounded-2xl rounded-tl-none border border-white/5">
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem(
                      "message",
                    ) as HTMLInputElement;
                    sendDebateMessage(input.value);
                    input.value = "";
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="message"
                    type="text"
                    placeholder="Add your voice..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-aurora-teal/50 transition-all"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-aurora-teal text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest">
            {error}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      {activeTab !== "matches" && (
        <nav className="fixed bottom-0 w-full glass-obsidian border-t border-hairline flex justify-around items-end px-2 py-3 z-50 overflow-x-auto scrollbar-hide">
          {(isMatchesContext ||
          activeTab === "momentum" ||
          activeTab === "smartxi" ||
          activeTab === "stories" ||
          activeTab === "prediction" ||
          activeTab === "verdict"
            ? [
                { id: "matches", label: "Matches", icon: TrendingUp },
                { id: "prediction", label: "Predict", icon: Brain },
                { id: "verdict", label: "Verdict", icon: Gavel },
                { id: "momentum", label: "Momentum", icon: Activity },
                { id: "smartxi", label: "Smart XI", icon: Sparkles },
                { id: "stories", label: "Stories", icon: BookOpen },
              ]
            : [
                { id: "home", label: "Home", icon: Home },
                { id: "matches", label: "Matches", icon: Swords },
                { id: "raffle", label: "Raffle", icon: Gift },
                { id: "store", label: "Store", icon: ShoppingCart },
                { id: "blog", label: "Blog", icon: Library },
                { id: "debate", label: "Debate", icon: MessageCircle },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id as AppTab);
                if (
                  tab.id === "matches" ||
                  tab.id === "prediction" ||
                  tab.id === "verdict" ||
                  tab.id === "momentum" ||
                  tab.id === "smartxi" ||
                  tab.id === "stories"
                ) {
                  setIsMatchesContext(true);
                }
              }}
              className={`flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300 ${activeTab === tab.id ? "text-mercury scale-105" : "text-[#948f96] opacity-50 hover:opacity-100 hover:text-mercury"}`}
            >
              <tab.icon size={18} />
              <span className="text-label">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="size-1 bg-mercury rounded-full mt-0.5 pulse-mercury" />
              )}
            </button>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300 ${activeTab === "admin" ? "text-mercury scale-105" : "text-[#948f96] opacity-50 hover:opacity-100"}`}
            >
              <ShieldCheck size={18} />
              <span className="text-label">Admin</span>
              {activeTab === "admin" && (
                <div className="size-1 bg-mercury rounded-full mt-0.5" />
              )}
            </button>
          )}
        </nav>
      )}
      <VerdictTray
        onCompare={() => {
          setActiveTab("verdict");
          setPlayerProfileId(null);
        }}
      />
    </div>
  );
}
