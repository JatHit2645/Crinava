import { SupabaseClient } from '@supabase/supabase-js';

export interface LevelUpEvent {
  achievementId: string;
  achievementName: string;
  oldStage: number;
  newStage: number;
}

/**
 * Records an action for a specific achievement and processes any resulting level-ups.
 * Uses the atomic increment_user_achievement RPC to prevent race conditions.
 * 
 * @param supabase Authenticated Supabase client
 * @param userId The UUID of the user performing the action
 * @param achievementId The ID of the achievement (e.g., 'rope_burner')
 * @param incrementAmount The amount to increment the counter (default 1)
 * @returns A LevelUpEvent if the user progressed to a new stage, otherwise null.
 */
export async function recordUserAction(
  supabase: SupabaseClient,
  userId: string,
  achievementId: string,
  incrementAmount: number = 1
): Promise<LevelUpEvent | null> {
  
  // 1. Fetch the badge configuration from Supabase 'badges' table to resolve name and targets dynamically
  const { data: badgeData, error: badgeError } = await supabase
    .from('badges')
    .select('*')
    .eq('id', achievementId)
    .single();

  if (badgeError) {
    throw new Error(`Failed to fetch badge config for '${achievementId}': ${badgeError.message}`);
  }
  if (!badgeData) {
    throw new Error(`Badge configuration not found for '${achievementId}'`);
  }

  // 2. Perform the atomic UPSERT via Postgres RPC
  const { data, error } = await supabase
    .rpc('increment_user_achievement', {
      p_user_id: userId,
      p_achievement_id: achievementId,
      p_increment_amount: incrementAmount
    });

  if (error) {
    throw new Error(`Database error incrementing achievement '${achievementId}': ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`No data returned from increment_user_achievement for '${achievementId}'`);
  }

  const newCount = data[0].new_count;
  const activeStage = data[0].active_stage;

  // 3. Calculate mathematically what stage they *should* be at now based on database targets
  const targets = badgeData.targets || [1, 2, 3, 4, 5];
  let calculatedNewStage = 0;
  for (let i = 0; i < 5; i++) {
    if (newCount >= (targets[i] || Infinity)) {
      calculatedNewStage = i + 1;
    }
  }

  // 4. Check if they leveled up
  if (calculatedNewStage > activeStage) {
    // 5. Update the stage in the database to reflect the level up
    const { error: updateError } = await supabase
      .from('user_achievements')
      .update({ current_stage: calculatedNewStage })
      .eq('user_id', userId)
      .eq('achievement_id', achievementId);

    if (updateError) {
      console.error(`Failed to promote stage for ${achievementId}:`, updateError);
      return null;
    }

    // Return the level up event payload so the frontend can trigger celebrations
    return {
      achievementId,
      achievementName: badgeData.name,
      oldStage: activeStage,
      newStage: calculatedNewStage,
    };
  }

  return null;
}

/**
 * Recalculates the user's overall global badge tier (Bronze -> Legendary)
 * based on the milestones of their individual achievements.
 */
export async function recalculateOverallBadgeTier(
  supabase: SupabaseClient,
  userId: string
): Promise<{ newTier: string; newProgress: number } | null> {
  
  // 1. Fetch all of the user's achievements
  const { data: achievements, error } = await supabase
    .from('user_achievements')
    .select('achievement_id, current_stage')
    .eq('user_id', userId);

  if (error || !achievements) {
    console.error("Failed to fetch achievements for tier calculation", error);
    return null;
  }

  // 2. Tally up how many achievements are at each stage or above
  let stage2Plus = 0; // Silver or higher
  let stage3Plus = 0; // Gold or higher
  let stage4Plus = 0; // Platinum or higher
  let stage5 = 0;     // Onyx (Max)

  achievements.forEach((ach) => {
    if (ach.current_stage >= 2) stage2Plus++;
    if (ach.current_stage >= 3) stage3Plus++;
    if (ach.current_stage >= 4) stage4Plus++;
    if (ach.current_stage === 5) stage5++;
  });

  const totalUnlocked = achievements.length;

  // 3. Define the Thresholds (No Shortcuts!)
  let tier = 'bronze';
  let progress = 0;

  if (stage5 >= 5 && totalUnlocked >= 30) {
    tier = 'legendary';
    progress = 100;
  } else if (stage4Plus >= 25) {
    tier = 'epic';
    // Calculate progress to Legendary
    const reqStage5 = Math.min(stage5, 5) / 5;
    const reqTotal = Math.min(totalUnlocked, 30) / 30;
    progress = Math.round(((reqStage5 + reqTotal) / 2) * 100);
  } else if (stage3Plus >= 15) {
    tier = 'gold';
    // Progress to Epic (requires 25 Platinum)
    progress = Math.round((Math.min(stage4Plus, 25) / 25) * 100);
  } else if (stage2Plus >= 8) {
    tier = 'silver';
    // Progress to Gold (requires 15 Gold)
    progress = Math.round((Math.min(stage3Plus, 15) / 15) * 100);
  } else {
    tier = 'bronze';
    // Progress to Silver (requires 8 Silver)
    progress = Math.round((Math.min(stage2Plus, 8) / 8) * 100);
  }

  // 4. Update the profiles table
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ badge_tier: tier, badge_progress: progress })
    .eq('id', userId);

  if (updateError) {
    console.error("Failed to update profile badge tier", updateError);
    return null;
  }

  return { newTier: tier, newProgress: progress };
}

/**
 * DYNAMIC EVENT TRACKER ENGINE
 * Broadcasts an event that matches any badges assigned to this event_type.
 */
export async function trackEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  incrementAmount: number = 1
): Promise<LevelUpEvent[]> {
  const levelUps: LevelUpEvent[] = [];
  try {
    // Dispatch a log to the monitor engine immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('badge-engine-log', {
        detail: {
          timestamp: new Date().toISOString(),
          type: 'INFO',
          message: `[Engine] Received event '${eventType}' for user ${userId} (Amount: +${incrementAmount})`
        }
      }));
    }

    // Insert raw event into database log table
    await supabase.from('user_achievement_logs').insert({
      user_id: userId,
      event_type: eventType,
      amount: incrementAmount
    });

    // 1. Fetch all badges that listen to this event type
    // We store the event mapping inside the icon string: "IconName|event_type"
    const { data: listeningBadges, error } = await supabase
      .from('badges')
      .select('id, name')
      .like('icon', `%|${eventType}`);

    if (error) {
      throw error;
    }

    if (!listeningBadges || listeningBadges.length === 0) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('badge-engine-log', {
          detail: {
            timestamp: new Date().toISOString(),
            type: 'WARN',
            message: `[Engine] No badges are currently mapped to event '${eventType}'.`
          }
        }));
      }
      return [];
    }

    // 2. Process each badge
    for (const badge of listeningBadges) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('badge-engine-log', {
          detail: {
            timestamp: new Date().toISOString(),
            type: 'INFO',
            message: `[Engine] Triggering badge '${badge.id}' (${badge.name})...`
          }
        }));
      }

      const result = await recordUserAction(supabase, userId, badge.id, incrementAmount);
      
      if (result) {
        levelUps.push(result);
        
        // Log level up to database table
        await supabase.from('user_achievement_logs').insert({
          user_id: userId,
          event_type: eventType,
          amount: incrementAmount,
          badge_id: badge.id,
          old_stage: result.oldStage,
          new_stage: result.newStage
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('badge-engine-log', {
            detail: {
              timestamp: new Date().toISOString(),
              type: 'SUCCESS',
              message: `[Engine] 🏆 LEVEL UP! Badge '${badge.id}' reached Stage ${result.newStage}!`
            }
          }));
        }
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('badge-engine-log', {
            detail: {
              timestamp: new Date().toISOString(),
              type: 'SUCCESS',
              message: `[Engine] Successfully recorded +${incrementAmount} to '${badge.id}'.`
            }
          }));
        }
      }
    }
  } catch (err: any) {
    console.error("Error in trackEvent:", err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('badge-engine-log', {
        detail: {
          timestamp: new Date().toISOString(),
          type: 'ERROR',
          message: `[Engine] Error tracking event '${eventType}': ${err.message}`
        }
      }));
    }
  }

  // Recalculate global tier just in case
  await recalculateOverallBadgeTier(supabase, userId);

  return levelUps;
}
