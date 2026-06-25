import React, { useState, useEffect, useRef } from "react";
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
  Settings
} from "lucide-react";
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
  
  // Forms state
  const [debateTopic, setDebateTopic] = useState("");
  const [blogTitle, setBlogTitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("Tactical Analysis");
  const [blogDraft, setBlogDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hfDrafts, setHfDrafts] = useState<any[]>([]);
  const [blogSubTab, setBlogSubTab] = useState<"new" | "old" | "approved" | "revoked">("new");
  const [approvedBlogs, setApprovedBlogs] = useState<any[]>([]);
  const [revokedBlogs, setRevokedBlogs] = useState<any[]>([]);
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
    try {
      const res = await fetch("/api/admin/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: debateTopic })
      });
      const data = await res.json();
      if (data.success) {
        alert("Debate published to main website instantly!");
        setDebateTopic("");
      }
    } catch (e) {
      alert("Failed to publish debate.");
    }
  };

  const handlePublishBlog = async () => {
    try {
      const res = await fetch("/api/admin/blog-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: blogTitle, category: blogCategory, content: blogDraft })
      });
      const data = await res.json();
      if (data.success) {
        alert("Blog published live!");
        setHfDrafts(prev => prev.filter(d => d.title !== blogTitle));
        fetch("/api/blogs").then(r => r.json()).then(d => setApprovedBlogs(d));
        setBlogDraft("");
        setBlogTitle("");
      }
    } catch (e) {
      alert("Failed to publish blog.");
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
                  onClick={() => setLoginStep("magic_code")}
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
          <div className="bg-black/40 border border-mercury/10 p-8 rounded-xl max-w-3xl">
            <h3 className="text-xl font-bold mb-6 flex items-center"><MessageSquare className="mr-3 text-metallic-gold" /> Deploy New Debate</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-mercury/70 mb-2">Debate Topic / Claim</label>
                <input
                  type="text"
                  value={debateTopic}
                  onChange={(e) => setDebateTopic(e.target.value)}
                  className="w-full bg-black/60 border border-mercury/20 rounded-lg p-4 text-white focus:border-metallic-gold transition-colors"
                  placeholder="e.g. Jasprit Bumrah is the greatest T20 bowler of all time."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-mercury/70 mb-2">Tag 1</label>
                  <input type="text" className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white" placeholder="e.g. T20" />
                </div>
                <div>
                  <label className="block text-sm text-mercury/70 mb-2">Tag 2</label>
                  <input type="text" className="w-full bg-black/60 border border-mercury/20 rounded-lg p-3 text-white" placeholder="e.g. Bowling" />
                </div>
              </div>
              <button onClick={handlePublishDebate} className="flex items-center justify-center space-x-2 w-full py-4 bg-metallic-gold text-black font-bold rounded-lg hover:brightness-110 transition-all">
                <Send size={18} />
                <span>Broadcast to All Users Instantly</span>
              </button>
            </div>
          </div>
        )}

        {activeAdminTab === "blog" && (
          <div className="grid grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col overflow-y-auto">
              <h3 className="text-lg font-bold mb-4 flex items-center"><Zap className="mr-2 text-metallic-gold" /> AI Blog Management</h3>
              
              <div className="flex space-x-2 mb-6 bg-[#111] p-1 rounded-lg">
                <button onClick={() => setBlogSubTab("new")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "new" ? "bg-aurora-teal text-black" : "text-mercury/60"}`}>New Drafts</button>
                <button onClick={() => setBlogSubTab("old")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "old" ? "bg-metallic-gold text-black" : "text-mercury/60"}`}>Old Drafts</button>
                <button onClick={() => setBlogSubTab("approved")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "approved" ? "bg-white text-black" : "text-mercury/60"}`}>Approved</button>
                <button onClick={() => setBlogSubTab("revoked")} className={`flex-1 py-2 text-xs font-bold rounded ${blogSubTab === "revoked" ? "bg-red-500 text-white" : "text-mercury/60"}`}>Revoked</button>
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
                    onClick={() => { setBlogTitle(draft.title); setBlogCategory(draft.category); setBlogDraft(draft.content); }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${blogTitle === draft.title ? 'border-metallic-gold bg-metallic-gold/10' : 'border-mercury/20 hover:border-mercury/50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white mb-1 leading-snug">{draft.title}</h4>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-bold text-aurora-teal bg-aurora-teal/10 px-2 py-1 rounded">{draft.category}</span>
                      <span className="text-[10px] text-mercury/40">Not Approved</span>
                    </div>
                  </div>
                ))}

                {blogSubTab === "approved" && approvedBlogs.map((blog, i) => (
                  <div key={i} className="p-4 rounded-xl border border-mercury/20 flex flex-col justify-between">
                    <h4 className="font-bold text-white mb-2">{blog.title}</h4>
                    <span className="text-xs text-white bg-white/10 w-max px-2 py-1 rounded mb-4">{blog.category}</span>
                    <button onClick={() => handleRevokeBlog(blog.id)} className="w-full py-2 bg-red-500/20 text-red-500 hover:bg-red-500/40 font-bold rounded text-xs transition-colors">Revoke Live Status</button>
                  </div>
                ))}

                {blogSubTab === "revoked" && revokedBlogs.map((blog, i) => (
                  <div key={i} className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex flex-col justify-between">
                    <div className="cursor-pointer" onClick={() => { setBlogTitle(blog.title); setBlogCategory(blog.category); setBlogDraft(blog.content); }}>
                      <h4 className="font-bold text-white mb-2 line-through opacity-50 hover:opacity-100">{blog.title}</h4>
                      <p className="text-xs text-mercury/40 mb-4">Click to edit and republish</p>
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
      </div>
    </div>
  );
};
