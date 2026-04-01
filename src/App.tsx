/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Waves,
  MessageSquare,
  BookOpen,
  Target,
  Users,
  Wallet,
  Ticket,
  Brain,
  Infinity as InfinityIcon,
  Sparkles,
  Award,
  Medal,
  Zap,
  HelpCircle,
  X,
  BarChart3,
  Shield,
  Star,
  ArrowUpRight,
  Activity,
  ArrowRight,
  Newspaper,
  TrendingUp as TrendingUpIcon,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  Line
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { supabase } from './lib/supabaseClient';
import { AuthModal } from './components/AuthModal';
import { UsernameModal } from './components/UsernameModal';
import { PredictionGame } from './components/PredictionGame';
import { MatchesSection, TournamentsList } from './components/MatchesSection';
import { PlayerEnrichmentButton } from './components/PlayerEnrichmentButton';

// --- AI Helper ---
const chatWithAI = async (prompt: string, systemInstruction?: string) => {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "AI request failed");
  }

  const data = await response.json();
  return { text: data.text };
};

// --- Types ---

type VerdictStatus = 'TRUE' | 'FALSE' | 'LARGELY TRUE' | 'CONTESTED';
type AppTab = 'home' | 'verdict' | 'momentum' | 'debate' | 'career' | 'smartxi' | 'matches' | 'raffle' | 'blog' | 'prediction' | 'admin' | 'store' | 'stories';

const CoinIcon = ({ size = 24, className = "", noShadow = false }: { size?: number, className?: string, noShadow?: boolean }) => (
  <div 
    className={`relative flex items-center justify-center rounded-full overflow-hidden ${noShadow ? "" : "shadow-[0_4px_12px_rgba(0,0,0,0.5)]"} ${className}`}
    style={{ width: size, height: size }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-metallic-gold via-aurora-300/30 to-metallic-gold animate-shimmer" />
    <div className="absolute inset-[1.5px] bg-gradient-to-br from-[#B8860B] via-[#DAA520] to-[#8B4513] rounded-full" />
    <div className="absolute inset-[3px] bg-gradient-to-br from-metallic-gold via-[#FFFACD] to-metallic-gold rounded-full" />
    <div className="relative z-10 flex items-center justify-center">
      <InfinityIcon 
        size={size * 0.5} 
        className="text-[#5C4033] drop-shadow-sm" 
        strokeWidth={3}
      />
    </div>
    <div className="absolute inset-0 border-[0.5px] border-aurora-600 rounded-full" />
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
  userVote?: 'for' | 'against';
  userReasoning?: string;
  status: 'open' | 'closed';
  createdAt: string;
  trending?: boolean;
}

interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
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
  const prompt = `Generate a short, insightful cricket blog post about: ${topic}. Include a title, content, category, and estimated read time. Focus on technical analysis.
  Return the response in JSON format matching this structure:
  {
    "title": string,
    "content": string,
    "category": string,
    "readTime": string
  }`;

  const response = await chatWithAI(prompt, "You are a cricket blogger. Always return valid JSON.");
  
  try {
    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      ...data,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      isAI: true
    };
  } catch (e) {
    console.error("Failed to parse blog post JSON:", e);
    return {
      title: "Error generating post",
      content: "Failed to parse AI response.",
      category: "Error",
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      readTime: "0 min",
      isAI: true
    };
  }
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

async function getCricketVerdict(claim: string): Promise<VerdictData> {
  const prompt = `Analyze this cricket claim: "${claim}". Provide a deep, data-driven verdict. 
  Return the response in JSON format matching this structure:
  {
    "claim": string,
    "verdict": "TRUE" | "FALSE" | "LARGELY TRUE" | "CONTESTED",
    "confidence": number,
    "rawStats": [ { "label": string, "value": string, "comparison": string } ],
    "contextStats": [ { "label": string, "value": string, "description": string } ],
    "surpriseStat": { "value": string, "label": string, "context": string },
    "nuance": string
  }`;

  const response = await chatWithAI(prompt, "You are a cricket data analyst. Always return valid JSON.");
  
  try {
    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("Failed to parse verdict JSON:", e);
    return {} as VerdictData;
  }
}

async function getLiveScores(): Promise<MatchData[]> {
  const prompt = `Get the current cricket matches worldwide. Return a list of matches in JSON format matching this structure:
  [
    {
      "teams": [string, string],
      "score": string,
      "status": string,
      "venue": string,
      "format": string,
      "series": string,
      "isLive": boolean
    }
  ]`;

  try {
    const response = await chatWithAI(prompt, "You are a live cricket score provider. Always return valid JSON.");
    const text = response.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error("Error fetching matches scores:", error);
    return [];
  }
}

async function runMatchSimulation(match: string): Promise<PredictionResult> {
  const prompt = `Run a 1 million iteration simulation for the match: ${match}. Consider the latest toss results, weather conditions (wind, humidity), and pitch reports.
  Return the response in JSON format matching this structure:
  {
    "match": string,
    "winner": string,
    "probability": number,
    "factors": {
      "toss": string,
      "weather": string,
      "pitch": string,
      "wind": string,
      "humidity": string
    },
    "simulationDetails": string
  }`;

  const response = await chatWithAI(prompt, "You are a cricket match simulator. Always return valid JSON.");
  
  try {
    const text = response.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("Failed to parse simulation JSON:", e);
    return {} as PredictionResult;
  }
}

// --- Components ---

