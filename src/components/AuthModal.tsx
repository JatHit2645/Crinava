import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
}

/**
 * Renders a Google sign-in icon as an SVG element.
 * @example
 * GoogleIcon()
 * <svg>...</svg>
 * @returns {JSX.Element} The Google icon SVG markup.
 **/
const GoogleLogo = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

/**
 * Renders an authentication modal that supports Google sign-in and email magic link sign-in.
 * @example
 * AuthModal({ isOpen: true, onClose: () => {}, session: null })
 * undefined
 * @param {{boolean}} isOpen - Controls whether the modal is visible.
 * @param {{() => void}} onClose - Callback invoked to close the modal.
 * @param {{any}} session - Current authenticated session; closes the modal when present.
 * @returns {{JSX.Element | null}} The authentication modal UI, or null when closed.
 **/
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && isOpen) {
      onClose();
    }
  }, [session, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const formatError = (err: any) => {
    const message = err.message || String(err);
    if (message.includes("auth/popup-closed-by-user"))
      return "Authentication cancelled";
    if (message.includes("auth/cancelled-popup-request"))
      return "Authentication cancelled";
    if (message.includes("auth/network-request-failed"))
      return "Network error. Please check your connection.";
    return "Login failed. Please try again.";
  };

  /**
  * Initiates Google OAuth sign-in through Supabase and handles loading, error, and modal close state.
  * @example
  * sync()
  * void
  * @returns {Promise<void>} A promise that resolves after the sign-in attempt completes.
  **/
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      onClose();
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles email sign-in via Supabase OTP, sets loading and error states, and stores the email on success.
   * @example
   * sync(event)
   * void
   * @param {React.FormEvent} e - The form submission event to prevent default behavior.
   * @returns {void} No return value.
   **/
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
      window.localStorage.setItem("emailForSignIn", email);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-cmd-bg/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-cmd-bg border border-cmd-border rounded-[40px] overflow-hidden shadow-2xl relative"
        >
          <div className="p-8 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-cmd-text-primary uppercase italic tracking-tighter flex items-center gap-2">
                  <Sparkles className="text-cmd-cyan" size={24} />
                  {isSignUp ? "Join Crinava" : "Welcome Back"}
                </h2>
                <p className="text-xs text-cmd-text-muted font-medium">
                  {isSignUp
                    ? "Step into the future of cricket intelligence."
                    : "Continue your journey in the ecosystem."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-cmd-surface-hover/50 rounded-xl transition-colors text-cmd-text-secondary hover:text-cmd-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-cmd-crimson/10 border border-cmd-crimson/20 rounded-2xl"
              >
                <p className="text-[10px] text-cmd-crimson font-black uppercase tracking-widest text-center">
                  {error}
                </p>
              </motion.div>
            )}

            {sent ? (
              <div className="space-y-6 text-center py-8">
                <div className="size-16 bg-cmd-cyan/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="text-cmd-cyan" size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-cmd-text-primary uppercase italic">
                    Check your email
                  </h3>
                  <p className="text-xs text-cmd-text-muted">
                    We've sent a magic link to{" "}
                    <span className="text-cmd-text-primary font-bold">
                      {email}
                    </span>
                    .
                  </p>
                </div>
                <button
                  onClick={() => setSent(false)}
                  className="text-[10px] text-cmd-cyan font-black uppercase tracking-widest hover:underline"
                >
                  Try another email
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-4 bg-white text-cmd-bg rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-cmd-cyan/10 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <GoogleLogo />
                  )}
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-cmd-border/50"></div>
                  </div>
                  <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.2em] text-cmd-text-muted">
                    <span className="bg-cmd-bg px-4">Or use magic link</span>
                  </div>
                </div>

                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-cmd-text-muted font-black uppercase tracking-widest ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-cmd-text-muted"
                        size={16}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-cmd-surface-hover/50 border border-cmd-border rounded-2xl py-4 pl-12 pr-4 text-cmd-text-primary text-xs focus:outline-none focus:border-cmd-border-light/50 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full py-4 bg-cmd-surface-hover/50 border border-cmd-border text-cmd-text-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-cmd-surface-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        {isSignUp ? "Create Account" : "Sign In"}
                        <ArrowRight size={14} className="text-cmd-cyan" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center space-y-4">
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    {isSignUp ? (
                      <span className="text-cmd-text-muted">
                        Already a member?{" "}
                        <span className="text-cmd-cyan hover:text-cmd-text-primary">
                          Sign In
                        </span>
                      </span>
                    ) : (
                      <span className="text-cmd-text-muted">
                        New to Crinava?{" "}
                        <span className="text-cmd-cyan hover:text-cmd-text-primary">
                          Create Account
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 text-center">
              <p className="text-[8px] text-cmd-text-muted font-black uppercase tracking-widest">
                By continuing, you agree to Crinava's Terms of Service and
                Privacy Policy.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
