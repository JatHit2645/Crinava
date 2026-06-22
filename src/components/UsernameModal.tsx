import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Check, X, Loader2, Sparkles, Calendar } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUsernameCheck } from "../hooks/useUsernameCheck";

interface UsernameModalProps {
  isOpen: boolean;
  uid: string;
  email: string;
  onComplete: (username: string) => void;
  onClose: () => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({
  isOpen,
  uid,
  email,
  onComplete,
  onClose,
}) => {
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const { isAvailable, checking } = useUsernameCheck(username);
  const [isDobValid, setIsDobValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLeapYear = (year: number) =>
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  const getDaysInMonth = (month: number, year: number) => {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  };

  const validateDOB = (date: string) => {
    const parts = date.split("/");
    if (parts.length !== 3) return false;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
    if (year < 1950 || year > new Date().getFullYear()) return false;
    if (month < 1 || month > 12) return false;

    const maxDays = getDaysInMonth(month, year);
    if (day < 1 || day > maxDays) return false;

    return true;
  };

  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 8) value = value.slice(0, 8);

    let formatted = "";
    if (value.length > 0) formatted += value.slice(0, 4);
    if (value.length > 4) formatted += `/${value.slice(4, 6)}`;
    if (value.length > 6) formatted += `/${value.slice(6, 8)}`;

    setDob(formatted);
  };

  useEffect(() => {
    if (dob.length === 10) {
      setIsDobValid(validateDOB(dob));
    } else {
      setIsDobValid(null);
    }
  }, [dob]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable || !isDobValid || loading) return;

    if (!gender) {
      setError("Please select your gender");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create username mapping
      const { error: usernameError } = await supabase
        .from("usernames")
        .insert({ id: username.toLowerCase(), uid });

      if (usernameError) throw usernameError;

      // 2. Create user profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: uid,
        username: username,
        email: email,
        dob: dob,
        gender: gender,
        cricket_iq: 100,
        crinava_coins: 500,
        career_path: "Rookie",
        expertise_badge: "Novice",
        professional_comparison: {
          batting: 45,
          bowling: 30,
          fielding: 55,
          strategy: 40,
        },
        updated_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      onComplete(username);
    } catch (err: any) {
      setError(err.message || "Failed to set username");
      console.error("Failed to set username:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg-primary/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-bg-primary border border-border-default rounded-3xl overflow-hidden shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/[0.03] rounded-xl transition-colors text-fg-muted hover:text-fg-primary z-20"
          >
            <X size={20} />
          </button>

          <div className="p-8 pt-12 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-fg-primary uppercase italic tracking-tighter flex items-center gap-2">
                <Sparkles className="text-accent-default" size={24} />
                Choose Identity
              </h2>
              <p className="text-fg-muted font-bold uppercase tracking-widest text-[10px]">
                Every legend needs a name. What's yours?
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-fg-muted font-black uppercase tracking-widest ml-1">
                  Username
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted"
                    size={16}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                    }
                    placeholder="cricket_legend_1"
                    className={`w-full bg-white/[0.03] border rounded-2xl py-4 px-12 text-fg-primary text-xs font-bold focus:outline-none transition-all${
                      isAvailable === true
                        ? "border-accent-default/50 focus:border-accent-default"
                        : isAvailable === false
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-border-default focus:border-accent-default/30"
                    }`}
                    required
                    minLength={3}
                    maxLength={20}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checking ? (
                      <Loader2
                        className="animate-spin text-fg-muted"
                        size={16}
                      />
                    ) : isAvailable === true ? (
                      <Check className="text-accent-default" size={16} />
                    ) : isAvailable === false ? (
                      <X className="text-red-500" size={16} />
                    ) : null}
                  </div>
                </div>
                <p
                  className={`text-[8px] font-black uppercase tracking-widest ml-1 ${
                    isAvailable === true
                      ? "text-accent-default"
                      : isAvailable === false
                        ? "text-red-500"
                        : "text-fg-muted"
                  }`}
                >
                  {isAvailable === true
                    ? "Username is available"
                    : isAvailable === false
                      ? "Username is already taken"
                      : "3-20 characters, letters, numbers, underscores"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-fg-muted font-black uppercase tracking-widest ml-1">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted"
                    size={16}
                  />
                  <input
                    type="text"
                    value={dob}
                    onChange={handleDOBChange}
                    placeholder="YYYY/MM/DD"
                    className={`w-full bg-white/[0.03] border rounded-2xl py-4 pl-12 pr-4 text-fg-primary text-xs font-bold focus:outline-none transition-all ${
                      isDobValid === true
                        ? "border-accent-default/50 focus:border-accent-default"
                        : isDobValid === false
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-border-default focus:border-accent-default/30"
                    }`}
                    required
                  />
                </div>
                <p
                  className={`text-[8px] font-black uppercase tracking-widest ml-1 ${
                    isDobValid === false ? "text-red-500" : "text-fg-muted"
                  }`}
                >
                  {isDobValid === false
                    ? "Invalid Date"
                    : "Format: YYYY/MM/DD (e.g. 1995/05/24)"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-fg-muted font-black uppercase tracking-widest ml-1">
                  Gender
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Male", "Female", "Others", "Can't say"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setGender(option)}
                      className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                        gender === option
                          ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                          : "bg-white/[0.03] border-border-default text-fg-muted hover:bg-white/[0.05]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[8px] text-fg-muted leading-relaxed text-center px-4 font-bold uppercase tracking-widest">
                  Your personal information is collected solely for security and
                  verification purposes. We are committed to your privacy and
                  will never share your sensitive data with third parties.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isAvailable || !isDobValid || !gender}
                className="w-full py-4 bg-amber-500 text-bg-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_5px_15px_rgba(245,158,11,0.3)]"
              >
                {loading ? (
                  <Loader2 className="animate-spin mx-auto" size={18} />
                ) : (
                  "Claim Identity"
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