const VerdictCard = ({ data, onBack }: { data: VerdictData, onBack: () => void }) => {
  const getStatusColor = (status: VerdictStatus) => {
    switch (status) {
      case 'TRUE': return 'text-aurora-300';
      case 'FALSE': return 'text-loss-red';
      case 'LARGELY TRUE': return 'text-aurora-300/80';
      case 'CONTESTED': return 'text-gold-base';
    }
  };

  const getStatusIcon = (status: VerdictStatus) => {
    const color = getStatusColor(status);
    switch (status) {
      case 'TRUE':
      case 'LARGELY TRUE':
        return <ShieldCheck className={`w-8 h-8 ${color}`} />;
      case 'FALSE':
        return <ShieldAlert className={`w-8 h-8 ${color}`} />;
      case 'CONTESTED':
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
        className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest">New Analysis</span>
      </button>

      <div className="bg-aurora-800 border border-aurora-600 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-aurora-600/50 bg-gradient-to-br from-aurora-700/30 to-transparent">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusIcon(data.verdict)}
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black border border-current uppercase tracking-widest ${getStatusColor(data.verdict)}`}>
                  {data.verdict}
                </span>
              </div>
              <div className="text-[9px] text-text-muted font-black uppercase tracking-[0.2em] mt-2">
                Oracle Confidence: {data.confidence}%
              </div>
            </div>
            <button className="p-2 bg-aurora-700/50 rounded-lg text-aurora-300 hover:bg-aurora-700 transition-colors">
              <Share2 size={20} />
            </button>
          </div>
          <h2 className="text-2xl md:text-3xl font-black italic text-text-primary leading-tight">
            "{data.claim}"
          </h2>
        </div>

        {/* Body */}
        <div className="p-8 space-y-10">
          {/* Raw Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {data.rawStats.map((stat, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xl font-black text-text-primary">{stat.value}</div>
                <div className="text-[9px] text-text-muted uppercase tracking-widest font-bold">{stat.label}</div>
                {stat.comparison && (
                  <div className="text-[8px] text-aurora-300/60 italic">{stat.comparison}</div>
                )}
              </div>
            ))}
          </div>

          {/* Context Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.contextStats.map((stat, i) => (
              <div key={i} className="p-4 rounded-xl bg-aurora-700/30 border border-aurora-600/50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{stat.label}</span>
                  <span className="text-sm font-black text-aurora-300">{stat.value}</span>
                </div>
                <p className="text-[10px] text-text-body leading-relaxed font-medium">{stat.description}</p>
              </div>
            ))}
          </div>

          {/* Surprise Stat */}
          <div className="p-6 rounded-xl bg-gold-base/5 border border-gold-base/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Info size={64} className="text-gold-base" />
            </div>
            <div className="relative z-10 space-y-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-base">Surprise Telemetry</h3>
              <div className="text-2xl font-black text-gold-base">{data.surpriseStat.value}</div>
              <div className="text-[11px] font-bold text-text-primary/80">{data.surpriseStat.label}</div>
              <p className="text-[10px] text-text-muted italic font-medium">{data.surpriseStat.context}</p>
            </div>
          </div>

          {/* Nuance */}
          <div className="pt-6 border-t border-aurora-600/50">
            <p className="text-[11px] text-text-body italic text-center font-medium">
              "{data.nuance}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-aurora-700/10 border-t border-aurora-600/50 flex justify-center">
          <div className="text-[8px] font-black uppercase tracking-[0.4em] text-text-muted">
            Neon Oracle Engine • Crinava Intelligence
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isMatchesContext, setIsMatchesContext] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState(500);
  const [cricketIQ, setCricketIQ] = useState(1240);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([
    { title: 'The Cummins Masterclass: Analyzing the 18th Over', date: '22 Mar 2026', readTime: '4 min', content: 'Pat Cummins showed why he is the best in the business...', category: 'Analysis', isAI: true },
    { title: 'Predictive Trends: Why Spin will dominate IPL 2026', date: '21 Mar 2026', readTime: '6 min', content: 'Spinners are becoming the most valuable assets in T20...', category: 'Trends', isAI: true },
    { title: 'Telemetry Breakdown: Kohli\'s Cover Drive Mechanics', date: '20 Mar 2026', readTime: '5 min', content: 'Analyzing the biomechanics of Virat Kohli...', category: 'Technique', isAI: false }
  ]);
  const [raffleTickets, setRaffleTickets] = useState<string[]>([]);
  const [isRaffleModalOpen, setIsRaffleModalOpen] = useState(false);
  const [raffleQuantity, setRaffleQuantity] = useState(1);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const userEmail = "hemnanijatin9@gmail.com";
  const isAdmin = userEmail === "hemnanijatin9@gmail.com" && isAdminMode;

  const tabs: { id: AppTab, label: string, icon: any }[] = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'matches', label: 'Matches', icon: Trophy },
    { id: 'verdict', label: 'Verdict', icon: Gavel },
    { id: 'momentum', label: 'Momentum', icon: Activity },
    { id: 'debate', label: 'Debate', icon: MessageSquare },
    { id: 'smartxi', label: 'Smart XI', icon: Brain },
    { id: 'prediction', label: 'Oracle', icon: Zap },
    { id: 'raffle', label: 'Raffle', icon: Ticket },
    { id: 'blog', label: 'Notes', icon: BookOpen },
    { id: 'stories', label: 'Stories', icon: Newspaper },
  ];

  useEffect(() => {
    // Secret admin access via URL hash
    const checkAdmin = () => {
      if (window.location.hash === '#admin-access-crinava') {
        setIsAdminMode(true);
      }
    };
    checkAdmin();
    window.addEventListener('hashchange', checkAdmin);
    return () => window.removeEventListener('hashchange', checkAdmin);
  }, []);
  const [raffleHistory] = useState<RaffleHistory[]>([
    { drawId: "RD-882", winner: "user_9921", prize: "Premium Sub", date: "Mar 21" },
    { drawId: "RD-881", winner: "cricket_fan_1", prize: "500 Coins", date: "Mar 20" },
  ]);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [showIQ, setShowIQ] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCareerInfo, setShowCareerInfo] = useState(false);
  const [showProInfo, setShowProInfo] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  const badges = [
    { id: 'early-bird', name: 'Early Bird', description: 'Joined Crinava in its inaugural month.', icon: '🌟', requirement: 'Join before April 2026', progress: 100 },
    { id: 'strategist', name: 'Strategist', description: 'Master of tactical debates.', icon: '🧠', requirement: 'Win 10 community debates', progress: 40 },
    { id: 'oracle', name: 'Oracle', description: 'Uncanny ability to predict match outcomes.', icon: '🔮', requirement: '80% accuracy over 50 predictions', progress: 15 },
    { id: 'iron-man', name: 'Iron Man', description: 'Unwavering consistency.', icon: '🛡️', requirement: '30-day login streak', progress: 60 },
    { id: 'mastermind', name: 'Mastermind', description: 'Advanced simulation expert.', icon: '⚡', requirement: 'Score > 90 in 5 advanced simulations', progress: 0 },
  ];

  const careerLevels = [
    { name: 'Rookie', range: '0 - 500 CP', actions: 'Daily Login: +10 CP' },
    { name: 'Amateur', range: '501 - 1500 CP', actions: 'Correct Prediction: +50 CP' },
    { name: 'Professional', range: '1501 - 3500 CP', actions: 'Debate Win: +100 CP' },
    { name: 'Elite', range: '3501 - 7500 CP', actions: 'Simulation Mastery: +150 CP' },
    { name: 'Legend', range: '7501+ CP', actions: 'Difficulty increases exponentially' },
  ];

  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Match Alert', message: 'IND vs PAK starting in 30 mins!', time: '10m ago', read: false },
    { id: '2', title: 'New Analysis', message: 'The Oracle has a new verdict on Kohli\'s form.', time: '1h ago', read: true },
    { id: '3', title: 'Raffle Draw', message: 'Draw RD-882 completed. Check winners!', time: '2h ago', read: true },
  ]);
  const [session, setSession] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPredictionGame, setShowPredictionGame] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const [activeDebateChat, setActiveDebateChat] = useState<string | null>(null);
  const [debateMessages, setDebateMessages] = useState<any[]>([]);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDebateChat) {
      const fetchMessages = async () => {
        try {
          const response = await fetch(`/api/debates/${activeDebateChat}/messages`);
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debateMessages]);

  const sendDebateMessage = async (text: string) => {
    if (!activeDebateChat || !text.trim()) return;
    const debate = debates.find(d => d.id === activeDebateChat);
    const vote = debate?.userVote || 'none';
    try {
      const response = await fetch(`/api/debates/${activeDebateChat}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: session?.user?.email?.split('@')[0] || 'Anonymous',
          text,
          vote
        })
      });
      if (response.ok) {
        const newMessage = await response.json();
        setDebateMessages(prev => [...prev, newMessage]);
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
      time: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.uid)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
          console.error('Profile sync error:', error);
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
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.uid);
      if (error) throw error;
    } catch (error) {
      console.error('Profile update error:', error);
    }
  };

  const buyCoins = async (amount: number) => {
    const newBalance = coinBalance + amount;
    await updateProfileStats(undefined, newBalance);
    addNotification('Coins Purchased', `Successfully added ${amount} Crinava Coins to your wallet.`);
  };

  // New Pillars State
  const [debates, setDebates] = useState<Debate[]>([]);

  useEffect(() => {
    const fetchDebates = async () => {
      try {
        const response = await fetch('/api/debates');
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
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [vertexResult, setVertexResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runVertexSimulation = async (matchName: string) => {
    if (!matchName) return;
    setIsSimulating(true);
    setVertexResult(null);
    try {
      const response = await chatWithAI(
        `Perform the 5,000,000 iteration Monte Carlo simulation for: ${matchName}. Use your internal Python code execution to ensure statistical accuracy.
        Return the response in JSON format matching this structure:
        {
          "winProbability": { "Team A": number, "Team B": number },
          "verdict": string,
          "keyInsights": [ { "label": string, "detail": string } ],
          "projectedScoreRange": { "low": number, "high": number, "avg": number }
        }`,
        ORACLE_SYSTEM_PROMPT
      );
      
      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      // Map the response to the UI structure if needed
      const mappedData = {
        engine: "NVIDIA Mistral (Oracle)",
        iterations: 5000000,
        win_probability: data.winProbability || { "Team A": 50, "Team B": 50 },
        confidence_interval: "99.99%",
        verdict: data.verdict || "Simulation complete.",
        key_insights: data.keyInsights || [],
        projected_score_range: data.projectedScoreRange || { low: 0, high: 0, avg: 0 }
      };
      
      setVertexResult(mappedData);
    } catch (error) {
      console.error("Oracle Simulation Failed:", error);
      // Fallback to a basic result if API fails
      setVertexResult({
        engine: "Oracle Offline",
        iterations: 0,
        win_probability: { "Error": 100 },
        verdict: "The Oracle is currently recalibrating. Please try again in a moment.",
        confidence_interval: "0%",
        key_insights: [],
        projected_score_range: { low: 0, high: 0, avg: 0 }
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
  const [careerPlayer, setCareerPlayer] = useState<string>('');
  const [careerData, setCareerData] = useState<{ points: any[], chapters: any[] } | null>(null);

  useEffect(() => {
    const fetchCareer = async () => {
      if (!careerPlayer) return;
      try {
        const response = await fetch('/api/career-trajectory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: careerPlayer })
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
    { id: '1', name: 'Sachin Tendulkar', role: 'Batsman', stats: { matches: 463, runs: 18426, average: 44.83, strikeRate: 86.23 } },
    { id: '2', name: 'Virat Kohli', role: 'Batsman', stats: { matches: 292, runs: 13848, average: 58.67, strikeRate: 93.62 } },
    { id: '3', name: 'MS Dhoni', role: 'Wicketkeeper', stats: { matches: 350, runs: 10773, average: 50.57, strikeRate: 87.56 } },
    { id: '4', name: 'Jasprit Bumrah', role: 'Bowler', stats: { matches: 89, wickets: 149, average: 23.55, strikeRate: 31.4 } },
    { id: '5', name: 'Hardik Pandya', role: 'All-rounder', stats: { matches: 86, runs: 1769, wickets: 84, average: 34.01, strikeRate: 110.3 } },
    { id: '6', name: 'Rohit Sharma', role: 'Batsman', stats: { matches: 262, runs: 10709, average: 49.12, strikeRate: 91.97 } },
    { id: '7', name: 'Ravindra Jadeja', role: 'All-rounder', stats: { matches: 197, runs: 2756, wickets: 220, average: 32.42, strikeRate: 84.5 } },
    { id: '8', name: 'Shane Warne', role: 'Bowler', stats: { matches: 194, wickets: 293, average: 25.73, strikeRate: 36.3 } },
    { id: '9', name: 'AB de Villiers', role: 'Batsman', stats: { matches: 228, runs: 9577, average: 53.5, strikeRate: 101.09 } },
    { id: '10', name: 'Wasim Akram', role: 'Bowler', stats: { matches: 356, wickets: 502, average: 23.52, strikeRate: 36.2 } },
    { id: '11', name: 'Adam Gilchrist', role: 'Wicketkeeper', stats: { matches: 287, runs: 9619, average: 35.89, strikeRate: 96.94 } }
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
    if (selectedSmartXI.find(p => p.id === player.id)) return;
    setSelectedSmartXI(prev => [...prev, player]);
    updateProfileStats(cricketIQ + 2);
  };

  const calculateXIRating = () => {
    if (selectedSmartXI.length === 0) return 0;
    const avg = selectedSmartXI.reduce((acc, p) => acc + p.stats.average, 0) / selectedSmartXI.length;
    return Math.min(99, Math.round(avg + (selectedSmartXI.length * 2)));
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
      return;
    }
    updateProfileStats(undefined, coinBalance - totalCost);
    addNotification('Ticket Purchased', `Successfully bought ${qty} Raffle Ticket${qty > 1 ? 's' : ''}. Good luck!`);
    const newTickets = Array.from({ length: qty }).map(() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let result = '';
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });
    setRaffleTickets(prev => [...prev, ...newTickets]);
    setIsRaffleModalOpen(false);
    setRaffleQuantity(1);
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
      setBlogPosts(prev => [newPost, ...prev]);
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
      const response = await fetch('/api/momentum-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match })
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

  const handleVote = async (debateId: string, side: 'for' | 'against', reasoning: string) => {
    /*
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    */
    try {
      const response = await fetch(`/api/debates/${debateId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side })
      });
      if (response.ok) {
        const updatedDebate = await response.json();
        setDebates(prev => prev.map(d => d.id === debateId ? { ...updatedDebate, userVote: side, userReasoning: reasoning } : d));
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
      setSimProgress(prev => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 10;
      });
    }, 200);

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match: matchName })
      });
      
      if (!response.ok) throw new Error('Simulation failed');
      
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
    if (activeTab === 'matches') {
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
    <div className="min-h-screen bg-aurora-950 text-text-primary font-sans selection:bg-win-green selection:text-midnight-void overflow-x-hidden flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-aurora-dark border-r border-aurora-600 z-50">
        <div className="p-6 border-b border-aurora-600 flex items-center gap-3 cursor-pointer" onClick={() => { setActiveTab('home'); setIsMatchesContext(false); setVerdict(null); setQuery(''); }}>
          <div className="w-8 h-8 bg-win-green rounded flex items-center justify-center">
            <TrendingUp size={20} className="text-midnight-void" />
          </div>
          <h1 className="text-xl font-display font-black tracking-tighter text-text-primary uppercase italic">CRINAVA</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {[
            { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'matches', label: 'Live Matches', icon: Activity },
            { id: 'prediction', label: 'Oracle AI', icon: Zap },
            { id: 'verdict', label: 'The Verdict', icon: Gavel },
            { id: 'momentum', label: 'Momentum', icon: TrendingUp },
            { id: 'smartxi', label: 'Smart XI', icon: Users },
            { id: 'stories', label: 'Stories', icon: BookOpen },
            { id: 'raffle', label: 'Raffle', icon: Ticket },
            { id: 'store', label: 'Store', icon: Wallet },
            { id: 'blog', label: 'Editorial', icon: Newspaper },
            { id: 'debate', label: 'Debate', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AppTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'tab-active' : 'tab-inactive'}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-aurora-600 space-y-4">
          {session ? (
            <div className="flex items-center gap-3 p-3 rounded-md glass-card">
              <div className="w-10 h-10 rounded bg-win-green/20 flex items-center justify-center border border-win-green/30 overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-win-green" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-text-primary truncate uppercase tracking-tight">
                  {profile?.username || 'User'}
                </p>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{cricketIQ} IQ</p>
              </div>
              <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="text-text-muted hover:text-text-primary">
                <ChevronDown size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="w-full py-3 bg-win-green text-midnight-void font-black text-[10px] uppercase tracking-widest rounded-md hover:scale-[1.02] transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 w-full z-50 bg-aurora-950/80 backdrop-blur-xl border-b border-aurora-600 flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-2" onClick={() => setActiveTab('home')}>
            <TrendingUp size={24} className="text-win-green" />
            <h1 className="text-lg font-display font-black tracking-tighter text-text-primary uppercase italic">CRINAVA</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowIQ(!showIQ)} className="text-text-muted hover:text-text-primary">
              <Brain size={20} />
            </button>
            <button onClick={() => setShowNotifications(!showNotifications)} className="text-text-muted hover:text-text-primary relative">
              <Bell size={20} />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-win-green rounded-full border border-pitch" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-[1600px] mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div className="space-y-16 lg:space-y-24">
                {/* Editorial Hero */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[60vh]">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-win-green animate-pulse" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-win-green">
                          Live Intelligence Active
                        </span>
                      </div>
                      <h1 className="text-7xl md:text-9xl font-display font-bold text-text-primary leading-[0.85] tracking-tight uppercase">
                        SIGNAL <br/>
                        <span className="text-win-green">&</span> PITCH
                      </h1>
                    </div>
                    <p className="text-text-body text-lg max-w-md font-medium leading-relaxed">
                      Technical sports intelligence for the modern era. Every ball, every signal, every outcome — analyzed with precision.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-4">
                      <button 
                        onClick={() => setActiveTab('verdict')}
                        className="px-8 py-4 bg-win-green text-midnight-void font-bold text-sm uppercase tracking-widest rounded-md hover:bg-opacity-90 transition-all"
                      >
                        Launch Oracle
                      </button>
                      <button 
                        onClick={() => setActiveTab('matches')}
                        className="btn-secondary"
                      >
                        View Matches
                      </button>
                    </div>
                  </div>
                  <div className="relative aspect-square lg:aspect-video rounded-md overflow-hidden border border-aurora-600 group">
                    <img 
                      src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1200" 
                      alt="Cricket Stadium" 
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-pitch via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-6 left-6 right-6 p-4 bg-aurora-dark/80 backdrop-blur-md border border-aurora-600 rounded-md">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-[10px] font-mono text-text-body uppercase tracking-widest mb-1">Current Feed</div>
                          <div className="text-lg font-display font-bold text-text-primary uppercase">Global Series Data</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-win-green uppercase tracking-widest mb-1">Status</div>
                          <div className="text-sm font-mono font-bold text-text-primary">SYNCED</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Core Pillars */}
                <section className="space-y-12">
                  <div className="flex items-end justify-between border-b border-aurora-600 pb-6">
                    <div className="space-y-2">
                      <h2 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight">Core Pillars</h2>
                      <p className="text-text-body font-mono text-xs uppercase tracking-widest">Advanced Analytical Modules</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Module Count: 04</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { icon: <Waves size={20} />, title: 'Momentum', desc: 'Real-time pressure wave analysis.', tab: 'momentum', signal: 'bg-win-green' },
                      { icon: <MessageSquare size={20} />, title: 'Debate', desc: 'AI-backed tactical arguments.', tab: 'debate', signal: 'bg-gold-base' },
                      { icon: <Target size={20} />, title: 'Smart XI', desc: 'Authoritative team simulation.', tab: 'smartxi', signal: 'bg-aurora-300' },
                      { icon: <BookOpen size={20} />, title: 'Stories', desc: 'Deep player trajectory mapping.', tab: 'career', signal: 'bg-win-green' }
                    ].map((feature, i) => (
                      <div 
                        key={i} 
                        onClick={() => setActiveTab(feature.tab as AppTab)}
                        className="p-8 glass-card space-y-6 cursor-pointer hover:bg-aurora-700/50 hover:border-win-green/30 transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <div className="p-3 bg-aurora-950 border border-aurora-600 rounded-md text-text-primary group-hover:text-win-green transition-colors">
                            {feature.icon}
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full ${feature.signal}`} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-display font-bold text-text-primary uppercase tracking-tight">{feature.title}</h4>
                          <p className="text-sm text-text-body leading-relaxed">{feature.desc}</p>
                        </div>
                        <div className="pt-4 flex items-center gap-2 text-[10px] font-mono font-bold text-muted group-hover:text-win-green transition-colors uppercase tracking-widest">
                          <span>Access Module</span>
                          <ArrowRight size={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* The Ecosystem */}
                <section className="glass-card p-8 lg:p-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Activity size={200} />
                  </div>
                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
                    <div className="space-y-6">
                      <h3 className="text-5xl font-display font-bold text-text-primary uppercase leading-none tracking-tight">THE <br/> ECOSYSTEM</h3>
                      <p className="text-text-body font-medium max-w-xs">A unified platform for technical cricket intelligence and community engagement.</p>
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: <TrendingUp size={20} />, title: 'Matches', tab: 'matches' },
                        { icon: <Ticket size={20} />, title: 'Raffle', tab: 'raffle' },
                        { icon: <Info size={20} />, title: 'Notes', tab: 'blog' },
                        { icon: <ShieldCheck size={20} />, title: 'Oracle', tab: 'verdict' }
                      ].map((extra, i) => (
                        <div 
                          key={i}
                          onClick={() => setActiveTab(extra.tab as AppTab)}
                          className="p-6 bg-aurora-950 border border-aurora-600 rounded-md flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-aurora-700/50 hover:border-win-green/30 transition-all group"
                        >
                          <div className="text-text-body group-hover:text-win-green transition-colors">
                            {extra.icon}
                          </div>
                          <span className="text-[10px] font-mono font-bold text-text-primary uppercase tracking-[0.2em]">{extra.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Global Series Archive */}
                <section className="space-y-12">
                  <div className="flex items-end justify-between border-b border-aurora-600 pb-6">
                    <div className="space-y-2">
                      <h2 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight">Series Archive</h2>
                      <p className="text-text-body font-mono text-xs uppercase tracking-widest">Global Tournament Database</p>
                    </div>
                  </div>
                  <TournamentsList onSelect={(t) => {
                    setSelectedTournament(t);
                    setActiveTab('matches');
                  }} />
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'momentum' && (
            <motion.div 
              key="momentum"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-4xl space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-win-green/10 border border-win-green/30 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-win-green animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-win-green uppercase tracking-widest">
                    Live Pressure Telemetry
                  </span>
                </div>
                <h2 className="text-6xl md:text-8xl font-display font-bold text-text-primary tracking-tight uppercase leading-none">
                  MOMENTUM <span className="text-win-green">MAP</span>
                </h2>
                <p className="text-text-body max-w-md mx-auto text-xs font-mono uppercase tracking-[0.2em]">
                  Real-time Pressure Wave Analysis
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 p-8 rounded-md glass-card space-y-8">
                  <div className="flex justify-between items-center border-b border-aurora-600 pb-6">
                    <select 
                      onChange={(e) => generateMomentumData(e.target.value)}
                      className="bg-aurora-950 border border-aurora-600 text-text-primary text-[10px] font-mono font-bold rounded-md px-4 py-2 outline-none focus:border-win-green/50 appearance-none cursor-pointer uppercase tracking-widest"
                    >
                      <option value="">Select Match Story</option>
                      <option value="IND vs PAK - T20WC">IND vs PAK - T20WC</option>
                      <option value="CSK vs GT - IPL Final">CSK vs GT - IPL Final</option>
                      <option value="AUS vs ENG - Ashes">AUS vs ENG - Ashes</option>
                    </select>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-win-green" />
                        <span className="text-[8px] font-mono text-text-body uppercase">Pressure</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gold-base" />
                        <span className="text-[8px] font-mono text-text-body uppercase">Pivot</span>
                      </div>
                    </div>
                  </div>

                  {momentumData?.length > 0 ? (
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={momentumData}>
                          <defs>
                            <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#252A34" vertical={false} />
                          <XAxis 
                            dataKey="over" 
                            stroke="#4E5869" 
                            fontSize={10} 
                            fontFamily="JetBrains Mono"
                            tickFormatter={(val) => `OV ${val}`}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#4E5869" 
                            fontSize={10} 
                            fontFamily="JetBrains Mono"
                            domain={[-100, 100]}
                            tickFormatter={(val) => val > 0 ? `+${val}` : val}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111318', border: '1px solid #252A34', borderRadius: '4px', fontFamily: 'JetBrains Mono' }}
                            itemStyle={{ color: '#22C55E', fontSize: '10px', fontWeight: 'bold' }}
                            cursor={{ stroke: '#22C55E', strokeWidth: 1 }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="pressure" 
                            stroke="#22C55E" 
                            fillOpacity={1} 
                            fill="url(#colorPressure)" 
                            strokeWidth={2}
                          />
                          <ReferenceLine y={0} stroke="#252A34" />
                          {momentumData?.map((p, i) => p.isTurningPoint && (
                            <ReferenceLine 
                              key={i} 
                              x={p.over} 
                              stroke="#F59E0B" 
                              strokeDasharray="4 4" 
                              label={{ 
                                value: 'PIVOT', 
                                position: 'top', 
                                fill: '#F59E0B', 
                                fontSize: 8, 
                                fontFamily: 'JetBrains Mono',
                                fontWeight: 'bold' 
                              }} 
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[350px] flex flex-col items-center justify-center border border-dashed border-aurora-600 rounded-md space-y-4">
                      <Waves size={40} className="text-muted opacity-20" />
                      <p className="text-[10px] text-muted font-mono font-bold uppercase tracking-widest">Awaiting Telemetry Stream</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-8 rounded-md glass-card space-y-6">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-win-green" />
                      <h3 className="text-[10px] font-mono font-bold text-text-primary uppercase tracking-widest">Impact Analysis</h3>
                    </div>
                    
                    {selectedMatch ? (
                      <div className="space-y-6">
                        <div className="p-4 rounded-md bg-aurora-950 border border-aurora-600 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-mono font-bold text-muted uppercase">Turning Point</span>
                            <span className="text-[8px] font-mono font-bold text-gold-base uppercase">Over 18.4</span>
                          </div>
                          <p className="text-xs text-text-primary font-medium leading-relaxed italic">"The moment it was won: Dhoni's consecutive sixes shifted pressure by 84%."</p>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-md bg-win-green/5 border border-win-green/20">
                          <div className="w-10 h-10 rounded-full bg-win-green/10 flex items-center justify-center">
                            <Trophy size={20} className="text-win-green" />
                          </div>
                          <div>
                            <div className="text-[8px] font-mono font-bold text-win-green uppercase tracking-widest">MVP Impact</div>
                            <div className="text-xs font-mono font-bold text-text-primary">MS Dhoni (+42.5)</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center space-y-2 opacity-20">
                        <p className="text-[10px] font-mono text-muted uppercase tracking-widest italic">No Data Stream</p>
                      </div>
                    )}
                  </div>

                  <button className="w-full py-4 glass-card flex items-center justify-center gap-3 hover:bg-aurora-700/50 transition-all group">
                    <Share2 size={16} className="text-text-body group-hover:text-win-green transition-colors" />
                    <span className="text-[10px] font-mono font-bold text-text-primary uppercase tracking-widest">Export Story Card</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'debate' && (
            <motion.div 
              key="debate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-12"
            >
              <div className="flex justify-between items-end border-b border-aurora-600 pb-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight">Debate Room</h2>
                  <p className="text-gold-base font-mono text-xs uppercase tracking-widest">Settle the Score</p>
                </div>
                <button className="px-6 py-3 bg-gold-base text-midnight-void font-bold text-[10px] uppercase tracking-widest rounded-md hover:bg-opacity-90 transition-all">
                  Create Debate
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {debates.map((d) => (
                  <div key={d.id} className="p-8 glass-card space-y-8 flex flex-col group hover:border-gold-base/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="p-2.5 bg-aurora-950 border border-aurora-600 rounded-md text-gold-base">
                          <Gavel size={18} />
                        </div>
                        <button 
                          onClick={() => setActiveDebateChat(d.id)}
                          className="p-2.5 bg-aurora-950 border border-aurora-600 rounded-md text-text-body hover:text-win-green transition-colors"
                        >
                          <MessageSquare size={18} />
                        </button>
                      </div>
                      {d.trending && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-gold-base/10 border border-gold-base/20 rounded-md">
                          <div className="w-1 h-1 rounded-full bg-gold-base animate-pulse" />
                          <span className="text-[8px] font-mono font-bold text-gold-base uppercase tracking-widest">Trending</span>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-display font-bold text-text-primary leading-tight uppercase tracking-tight">"{d.claim}"</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-aurora-950 border border-aurora-600 rounded-md space-y-2">
                        <div className="text-[8px] font-mono font-bold text-win-green uppercase tracking-widest">The Case For</div>
                        <p className="text-[10px] text-text-body leading-relaxed font-medium">{d.arguments.for}</p>
                      </div>
                      <div className="p-4 bg-aurora-950 border border-aurora-600 rounded-md space-y-2">
                        <div className="text-[8px] font-mono font-bold text-loss-red uppercase tracking-widest">The Case Against</div>
                        <p className="text-[10px] text-text-body leading-relaxed font-medium">{d.arguments.against}</p>
                      </div>
                    </div>

                    <div className="space-y-4 mt-auto pt-6 border-t border-aurora-600">
                      <div className="flex justify-between text-[10px] font-mono font-bold text-text-primary uppercase tracking-widest">
                        <span className="text-win-green">For: {Math.round((d.votes.for / (d.votes.for + d.votes.against)) * 100)}%</span>
                        <span className="text-loss-red">Against: {Math.round((d.votes.against / (d.votes.for + d.votes.against)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-aurora-950 rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-win-green transition-all duration-1000" 
                          style={{ width: `${(d.votes.for / (d.votes.for + d.votes.against)) * 100}%` }}
                        />
                        <div 
                          className="h-full bg-loss-red transition-all duration-1000" 
                          style={{ width: `${(d.votes.against / (d.votes.for + d.votes.against)) * 100}%` }}
                        />
                      </div>

                      {d.userVote ? (
                        <div className={`p-3 rounded-md bg-aurora-950 border border-aurora-600 text-center ${d.userVote === 'for' ? 'border-win-green/30' : 'border-loss-red/30'}`}>
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${d.userVote === 'for' ? 'text-win-green' : 'text-loss-red'}`}>
                            Vote Recorded: {d.userVote === 'for' ? 'Affirmative' : 'Negative'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleVote(d.id, 'for', 'He is simply the best.')}
                            className="flex-1 py-3 bg-win-green/10 border border-win-green/20 text-win-green text-[10px] font-mono font-bold uppercase tracking-widest rounded-md hover:bg-win-green hover:text-midnight-void transition-all"
                          >
                            Affirm
                          </button>
                          <button 
                            onClick={() => handleVote(d.id, 'against', 'Era comparison matters.')}
                            className="flex-1 py-3 bg-loss-red/10 border border-loss-red/20 text-loss-red text-[10px] font-mono font-bold uppercase tracking-widest rounded-md hover:bg-loss-red hover:text-text-primary transition-all"
                          >
                            Oppose
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'career' && (
            <motion.div 
              key="career"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-4xl space-y-12 pb-20"
            >
              <div className="text-center space-y-3 border-b border-aurora-600 pb-8">
                <h2 className="text-5xl font-display font-bold text-text-primary uppercase tracking-tight italic">Crinava Career</h2>
                <p className="text-gold-base font-mono text-xs font-bold uppercase tracking-widest">Your Path to Cricket Immortality</p>
              </div>

              {/* 1. Crinava Career Path */}
              <div className="p-8 glass-card space-y-8">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={16} className="text-win-green" />
                      Career Progression
                    </h3>
                    <p className="text-[10px] text-text-body font-medium italic">Level up your cricket intelligence</p>
                  </div>
                  <div className="px-3 py-1 bg-win-green/10 border border-win-green/20 rounded-md">
                    <span className="text-[10px] font-mono font-bold text-win-green uppercase tracking-widest">{profile?.career_path || 'Rookie'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  {['Rookie', 'Amateur', 'Semi-Pro', 'Pro', 'Legend'].map((stage, idx) => {
                    const stages = ['Rookie', 'Amateur', 'Semi-Pro', 'Pro', 'Legend'];
                    const currentIdx = stages.indexOf(profile?.career_path || 'Rookie');
                    const isActive = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <div key={stage} className="space-y-4">
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${isActive ? 'bg-win-green shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-aurora-950 border border-aurora-600'}`} />
                        <p className={`text-[9px] font-mono font-bold uppercase text-center tracking-tight ${isActive ? 'text-text-primary' : 'text-muted'}`}>{stage}</p>
                        {isCurrent && <div className="w-1 h-1 bg-win-green rounded-full mx-auto animate-ping" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 2. Expertise Badge */}
                <div className="p-8 glass-card space-y-8 relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Award size={120} className="text-gold-base" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                      <Medal size={16} className="text-gold-base" />
                      Expertise Badge
                    </h3>
                    <p className="text-[10px] text-text-body font-medium italic">Your current mastery level</p>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="w-28 h-28 rounded-md bg-aurora-950 border border-aurora-600 flex items-center justify-center group-hover:border-gold-base/50 transition-all">
                        <Zap className="text-gold-base" size={48} />
                      </div>
                      <div className="absolute -bottom-3 -right-3 bg-gold-base text-midnight-void text-[9px] font-mono font-bold px-3 py-1 rounded-md uppercase tracking-widest">
                        {profile?.expertise_badge || 'Novice'}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm text-text-primary font-display font-bold uppercase tracking-tight">
                        {profile?.expertise_badge === 'Novice' ? 'The Journey Begins' : 
                         profile?.expertise_badge === 'Analyst' ? 'The Data Master' : 'The Oracle'}
                      </p>
                      <p className="text-[10px] text-text-body leading-relaxed font-medium">
                        Complete 5 more correct predictions to unlock the <span className="text-gold-base font-bold">Analyst</span> tier.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Professional Comparison */}
                <div className="p-8 glass-card space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={16} className="text-win-green" />
                      Pro Comparison
                    </h3>
                    <p className="text-[10px] text-text-body font-medium italic">You vs. The Elite</p>
                  </div>

                  <div className="space-y-6">
                    {[
                      { label: 'Batting IQ', user: profile?.professional_comparison?.batting || 45, pro: 92 },
                      { label: 'Bowling IQ', user: profile?.professional_comparison?.bowling || 30, pro: 88 },
                      { label: 'Strategy', user: profile?.professional_comparison?.strategy || 40, pro: 95 }
                    ].map((stat) => (
                      <div key={stat.label} className="space-y-3">
                        <div className="flex justify-between text-[9px] font-mono font-bold uppercase tracking-widest">
                          <span className="text-muted">{stat.label}</span>
                          <span className="text-text-primary">{stat.user}% <span className="text-muted">/ {stat.pro}%</span></span>
                        </div>
                        <div className="h-1.5 bg-aurora-950 border border-aurora-600 rounded-full overflow-hidden flex">
                          <div className="h-full bg-win-green" style={{ width: `${stat.user}%` }} />
                          <div className="h-full bg-aurora-dark" style={{ width: `${stat.pro - stat.user}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Original Career Story Section (Integrated) */}
              <div className="space-y-8">
                <div className="flex justify-center">
                  <div className="flex bg-aurora-700/50 p-1 rounded-2xl border border-aurora-600">
                    {['Virat Kohli', 'Sachin Tendulkar', 'MS Dhoni'].map((p) => (
                      <button 
                        key={p}
                        onClick={() => setCareerPlayer(p)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${careerPlayer === p ? 'bg-aurora-300 text-aurora-950' : 'text-text-body hover:text-text-primary'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {careerPlayer ? (
                  <div className="p-8 rounded-3xl bg-aurora-800 border border-aurora-600/50 space-y-8">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-aurora-300 uppercase tracking-widest">{careerPlayer} Performance Timeline</h3>
                      <span className="text-[10px] font-black text-gold-base uppercase">Historical Data</span>
                    </div>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={careerData?.points || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="year" stroke="#ffffff20" fontSize={10} />
                          <YAxis stroke="#ffffff20" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #ffffff10', borderRadius: '12px' }}
                            itemStyle={{ color: '#00FFC8', fontSize: '10px', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="runs" stroke="#00FFC8" strokeWidth={3} dot={{ fill: '#00FFC8', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-aurora-700/50 flex items-center justify-center border border-dashed border-aurora-600">
                      <BookOpen size={30} className="text-aurora-600" />
                    </div>
                    <p className="text-xs text-text-muted font-black uppercase tracking-widest">Select a player to explore their story</p>
                  </div>
                )}

                {/* Chapters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(careerData?.chapters || []).map((chapter, i) => (
                      <div key={i} className="p-6 rounded-2xl bg-aurora-700/30 border border-aurora-600/50 space-y-3 hover:border-aurora-300/30 transition-all">
                        <div className="text-[8px] font-black text-aurora-300 uppercase tracking-[0.2em]">{chapter.year}</div>
                        <h4 className="text-sm font-black text-text-primary italic">{chapter.title}</h4>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">{chapter.insight}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-4">
                    <button className="px-8 py-3 bg-aurora-700/50 border border-aurora-600 text-text-primary font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-aurora-700 transition-all flex items-center gap-2">
                      <TrendingUp size={14} className="text-aurora-300" />
                      Greatest Season Detector
                    </button>
                    <button className="px-8 py-3 bg-aurora-700/50 border border-aurora-600 text-text-primary font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-aurora-700 transition-all flex items-center gap-2">
                      <Share2 size={14} className="text-gold-base" />
                      Share Career Moment
                    </button>
                  </div>
                </div>
            </motion.div>
          )}

          {activeTab === 'smartxi' && (
            <motion.div 
              key="smartxi"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-5xl space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black italic text-text-primary uppercase tracking-tighter">Smart XI</h2>
                <p className="text-gold-base text-xs font-black uppercase tracking-widest">The Data-Driven Dream Team</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Builder */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="p-6 rounded-3xl bg-aurora-800 border border-aurora-600/50 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-aurora-300 uppercase tracking-widest">Your XI ({selectedSmartXI.length}/11)</h3>
                      <button 
                        onClick={() => setSelectedSmartXI([])}
                        className="text-[10px] font-black text-loss-red uppercase tracking-widest hover:underline"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Array.from({ length: 11 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`aspect-[3/4] rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all ${selectedSmartXI[i] ? 'bg-aurora-300/10 border-aurora-300/30' : 'bg-aurora-700/10 border-dashed border-aurora-600'}`}
                        >
                          {selectedSmartXI[i] ? (
                            <>
                              <div className="text-[8px] font-black text-aurora-300 uppercase mb-1">{selectedSmartXI[i].role}</div>
                              <div className="text-[10px] font-black text-text-primary leading-tight">{selectedSmartXI[i].name}</div>
                              <div className="mt-2 text-[8px] font-bold text-text-muted">Avg: {selectedSmartXI[i].stats.average}</div>
                            </>
                          ) : (
                            <PlusCircle size={20} className="text-aurora-700" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-aurora-800 border border-aurora-600/50 space-y-4">
                    <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Available Legends</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {mockPlayers.map((player) => (
                        <div 
                          key={player.id}
                          onClick={() => handleAddToXI(player)}
                          className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${selectedSmartXI.find(p => p.id === player.id) ? 'opacity-30 pointer-events-none' : 'bg-aurora-700/30 border-aurora-600/50 hover:border-aurora-300/30'}`}
                        >
                          <div>
                            <div className="text-xs font-black text-text-primary">{player.name}</div>
                            <div className="text-[8px] font-black text-text-muted uppercase">{player.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black text-aurora-300">{player.stats.average}</div>
                            <div className="text-[8px] font-bold text-text-muted uppercase">Avg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rating & Insights */}
                <div className="space-y-6">
                  <div className="p-8 rounded-3xl bg-aurora-300 text-aurora-950 space-y-6 text-center">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">XI Rating</div>
                      <div className="text-7xl font-black italic leading-none">{calculateXIRating()}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Win Probability</div>
                      <div className="text-2xl font-black italic">67%</div>
                    </div>
                    <p className="text-[10px] font-bold leading-relaxed">
                      "The stats say your XI wins 67% of the time. Strong middle order, but slightly weak on death bowling."
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-aurora-800 border border-aurora-600/50 space-y-4">
                    <h3 className="text-xs font-black text-gold-base uppercase tracking-widest">Community Poll</h3>
                    <div className="space-y-3">
                      <p className="text-[10px] text-text-body font-medium">All-time India XI: Who is your opener?</p>
                      <div className="space-y-2">
                        {['Sehwag', 'Gavaskar', 'Rohit'].map((opt) => (
                          <button key={opt} className="w-full p-3 rounded-xl bg-aurora-700/50 border border-aurora-600 text-left text-[10px] font-black text-text-primary hover:bg-aurora-700 transition-all flex justify-between">
                            {opt}
                            <span className="text-aurora-300">34%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button className="w-full py-4 bg-aurora-700/50 border border-aurora-600 rounded-2xl flex items-center justify-center gap-2 hover:bg-aurora-700 transition-all group">
                    <Users size={16} className="text-text-body group-hover:text-aurora-300" />
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Compare with Friends</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'matches' && (
            <motion.div 
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-6"
            >
              <MatchesSection 
                initialTournament={selectedTournament}
                onBackToHome={() => { 
                  setSelectedTournament(null);
                  setActiveTab('home'); 
                }} 
              />
            </motion.div>
          )}

          {activeTab === 'prediction' && (
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
                  <div className="p-8 rounded-2xl bg-gradient-to-br from-aurora-500/20 to-transparent border border-aurora-300/20 space-y-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <CoinIcon size={120} />
                    </div>
                    <h3 className="text-xl font-black text-text-primary italic">Oracle Simulation</h3>
                    <p className="text-[10px] text-text-muted font-medium leading-relaxed">
                      Run 1,000,000 iterations based on real-time toss, weather, and pitch telemetry.
                    </p>
                    {true ? (
                      <div className="space-y-4">
                        <input 
                          type="text"
                          placeholder="Enter Match (e.g. MI vs CSK)"
                          className="w-full bg-aurora-900 border border-aurora-600 rounded-xl px-4 py-3 text-xs focus:border-aurora-300 outline-none transition-all"
                          onKeyDown={(e) => e.key === 'Enter' && handleSimulate((e.target as HTMLInputElement).value)}
                        />
                        <button 
                          onClick={() => handleSimulate('Current Live Match')}
                          className="w-full py-3 bg-aurora-300 text-aurora-950 font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                        >
                          Run Simulation
                        </button>
                      </div>
                    ) : (
                        <button 
                          onClick={async () => { 
                            if (coinBalance >= 199) {
                              await updateProfileStats(undefined, coinBalance - 199);
                              setIsSubscribed(true); 
                            }
                          }}
                          className="w-full py-3 bg-aurora-300 text-aurora-950 font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                        >
                          Unlock for 199 <CoinIcon size={16} noShadow />
                        </button>
                    )}
                  </div>

                  <div className="p-8 rounded-2xl bg-aurora-800 border border-aurora-600 space-y-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Trophy size={120} className="text-gold-base" />
                    </div>
                    <h3 className="text-xl font-black text-text-primary italic">Prediction Game</h3>
                    <p className="text-[10px] text-text-muted font-medium leading-relaxed">
                      Compete with the community and climb the leaderboard.
                    </p>
                    <button 
                      onClick={() => setShowPredictionGame(true)}
                      className="w-full py-3 border border-gold-base text-gold-base font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-base/10 transition-all"
                    >
                      Enter Arena
                    </button>
                  </div>
                </div>
              ) : simulating ? (
                <div className="bg-aurora-800 border border-aurora-300/30 rounded-3xl p-12 flex flex-col items-center space-y-8">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle className="text-text-primary/5 stroke-current" strokeWidth="4" fill="transparent" r="45" cx="50" cy="50" />
                      <circle 
                        className="text-aurora-300 stroke-current transition-all duration-300" 
                        strokeWidth="4" 
                        strokeDasharray={283}
                        strokeDashoffset={283 - (283 * simProgress) / 100}
                        strokeLinecap="round" 
                        fill="transparent" 
                        r="45" cx="50" cy="50" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CoinIcon size={48} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-text-primary uppercase italic tracking-tighter">Simulating Reality</h3>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.3em]">{Math.floor(simProgress * 10000)} Iterations Complete</p>
                  </div>
                </div>
              ) : prediction && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-aurora-800 border border-aurora-300/30 rounded-3xl p-8 space-y-8"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-text-primary uppercase italic">{prediction.match}</h3>
                      <div className="text-[10px] text-aurora-300 font-black uppercase tracking-widest">Simulation Complete • 1M Iterations</div>
                    </div>
                    <button onClick={() => setPrediction(null)} className="text-text-muted hover:text-text-primary">
                      <ArrowLeft size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-aurora-700/50 rounded-2xl border border-aurora-600/50 relative overflow-hidden">
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gold-base animate-golden-pulse"></div>
                      <div className="text-[8px] text-text-muted font-black uppercase tracking-widest mb-1">Probable Winner</div>
                      <div className="text-xl font-black text-gold-base uppercase italic">{prediction.winner}</div>
                    </div>
                    <div className="p-4 bg-aurora-700/50 rounded-2xl border border-aurora-600/50">
                      <div className="text-[8px] text-text-muted font-black uppercase tracking-widest mb-1">Confidence</div>
                      <div className="text-xl font-black text-text-primary">{prediction.probability}%</div>
                    </div>
                    <div className="p-4 bg-aurora-700/50 rounded-2xl border border-aurora-600/50">
                      <div className="text-[8px] text-text-muted font-black uppercase tracking-widest mb-1">Risk Level</div>
                      <div className="text-xl font-black text-loss-red uppercase italic">Low</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gold-base uppercase tracking-widest">Telemetry Factors</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-1">
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">Toss</div>
                        <div className="text-[10px] font-bold text-text-primary/80">{prediction.factors.toss}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">Weather</div>
                        <div className="text-[10px] font-bold text-text-primary/80">{prediction.factors.weather}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">Pitch</div>
                        <div className="text-[10px] font-bold text-text-primary/80">{prediction.factors.pitch}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">Wind</div>
                        <div className="text-[10px] font-bold text-text-primary/80">{prediction.factors.wind || 'N/A'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">Humidity</div>
                        <div className="text-[10px] font-bold text-text-primary/80">{prediction.factors.humidity || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-aurora-900 rounded-2xl border border-aurora-600/50">
                    <p className="text-[11px] text-text-body leading-relaxed italic">
                      "{prediction.simulationDetails}"
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'raffle' && (
            <motion.div 
              key="raffle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="bg-gradient-to-br from-metallic-gold/20 to-transparent p-8 rounded-3xl border border-gold-base/20 relative">
                <div className="relative z-10 space-y-6">
                  <div className="relative">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-text-primary tracking-tighter uppercase italic">IPL Raffle</h2>
                      <p className="text-gold-base text-[10px] font-black uppercase tracking-widest">Next Draw: 2h 45m</p>
                    </div>
                    <div className="absolute -top-2 -right-6 bg-aurora-900 px-4 py-2 rounded-xl border border-aurora-600">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-black text-text-primary">10</span>
                        <CoinIcon size={20} />
                      </div>
                      <span className="text-[8px] text-text-muted font-black uppercase tracking-widest block mt-1">Per Ticket</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-[10px] text-text-body font-medium">Grand Prize:</div>
                    <div className="text-2xl font-black text-aurora-300 uppercase italic">1 Year Premium Subscription</div>
                  </div>

                  <button 
                    onClick={() => setIsRaffleModalOpen(true)}
                    className="w-full py-4 bg-gold-base text-aurora-950 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(255,215,0,0.2)]"
                  >
                    Buy Raffle Tickets
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-text-primary uppercase tracking-widest">My Tickets ({raffleTickets?.length || 0})</h3>
                    {raffleTickets?.length > 0 && (
                      <button 
                        onClick={() => setRaffleTickets([])}
                        className="text-[8px] text-loss-red font-black uppercase tracking-widest"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {raffleTickets?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {raffleTickets?.map((ticket, i) => (
                        <div key={i} className="p-2 bg-aurora-700/50 border border-aurora-600 rounded-lg text-center">
                          <span className="text-[9px] font-black text-gold-base font-mono tracking-tighter">{ticket}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-aurora-800 border border-aurora-600/50 rounded-2xl text-center">
                      <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">No Tickets Purchased</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-text-primary uppercase tracking-widest">Recent Winners</h3>
                  <div className="space-y-3">
                    {raffleHistory.map((item, i) => (
                      <div key={i} className="p-4 bg-aurora-800 border border-aurora-600/50 rounded-2xl flex justify-between items-center">
                        <div>
                          <div className="text-[10px] font-black text-text-primary uppercase">{item.winner}</div>
                          <div className="text-[8px] text-text-muted font-bold uppercase tracking-widest">{item.date} • {item.drawId}</div>
                        </div>
                        <div className="text-[9px] font-black text-aurora-300 uppercase tracking-widest">{item.prize}</div>
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
                      className="absolute inset-0 bg-aurora-950/80 backdrop-blur-md"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-sm bg-aurora-950 border border-aurora-600 rounded-3xl p-8 space-y-8 shadow-2xl"
                    >
                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-text-primary uppercase italic tracking-tighter">Buy Tickets</h3>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Select Quantity</p>
                      </div>

                      <div className="flex items-center justify-center gap-8">
                        <button 
                          onClick={() => setRaffleQuantity(prev => Math.max(1, prev - 1))}
                          className="w-12 h-12 rounded-full border border-aurora-600 flex items-center justify-center text-text-primary hover:bg-aurora-700/50"
                        >
                          -
                        </button>
                        <span className="text-4xl font-black text-text-primary">{raffleQuantity}</span>
                        <button 
                          onClick={() => setRaffleQuantity(prev => Math.min(50, prev + 1))}
                          className="w-12 h-12 rounded-full border border-aurora-600 flex items-center justify-center text-text-primary hover:bg-aurora-700/50"
                        >
                          +
                        </button>
                      </div>

                      <div className="p-4 bg-aurora-700/50 rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] text-text-body font-black uppercase tracking-widest">Total Cost</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-aurora-300">{raffleQuantity * 10}</span>
                          <CoinIcon size={20} noShadow />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => setIsRaffleModalOpen(false)}
                          className="flex-1 py-4 border border-aurora-600 text-text-primary font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-aurora-700/50"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleBuyTicket(raffleQuantity)}
                          className="flex-1 py-4 bg-aurora-300 text-aurora-950 font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
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

          {activeTab === 'blog' && (
            <motion.div 
              key="blog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase italic">
                  <span className="bg-gradient-to-r from-text-primary to-aurora-500 bg-clip-text text-transparent">CRINAVA</span> NOTES
                </h2>
                <button 
                  onClick={handleGenerateBlog}
                  disabled={loading}
                  className="px-4 py-2 bg-aurora-300 text-aurora-950 font-black text-[9px] uppercase tracking-widest rounded-lg hover:scale-105 transition-all disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate AI Note'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {blogPosts.map((post, i) => (
                  <div key={i} className="group cursor-pointer space-y-4 p-8 rounded-3xl bg-aurora-800 hover:bg-aurora-700/30 transition-all border border-aurora-600/50 hover:border-aurora-300/30">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-aurora-700/50 text-text-body text-[8px] font-black uppercase tracking-widest rounded-full">{post.category}</span>
                        {post.isAI && (
                          <span className="px-2 py-0.5 bg-aurora-300/10 text-aurora-300 text-[7px] font-black uppercase tracking-widest border border-aurora-300/20 rounded">AI Oracle</span>
                        )}
                      </div>
                      <span className="text-[9px] text-text-muted font-black uppercase tracking-widest">{post.date} • {post.readTime} read</span>
                    </div>
                    <h3 className="text-2xl font-black text-text-primary group-hover:text-aurora-300 transition-colors leading-tight italic">
                      {post.title}
                    </h3>
                    <p className="text-xs text-text-body font-medium line-clamp-3 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-2 text-aurora-300 text-[9px] font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                      Read Full Note <ChevronRight size={12} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'store' && (
            <motion.div 
              key="store"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl space-y-12 py-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-5xl font-black uppercase tracking-tighter italic">
                  <span className="bg-gradient-to-r from-text-primary to-aurora-500 bg-clip-text text-transparent">CRINAVA</span> STORE
                </h2>
                <p className="text-text-muted text-xs font-bold uppercase tracking-[0.3em]">Premium In-App Currency</p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-aurora-500 to-metallic-gold rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative p-12 rounded-[40px] bg-aurora-950 border border-aurora-600/50 text-center space-y-8 overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-aurora-300/5 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-gold-base/5 rounded-full blur-3xl"></div>
                  
                  <div className="space-y-2 relative z-10">
                    <div className="text-[10px] text-text-muted font-black uppercase tracking-[0.4em]">Current Balance</div>
                    <div className="text-7xl font-black text-text-primary tracking-tighter flex items-center justify-center gap-4">
                      {coinBalance}
                      <CoinIcon size={64} />
                    </div>
                  </div>
                  
                  <div className="flex justify-center items-center gap-3 relative z-10">
                    <div className="w-1.5 h-1.5 bg-aurora-300 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-aurora-300 font-black uppercase tracking-[0.2em]">Secure Ledger Sync Active</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { amount: 100, price: 100, tag: 'Starter' },
                  { amount: 500, price: 500, tag: 'Most Popular', highlight: true },
                  { amount: 1000, price: 1000, tag: 'Pro Pack' },
                  { amount: 2000, price: 2000, tag: 'Legendary' }
                ].map((pkg) => (
                  <button 
                    key={pkg.amount}
                    onClick={() => buyCoins(pkg.amount)}
                    className={`relative p-8 rounded-[32px] border transition-all duration-500 group overflow-hidden ${
                      pkg.highlight 
                        ? 'bg-aurora-700/50 border-aurora-300/30 hover:border-aurora-300' 
                        : 'bg-aurora-900 border-aurora-600/50 hover:border-aurora-600'
                    }`}
                  >
                    {pkg.highlight && (
                      <div className="absolute top-0 right-0 px-4 py-1 bg-aurora-300 text-aurora-950 text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                        {pkg.tag}
                      </div>
                    )}
                    {!pkg.highlight && (
                      <div className="text-[8px] text-text-muted font-black uppercase tracking-widest mb-4">
                        {pkg.tag}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-3xl font-black text-text-primary flex items-center gap-2">
                          {pkg.amount}
                          <CoinIcon size={28} />
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest">
                          <span className="bg-gradient-to-r from-text-muted to-aurora-500/50 bg-clip-text text-transparent">CRINAVA</span> COINS
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-text-primary">₹{pkg.price}</div>
                        <div className="text-[8px] text-text-muted font-black uppercase tracking-widest">One-time</div>
                      </div>
                    </div>
                    
                    <div className="mt-6 w-full py-3 bg-aurora-700/50 border border-aurora-600 rounded-xl text-[10px] font-black text-text-primary uppercase tracking-widest group-hover:bg-aurora-700 transition-all">
                      Purchase Now
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-8 text-center space-y-4">
                <p className="text-[10px] text-text-muted font-medium italic max-w-sm mx-auto">
                  "Crinava Coins are virtual assets for use within the ecosystem. Non-refundable and non-transferable."
                </p>
                <div className="flex justify-center gap-8 opacity-20 grayscale">
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-primary">Visa</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-primary">Mastercard</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-primary">UPI</div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'verdict' && (
            <motion.div 
              key="verdict"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl space-y-12"
            >
              {/* Header */}
              <section className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-aurora-300/10 border border-aurora-300/30 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-aurora-300 animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-aurora-300 uppercase tracking-widest">
                    5.2M Iterations Engine
                  </span>
                </div>
                <h2 className="text-6xl md:text-8xl font-display font-bold text-text-primary tracking-tight uppercase leading-none">
                  THE <span className="text-aurora-300 text-glow-indigo">ORACLE</span>
                </h2>
                <p className="text-text-body max-w-md mx-auto text-xs font-mono uppercase tracking-[0.2em]">
                  Statistical Simulation & Predictive Modeling
                </p>
              </section>

              {/* Match Selector */}
              <div className="max-w-md mx-auto w-full space-y-8">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-aurora-300 rounded-md blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                  <select 
                    value={selectedMatch}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    className="input-search w-full"
                  >
                    <option value="">Select Match for Simulation</option>
                    <option value="IND vs PAK - T20WC">IND vs PAK - T20WC</option>
                    <option value="CSK vs GT - IPL Final">CSK vs GT - IPL Final</option>
                    <option value="AUS vs ENG - Ashes">AUS vs ENG - Ashes</option>
                    <option value="MI vs RCB - WPL">MI vs RCB - WPL</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown size={18} className="text-aurora-300" />
                  </div>
                </div>
                <PlayerEnrichmentButton />

                {/* Simulation Progress */}
                {isSimulating && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-md bg-aurora-dark border border-aurora-300/20 text-center space-y-6 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-aurora-950 overflow-hidden">
                      <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                        className="w-1/2 h-full bg-aurora-300 shadow-[0_0_10px_#14B8A6]"
                      />
                    </div>
                    <div className="flex justify-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-2 border-aurora-300/10 rounded-full" />
                        <div className="absolute inset-0 border-2 border-aurora-300 border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Brain size={24} className="text-aurora-300 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs font-mono font-bold text-text-primary uppercase tracking-[0.2em]">Oracle Engine Active</h3>
                      <p className="text-[10px] text-aurora-300 font-mono font-bold uppercase tracking-widest animate-pulse">Processing Telemetry...</p>
                    </div>
                  </motion.div>
                )}

                {/* Results Display */}
                {vertexResult && !isSimulating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* Win Probability */}
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(vertexResult.win_probability).map(([team, prob]: any) => (
                        <div key={team} className="p-8 rounded-md glass-card text-center group hover:border-aurora-300/30 transition-all">
                          <p className="text-[10px] font-mono text-text-body font-bold uppercase tracking-[0.2em] mb-3">{team}</p>
                          <p className="text-5xl font-mono font-bold text-text-primary tracking-tighter">{prob}%</p>
                        </div>
                      ))}
                    </div>

                    {/* Verdict Card */}
                    <div className="p-10 rounded-md bg-aurora-dark border border-aurora-600 border-l-4 border-l-aurora-300 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5">
                        <ShieldCheck size={80} className="text-aurora-300" />
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-aurora-300/10 rounded-md flex items-center justify-center">
                          <Sparkles size={16} className="text-aurora-300" />
                        </div>
                        <h3 className="text-[10px] font-mono font-bold text-aurora-300 uppercase tracking-[0.3em]">AI Synthesis</h3>
                      </div>
                      <p className="text-xl font-display font-medium text-text-primary leading-relaxed italic mb-8">
                        "{vertexResult.verdict}"
                      </p>
                      <div className="flex justify-between items-center pt-6 border-t border-aurora-600">
                        <div className="space-y-1">
                          <p className="text-[8px] font-mono text-muted font-bold uppercase tracking-widest">Iterations</p>
                          <p className="text-xs font-mono font-bold text-text-primary">{vertexResult.iterations.toLocaleString()}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[8px] font-mono text-muted font-bold uppercase tracking-widest">Confidence</p>
                          <p className="text-xs font-mono font-bold text-aurora-300">{vertexResult.confidence_interval}</p>
                        </div>
                      </div>
                    </div>

                    {/* Impact Factors */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {vertexResult.key_insights.map((insight: any, i: number) => (
                        <div key={i} className="p-6 rounded-md bg-aurora-950 border border-aurora-600 space-y-3">
                          <p className="text-[9px] font-mono text-aurora-300 font-bold uppercase tracking-widest">{insight.label}</p>
                          <p className="text-xs text-text-body font-medium leading-relaxed">{insight.detail}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {!isSimulating && !vertexResult && (
                  <div className="py-20 text-center space-y-6 opacity-20">
                    <div className="flex justify-center">
                      <div className="p-6 glass-card rounded-full">
                        <Target size={48} className="text-text-primary" />
                      </div>
                    </div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-text-primary">Awaiting Match Telemetry</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'stories' && (
            <motion.div 
              key="stories"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-text-primary tracking-tighter uppercase italic">Stories</h2>
                  <p className="text-aurora-300 text-[10px] font-black uppercase tracking-widest">Crinava Exclusive Insights</p>
                </div>
                <BookOpen size={32} className="text-aurora-300 opacity-20" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-64 bg-aurora-800 border border-aurora-600/50 rounded-3xl overflow-hidden relative group cursor-wait">
                    <div className="absolute inset-0 bg-gradient-to-t from-aurora-950 to-transparent z-10" />
                    <div className="absolute bottom-6 left-6 right-6 z-20 space-y-2">
                      <div className="w-20 h-2 bg-aurora-700 rounded-full overflow-hidden">
                        <div className="h-full bg-aurora-300 w-1/3" />
                      </div>
                      <div className="h-4 bg-aurora-700/50 rounded w-3/4" />
                      <div className="h-3 bg-aurora-700/50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-12"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-text-primary tracking-tighter uppercase italic">Admin Console</h2>
                  <p className="text-aurora-300 text-[10px] font-black uppercase tracking-widest">System Overlord Access</p>
                </div>
                <div className="px-4 py-2 bg-aurora-700/50 border border-aurora-600 rounded-xl">
                  <span className="text-[8px] text-text-muted font-black uppercase tracking-widest block">Logged in as</span>
                  <span className="text-[10px] text-text-primary font-bold">{userEmail}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-aurora-800 border border-aurora-600/50 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-aurora-300/10 rounded-xl flex items-center justify-center">
                    <PlusCircle size={24} className="text-aurora-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-text-primary uppercase italic">Create Blog</h3>
                    <p className="text-xs text-text-muted">Publish new Crinava Notes to the community.</p>
                  </div>
                  <button className="w-full py-3 bg-aurora-700/50 border border-aurora-600 text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-aurora-700 transition-all">
                    Open Editor
                  </button>
                </div>

                <div className="p-8 bg-aurora-800 border border-aurora-600/50 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-gold-base/10 rounded-xl flex items-center justify-center">
                    <Trophy size={24} className="text-gold-base" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-text-primary uppercase italic">Tournaments</h3>
                    <p className="text-xs text-text-muted">Organize and manage cricket events.</p>
                  </div>
                  <button className="w-full py-3 bg-aurora-700/50 border border-aurora-600 text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-aurora-700 transition-all">
                    Manage Events
                  </button>
                </div>

                <div className="p-8 bg-aurora-800 border border-aurora-600/50 rounded-3xl space-y-6">
                  <div className="w-12 h-12 bg-loss-red/10 rounded-xl flex items-center justify-center">
                    <ShieldAlert size={24} className="text-loss-red" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-text-primary uppercase italic">Moderation</h3>
                    <p className="text-xs text-text-muted">Review debates and user-generated content.</p>
                  </div>
                  <button className="w-full py-3 bg-aurora-700/50 border border-aurora-600 text-text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-aurora-700 transition-all">
                    Review Queue
                  </button>
                </div>

              </div>

              <div className="p-8 bg-gradient-to-r from-aurora-500/10 to-transparent border border-aurora-600/50 rounded-3xl">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-text-primary uppercase italic">System Health</h4>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Oracle Engine Status: Operational</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-aurora-300 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-aurora-300 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-aurora-300 rounded-full animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeDebateChat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-aurora-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-lg bg-aurora-950 border border-aurora-600 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]"
            >
              <div className="p-6 border-b border-aurora-600/50 flex justify-between items-center bg-aurora-700/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-aurora-300/10 rounded-lg">
                    <MessageSquare size={20} className="text-aurora-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-primary uppercase italic tracking-widest">Debate Chat</h3>
                    <p className="text-[8px] text-text-muted font-black uppercase tracking-[0.2em]">Community Pulse</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveDebateChat(null)}
                  className="p-2 hover:bg-aurora-700/50 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className="text-text-body" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {debateMessages?.map((msg) => {
                  const isUnread = lastReadMessageId && msg.id !== lastReadMessageId && new Date(msg.timestamp) > new Date(debateMessages.find(m => m.id === lastReadMessageId)?.timestamp || 0);
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.vote === 'for' ? 'text-aurora-300' : msg.vote === 'against' ? 'text-loss-red' : 'text-text-body'}`}>
                          {msg.user}
                        </span>
                        <span className="text-[8px] text-text-muted font-black uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isUnread && <span className="w-1.5 h-1.5 bg-aurora-300 rounded-full animate-pulse" />}
                      </div>
                      <div className="p-3 bg-aurora-700/50 rounded-2xl rounded-tl-none border border-aurora-600/50">
                        <p className="text-xs text-text-body leading-relaxed">{msg.text}</p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-aurora-600/50 bg-aurora-700/30">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                    sendDebateMessage(input.value);
                    input.value = '';
                  }}
                  className="flex gap-2"
                >
                  <input 
                    name="message"
                    type="text" 
                    placeholder="Add your voice..." 
                    className="flex-1 bg-aurora-700/50 border border-aurora-600 rounded-xl px-4 py-3 text-xs text-text-primary focus:outline-none focus:border-aurora-300/50 transition-all"
                  />
                  <button 
                    type="submit"
                    className="px-6 py-3 bg-aurora-300 text-aurora-950 font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-loss-red/10 border border-loss-red/20 rounded-xl text-loss-red text-[10px] font-black uppercase tracking-widest">
            {error}
          </div>
        )}
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 w-full bg-aurora-dark border-t border-aurora-600 flex justify-around items-center px-2 py-3 z-50">
        {[
          { id: 'home', label: 'Home', icon: LayoutDashboard },
          { id: 'matches', label: 'Matches', icon: Activity },
          { id: 'prediction', label: 'Oracle', icon: Zap },
          { id: 'verdict', label: 'Verdict', icon: Gavel },
          { id: 'momentum', label: 'Stats', icon: TrendingUp },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AppTab)}
            className={`flex flex-col items-center gap-1 min-w-[60px] transition-all ${activeTab === tab.id ? 'text-aurora-300 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]' : 'text-text-muted hover:text-text-primary'}`}
          >
            <tab.icon size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </div>
  );
}
