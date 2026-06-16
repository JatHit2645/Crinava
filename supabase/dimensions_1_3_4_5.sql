-- ==========================================
-- CRINAVA 21-DIMENSION ENGINE: CORRECTED SQL SCRIPTS
-- Dimensions: 1 (Consistency), 3 (Trajectory), 4 (Clutch), 5 (Impact)
-- Target Schema: deliveries (match_id, innings_no, batter_id, bowler_id, runs_batter, runs_extras, runs_total, wicket_kind, wicket_player_out)
-- Target Schema: matches (match_id, season, venue)
-- ==========================================

-- ------------------------------------------
-- Dimension 1: Consistency
-- ------------------------------------------
CREATE OR REPLACE FUNCTION get_dimension_1_consistency(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH 
    batting_innings AS (
        SELECT 
            d.match_id,
            SUM(d.runs_batter) as runs,
            COUNT(*) as balls_faced,
            MAX(CASE WHEN d.wicket_player_out = p_player_id THEN 1 ELSE 0 END) as is_out
        FROM deliveries d
        WHERE d.batter_id = p_player_id
        GROUP BY d.match_id
    ),
    bowling_innings AS (
        SELECT 
            d.match_id,
            SUM(CASE WHEN d.wicket_kind IS NOT NULL AND d.wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field', 'retired out') THEN 1 ELSE 0 END) as wickets,
            SUM(d.runs_batter + d.runs_extras) as runs_conceded,
            COUNT(*) as balls_bowled
        FROM deliveries d
        WHERE d.bowler_id = p_player_id
        GROUP BY d.match_id
    ),
    batting_metrics AS (
        SELECT 
            COUNT(*) as innings_count,
            AVG(runs) as avg_runs,
            STDDEV(runs) as stddev_runs,
            COUNT(*) FILTER (WHERE runs >= 50) as count_50s,
            COUNT(*) FILTER (WHERE runs < 10) as failure_count
        FROM batting_innings
    ),
    bowling_metrics AS (
        SELECT 
            COUNT(*) as innings_count,
            AVG(wickets) as avg_wickets,
            STDDEV(wickets) as stddev_wickets,
            COUNT(*) FILTER (WHERE wickets = 0) as wicketless_count
        FROM bowling_innings
    )
    SELECT jsonb_build_object(
        'BattingInningsCount', COALESCE((SELECT innings_count FROM batting_metrics), 0),
        'AverageRuns', ROUND(COALESCE((SELECT avg_runs FROM batting_metrics), 0)::numeric, 2),
        'RunsVolatility', ROUND(COALESCE((SELECT stddev_runs FROM batting_metrics), 0)::numeric, 2),
        'FailureRate', ROUND(COALESCE((SELECT failure_count::float / NULLIF(innings_count, 0) FROM batting_metrics), 0)::numeric, 2),
        'BowlingInningsCount', COALESCE((SELECT innings_count FROM bowling_metrics), 0),
        'AverageWickets', ROUND(COALESCE((SELECT avg_wickets FROM bowling_metrics), 0)::numeric, 2),
        'WicketsVolatility', ROUND(COALESCE((SELECT stddev_wickets FROM bowling_metrics), 0)::numeric, 2),
        'WicketlessRate', ROUND(COALESCE((SELECT wicketless_count::float / NULLIF(innings_count, 0) FROM bowling_metrics), 0)::numeric, 2)
    ) INTO result;
    RETURN result;
END;
$$;

-- ------------------------------------------
-- Dimension 3: Trajectory
-- ------------------------------------------
CREATE OR REPLACE FUNCTION get_dimension_3_trajectory(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH 
    batting_seasons AS (
        SELECT 
            m.season,
            SUM(d.runs_batter) as runs,
            COUNT(DISTINCT d.match_id) as matches
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.batter_id = p_player_id
        GROUP BY m.season
        ORDER BY m.season DESC
    ),
    bowling_seasons AS (
        SELECT 
            m.season,
            SUM(CASE WHEN d.wicket_kind IS NOT NULL AND d.wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field', 'retired out') THEN 1 ELSE 0 END) as wickets,
            COUNT(DISTINCT d.match_id) as matches
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.bowler_id = p_player_id
        GROUP BY m.season
        ORDER BY m.season DESC
    )
    SELECT jsonb_build_object(
        'LatestSeasonRuns', COALESCE((SELECT runs FROM batting_seasons LIMIT 1), 0),
        'CareerAvgRunsPerSeason', ROUND(COALESCE((SELECT AVG(runs) FROM batting_seasons), 0)::numeric, 2),
        'LatestSeasonWickets', COALESCE((SELECT wickets FROM bowling_seasons LIMIT 1), 0),
        'CareerAvgWicketsPerSeason', ROUND(COALESCE((SELECT AVG(wickets) FROM bowling_seasons), 0)::numeric, 2)
    ) INTO result;
    RETURN result;
END;
$$;

-- ------------------------------------------
-- Dimension 4: Clutch
-- ------------------------------------------
CREATE OR REPLACE FUNCTION get_dimension_4_clutch(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    WITH 
    death_batting AS (
        SELECT 
            SUM(d.runs_batter) as runs,
            COUNT(*) as balls
        FROM deliveries d
        WHERE d.batter_id = p_player_id AND d.over_no >= 16
    ),
    death_bowling AS (
        SELECT 
            SUM(CASE WHEN d.wicket_kind IS NOT NULL AND d.wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field', 'retired out') THEN 1 ELSE 0 END) as wickets,
            SUM(d.runs_batter + d.runs_extras) as runs_conceded,
            COUNT(*) as balls
        FROM deliveries d
        WHERE d.bowler_id = p_player_id AND d.over_no >= 16
    )
    SELECT jsonb_build_object(
        'DeathRuns', COALESCE((SELECT runs FROM death_batting), 0),
        'DeathStrikeRate', ROUND(COALESCE((SELECT (runs::float / NULLIF(balls, 0)) * 100 FROM death_batting), 0)::numeric, 2),
        'DeathWickets', COALESCE((SELECT wickets FROM death_bowling), 0),
        'DeathEconomy', ROUND(COALESCE((SELECT (runs_conceded::float / NULLIF(balls, 0)) * 6 FROM death_bowling), 0)::numeric, 2)
    ) INTO result;
    RETURN result;
END;
$$;

-- ------------------------------------------
-- Dimension 5: Impact
-- ------------------------------------------
CREATE OR REPLACE FUNCTION get_dimension_5_impact(p_player_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
    v_league_rpb FLOAT := 0.478; 
    v_league_avg_runs_per_wicket FLOAT := 26.56;
BEGIN
    WITH 
    player_batting AS (
        SELECT 
            SUM(runs_batter) as total_runs,
            COUNT(*) as total_balls,
            SUM(CASE WHEN wicket_player_out = p_player_id THEN 1 ELSE 0 END) as total_outs
        FROM deliveries
        WHERE batter_id = p_player_id
    ),
    player_bowling AS (
        SELECT 
            SUM(runs_batter + runs_extras) as runs_conceded,
            COUNT(*) as balls_bowled,
            SUM(CASE WHEN wicket_kind IS NOT NULL AND wicket_kind NOT IN ('run out', 'retired hurt', 'obstructing the field', 'retired out') THEN 1 ELSE 0 END) as wickets
        FROM deliveries
        WHERE bowler_id = p_player_id
    )
    SELECT jsonb_build_object(
        'BattingImpactRAA', ROUND(COALESCE((SELECT total_runs - (total_balls * v_league_rpb) FROM player_batting), 0)::numeric, 2),
        'BowlingImpactRAA', ROUND(COALESCE((SELECT (balls_bowled * v_league_rpb) - runs_conceded FROM player_bowling), 0)::numeric, 2),
        'TotalImpactScore', ROUND(COALESCE(
            (SELECT total_runs - (total_balls * v_league_rpb) FROM player_batting) + 
            (SELECT (balls_bowled * v_league_rpb) - runs_conceded FROM player_bowling), 0)::numeric, 2)
    ) INTO result;
    RETURN result;
END;
$$;
