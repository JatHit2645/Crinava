import React, { useState, useEffect } from "react";
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loginStep, setLoginStep] = useState<"password" | "totp" | "telegram">(
    "password",
  );
  const [error, setError] = useState("");
  const [activeAdminTab, setActiveAdminTab] = useState("dashboard");
  const [sessionTimeLeft, setSessionTimeLeft] = useState(60);
  
  // Forms state
  const [debateTopic, setDebateTopic] = useState("");
  const [blogTopic, setBlogTopic] = useState("");
  const [blogDraft, setBlogDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated && activeAdminTab === "dashboard") {
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
      const interval = setInterval(fetchTelemetry, 3000);
      return () => clearInterval(interval);
    }
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
      // Basic client-side check, actual verification happens on the server next
      if (password === "crinava_admin_secure") {
        setLoginStep("totp");
      } else {
        setError("Invalid credentials");
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
    }
  };

  const handleGenerateBlog = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/admin/blog/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: blogTopic })
      });
      const data = await res.json();
      setBlogDraft(data.draft || "Error generating draft from AI.");
    } catch (e) {
      setBlogDraft("Failed to connect to the backend AI engine.");
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
      const res = await fetch("/api/admin/blog/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: blogTopic, draft: blogDraft })
      });
      const data = await res.json();
      if (data.success) {
        alert("Blog published live!");
        setBlogDraft("");
        setBlogTopic("");
      }
    } catch (e) {
      alert("Failed to publish blog.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] text-white p-4 font-space">
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
              </div>
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
                {loginStep === "password" ? "Verify Identity" : "Submit Token"}
              </button>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white font-space flex">
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
        <button onClick={() => setActiveAdminTab("terminal")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeAdminTab === "terminal" ? "bg-metallic-gold/10 text-metallic-gold border border-metallic-gold/20" : "text-mercury/70 hover:bg-white/5"}`}>
          <Terminal size={20} />
          <span>Server Terminal</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-bold uppercase tracking-wider text-mercury">
            {activeAdminTab === "dashboard" && "System Telemetry"}
            {activeAdminTab === "debate" && "Live Debate Deployment"}
            {activeAdminTab === "blog" && "AI-Assisted Publishing"}
            {activeAdminTab === "terminal" && "DevOps Console"}
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
            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col">
              <h3 className="text-lg font-bold mb-4 flex items-center"><Zap className="mr-2 text-metallic-gold" /> Step 1: AI Generation</h3>
              <p className="text-sm text-mercury/60 mb-4">Enter a topic or select a recent match to have the AI draft a comprehensive, SEO-optimized blog post.</p>
              <textarea
                value={blogTopic}
                onChange={(e) => setBlogTopic(e.target.value)}
                className="w-full h-32 bg-black/60 border border-mercury/20 rounded-lg p-4 text-white resize-none focus:border-metallic-gold transition-colors mb-4"
                placeholder="Topic: Analyze Rohit Sharma's tactical field placements in today's match..."
              />
              <button 
                onClick={handleGenerateBlog} 
                disabled={isGenerating || !blogTopic}
                className="py-3 bg-white/5 border border-mercury/20 text-white font-medium rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {isGenerating ? "AI is writing..." : "Generate AI Draft"}
              </button>
            </div>

            <div className="bg-black/40 border border-mercury/10 p-6 rounded-xl flex flex-col">
              <h3 className="text-lg font-bold mb-4">Step 2: The Manual Touch</h3>
              <p className="text-sm text-mercury/60 mb-4">Review and edit the Markdown draft below before publishing to the live site.</p>
              <textarea
                value={blogDraft}
                onChange={(e) => setBlogDraft(e.target.value)}
                className="flex-1 w-full bg-[#111] border border-mercury/20 rounded-lg p-4 text-mercury font-mono text-sm resize-none focus:border-metallic-gold transition-colors mb-4"
                placeholder="Your Markdown draft will appear here..."
              />
              <button 
                onClick={handlePublishBlog}
                disabled={!blogDraft}
                className="py-3 bg-metallic-gold text-black font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-400"
              >
                Publish Article Live
              </button>
            </div>
          </div>
        )}

        {activeAdminTab === "terminal" && (
          <div className="bg-black border border-mercury/20 rounded-xl h-[calc(100vh-12rem)] overflow-hidden flex flex-col font-mono">
            <div className="bg-[#111] px-4 py-2 border-b border-mercury/10 flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-xs text-mercury/50">root@oracle-vm-mumbai:~#</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-sm space-y-1">
              <div className="text-green-400">crinava@system:~$ tail -f /var/log/nginx/access.log</div>
              <div className="text-mercury/70">127.0.0.1 - - [24/Jun/2026:00:15:32 +0530] "GET /api/matches HTTP/1.1" 200 1452 "-" "Mozilla/5.0"</div>
              <div className="text-mercury/70">127.0.0.1 - - [24/Jun/2026:00:15:33 +0530] "GET /api/scorecard/101 HTTP/1.1" 200 894 "-" "Mozilla/5.0" <span className="text-yellow-400">[CACHE HIT]</span></div>
              <div className="text-mercury/70">127.0.0.1 - - [24/Jun/2026:00:15:35 +0530] "POST /api/predict HTTP/1.1" 200 452 "-" "Mozilla/5.0"</div>
              <div className="text-blue-400 mt-4">[SYSTEM] PostgreSQL Database connection stable. Pool size: 10/20.</div>
              <div className="text-green-400 mt-4">[SYSTEM] AI Engine Worker 'INDvPAK' initialized successfully.</div>
              <div className="animate-pulse text-mercury mt-2">_</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
