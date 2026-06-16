-- Dimension 18: Portability
-- This script calculates portability stats for players based on their performance across different venues.
-- Portability answers: How portable (transferable) is a player’s performance across different venues?

-- Rule:
-- * Split ONLY by venue using matches.venue
-- * NO phase, NO result, NO time buckets
-- * ONLY counts (no ratios)
-- * No overlap with consistency or trajectory

CREATE OR REPLACE FUNCTION get_dimension_18_portability(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH 
    -- 1. Base Batting Data per Innings (Match + Player)
    batting_innings AS (
        SELECT 
            d.match_id,
            m.venue,
            SUM(d.runs_batter) as runs,
            COUNT(*) as balls_faced,
            SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) as fours,
            SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) as sixes,
            MAX(CASE WHEN d.wicket_player_out = d.batter_id THEN 1 ELSE 0 END) as is_out
        FROM deliveries d
        JOIN matches m ON d.match_id = m.id
        WHERE d.batter_id = p_player_id
        GROUP BY d.match_id, m.venue
    ),
    -- 2. Base Bowling Data per Innings (Match + Player)
    bowling_innings AS (
        SELECT 
            d.match_id,
            m.venue,
            SUM(CASE WHEN d.wicket_kind IS NOT NULL AND d.wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field', 'retired out') THEN 1 ELSE 0 END) as wickets,
            SUM(d.runs_batter + d.runs_extras) as runs_conceded,
            SUM(CASE WHEN d.runs_batter = 0 AND d.runs_extras = 0 THEN 1 ELSE 0 END) as dots,
            SUM(CASE WHEN d.runs_batter IN (4, 6) THEN 1 ELSE 0 END) as boundaries_conceded,
            COUNT(*) as balls_bowled
        FROM deliveries d
        JOIN matches m ON d.match_id = m.id
        WHERE d.bowler_id = p_player_id
        GROUP BY d.match_id, m.venue
    ),
    -- 3. Batting Aggregates per Venue
    batting_venue_agg AS (
        SELECT 
            venue,
            SUM(runs) as total_runs,
            COUNT(*) as innings_count,
            MAX(runs) as best_innings,
            SUM(fours + sixes) as total_boundaries,
            SUM(sixes) as total_sixes,
            SUM(balls_faced) as total_balls,
            MAX(CASE WHEN runs = 0 AND is_out = 1 THEN 1 ELSE 0 END) as has_duck,
            COUNT(*) FILTER (WHERE runs >= 50) as count_50s,
            COUNT(*) FILTER (WHERE runs >= 100) as count_100s,
            COUNT(*) FILTER (WHERE runs >= 30) as count_30s,
            BOOL_AND(runs <= 20) as all_low_scores
        FROM batting_innings
        GROUP BY venue
    ),
    -- 4. Bowling Aggregates per Venue
    bowling_venue_agg AS (
        SELECT 
            venue,
            SUM(wickets) as total_wickets,
            COUNT(*) as innings_count,
            MAX(wickets) as best_wickets,
            SUM(runs_conceded) as total_runs_conceded,
            SUM(dots) as total_dots,
            SUM(boundaries_conceded) as total_boundaries_conceded,
            COUNT(*) FILTER (WHERE wickets >= 3) as count_3w,
            MAX(CASE WHEN wickets = 0 THEN 1 ELSE 0 END) as has_wicketless,
            BOOL_AND(wickets <= 1) as all_low_impact
        FROM bowling_innings
        GROUP BY venue
    ),
    -- 5. Ranked Venue Runs
    ranked_batting AS (
        SELECT 
            total_runs,
            ROW_NUMBER() OVER (ORDER BY total_runs DESC) as rank
        FROM batting_venue_agg
    ),
    -- 6. Ranked Venue Wickets
    ranked_bowling AS (
        SELECT 
            total_wickets,
            ROW_NUMBER() OVER (ORDER BY total_wickets DESC) as rank
        FROM bowling_venue_agg
    )
    SELECT jsonb_build_object(
        -- Batting Portability Stats (1-15)
        'VenuesPlayedCount', (SELECT COUNT(*) FROM batting_venue_agg),
        'VenuesWithRunsCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE total_runs > 0),
        'VenuesWith50PlusCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE count_50s > 0),
        'VenuesWith100PlusCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE count_100s > 0),
        'VenuesWithOnlyLowScoresCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE all_low_scores = TRUE),
        'VenuesWithBoundaryPresenceCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE total_boundaries > 0),
        'VenuesWithSixPresenceCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE total_sixes > 0),
        'VenuesWithDuckCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE has_duck = 1),
        'TopVenueRuns', COALESCE((SELECT total_runs FROM ranked_batting WHERE rank = 1), 0),
        'SecondBestVenueRuns', COALESCE((SELECT total_runs FROM ranked_batting WHERE rank = 2), 0),
        'ThirdBestVenueRuns', COALESCE((SELECT total_runs FROM ranked_batting WHERE rank = 3), 0),
        'VenuesWithAbove30RunsCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE count_30s > 0),
        'VenuesWithMultipleInningsCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE innings_count > 1),
        'VenuesWithNoBoundaryCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE total_boundaries = 0),
        'VenuesWithHighBallUsageCount', (SELECT COUNT(*) FROM batting_venue_agg WHERE total_balls >= 50),
        
        -- Bowling Portability Stats (16-30)
        'VenuesBowledCount', (SELECT COUNT(*) FROM bowling_venue_agg),
        'VenuesWithWicketsCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_wickets > 0),
        'VenuesWith3PlusWicketsCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE count_3w > 0),
        'VenuesWithWicketlessCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE has_wicketless = 1),
        'VenuesWithDotBallPresenceCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_dots > 0),
        'VenuesWithBoundaryConcedePresenceCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_boundaries_conceded > 0),
        'TopVenueWickets', COALESCE((SELECT total_wickets FROM ranked_bowling WHERE rank = 1), 0),
        'SecondBestVenueWickets', COALESCE((SELECT total_wickets FROM ranked_bowling WHERE rank = 2), 0),
        'ThirdBestVenueWickets', COALESCE((SELECT total_wickets FROM ranked_bowling WHERE rank = 3), 0),
        'VenuesWithMultipleSpellsCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE innings_count > 1),
        'VenuesWithLowImpactCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE all_low_impact = TRUE),
        'VenuesWithHighRunConcedeCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_runs_conceded >= 100), -- Threshold 100
        'VenuesWithNoBoundaryConcedeCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_boundaries_conceded = 0),
        'VenuesWithHighDotBallCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_dots >= 24), -- Threshold 24
        'VenuesWithBalancedPerformanceCount', (SELECT COUNT(*) FROM bowling_venue_agg WHERE total_wickets > 0 AND total_dots > 0)
    ) INTO result;

    RETURN result;
END;
$$;
