import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Checks the current user's subscription status and loading state from Supabase.
 * @example
 * useUserSubscription()
 * { isSubscribed: true, isLoading: false }
 * @returns {{ isSubscribed: boolean | null, isLoading: boolean }} An object containing whether the user is subscribed and whether the subscription check is still loading.
 **/
export function useUserSubscription() {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /**
    * Checks the current authenticated user's subscription status and updates local state.
    * @example
    * sync()
    * undefined
    * @returns {void} No return value; updates subscription and loading state internally.
    **/
    const checkSubscription = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsSubscribed(false);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("is_subscribed")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        setIsSubscribed(data?.is_subscribed || false);
      } catch (err) {
        console.error("Error checking subscription:", err);
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return { isSubscribed, isLoading };
}
