-- Create debates table
CREATE TABLE IF NOT EXISTS public.debates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim TEXT NOT NULL,
    argument_for TEXT NOT NULL,
    argument_against TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
    trending BOOLEAN DEFAULT false,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    end_time TIMESTAMPTZ, -- Custom timer end time
    created_at TIMESTAMPTZ DEFAULT now(),
    creator_id TEXT -- If null, created by admin. If user, must have 90+ rep.
);

-- Create debate_messages table
CREATE TABLE IF NOT EXISTS public.debate_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID REFERENCES public.debates(id) ON DELETE CASCADE,
    username TEXT NOT NULL, -- Storing username for quick display
    text TEXT NOT NULL,
    stance TEXT NOT NULL, -- 'for' or 'against'
    claps INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false, -- Tactical Pin feature
    is_hidden BOOLEAN DEFAULT false, -- If hidden by teammate reports
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create debate_votes table (to prevent double voting and track flips)
CREATE TABLE IF NOT EXISTS public.debate_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID REFERENCES public.debates(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    stance TEXT NOT NULL, -- 'for' or 'against'
    has_flipped BOOLEAN DEFAULT false,
    convinced_by_message_id UUID REFERENCES public.debate_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(debate_id, username) -- A user can only have one active vote per debate
);

-- Create debate_reports table (for Stance-Balanced Moderation)
CREATE TABLE IF NOT EXISTS public.debate_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.debate_messages(id) ON DELETE CASCADE,
    reporter_username TEXT NOT NULL,
    reporter_stance TEXT NOT NULL, -- Must match the message author's stance to trigger hide
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, reporter_username)
);

-- Note: User reputation score is assumed to be in an existing profiles table. 
-- We will just query it or update it dynamically.

-- Setup RLS (Row Level Security) if needed (for now, keeping it simple as public access is likely managed by the app backend)
