import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Check, X, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface UsernameSetupProps {
  isOpen: boolean;
  onComplete: (username: string) => void;
}

export const UsernameSetup: React.FC<UsernameSetupProps> = ({ isOpen, onComplete }) => {
  const [username, setUsername] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = React.useRef(new Map<string, boolean>());

  useEffect(() => {
    if (username.length < 3) {
      setIsAvailable(null);
      return;
    }

    const checkAvailability = async () => {
      const lowerUsername = username.toLowerCase();
      if (cache.current.has(lowerUsername)) {
        setIsAvailable(cache.current.get(lowerUsername)!);
        return;
      }

      setChecking(true);
      try {
        const { data, error } = await supabase
          .from('usernames')
          .select('id')
          .eq('id', lowerUsername)
          .maybeSingle();
        
        const available = !data;
        cache.current.set(lowerUsername, available);
        setIsAvailable(available);
      } catch (err) {
        console.error('Error checking username availability:', err);
      } finally {
        setChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !isAvailable) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const userId = user.id;
      const lowerUsername = username.toLowerCase();

      // 1. Create username mapping
      const { error: usernameError } = await supabase
        .from('usernames')
        .insert({ id: lowerUsername, uid: userId });
      
      if (usernameError) throw usernameError;

      // 2. Create/Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: user.email,
          username: username,
          cricket_iq: 100,
          crinava_coins: 500,
          career_path: 'Rookie',
          expertise_badge: 'Novice',
          professional_comparison: {
            match: 'Unranked',
            similarity: 0
          },
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      onComplete(username);
    } catch (err: any) {
      console.error('Failed to set username:', err);
      setError(err.message || 'Failed to set username. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
        >
          <div className="p-8 space-y-8">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 bg-aurora-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="text-aurora-teal" size={32} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                Claim Your Identity
              </h2>
              <p className="text-xs text-gray-500 font-medium tracking-wide">
                Choose a unique username to start your Crinava career.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="cricket_pro_99"
                    className={`w-full bg-white/5 border rounded-2xl py-5 pl-12 pr-12 text-white text-sm font-bold focus:outline-none transition-all ${
                      isAvailable === true ? 'border-green-500/50 focus:border-green-500' : 
                      isAvailable === false ? 'border-red-500/50 focus:border-red-500' : 
                      'border-white/10 focus:border-aurora-teal/50'
                    }`}
                    maxLength={20}
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checking ? (
                      <Loader2 className="animate-spin text-gray-600" size={18} />
                    ) : isAvailable === true ? (
                      <Check className="text-green-500" size={18} />
                    ) : isAvailable === false ? (
                      <X className="text-red-500" size={18} />
                    ) : null}
                  </div>
                </div>
                <div className="flex justify-between px-1">
                  <p className={`text-[9px] font-black uppercase tracking-widest ${
                    isAvailable === true ? 'text-green-500' : 
                    isAvailable === false ? 'text-red-500' : 
                    'text-gray-600'
                  }`}>
                    {isAvailable === true ? 'Username Available' : 
                     isAvailable === false ? 'Username Taken' : 
                     'Min. 3 characters'}
                  </p>
                  <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">
                    {username.length}/20
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !isAvailable || checking}
                className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-aurora-teal hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black group"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Initialize Profile
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 text-center">
              <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest leading-relaxed">
                Your username is permanent and will be used across all Crinava features, including leaderboards and debates.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
