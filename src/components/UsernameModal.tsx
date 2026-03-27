import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Check, X, Loader2, Sparkles, Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface UsernameModalProps {
  isOpen: boolean;
  uid: string;
  email: string;
  onComplete: (username: string) => void;
  onClose: () => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ isOpen, uid, email, onComplete, onClose }) => {
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isDobValid, setIsDobValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = React.useRef(new Map<string, boolean>());

  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  const getDaysInMonth = (month: number, year: number) => {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  };

  const validateDOB = (date: string) => {
    const parts = date.split('/');
    if (parts.length !== 3) return false;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
    if (year < 1950 || year > new Date().getFullYear()) return false;
    if (month < 1 || month > 12) return false;
    
    const maxDays = getDaysInMonth(month, year);
    if (day < 1 || day > maxDays) return false;
    
    return true;
  };

  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = '';
    if (value.length > 0) formatted += value.slice(0, 4);
    if (value.length > 4) formatted += '/' + value.slice(4, 6);
    if (value.length > 6) formatted += '/' + value.slice(6, 8);
    
    setDob(formatted);
  };

  useEffect(() => {
    if (dob.length === 10) {
      setIsDobValid(validateDOB(dob));
    } else {
      setIsDobValid(null);
    }
  }, [dob]);

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
        console.error('Error checking username availability', err);
      } finally {
        setChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable || !isDobValid || loading) return;
    
    if (!gender) {
      setError('Please select your gender');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create username mapping
      const { error: usernameError } = await supabase
        .from('usernames')
        .insert({ id: username.toLowerCase(), uid });
      
      if (usernameError) throw usernameError;

      // 2. Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: uid,
          username: username,
          email: email,
          dob: dob,
          gender: gender,
          cricket_iq: 100,
          crinava_coins: 500,
          career_path: 'Rookie',
          expertise_badge: 'Novice',
          professional_comparison: {
            batting: 45,
            bowling: 30,
            fielding: 55,
            strategy: 40
          },
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      onComplete(username);
    } catch (err: any) {
      setError(err.message || 'Failed to set username');
      console.error('Failed to set username:', err);
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
          className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white z-20"
          >
            <X size={20} />
          </button>

          <div className="p-8 pt-12 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                <Sparkles className="text-aurora-teal" size={24} />
                Choose Identity
              </h2>
              <p className="text-xs text-gray-500 font-medium">Every legend needs a name. What's yours?</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="cricket_legend_1"
                    className={`w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-12 text-white text-xs focus:outline-none transition-all ${
                      isAvailable === true ? 'border-green-500/50 focus:border-green-500' : 
                      isAvailable === false ? 'border-red-500/50 focus:border-red-500' : 
                      'border-white/10 focus:border-aurora-teal/50'
                    }`}
                    required
                    minLength={3}
                    maxLength={20}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checking ? (
                      <Loader2 className="animate-spin text-gray-500" size={16} />
                    ) : isAvailable === true ? (
                      <Check className="text-green-500" size={16} />
                    ) : isAvailable === false ? (
                      <X className="text-red-500" size={16} />
                    ) : null}
                  </div>
                </div>
                <p className={`text-[8px] font-black uppercase tracking-widest ml-1 ${
                  isAvailable === true ? 'text-green-500' : 
                  isAvailable === false ? 'text-red-500' : 
                  'text-gray-600'
                }`}>
                  {isAvailable === true ? 'Username is available' : 
                   isAvailable === false ? 'Username is already taken' : 
                   '3-20 characters, letters, numbers, underscores'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <input
                    type="text"
                    value={dob}
                    onChange={handleDOBChange}
                    placeholder="YYYY/MM/DD"
                    className={`w-full bg-white/5 border rounded-2xl py-4 pl-12 pr-4 text-white text-xs focus:outline-none transition-all ${
                      isDobValid === true ? 'border-green-500/50 focus:border-green-500' : 
                      isDobValid === false ? 'border-red-500/50 focus:border-red-500' : 
                      'border-white/10 focus:border-aurora-teal/50'
                    }`}
                    required
                  />
                </div>
                <p className={`text-[8px] font-black uppercase tracking-widest ml-1 ${
                  isDobValid === false ? 'text-red-500' : 'text-gray-600'
                }`}>
                  {isDobValid === false ? 'Invalid Date' : 'Format: YYYY/MM/DD (e.g. 1995/05/24)'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Male', 'Female', 'Others', "Can't say"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGender(option)}
                      className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        gender === option 
                          ? 'bg-aurora-teal/10 border-aurora-teal text-aurora-teal' 
                          : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[8px] text-gray-600 leading-relaxed text-center px-4">
                  Your personal information is collected solely for security and verification purposes. We are committed to your privacy and will never share your sensitive data with third parties.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isAvailable || !isDobValid || !gender}
                className="w-full py-4 bg-aurora-teal text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-aurora-teal/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Claim Identity'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
