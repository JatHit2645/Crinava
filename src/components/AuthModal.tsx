import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Lock,
  Loader2,
  LogOut,
  Chrome,
  Sparkles,
  Trophy,
  Wallet,
  Calendar,
  Activity,
  Settings,
  User,
} from "lucide-react";
import { auth, signInWithGoogle, sendMagicLink } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  profile?: any;
}

export function AuthModal({
  isOpen,
  onClose,
  session,
  profile,
}: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isMagicLink) {
        await sendMagicLink(email);
        window.localStorage.setItem("emailForSignIn", email);
        setMessage("Magic link sent! Check your email inbox.");
      } else if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to initialize Google login.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await signOut(auth);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  const userInitials =
    session?.user?.email?.substring(0, 2).toUpperCase() || "US";
  const joinDate = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`w-full ${session ? "max-w-2xl" : "max-w-md"} bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 z-10"
          >
            <X size={20} />
          </button>

          <div className="p-8">
            {!session && (
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">
                  {isMagicLink
                    ? "Magic Link"
                    : isSignUp
                      ? "Join Crinava"
                      : "Welcome Back"}
                </h2>
                <p className="text-sm text-gray-400">
                  {isMagicLink
                    ? "Sign in with a one-time link sent to your email"
                    : isSignUp
                      ? "Create an account to track your Cricket IQ"
                      : "Sign in to access your predictions and coins"}
                </p>
              </div>
            )}

            {session ? (
              <div className="flex flex-col space-y-8">
                {/* Profile Header */}
                <div className="flex items-center gap-6 pb-6 border-b border-white/10">
                  <div className="w-24 h-24 bg-gradient-to-br from-aurora-teal to-blue-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(45,212,191,0.3)] border-4 border-[#0a0a0a]">
                    <span className="text-3xl font-black text-black tracking-tighter">
                      {userInitials}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {session.user.displayName || "Cricket Analyst"}
                    </h2>
                    <p className="text-sm text-aurora-teal font-medium flex items-center gap-2">
                      <Mail size={14} />
                      {session.user.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] uppercase tracking-widest text-gray-400 font-bold flex items-center gap-1">
                        <Calendar size={12} /> Joined {joinDate}
                      </span>
                      <span className="px-2 py-1 bg-aurora-teal/10 border border-aurora-teal/20 rounded text-[10px] uppercase tracking-widest text-aurora-teal font-bold flex items-center gap-1">
                        <Activity size={12} /> Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4 hover:bg-white/[0.04] transition-colors">
                    <div className="p-3 bg-metallic-gold/10 rounded-lg">
                      <Trophy size={24} className="text-metallic-gold" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
                        Cricket IQ
                      </p>
                      <p className="text-2xl font-black text-white">
                        {profile?.cricket_iq || 100}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4 hover:bg-white/[0.04] transition-colors">
                    <div className="p-3 bg-aurora-teal/10 rounded-lg">
                      <Wallet size={24} className="text-aurora-teal" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
                        Crinava Coins
                      </p>
                      <p className="text-2xl font-black text-white">
                        {profile?.crinava_coins || 500}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="space-y-3">
                  <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">
                    Account Settings
                  </h3>
                  <button className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-between transition-colors group">
                    <div className="flex items-center gap-3 text-gray-300 group-hover:text-white">
                      <User size={18} />
                      <span className="font-medium text-sm">
                        Edit Profile Details
                      </span>
                    </div>
                    <Settings
                      size={16}
                      className="text-gray-500 group-hover:text-white transition-colors"
                    />
                  </button>
                  <button
                    onClick={handleSignOut}
                    disabled={loading}
                    className="w-full p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3 text-red-400 group-hover:text-red-300">
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <LogOut size={18} />
                      )}
                      <span className="font-medium text-sm">
                        Sign Out Securely
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-white text-black hover:bg-gray-100 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0a0a0a] px-2 text-gray-500 tracking-widest font-bold">
                      Or email
                    </span>
                  </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                  {message && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm text-center">
                      {message}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={18} className="text-gray-500" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aurora-teal/50 text-white placeholder-gray-500 transition-colors"
                        placeholder="Email address"
                      />
                    </div>

                    {!isMagicLink && (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock size={18} className="text-gray-500" />
                        </div>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aurora-teal/50 text-white placeholder-gray-500 transition-colors"
                          placeholder="Password"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-aurora-teal hover:bg-aurora-teal/90 text-black rounded-xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : isMagicLink ? (
                      <>
                        <Sparkles size={20} />
                        Send Magic Link
                      </>
                    ) : isSignUp ? (
                      "Create Account"
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  <div className="flex flex-col gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setIsMagicLink(false);
                        setError(null);
                        setMessage(null);
                      }}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {isSignUp
                        ? "Already have an account? Sign in"
                        : "Don't have an account? Sign up"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMagicLink(!isMagicLink);
                        setIsSignUp(false);
                        setError(null);
                        setMessage(null);
                      }}
                      className="text-sm text-aurora-teal/70 hover:text-aurora-teal transition-colors"
                    >
                      {isMagicLink
                        ? "Sign in with password"
                        : "Sign in with Magic Link (OTP)"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
