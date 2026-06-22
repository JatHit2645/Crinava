import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export function useUsernameCheck(username: string) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const cache = useRef(new Map<string, boolean>());

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
          .from("usernames")
          .select("id")
          .eq("id", lowerUsername)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error("Error checking username availability:", error);
        }

        const available = !data;
        cache.current.set(lowerUsername, available);
        setIsAvailable(available);
      } catch (err) {
        console.error("Error checking username availability:", err);
      } finally {
        setChecking(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  return { isAvailable, checking };
}
