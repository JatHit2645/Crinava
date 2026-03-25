import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Chrome, Sparkles, Loader2 } from 'lucide-react';
import { signInWithGoogle, sendMagicLink } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, session }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      await sendMagicLink(email);
      setSent(true);
      window.localStorage.setItem('emailForSignIn', email);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="p-8 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                  <Sparkles className="text-aurora-teal" size={24} />
                  Access Crinava
                </h2>
                <p className="text-xs text-gray-500 font-medium">Join the next generation of cricket intelligence.</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{error}</p>
              </div>
            )}

            {sent ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 bg-aurora-teal/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="text-aurora-teal" size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase italic">Check your email</h3>
                  <p className="text-xs text-gray-500">We've sent a magic link to <span className="text-white font-bold">{email}</span>.</p>
                </div>
                <button 
                  onClick={() => setSent(false)}
                  className="text-[10px] text-aurora-teal font-black uppercase tracking-widest hover:underline"
                >
                  Try another email
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Chrome size={18} />}
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.2em] text-gray-600">
                    <span className="bg-[#0A0A0A] px-4">Or use magic link</span>
                  </div>
                </div>

                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-xs focus:outline-none focus:border-aurora-teal/50 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Send Magic Link'}
                  </button>
                </form>
              </div>
            )}

            <div className="pt-4 text-center">
              <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">
                By continuing, you agree to Crinava's Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
