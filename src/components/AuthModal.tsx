import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, LogOut, Chrome, Sparkles } from 'lucide-react';
import { auth, signInWithGoogle, sendMagicLink } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
}

export function AuthModal({ isOpen, onClose, session }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        window.localStorage.setItem('emailForSignIn', email);
        setMessage('Magic link sent! Check your email inbox.');
      } else if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
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
      setError(err.message || 'Failed to initialize Google login.');
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-[#0a0a0a] border border-metallic-gold/10 rounded-2xl shadow-2xl overflow-hidden relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-metallic-gold transition-colors rounded-full hover:bg-metallic-gold/5"
          >
            <X size={20} />
          </button>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black tracking-tighter uppercase mb-2">
                {session ? 'Profile' : isMagicLink ? 'Magic Link' : isSignUp ? 'Join Crinava' : 'Welcome Back'}
              </h2>
              <p className="text-sm text-gray-400">
                {session 
                  ? 'Manage your account' 
                  : isMagicLink
                    ? 'Sign in with a one-time link sent to your email'
                    : isSignUp 
                      ? 'Create an account to track your Cricket IQ' 
                      : 'Sign in to access your predictions and coins'}
              </p>
            </div>

            {session ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="w-20 h-20 bg-aurora-teal/10 rounded-full flex items-center justify-center border border-aurora-teal/30">
                  <Mail size={32} className="text-aurora-teal" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Logged in as</p>
                  <p className="text-lg font-bold text-metallic-gold">{session.user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-metallic-gold text-black hover:bg-metallic-gold/90 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3"
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
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-metallic-gold/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0a0a0a] px-2 text-gray-500 tracking-widest font-bold">Or email</span>
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
                        className="w-full pl-10 pr-4 py-3 bg-metallic-gold/5 border border-metallic-gold/10 rounded-xl focus:outline-none focus:border-aurora-teal/50 text-metallic-gold placeholder-gray-500 transition-colors"
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
                          className="w-full pl-10 pr-4 py-3 bg-metallic-gold/5 border border-metallic-gold/10 rounded-xl focus:outline-none focus:border-aurora-teal/50 text-metallic-gold placeholder-gray-500 transition-colors"
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
                    ) : (
                      isSignUp ? 'Create Account' : 'Sign In'
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
                      className="text-sm text-gray-400 hover:text-metallic-gold transition-colors"
                    >
                      {isSignUp 
                        ? 'Already have an account? Sign in' 
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
                      {isMagicLink ? 'Sign in with password' : 'Sign in with Magic Link (OTP)'}
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
