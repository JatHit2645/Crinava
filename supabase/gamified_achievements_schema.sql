-- Crinava Gamified Achievements & Progression Schema

-- 0. Create profiles and usernames tables if they do not exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    email TEXT,
    dob TEXT,
    gender TEXT,
    cricket_iq INTEGER DEFAULT 100,
    crinava_coins INTEGER DEFAULT 500,
    career_path TEXT DEFAULT 'Rookie',
    expertise_badge TEXT DEFAULT 'Novice',
    professional_comparison JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.usernames (
    id TEXT PRIMARY KEY,
    uid UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;

-- Simple policies for profiles/usernames if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow public read access on profiles') THEN
        CREATE POLICY "Allow public read access on profiles" ON public.profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow users to update own profile') THEN
        CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow users to insert own profile') THEN
        CREATE POLICY "Allow users to insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usernames' AND policyname = 'Allow public read access on usernames') THEN
        CREATE POLICY "Allow public read access on usernames" ON public.usernames FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usernames' AND policyname = 'Allow users to insert own username') THEN
        CREATE POLICY "Allow users to insert own username" ON public.usernames FOR INSERT WITH CHECK (auth.uid() = uid);
    END IF;
END
$$;

-- 1. Add overall badge tier columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS badge_tier TEXT DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS badge_progress NUMERIC DEFAULT 0;

-- 2. Create the user_achievements table for individual action tracking
CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL,
    current_count INTEGER DEFAULT 0 NOT NULL,
    current_stage INTEGER DEFAULT 1 NOT NULL, -- 1=Bronze, 2=Silver, 3=Gold, 4=Platinum, 5=Onyx
    last_triggered TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
);

-- 3. Enable Row Level Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Users can read everyone's achievements (for leaderboards/public profiles)
CREATE POLICY "Enable read access for all users" ON public.user_achievements
    FOR SELECT USING (true);

-- Users can only insert/update their own achievements
CREATE POLICY "Enable insert for users based on user_id" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id" ON public.user_achievements
    FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Create index on achievement_id for fast analytics filtering
CREATE INDEX IF NOT EXISTS idx_user_achievements_id ON public.user_achievements(achievement_id);

-- 5. RPC Function for Atomic Increments (Avoids read-then-write race conditions)
CREATE OR REPLACE FUNCTION public.increment_user_achievement(
    p_user_id UUID, 
    p_achievement_id VARCHAR, 
    p_increment_amount INT
)
RETURNS TABLE (new_count INT, active_stage INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_achievements (user_id, achievement_id, current_count, current_stage, last_triggered)
    VALUES (p_user_id, p_achievement_id, p_increment_amount, 1, NOW())
    ON CONFLICT (user_id, achievement_id)
    DO UPDATE SET 
        current_count = public.user_achievements.current_count + p_increment_amount,
        last_triggered = NOW()
    RETURNING public.user_achievements.current_count, public.user_achievements.current_stage INTO new_count, active_stage;

    RETURN QUERY SELECT new_count, active_stage;
END;
$$;

-- 6. Create the user_achievement_logs table for event audit trailing
CREATE TABLE IF NOT EXISTS public.user_achievement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    badge_id VARCHAR(50),
    amount INTEGER DEFAULT 1 NOT NULL,
    old_stage INTEGER,
    new_stage INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_achievement_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Enable read access for all users on logs" ON public.user_achievement_logs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for users based on user_id on logs" ON public.user_achievement_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

