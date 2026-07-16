import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldAlert,
  KeyRound,
  Send,
  MessageSquare,
  FileText,
  Activity,
  Terminal,
  Zap,
  Server,
  Lock,
  Brain,
  Cpu,
  GitBranch,
  Database,
  Eye,
  Command,
  Search,
  Settings,
  Check,
  Trash2,
  ImagePlus,
  Award,
  Plus,
  Save,
  Edit
} from "lucide-react";
import { ACHIEVEMENTS_CONFIG, AchievementThreshold } from "../lib/achievementsConfig";
import { motion } from "motion/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const AdminControlCenter = () => {
  const [isDisguised, setIsDisguised] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [magicCodeInput, setMagicCodeInput] = useState("");
  const [loginStep, setLoginStep] = useState<"password" | "totp" | "telegram" | "magic_code">(
    "password",
  );
  const [error, setError] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState("dashboard");
  const [sessionTimeLeft, setSessionTimeLeft] = useState(60);
  const isVerifyingMagicLink = useRef(false);

  // Engine Monitor State
  const [engineLogs, setEngineLogs] = useState<{time: string, type: string, message: string}[]>([]);
  const [cheatEvent, setCheatEvent] = useState("vote_cast");
  const [cheatUser, setCheatUser] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<{id: string, username: string}[]>([]);
  
  useEffect(() => {
    const handleEngineLog = (e: any) => {
      setEngineLogs(prev => [{
        time: e.detail.timestamp,
        type: e.detail.type,
        message: e.detail.message
      }, ...prev].slice(0, 100)); // Keep last 100 logs
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('badge-engine-log', handleEngineLog);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('badge-engine-log', handleEngineLog);
      }
    };
  }, []);

  useEffect(() => {
    if (activeAdminTab === "engine") {
      // Fetch users for the dropdown helper
      fetch("/api/admin/users")
        .then(res => res.json())
        .then(data => setRegisteredUsers(data))
        .catch(err => console.error("Error fetching users:", err));

      // Fetch persistent database logs
      fetch("/api/admin/engine-logs")
        .then(res => res.json())
        .then(data => {
          const formattedLogs = data.map((log: any) => ({
            time: log.created_at,
            type: log.new_stage ? 'SUCCESS' : 'INFO',
            message: log.new_stage 
              ? `[DB Log] 🏆 LEVEL UP! User ${log.username || log.user_id} reached Stage ${log.new_stage} on '${log.badge_id}'!`
              : `[DB Log] Event '${log.event_type}' recorded for user ${log.username || log.user_id} (Amount: +${log.amount})`
          }));
          setEngineLogs(formattedLogs);
        })
        .catch(err => console.error("Error fetching logs:", err));
    }
  }, [activeAdminTab]);
  
  // Forms state
  const [debateTopic, setDebateTopic] = useState("");
  const [debateArgumentFor, setDebateArgumentFor] = useState("");
  const [debateArgumentAgainst, setDebateArgumentAgainst] = useState("");
  const [debateTrending, setDebateTrending] = useState(false);
  const [debateTimerMinutes, setDebateTimerMinutes] = useState("1440"); // Default 24 hours
  const [blogTitle, setBlogTitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("Tactical Analysis");
  const [blogDraft, setBlogDraft] = useState("");
  const [blogImageUrls, setBlogImageUrls] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hfDrafts, setHfDrafts] = useState<any[]>([]);
  const [blogSubTab, setBlogSubTab] = useState<"new" | "old" | "approved" | "revoked">("new");
  const [approvedBlogs, setApprovedBlogs] = useState<any[]>([]);
  const [revokedBlogs, setRevokedBlogs] = useState<any[]>([]);
  // Admin Debate Manager
  const [liveDebates, setLiveDebates] = useState<any[]>([]);
  const [editingDebateId, setEditingDebateId] = useState<string | null>(null);
  const [editDebateForm, setEditDebateForm] = useState<any>({});
  // Command Bar
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const [telemetry, setTelemetry] = useState({
    uptime: 0,
    memoryUsageMB: 0,
    totalRequests: 0,
    activeDebates: 0,
    totalBlogs: 0
  });

  const [telemetryHistory, setTelemetryHistory] = useState([
    { time: "00:00", requests: 15000 }
  ]);

  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // DevOps State
  const [canary, setCanary] = useState({ visualStories: true, matchTwin: true });
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);

  // Badges Editor State
  const [editableBadges, setEditableBadges] = useState<Record<string, AchievementThreshold>>(ACHIEVEMENTS_CONFIG);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [isSavingBadges, setIsSavingBadges] = useState(false);

  useEffect(() => {
    if (activeAdminTab === "badges") {
      fetch("/api/badges")
        .then(res => res.json())
        .then((data: any[]) => {
          if (Array.isArray(data) && data.length > 0) {
            const record: any = {};
            data.forEach((b: any) => {
              record[b.id] = {
                id: b.id,
                name: b.name,
                category: b.category,
                description: b.description,
                targets: b.targets || [1, 2, 3, 4, 5],
                thresholds: b.thresholds || ["", "", "", "", ""],
                icon: b.icon || 'Award'
              };
            });
            setEditableBadges(record);
          }
        })
        .catch(console.error);
    }
  }, [activeAdminTab]);

  // Fake 404 Disguise & Magic Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic_token");
    if (magicToken && !isVerifyingMagicLink.current) {
      isVerifyingMagicLink.current = true;
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch("/api/admin/magic-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: magicToken })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsDisguised(false);
          setIsAuthenticated(true);
        }
      }).catch(console.error);
    }

    let typedStr = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K Command Bar
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setShowCommandBar(true);
        return;
      }
      if (e.key === "Escape") {
        setShowCommandBar(false);
      }

      // Fake 404 Disguise Knock
      if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
        typedStr += e.key.toLowerCase();
        if (typedStr.includes("jatin")) {
          setIsDisguised(false);
          typedStr = ""; 
        }
        if (typedStr.length > 20) typedStr = typedStr.slice(-20);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Polling loops
  useEffect(() => {
    let telemetryInterval: any;
    let logInterval: any;
    let auditInterval: any;

    if (isAuthenticated) {
      if (activeAdminTab === "dashboard") {
        const fetchTelemetry = async () => {
          try {
            const res = await fetch("/api/admin/telemetry");
            const data = await res.json();
            setTelemetry(data);
            setTelemetryHistory(prev => {
              const newHistory = [...prev, { time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}), requests: data.totalRequests }];
              if (newHistory.length > 10) newHistory.shift();
              return newHistory;
            });
          } catch (e) {
            console.error("Telemetry fetch failed", e);
          }
        };
        fetchTelemetry();
        telemetryInterval = setInterval(fetchTelemetry, 3000);
      } else if (activeAdminTab === "devops") {
        const fetchLogs = async () => {
          try {
            const res = await fetch("/api/admin/logs");
            const data = await res.json();
            setServerLogs(data);
          } catch (e) {
            console.error("Failed to fetch server logs");
          }
        };
        fetchLogs();
        logInterval = setInterval(fetchLogs, 1000);
      } else if (activeAdminTab === "debate") {
        const fetchDebatesAdmin = async () => {
          try {
            const res = await fetch("/api/debates");
            const data = await res.json();
            setLiveDebates(Array.isArray(data) ? data : []);
          } catch (e) {
            console.error("Failed to fetch debates for admin");
          }
        };
        fetchDebatesAdmin();
        auditInterval = setInterval(fetchDebatesAdmin, 5000);
      } else if (activeAdminTab === "secops") {
        const fetchAudit = async () => {
          try {
            const res = await fetch("/api/admin/audit-logs");
            const data = await res.json();
            setAuditLogs(Array.isArray(data) ? data : []);
          } catch (e) {
            console.error("Failed to fetch audit logs");
          }
        };
        fetchAudit();
        auditInterval = setInterval(fetchAudit, 3000);
      }
    }
    
    return () => {
      clearInterval(telemetryInterval);
      clearInterval(logInterval);
      clearInterval(auditInterval);
    };
  }, [isAuthenticated, activeAdminTab]);

  useEffect(() => {
    if (isAuthenticated) {
      setSessionTimeLeft(900); // 15 minute session (900 seconds)
      const timer = setInterval(() => {
        setSessionTimeLeft((prev) => {
          const newTime = prev - 1;
          
          if (newTime <= 0) {
            clearInterval(timer);
            setIsAuthenticated(false);
            setLoginStep("password");
            setPassword("");
            setTotpCode("");
            fetch("/api/admin/session-alert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "forced_logout" })
            }).catch(() => {});
            return 0;
          }

          // Original: After 10 mins (<= 300s left), alert every 30s.
          if (newTime <= 300 && newTime % 30 === 0) {
            fetch("/api/admin/session-alert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "warning", timeLeft: newTime })
            }).catch(() => {});
          }

          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLoginStep("password");
    setPassword("");
    setTotpCode("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (loginStep === "password") {
      if (password.trim().length > 0) {
        try {
          const res = await fetch("/api/admin/verify-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setLoginStep("totp");
          } else {
            setError(data.error || "Invalid credentials");
          }
        } catch (e) {
          setError("Connection failed. Try again.");
        }
      } else {
        setError("Please enter your password");
      }
    } else if (loginStep === "totp") {
      if (totpCode.length === 6) {
        try {
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, totp: totpCode })
          });
          const data = await res.json();
          if (data.error) {
            setError(data.error);
            return;
          }
          if (data.requireTelegram) {
            setLoginStep("telegram");
            const interval = setInterval(async () => {
              try {
                const check = await fetch(`/api/admin/check-approval/${data.sessionId}`);
                const statusData = await check.json();
                if (statusData.status === "approved") {
                  clearInterval(interval);
                  setIsAuthenticated(true);
                } else if (statusData.status === "denied") {
                  clearInterval(interval);
                  setError("Login denied via Telegram.");
                  setLoginStep("totp");
                  setTotpCode("");
                }
              } catch (err) {}
            }, 1000);
          } else {
            setIsAuthenticated(true);
          }
        } catch (err) {
          setError("Server connection failed.");
        }
      } else {
        setError("Invalid TOTP code length");
      }
    } else if (loginStep === "magic_code") {
      if (magicCodeInput.length === 6) {
        try {
          const res = await fetch("/api/admin/magic-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: magicCodeInput.toUpperCase() })
          });
          const data = await res.json();
          if (data.success) {
            setIsDisguised(false);
            setIsAuthenticated(true);
            setMagicCodeInput("");
          } else {
            setError(data.error || "Invalid magic code.");
          }
        } catch (err) {
          setError("Server connection failed.");
        }
      } else {
        setError("Magic code must be exactly 6 characters");
      }
    }
  };

  const handleRequestMagicCode = async () => {
    try {
      await fetch("/api/admin/request-magic-code", { method: "POST" });
      setLoginStep("magic_code");
    } catch (e) {
      setError("Failed to request magic code.");
    }
  };

  const handleFetchDrafts = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/admin/blog-drafts");
      const data = await res.json();
      const now = Date.now();
      
      setHfDrafts(prev => {
        const newDrafts = [...prev];
        (data || []).forEach((draft: any) => {
           if (!newDrafts.find(d => d.title === draft.title)) {
              newDrafts.push({ ...draft, fetchedAt: now });
           }
        });
        return newDrafts;
      });
      
      if (data.length > 0) {
        setBlogTitle(data[0].title);
        setBlogCategory(data[0].category || "Tactical Analysis");
        setBlogDraft(data[0].content);
      }
      
      fetch("/api/blogs").then(res => res.json()).then(data => setApprovedBlogs(data));
      fetch("/api/admin/blogs/revoked").then(res => res.json()).then(data => setRevokedBlogs(data));
      
    } catch (e) {
      setBlogDraft("Failed to connect to Hugging Face API.");
    }
    setIsGenerating(false);
  };

  const handlePublishDebate = async () => {
    if (!debateTopic.trim()) {
      alert("Please enter a debate topic.");
      return;
    }
    try {
      const res = await fetch("/api/admin/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic: debateTopic,
          argumentFor: debateArgumentFor,
          argumentAgainst: debateArgumentAgainst,
          trending: debateTrending,
          timerMinutes: debateTimerMinutes === "indefinite" ? null : debateTimerMinutes
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Debate published to main website instantly!");
        setDebateTopic("");
        setDebateArgumentFor("");
        setDebateArgumentAgainst("");
        setDebateTrending(false);
        setDebateTimerMinutes("1440");
      } else {
        alert("Failed to publish debate: " + (data.error || "Check database logs. Has debate_schema.sql been executed in Supabase?"));
      }
    } catch (e) {
      alert("Failed to publish debate. Connection error.");
    }
  };

  const handlePublishBlog = async () => {
    try {
      const res = await fetch("/api/admin/blog-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: blogTitle, category: blogCategory, content: blogDraft, image_url: selectedImageUrl })
      });
      const data = await res.json();
      if (data.success) {
        alert("Blog published live!");
        setHfDrafts(prev => prev.filter(d => d.title !== blogTitle));
        fetch("/api/blogs").then(r => r.json()).then(d => setApprovedBlogs(d));
        setBlogDraft("");
        setBlogTitle("");
        setBlogCategory("");
        setBlogImageUrls([]);
        setSelectedImageUrl("");
      } else {
        alert("Failed to publish blog: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Failed to publish blog network error.");
    }
  };

  const handleRevokeBlog = async (id: string) => {
    try {
      await fetch(`/api/admin/blogs/${id}/revoke`, { method: "POST" });
      fetch("/api/blogs").then(r => r.json()).then(d => setApprovedBlogs(d));
      fetch("/api/admin/blogs/revoked").then(r => r.json()).then(d => setRevokedBlogs(d));
      alert("Blog revoked from live site.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if(!window.confirm("Are you sure you want to permanently delete this?")) return;
    try {
      await fetch(`/api/admin/blogs/${id}`, { method: "DELETE" });
      fetch("/api/admin/blogs/revoked").then(r => r.json()).then(d => setRevokedBlogs(d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAIOpsUpdate = async (endpoint: string, payload: any) => {
    try {
      await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      alert(`Successfully updated ${endpoint}!`);
    } catch (e) {
      alert(`Failed to update ${endpoint}`);
    }
  };

  const handleSaveBadgesConfig = async () => {
    setIsSavingBadges(true);
    try {
      const res = await fetch("/api/admin/badges/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editableBadges)
      });
      const data = await res.json();
      if (data.success) {
        alert("Badges configuration successfully deployed! (Hot-reload should apply instantly)");
      } else {
        alert("Failed to deploy: " + data.error);
      }
    } catch (e) {
      alert("Failed to deploy badges configuration. Connection error.");
    }
    setIsSavingBadges(false);
  };

  const handleSqlExecute = async () => {
    try {
      const res = await fetch("/api/admin/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      setSqlResult(data);
    } catch (e) {
      alert("Failed to execute SQL.");
    }
  };

  if (isDisguised) {
    return (
      <div className="admin-control-center-wrapper min-h-screen flex items-center justify-center bg-[#050505] font-body">
        <div className="text-center space-y-4">
          <h1 className="text-9xl font-black text-mercury/10">404</h1>
          <p className="text-xl text-mercury/40 font-black uppercase tracking-[0.3em]">Page Not Found</p>
          <div className="mt-8 flex justify-center">
            <a href="/" className="px-6 py-2 text-xs border border-mercury/10 rounded-full text-mercury/30 hover:bg-white/5 transition-colors uppercase tracking-widest">
              Return Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-control-center-wrapper min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] text-white p-4 font-space">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-mercury/20 p-8 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border border-red-500/30 mb-4">
              <ShieldAlert className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-center">
              ENTERPRISE COMMAND
            </h1>
            <p className="text-sm text-mercury/60 mt-2 text-center">
              Secure area. Unauthorized access is logged.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {loginStep === "password" && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-mercury/80">
                  Master Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-mercury/50" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-mercury/20 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-metallic-gold transition-colors"
                    placeholder="Enter passphrase"
                    required
                  />
                </div>
                <button 
                  type="button"
                  onClick={handleRequestMagicCode}
                  className="w-full text-center text-xs text-metallic-gold/80 hover:text-metallic-gold transition-colors mt-4 block"
                >
                  Or Enter Laptop Entry Code
                </button>
              </div>
            )}

            {loginStep === "magic_code" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-mercury/80 block mb-2 text-center">
                  Laptop Entry Code (from Telegram)
                </label>
                <input
                  type="text"
                  value={magicCodeInput}
                  onChange={(e) => setMagicCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full bg-black/50 border border-mercury/20 rounded-lg py-3 px-4 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-metallic-gold transition-colors font-mono"
                  placeholder="CODE12"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setLoginStep("password")}
                  className="w-full text-center text-xs text-mercury/50 hover:text-mercury transition-colors mt-4 block"
                >
                  Back to Password Login
                </button>
              </motion.div>
            )}

            {loginStep === "totp" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-mercury/80">
                  Google Authenticator (TOTP)
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  maxLength={6}
                  className="w-full bg-black/50 border border-mercury/20 rounded-lg py-3 px-4 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-metallic-gold transition-colors font-mono"
                  placeholder="000000"
                  required
                />
              </motion.div>
            )}

            {loginStep === "telegram" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                <p className="text-blue-400 font-medium animate-pulse">Awaiting Telegram Approval...</p>
                <p className="text-xs text-mercury/60">Please check your mobile device to authorize this session.</p>
              </motion.div>
            )}

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {loginStep !== "telegram" && (
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-metallic-gold to-[#B8860B] text-black font-bold rounded-lg uppercase tracking-wider hover:brightness-110 transition-all"
              >
                {loginStep === "password" ? "Verify Identity" : loginStep === "magic_code" ? "Validate Laptop Code" : "Submit Token"}
              </button>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  const executeCommand = (cmd: string) => {
    setShowCommandBar(false);
    setCommandQuery("");
    if (cmd === "telemetry") setActiveAdminTab("dashboard");
    if (cmd === "debate") setActiveAdminTab("debate");
    if (cmd === "blog") setActiveAdminTab("blog");
    if (cmd === "devops") setActiveAdminTab("devops");
    if (cmd === "canary") setActiveAdminTab("canary");
    if (cmd === "secops") setActiveAdminTab("secops");
    if (cmd === "logout") handleLogout();
  };

  return (
    <div className="admin-control-center-wrapper min-h-screen w-full bg-[#050505] text-white font-space flex relative overflow-hidden">
      {/* Command Bar Overlay */}
      {showCommandBar && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center pt-[15vh]">
          <div className="w-[600px] h-fit bg-[#111] border border-mercury/20 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-mercury/10 flex items-center gap-3">
              <Command className="text-mercury/50" size={20} />
              <input 
                autoFocus
                type="text" 
                placeholder="Type a command or search..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-lg placeholder:text-mercury/30"
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              <div className="px-3 py-2 text-xs text-mercury/40 font-bold uppercase tracking-widest">Navigation</div>
              <button onClick={() => executeCommand("telemetry")} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-lg flex items-center gap-3 transition-colors">
                <Activity size={16} className="text-aurora-teal"/> <span className="text-sm">Go to Telemetry Dashboard</span>
              </button>
              <button onClick={() => executeCommand("devops")} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-lg flex items-center gap-3 transition-colors">
                <Terminal size={16} className="text-blue-400"/> <span className="text-sm">Open DevOps Console</span>
              </button>
              <button onClick={() => executeCommand("canary")} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-lg flex items-center gap-3 transition-colors">
                <GitBranch size={16} className="text-purple-400"/> <span className="text-sm">Manage Canary Features</span>
              </button>
              <div className="px-3 py-2 text-xs text-mercury/40 font-bold uppercase tracking-widest mt-2">Actions</div>
              <button onClick={() => executeCommand("logout")} className="w-full text-left px-4 py-3 hover:bg-red-500/10 rounded-lg flex items-center gap-3 transition-colors text-red-400">
                <Lock size={16} /> <span className="text-sm">Force Safe Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="w-64 bg-black/80 border-r border-mercury/10 flex flex-col p-4 space-y-2">
        <div className="flex items-center space-x-3 px-2 mb-8 mt-4">
          <ShieldAlert className="text-metallic-gold" size={24} />
          <span className="font-bold tracking-widest text-lg uppercase">Ops Center</span>
        </div>
        
        <button onClick={() => setActiveAdminTab("dashboard")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "dashboard" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Activity size={20} />
          <span>Telemetry</span>
        </button>
        <button onClick={() => setActiveAdminTab("debate")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "debate" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <MessageSquare size={20} />
          <span>Debate Publisher</span>
        </button>
        <button onClick={() => setActiveAdminTab("blog")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "blog" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <FileText size={20} />
          <span>AI Blog Writer</span>
        </button>
        <button onClick={() => setActiveAdminTab("devops")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "devops" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Terminal size={20} />
          <span>DevOps Console</span>
        </button>
        <button onClick={() => setActiveAdminTab("canary")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "canary" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <GitBranch size={20} />
          <span>Feature Canary</span>
        </button>
        <button onClick={() => setActiveAdminTab("secops")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "secops" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Eye size={20} />
          <span>SecOps Audit</span>
        </button>
        <button onClick={() => setActiveAdminTab("badges")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "badges" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Award size={20} />
          <span className="font-bold tracking-wide">Badges</span>
        </button>
        <button onClick={() => setActiveAdminTab("engine")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "engine" ? "bg-aurora-teal/10 text-aurora-teal border border-aurora-teal/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Zap size={20} />
          <span className="font-bold tracking-wide">Engine & Cheat</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold uppercase tracking-wider text-mercury">
            {activeAdminTab === "dashboard" && "System Telemetry"}
            {activeAdminTab === "debate" && "Live Debate Deployment"}
            {activeAdminTab === "blog" && "AI-Assisted Publishing"}
            {activeAdminTab === "devops" && "DevOps Engineering Console"}
            {activeAdminTab === "canary" && "Canary Cohort Controls"}
            {activeAdminTab === "secops" && "SecOps Audit & Access"}
            {activeAdminTab === "badges" && "Badge Configuration Matrix"}
            {activeAdminTab === "engine" && "Event Engine & Cheat Mode"}
          </h2>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-full border font-mono font-bold ${sessionTimeLeft <= 15 ? "text-red-400 bg-red-900/20 border-red-500/30 animate-pulse" : "text-yellow-400 bg-yellow-900/20 border-yellow-500/30"}`}>
              <span>{Math.floor(sessionTimeLeft / 60)}:{(sessionTimeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
            <span className="flex items-center space-x-2 text-sm text-green-400 bg-green-900/20 px-3 py-1.5 rounded-full border border-green-500/30">
              <Server size={14} />
              <span>Oracle VM: Online</span>
            </span>
            <span className="flex items-center space-x-2 text-sm text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-500/30">
              <Lock size={14} />
              <span>Dual-Lock Active</span>
            </span>
            <button onClick={handleLogout} className="px-4 py-1.5 bg-red-600/20 text-red-500 border border-red-500/30 rounded-full text-sm font-bold hover:bg-red-500 hover:text-white transition-colors">
              LOGOUT
            </button>
          </div>
        </header>

        {activeAdminTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl">
                <h3 className="text-mercury/60 text-sm uppercase mb-2">Total Requests</h3>
                <div className="text-4xl font-bold">{telemetry.totalRequests.toLocaleString()}</div>
                <div className="text-green-400 text-sm mt-2 flex items-center"><Activity size={14} className="mr-1"/> Live Tracking Active</div>
              </div>
              <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl">
                <h3 className="text-mercury/60 text-sm uppercase mb-2">System Memory</h3>
                <div className="text-4xl font-bold">{telemetry.memoryUsageMB} MB</div>
                <div className="text-green-400 text-sm mt-2 flex items-center"><Zap size={14} className="mr-1"/> Stable Performance</div>
              </div>
              <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl">
                <h3 className="text-mercury/60 text-sm uppercase mb-2">Active Content</h3>
                <div className="text-4xl font-bold">{telemetry.activeDebates} <span className="text-lg text-mercury/50">Debates</span></div>
                <div className="text-yellow-400 text-sm mt-2 flex items-center">{telemetry.totalBlogs} Published Blogs</div>
              </div>
            </div>

            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl h-96">
              <h3 className="text-mercury/60 text-sm uppercase mb-6">Traffic Telemetry (Real-time)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" stroke="#ffffff50" />
                  <YAxis stroke="#ffffff50" domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: "#000", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="requests" stroke="#d4af37" strokeWidth={3} dot={{ r: 4, fill: "#d4af37" }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeAdminTab === "debate" && (
          <>
          <div className="bg-black/40 border border-mercury/10 p-8 rounded-xl max-w-3xl">
            <h3 className="text-xl font-bold mb-6 flex items-center"><MessageSquare className="mr-3 text-metallic-gold" /> Deploy New Debate</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-mercury/70 mb-2">Debate Topic / Claim</label>
                <input
                  type="text"
                  value={debateTopic}
                  onChange={(e) => setDebateTopic(e.target.value)}
                  className="w-full bg-black/60 border border-mercury/20 rounded-lg p-4 text-white focus:border-metallic-gold transition-colors outline-none"
                  placeholder="e.g. Jasprit Bumrah is the greatest T20 bowler of all time."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-mercury/70 mb-2">The Case For (Starter Argument)</label>
                  <textarea
                    value={debateArgumentFor}
                    onChange={(e) => setDebateArgumentFor(e.target.value)}
                    rows={3}
                    className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold transition-colors outline-none resize-none"
                    placeholder="e.g. Unbelievable economy rate under pressure, unmatched variations."
                  />
                </div>
                <div>
                  <label className="block text-sm text-mercury/70 mb-2">The Case Against (Starter Argument)</label>
                  <textarea
                    value={debateArgumentAgainst}
                    onChange={(e) => setDebateArgumentAgainst(e.target.value)}
                    rows={3}
                    className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold transition-colors outline-none resize-none"
                    placeholder="e.g. Needs more longevity or statistics across different formats."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-mercury/70 mb-2">Debate Duration (Timer)</label>
                  <select
                    value={debateTimerMinutes}
                    onChange={(e) => setDebateTimerMinutes(e.target.value)}
                    className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold transition-colors outline-none"
                  >
                    <option value="15">15 Minutes (Live Match Flash)</option>
                    <option value="60">1 Hour</option>
                    <option value="1440">24 Hours (Standard)</option>
                    <option value="10080">7 Days</option>
                    <option value="indefinite">Indefinite (No Timer)</option>
                  </select>
                </div>
                <div className="flex items-center space-x-3 pt-8">
                  <input
                    type="checkbox"
                    id="debateTrending"
                    checked={debateTrending}
                    onChange={(e) => setDebateTrending(e.target.checked)}
                    className="size-5 accent-metallic-gold bg-black/60 border border-mercury/20 rounded cursor-pointer"
                  />
                  <label htmlFor="debateTrending" className="text-sm text-mercury/90 cursor-pointer select-none">
                    Mark as Hot & Trending (Flickering Fire font on Battle Feed)
                  </label>
                </div>
              </div>

              <button onClick={handlePublishDebate} className="flex items-center justify-center space-x-2 w-full py-4 bg-metallic-gold text-black font-bold rounded-lg hover:brightness-110 transition-all">
                <Send size={18} />
                <span>Broadcast to All Users Instantly</span>
              </button>
            </div>
          </div>

          {/* Live Debates Manager */}
          <div className="bg-black/40 border border-mercury/10 p-8 rounded-xl max-w-5xl mt-8">
            <h3 className="text-xl font-bold mb-6 flex items-center"><Settings className="mr-3 text-aurora-teal" /> Manage Live Debates ({liveDebates.length})</h3>
            {liveDebates.length === 0 ? (
              <p className="text-mercury/50 text-sm">No active debates found. Deploy one above.</p>
            ) : (
              <div className="space-y-4">
                {liveDebates.map((d: any) => (
                  <div key={d.id} className={`border rounded-xl p-5 transition-all ${d.status === 'closed' ? 'border-red-500/20 bg-red-900/5' : 'border-mercury/10 bg-black/30'}`}>
                    {editingDebateId === d.id ? (
                      /* --- EDITING MODE --- */
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs text-mercury/60 mb-1">Claim / Topic</label>
                          <input value={editDebateForm.claim || ""} onChange={(e) => setEditDebateForm({...editDebateForm, claim: e.target.value})} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-mercury/60 mb-1">Argument For</label>
                            <textarea value={editDebateForm.argument_for || ""} onChange={(e) => setEditDebateForm({...editDebateForm, argument_for: e.target.value})} rows={2} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold outline-none resize-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-mercury/60 mb-1">Argument Against</label>
                            <textarea value={editDebateForm.argument_against || ""} onChange={(e) => setEditDebateForm({...editDebateForm, argument_against: e.target.value})} rows={2} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold outline-none resize-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-mercury/60 mb-1">Votes For</label>
                            <input type="number" value={editDebateForm.votes_for ?? 0} onChange={(e) => setEditDebateForm({...editDebateForm, votes_for: parseInt(e.target.value) || 0})} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-mercury/60 mb-1">Votes Against</label>
                            <input type="number" value={editDebateForm.votes_against ?? 0} onChange={(e) => setEditDebateForm({...editDebateForm, votes_against: parseInt(e.target.value) || 0})} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-mercury/60 mb-1">Status</label>
                            <select value={editDebateForm.status || "open"} onChange={(e) => setEditDebateForm({...editDebateForm, status: e.target.value})} className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white outline-none">
                              <option value="open">Open</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <input type="checkbox" checked={editDebateForm.trending || false} onChange={(e) => setEditDebateForm({...editDebateForm, trending: e.target.checked})} className="size-5 accent-orange-500" />
                          <label className="text-sm text-mercury/90">🔥 Trending</label>
                        </div>
                        <div className="flex space-x-3">
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`/api/admin/debate/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDebateForm) });
                              const data = await res.json();
                              if (data.success) { setEditingDebateId(null); setLiveDebates(prev => prev.map(x => x.id === d.id ? data.debate : x)); }
                              else alert("Save failed: " + data.error);
                            } catch (e) { alert("Save failed"); }
                          }} className="flex-1 py-3 bg-aurora-teal text-black font-bold rounded-lg hover:brightness-110 transition-all flex items-center justify-center space-x-2">
                            <Check size={16} /><span>Save Changes</span>
                          </button>
                          <button onClick={() => setEditingDebateId(null)} className="px-6 py-3 bg-mercury/10 text-mercury/70 rounded-lg hover:bg-mercury/20 transition-all">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* --- VIEW MODE --- */
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-bold text-white">"{d.claim}"</h4>
                            {d.trending && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded animate-pulse">🔥 TRENDING</span>}
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${d.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{d.status?.toUpperCase()}</span>
                          </div>
                          <div className="text-xs text-mercury/50 space-y-1">
                            <p>For: <span className="text-blue-400 font-bold">{d.votes_for}</span> | Against: <span className="text-red-400 font-bold">{d.votes_against}</span> | Total: {d.votes_for + d.votes_against}</p>
                            <p>Created: {new Date(d.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button onClick={() => { setEditingDebateId(d.id); setEditDebateForm({ claim: d.claim, argument_for: d.argument_for, argument_against: d.argument_against, trending: d.trending, status: d.status, votes_for: d.votes_for, votes_against: d.votes_against }); }} className="px-3 py-2 bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20 rounded-lg text-xs font-bold hover:bg-metallic-gold/20 transition-all">
                            Edit
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm("Reset all votes on this debate?")) return;
                            try { await fetch(`/api/admin/debate/${d.id}/reset-votes`, { method: "POST" }); setLiveDebates(prev => prev.map(x => x.id === d.id ? {...x, votes_for: 0, votes_against: 0} : x)); } catch(e) {}
                          }} className="px-3 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-xs font-bold hover:bg-yellow-500/20 transition-all">
                            Reset Votes
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm("Permanently delete this debate?")) return;
                            try { await fetch(`/api/admin/debate/${d.id}`, { method: "DELETE" }); setLiveDebates(prev => prev.filter(x => x.id !== d.id)); } catch(e) {}
                          }} className="px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {activeAdminTab === "blog" && (
          <div className="grid grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 flex items-center"><Zap className="mr-2 text-metallic-gold" /> AI Blog Management</h3>
              
              <div className="flex space-x-2 mb-6 bg-[#111] p-1 rounded-lg">
                <button onClick={() => setBlogSubTab("new")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "new" ? "bg-aurora-teal text-black" : "text-mercury/60"}`}>
                  New ({hfDrafts.filter(d => (Date.now() - (d.fetchedAt || Date.now())) <= 6 * 60 * 60 * 1000).length})
                </button>
                <button onClick={() => setBlogSubTab("old")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "old" ? "bg-metallic-gold text-black" : "text-mercury/60"}`}>
                  Old ({hfDrafts.filter(d => (Date.now() - (d.fetchedAt || Date.now())) > 6 * 60 * 60 * 1000).length})
                </button>
                <button onClick={() => setBlogSubTab("approved")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "approved" ? "bg-white text-black" : "text-mercury/60"}`}>
                  Approved ({approvedBlogs.length})
                </button>
                <button onClick={() => setBlogSubTab("revoked")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "revoked" ? "bg-red-500 text-white" : "text-mercury/60"}`}>
                  Revoked ({revokedBlogs.length})
                </button>
              </div>

              <button 
                onClick={handleFetchDrafts} 
                disabled={isGenerating}
                className="py-3 bg-aurora-teal/20 border border-aurora-teal/30 text-aurora-teal font-bold rounded-lg hover:bg-aurora-teal/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 w-full mb-6"
              >
                <Zap size={18} />
                <span>{isGenerating ? "Fetching..." : "Fetch Latest from Hugging Face"}</span>
              </button>

              <div className="space-y-4">
                {(blogSubTab === "new" || blogSubTab === "old") && hfDrafts.filter(d => {
                  const ageMs = Date.now() - (d.fetchedAt || Date.now());
                  const isOld = ageMs > 6 * 60 * 60 * 1000;
                  return blogSubTab === "new" ? !isOld : isOld;
                }).map((draft, i) => (
                  <div 
                    key={i} 
                    onClick={() => { 
                      setBlogTitle(draft.title); 
                      setBlogCategory(draft.category); 
                      setBlogDraft(draft.content); 
                      setBlogImageUrls(draft.image_urls || []);
                      setSelectedImageUrl(draft.image_urls && draft.image_urls.length > 0 ? draft.image_urls[0] : "");
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${blogTitle === draft.title ? 'border-metallic-gold bg-metallic-gold/10' : 'border-mercury/20 hover:border-mercury/50'}`}
                  >
                    <div className="flex justify-between items-start mb-2 group/title">
                      <h4 className="font-bold text-white mb-1 leading-snug pr-4">{draft.title}</h4>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to discard this draft?")) {
                            setHfDrafts(prev => prev.filter(d => d.id !== draft.id));
                            if (blogTitle === draft.title) {
                              setBlogTitle(""); setBlogCategory(""); setBlogDraft(""); setBlogImageUrls([]); setSelectedImageUrl("");
                            }
                          }
                        }}
                        className="text-mercury/20 hover:text-red-500 transition-colors p-1"
                        title="Discard Draft"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-aurora-teal bg-aurora-teal/10 px-2 py-1 rounded">{draft.category}</span>
                        {draft.image_urls && draft.image_urls.length > 0 ? (
                          <span className="text-[10px] bg-metallic-gold/20 text-metallic-gold px-1.5 py-0.5 rounded flex items-center gap-1">🖼️ Has Image</span>
                        ) : (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1">📸 No Image</span>
                        )}
                      </div>
                      <span className="text-[10px] text-mercury/40">Not Approved</span>
                    </div>
                  </div>
                ))}

                {blogSubTab === "approved" && approvedBlogs.map((blog, i) => (
                  <div key={i} className="p-4 rounded-xl border border-mercury/20 flex flex-col justify-between">
                    <h4 className="font-bold text-white mb-2">{blog.title}</h4>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-white bg-white/10 w-max px-2 py-1 rounded">{blog.category}</span>
                      {blog.image_url ? (
                        <span className="text-[10px] bg-metallic-gold/20 text-metallic-gold w-max px-1.5 py-0.5 rounded">🖼️ Has Image</span>
                      ) : (
                        <span className="text-[10px] bg-red-500/20 text-red-400 w-max px-1.5 py-0.5 rounded">📸 No Image</span>
                      )}
                    </div>
                    <button onClick={() => handleRevokeBlog(blog.id)} className="w-full py-2 bg-red-500/20 text-red-500 hover:bg-red-500/40 font-bold rounded text-xs transition-colors">Revoke Live Status</button>
                  </div>
                ))}

                {blogSubTab === "revoked" && revokedBlogs.map((blog, i) => (
                  <div key={i} className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex flex-col justify-between">
                    <div className="cursor-pointer" onClick={() => { 
                      setBlogTitle(blog.title); 
                      setBlogCategory(blog.category); 
                      setBlogDraft(blog.content); 
                      setBlogImageUrls(blog.image_url ? [blog.image_url] : []);
                      setSelectedImageUrl(blog.image_url || "");
                    }}>
                      <h4 className="font-bold text-white mb-2 line-through opacity-50 hover:opacity-100">{blog.title}</h4>
                      <div className="flex items-center gap-2 mb-4">
                        <p className="text-xs text-mercury/40 m-0">Click to edit and republish</p>
                        {blog.image_url ? (
                          <span className="text-[10px] bg-metallic-gold/20 text-metallic-gold w-max px-1.5 py-0.5 rounded">🖼️ Has Image</span>
                        ) : (
                          <span className="text-[10px] bg-red-500/20 text-red-400 w-max px-1.5 py-0.5 rounded">📸 No Image</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteBlog(blog.id)} className="w-full py-2 bg-red-500 text-white hover:bg-red-600 font-bold rounded text-xs transition-colors">Delete Permanently</button>
                  </div>
                ))}

                {((blogSubTab === "new" || blogSubTab === "old") && hfDrafts.length === 0) && (
                  <div className="text-center p-8 border border-dashed border-mercury/20 rounded-xl text-mercury/40">
                    No drafts pending in this category.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col">
              <h3 className="text-lg font-bold mb-4">Step 2: Review & Publish</h3>
              
              <div className="mb-4">
                <span className="text-xs text-mercury/50 mb-2 block uppercase tracking-widest font-bold">Cover Image URL</span>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={selectedImageUrl} 
                    onChange={(e) => setSelectedImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 bg-[#111] border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold text-xs"
                  />
                  <label className="cursor-pointer bg-mercury/10 hover:bg-mercury/20 text-white rounded-lg px-4 flex items-center transition-colors">
                    <span className="text-xs font-bold whitespace-nowrap">Local File</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setSelectedImageUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                </div>
                <div className="flex justify-end mb-2">
                  <button 
                    onClick={() => setBlogDraft(prev => prev + `\n\n![Image](${selectedImageUrl})\n`)}
                    disabled={!selectedImageUrl}
                    className="text-[10px] text-metallic-gold hover:text-white bg-metallic-gold/10 hover:bg-metallic-gold/20 px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <ImagePlus size={12} /> Insert Selected Image Into Article Content
                  </button>
                </div>
                
                {blogImageUrls.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-mercury/20 mt-2">
                    {blogImageUrls.map((url, i) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedImageUrl(url)}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${selectedImageUrl === url ? 'border-aurora-teal scale-105 shadow-[0_0_15px_rgba(45,212,191,0.3)] z-10' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      >
                        <img src={url} alt="Cover option" className="h-20 w-32 object-cover" />
                        {selectedImageUrl === url && (
                          <div className="absolute top-1 right-1 bg-aurora-teal text-black p-0.5 rounded-full">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input 
                type="text" 
                value={blogTitle} 
                onChange={(e) => setBlogTitle(e.target.value)}
                placeholder="Article Title..."
                className="bg-[#111] border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold mb-3 w-full"
              />
              <input 
                type="text" 
                value={blogCategory} 
                onChange={(e) => setBlogCategory(e.target.value)}
                placeholder="Category (e.g. Tactical Analysis)"
                className="bg-[#111] border border-mercury/20 rounded-lg p-3 text-white focus:border-metallic-gold mb-4 w-full"
              />

              <textarea
                value={blogDraft}
                onChange={(e) => setBlogDraft(e.target.value)}
                className="flex-1 w-full bg-[#111] border border-mercury/20 rounded-lg p-4 text-mercury font-mono text-sm resize-none focus:border-metallic-gold transition-colors mb-4"
                placeholder="Your Markdown draft will appear here..."
              />
              <button 
                onClick={handlePublishBlog}
                disabled={!blogDraft || !blogTitle}
                className="py-3 bg-metallic-gold text-black font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-400"
              >
                Publish Article Live
              </button>
            </div>
          </div>
        )}

        {activeAdminTab === "devops" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
             <div className="bg-black border border-mercury/20 rounded-xl overflow-hidden flex flex-col font-mono relative">
              <div className="bg-[#111] px-4 py-2 border-b border-mercury/10 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-xs text-mercury/50 hidden sm:block">Real-Time Server Terminal</span>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-mercury/50" />
                  <input
                    type="text"
                    placeholder="Search logs/user..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="bg-black border border-mercury/20 rounded-full py-1 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-mercury/50"
                  />
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto text-xs space-y-1 bg-black text-green-400">
                {serverLogs.filter(l => l.message.toLowerCase().includes(logSearchQuery.toLowerCase())).map((log, i) => (
                  <div key={i} className={log.type === "error" ? "text-red-400" : log.type === "warn" ? "text-yellow-400" : ""}>
                    <span className="text-mercury/50">[{new Date(log.time).toLocaleTimeString()}]</span> {log.message}
                  </div>
                ))}
                {serverLogs.filter(l => l.message.toLowerCase().includes(logSearchQuery.toLowerCase())).length === 0 && logSearchQuery && (
                   <div className="text-mercury/40">No logs found matching "{logSearchQuery}"</div>
                )}
                <div className="animate-pulse text-mercury mt-2">_</div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col h-full">
                <h3 className="text-lg font-bold mb-4 flex items-center"><Database className="mr-2 text-aurora-teal" /> Interactive SQL Console</h3>
                <p className="text-sm text-mercury/60 mb-4">Execute raw queries against the production CockroachDB instance.</p>
                <textarea 
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM users LIMIT 10;" 
                  className="flex-1 w-full bg-[#111] border border-mercury/20 rounded-lg p-3 text-mercury font-mono text-sm resize-none focus:border-aurora-teal transition-colors mb-4" 
                />
                <button onClick={handleSqlExecute} className="py-3 w-full bg-aurora-teal/20 text-aurora-teal border border-aurora-teal/30 font-bold rounded-lg hover:bg-aurora-teal hover:text-black transition-all mb-4">Execute Raw Query</button>
                {sqlResult && (
                  <div className="bg-black border border-mercury/20 rounded-lg p-3 overflow-auto max-h-48">
                    {sqlResult.error ? (
                      <div className="text-red-400 font-mono text-xs">{sqlResult.error}</div>
                    ) : (
                      <pre className="text-green-400 font-mono text-xs">{JSON.stringify(sqlResult.rows, null, 2)}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === "canary" && (
          <div className="bg-black/40 border border-mercury/10 p-8 rounded-xl max-w-4xl">
            <h3 className="text-xl font-bold mb-2 flex items-center"><GitBranch className="mr-3 text-purple-400" /> Canary Cohort Controls</h3>
            <p className="text-sm text-mercury/60 mb-8">Granularly deploy experimental features to specific user cohorts or admin groups in real-time.</p>
            
            <div className="space-y-6">
              <div className="bg-[#111] border border-mercury/10 p-5 rounded-lg flex items-center justify-between hover:bg-white/5 transition-colors">
                <div>
                  <h4 className="font-bold text-white mb-1">Visual Stories Beta</h4>
                  <p className="text-xs text-mercury/50">Target: High Activity Users & Ambassadors</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-xs font-bold ${canary.visualStories ? 'text-green-400' : 'text-mercury/40'}`}>{canary.visualStories ? 'DEPLOYED' : 'INACTIVE'}</span>
                  <input type="checkbox" checked={canary.visualStories} onChange={(e) => { setCanary({...canary, visualStories: e.target.checked}); handleAIOpsUpdate('canary', { feature: 'visualStories', value: e.target.checked }); }} className="w-6 h-6 accent-purple-500 cursor-pointer" />
                </div>
              </div>

              <div className="bg-[#111] border border-mercury/10 p-5 rounded-lg flex items-center justify-between hover:bg-white/5 transition-colors">
                <div>
                  <h4 className="font-bold text-white mb-1">Match Twin Tool</h4>
                  <p className="text-xs text-mercury/50">Target: Internal Admins Only</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-xs font-bold ${canary.matchTwin ? 'text-green-400' : 'text-mercury/40'}`}>{canary.matchTwin ? 'DEPLOYED' : 'INACTIVE'}</span>
                  <input type="checkbox" checked={canary.matchTwin} onChange={(e) => { setCanary({...canary, matchTwin: e.target.checked}); handleAIOpsUpdate('canary', { feature: 'matchTwin', value: e.target.checked }); }} className="w-6 h-6 accent-purple-500 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeAdminTab === "secops" && (
          <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl h-[calc(100vh-12rem)] flex flex-col">
            <h3 className="text-lg font-bold mb-6 flex items-center"><Eye className="mr-2 text-red-400" /> Cryptographic Audit Trail</h3>
            <div className="flex-1 overflow-auto border border-mercury/10 rounded-lg">
              <table className="w-full text-left text-sm text-mercury/80">
                <thead className="text-xs uppercase text-mercury/50 border-b border-mercury/10 bg-black/60 sticky top-0">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-xs font-mono">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold">{log.action}</td>
                      <td className="py-3 px-4 font-mono text-xs text-blue-300">{log.ip_address}</td>
                      <td className="py-3 px-4 text-xs truncate max-w-[200px] text-mercury/60" title={log.user_agent}>{log.user_agent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeAdminTab === "badges" && (
          <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col h-[calc(100vh-12rem)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center"><Award className="mr-2 text-metallic-gold" /> Pro Badge Editor</h3>
              <div className="flex space-x-4">
                <button 
                  onClick={() => {
                    const newId = "new_badge_" + Date.now();
                    setEditableBadges(prev => ({
                      ...prev,
                      [newId]: {
                        id: newId,
                        name: "New Badge",
                        category: "General",
                        description: "Description here",
                        targets: [1, 10, 50, 100, 500],
                        thresholds: ["1 action", "10 actions", "50 actions", "100 actions", "500 actions"],
                        icon: "Award"
                      }
                    }));
                    setEditingBadgeId(newId);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center transition-colors text-sm font-bold"
                >
                  <Plus size={16} className="mr-2" /> Add Badge
                </button>
                <button 
                  onClick={handleSaveBadgesConfig}
                  disabled={isSavingBadges}
                  className="px-4 py-2 bg-metallic-gold hover:brightness-110 text-black rounded-lg flex items-center transition-all text-sm font-bold disabled:opacity-50"
                >
                  <Save size={16} className="mr-2" /> {isSavingBadges ? "Deploying..." : "Deploy Config"}
                </button>
              </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
              <div className="w-1/3 overflow-y-auto border border-mercury/10 rounded-lg p-2 bg-black/50">
                {Object.values(editableBadges).map(badge => (
                  <div 
                    key={badge.id}
                    onClick={() => setEditingBadgeId(badge.id)}
                    className={`p-3 rounded-lg mb-2 cursor-pointer border transition-colors ${editingBadgeId === badge.id ? 'bg-metallic-gold/10 border-metallic-gold text-white' : 'bg-transparent border-transparent hover:bg-white/5 text-mercury/80'}`}
                  >
                    <div className="font-bold text-sm">{badge.name}</div>
                    <div className="text-xs opacity-60 truncate">{badge.category}</div>
                  </div>
                ))}
              </div>

              {editingBadgeId && editableBadges[editingBadgeId] ? (
                <div className="w-2/3 overflow-y-auto border border-mercury/10 rounded-lg p-6 bg-black/50 space-y-6">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Internal ID</label>
                    <input 
                      type="text" 
                      value={editableBadges[editingBadgeId].id}
                      onChange={(e) => {
                        const newId = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setEditableBadges(prev => {
                          const newBadges = { ...prev };
                          const oldBadge = newBadges[editingBadgeId];
                          delete newBadges[editingBadgeId];
                          newBadges[newId] = { ...oldBadge, id: newId };
                          setEditingBadgeId(newId);
                          return newBadges;
                        });
                      }}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Badge Name</label>
                    <input 
                      type="text" 
                      value={editableBadges[editingBadgeId].name}
                      onChange={(e) => setEditableBadges(prev => ({...prev, [editingBadgeId]: {...prev[editingBadgeId], name: e.target.value}}))}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Icon (Lucide name or URL)</label>
                    <input 
                      type="text" 
                      value={(editableBadges[editingBadgeId].icon || 'Award').split('|')[0]}
                      onChange={(e) => {
                        const parts = (editableBadges[editingBadgeId].icon || 'Award').split('|');
                        const newEvent = parts[1] ? `|${parts[1]}` : '';
                        setEditableBadges(prev => ({...prev, [editingBadgeId]: {...prev[editingBadgeId], icon: e.target.value + newEvent}}));
                      }}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none"
                      placeholder="e.g. Shield, Zap, or https://example.com/icon.svg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-metallic-gold mb-2">Dynamic Event Trigger (Engine)</label>
                    <select
                      value={(editableBadges[editingBadgeId].icon || 'Award').split('|')[1] || ''}
                      onChange={(e) => {
                        const iconPart = (editableBadges[editingBadgeId].icon || 'Award').split('|')[0];
                        const newEvent = e.target.value ? `|${e.target.value}` : '';
                        setEditableBadges(prev => ({...prev, [editingBadgeId]: {...prev[editingBadgeId], icon: iconPart + newEvent}}));
                      }}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none"
                    >
                      <option value="">No trigger (Manual only)</option>
                      <option value="vote_cast">Debate Vote Cast (vote_cast)</option>
                      <option value="prediction_made">Prediction Made (prediction_made)</option>
                      <option value="prediction_won">Prediction Won (prediction_won)</option>
                      <option value="profile_visit">Profile Visited (profile_visit)</option>
                      <option value="coin_spent">Coins Spent (coin_spent)</option>
                      <option value="daily_login">Daily Login (daily_login)</option>
                    </select>
                    <p className="text-[10px] text-mercury/50 mt-1">If selected, the Engine will automatically level up this badge whenever this action occurs.</p>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Category</label>
                    <input 
                      type="text" 
                      value={editableBadges[editingBadgeId].category}
                      onChange={(e) => setEditableBadges(prev => ({...prev, [editingBadgeId]: {...prev[editingBadgeId], category: e.target.value}}))}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Description</label>
                    <textarea 
                      value={editableBadges[editingBadgeId].description}
                      onChange={(e) => setEditableBadges(prev => ({...prev, [editingBadgeId]: {...prev[editingBadgeId], description: e.target.value}}))}
                      rows={3}
                      className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-metallic-gold outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-4">Stage Configurations (Target and Display Label)</label>
                    <div className="space-y-3">
                      {['Bronze (1)', 'Silver (2)', 'Gold (3)', 'Diamond (4)', 'Legendary (5)'].map((label, idx) => (
                        <div key={idx} className="flex items-center space-x-4">
                          <span className="w-24 text-xs font-bold text-mercury/80">{label}</span>
                          <input 
                            type="number" 
                            placeholder="Target"
                            value={(editableBadges[editingBadgeId] as any).targets?.[idx] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setEditableBadges(prev => {
                                const newBadges = { ...prev };
                                const newTargets = [...((newBadges[editingBadgeId] as any).targets || [1, 2, 3, 4, 5])];
                                newTargets[idx] = val;
                                newBadges[editingBadgeId] = { 
                                  ...newBadges[editingBadgeId], 
                                  targets: newTargets
                                } as any;
                                return newBadges;
                              });
                            }}
                            className="w-24 bg-black border border-mercury/20 rounded p-2 text-white text-sm focus:border-metallic-gold outline-none text-center"
                          />
                          <input 
                            type="text" 
                            placeholder="Display Label"
                            value={editableBadges[editingBadgeId].thresholds[idx]}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setEditableBadges(prev => {
                                const newBadges = { ...prev };
                                const newThresholds = [...newBadges[editingBadgeId].thresholds];
                                newThresholds[idx] = newVal;
                                newBadges[editingBadgeId] = { ...newBadges[editingBadgeId], thresholds: newThresholds as [string,string,string,string,string] };
                                return newBadges;
                              });
                            }}
                            className="flex-1 bg-black border border-mercury/20 rounded p-2 text-white text-sm focus:border-metallic-gold outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-red-500/20">
                    <button 
                      onClick={async () => {
                        if(window.confirm("Are you sure you want to completely delete this badge from existence?")) {
                          try {
                            const res = await fetch(`/api/admin/badges/${editingBadgeId}`, { method: 'DELETE' });
                            const data = await res.json();
                            if (data.success) {
                              setEditableBadges(prev => {
                                const newBadges = { ...prev };
                                delete newBadges[editingBadgeId];
                                return newBadges;
                              });
                              setEditingBadgeId(null);
                              alert("Badge successfully deleted!");
                            } else {
                              alert("Failed to delete badge: " + data.error);
                            }
                          } catch (err) {
                            alert("Failed to delete badge. Connection error.");
                          }
                        }
                      }}
                      className="flex items-center text-red-500 hover:text-red-400 text-sm font-bold transition-colors"
                    >
                      <Trash2 size={16} className="mr-2" /> Delete Entire Badge
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-2/3 border border-dashed border-mercury/20 rounded-lg flex items-center justify-center text-mercury/40 flex-col">
                  <Award size={48} className="mb-4 opacity-20" />
                  <p>Select a badge to edit or create a new one.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeAdminTab === "engine" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
            {/* Monitor Panel */}
            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col font-mono relative">
              <h3 className="text-xl font-bold mb-4 flex items-center text-aurora-teal"><Zap className="mr-3" /> Live Event Monitor</h3>
              <p className="text-xs text-mercury/50 mb-4">Listening for dynamic events dispatched by the application...</p>
              
              <div className="flex-1 bg-black border border-mercury/20 rounded-lg p-4 overflow-y-auto space-y-2 font-mono text-xs">
                {engineLogs.length === 0 ? (
                  <div className="text-mercury/30 italic text-center mt-10">No events recorded yet. Waiting...</div>
                ) : (
                  engineLogs.map((log, i) => (
                    <div key={i} className={`pb-2 border-b border-mercury/10 ${log.type === 'SUCCESS' ? 'text-green-400' : log.type === 'WARN' ? 'text-yellow-400' : log.type === 'ERROR' ? 'text-red-400' : 'text-mercury/70'}`}>
                      <span className="text-mercury/40 mr-2">[{new Date(log.time).toLocaleTimeString()}]</span>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cheat Mode Panel */}
            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col">
              <h3 className="text-xl font-bold mb-4 flex items-center text-red-500"><Terminal className="mr-3" /> Cheat Mode Simulator</h3>
              <p className="text-sm text-mercury/60 mb-8">Manually trigger events to simulate user actions and test if badges are leveling up correctly.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-mercury/60 mb-2">Simulate Event Type</label>
                  <select
                    value={cheatEvent}
                    onChange={(e) => setCheatEvent(e.target.value)}
                    className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-red-500 outline-none"
                  >
                    <option value="vote_cast">Debate Vote Cast (vote_cast)</option>
                    <option value="prediction_made">Prediction Made (prediction_made)</option>
                    <option value="prediction_won">Prediction Won (prediction_won)</option>
                    <option value="profile_visit">Profile Visited (profile_visit)</option>
                    <option value="coin_spent">Coins Spent (coin_spent)</option>
                    <option value="daily_login">Daily Login (daily_login)</option>
                  </select>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs uppercase tracking-widest text-mercury/60">Target User ID (UUID)</label>
                    {registeredUsers.length > 0 && (
                      <span className="text-[10px] text-aurora-teal/70 font-mono">
                        ({registeredUsers.length} users registered)
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={cheatUser}
                    onChange={(e) => setCheatUser(e.target.value)}
                    placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                    className="w-full bg-black border border-mercury/20 rounded p-3 text-white text-sm focus:border-red-500 outline-none font-mono mb-3"
                  />
                  {registeredUsers.length > 0 && (
                    <div className="bg-black/60 border border-mercury/10 rounded p-3 max-h-[140px] overflow-y-auto space-y-1.5 custom-scrollbar text-xs">
                      <p className="text-[10px] uppercase text-mercury/40 tracking-wider mb-2 font-bold">Quick Select Registered User:</p>
                      {registeredUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setCheatUser(u.id)}
                          className={`w-full text-left px-2 py-1 rounded transition-colors flex justify-between items-center ${cheatUser === u.id ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'hover:bg-white/5 text-mercury/80 border border-transparent'}`}
                        >
                          <span className="font-bold">{u.username || 'Anonymous'}</span>
                          <span className="font-mono text-[10px] opacity-60">{u.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    if (!cheatUser) {
                      alert("Please provide a Target User ID.");
                      return;
                    }
                    setIsSimulating(true);
                    try {
                      const { trackEvent } = await import('../lib/achievementsEngine');
                      // @ts-ignore
                      const { supabase } = await import('../lib/supabase');
                      await trackEvent(supabase, cheatUser, cheatEvent, 1);
                    } catch(e: any) {
                      alert("Simulation failed: " + e.message);
                    }
                    setIsSimulating(false);
                  }}
                  disabled={isSimulating}
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 font-bold tracking-widest uppercase rounded-lg py-4 transition-colors disabled:opacity-50"
                >
                  {isSimulating ? "Simulating..." : "🔥 FIRE EVENT"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
