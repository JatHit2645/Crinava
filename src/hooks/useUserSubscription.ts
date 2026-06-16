import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useUserSubscription() {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsSubscribed(false);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('is_subscribed')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setIsSubscribed(data?.is_subscribed || false);
      } catch (err) {
        console.error('Error checking subscription:', err);
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return { isSubscribed, isLoading };
}
