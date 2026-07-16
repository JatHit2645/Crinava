import re
import json

# Read achievementsConfig.ts
with open("src/lib/achievementsConfig.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Match achievements config blocks
pattern = re.compile(
    r'(\w+):\s*\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*thresholds:\s*\[([^\]]+)\]',
    re.DOTALL
)

matches = pattern.findall(content)

sql_statements = []
sql_statements.append("-- Create badges table in Supabase")
sql_statements.append("""CREATE TABLE IF NOT EXISTS public.badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    targets INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    thresholds TEXT[] NOT NULL DEFAULT '{"","","","",""}',
    icon TEXT NOT NULL DEFAULT 'Award'
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow public read access" ON public.badges;
DROP POLICY IF EXISTS "Allow service role write access" ON public.badges;
CREATE POLICY "Allow public read access" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Allow service role write access" ON public.badges FOR ALL USING (true);

-- Insert seed data
""")

def extract_targets(thresholds_list):
    targets = []
    for val in thresholds_list:
        val = val.strip().replace('"', '').replace("'", "").replace(",", "")
        # Find first number
        num_match = re.search(r'([\d,]+)', val)
        if num_match:
            num_str = num_match.group(1).replace(",", "")
            targets.append(int(num_str))
        else:
            targets.append(len(targets) + 1)
    if len(targets) < 5:
        targets += [i for i in range(len(targets) + 1, 6)]
    return targets[:5]

for match in matches:
    key, bid, name, category, description, thresholds_raw = match
    # Find all quoted strings inside thresholds
    thresholds = re.findall(r'"([^"]*)"', thresholds_raw)
    if not thresholds:
        thresholds = re.findall(r"'([^']*)'", thresholds_raw)
        
    thresholds = (thresholds + [""] * 5)[:5]
    targets = extract_targets(thresholds)
    
    # Escape single quotes for SQL
    name_esc = name.replace("'", "''")
    category_esc = category.replace("'", "''")
    description_esc = description.replace("'", "''")
    
    # Convert thresholds array to PostgreSQL text array format e.g. '{"5 votes", "50 votes"}'
    # Double quotes inside PostgreSQL array elements must be escaped
    escaped_thresholds = []
    for t in thresholds:
        t_esc = t.replace('"', '\\"')
        escaped_thresholds.append(f'"{t_esc}"')
    thresholds_sql = "{" + ",".join(escaped_thresholds) + "}"
    targets_sql = "{" + ",".join(str(t) for t in targets) + "}"
    
    icon_map = {
        "rope_burner": "Vote",
        "trend_breaker": "RotateCcw",
        "crowd_commander": "Users",
        "debate_architect": "MessageSquarePlus",
        "hitmans_vanguard": "Target",
        "kings_shield": "Shield",
        "thalas_anchor": "Anchor",
        "heavy_puller": "Zap",
        "iron_grip": "CalendarCheck",
        "the_tie_breaker": "Scale",
        "neural_seer": "Brain",
        "calculated_fortune": "Trophy",
        "streak_weaver": "Sparkles",
        "underdog_alchemist": "Star",
        "smart_xi_tactician": "ClipboardList",
        "monte_carlo_survivor": "Dices",
        "high_roller": "Coins",
        "the_hedger": "Share2",
        "clean_sweep": "ListChecks",
        "oracle_override": "ToggleRight",
        "coin_accumulator": "PiggyBank",
        "patron_of_crinava": "CreditCard",
        "star_trader": "Star",
        "coin_burner": "ShoppingCart",
        "daily_collector": "Calendar",
        "ledger_sync": "RefreshCw",
        "ticket_master": "Ticket",
        "raffle_reaver": "Gift",
        "lucky_escape": "Clover",
        "high_stakes_bidding": "Gem",
        "jackpot_hunter": "Hourglass",
        "dna_decoder": "Dna",
        "telemetry_inspector": "FileText",
        "momentum_watcher": "LineChartIcon",
        "smart_selector": "UserCheck",
        "global_fan": "Globe",
        "turning_point_spotter": "Radar",
        "bloggers_guild": "BookOpen",
        "core_identity": "ShieldCheck",
        "onyx_ascendant": "Crown"
    }
    icon = icon_map.get(bid, "Award")
    
    sql_statements.append(
        f"INSERT INTO public.badges (id, name, category, description, targets, thresholds, icon) "
        f"VALUES ('{bid}', '{name_esc}', '{category_esc}', '{description_esc}', '{targets_sql}', '{thresholds_sql}', '{icon}') "
        f"ON CONFLICT (id) DO UPDATE SET "
        f"name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description, "
        f"targets = EXCLUDED.targets, thresholds = EXCLUDED.thresholds, icon = EXCLUDED.icon;"
    )

with open("supabase/badges_schema.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql_statements))

print("SQL seed script created at supabase/badges_schema.sql")
