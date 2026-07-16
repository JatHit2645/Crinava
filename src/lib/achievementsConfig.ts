export type AchievementStage = 1 | 2 | 3 | 4 | 5;

export interface AchievementThreshold {
  icon?: any;

  id: string;
  name: string;
  category: string;
  description: string;
  thresholds: [string, string, string, string, string]; // Now strings since they are text like "5 votes"
}

export const ACHIEVEMENTS_CONFIG: Record<string, AchievementThreshold> = {
  rope_burner: {
    id: "rope_burner",
    name: "Rope Burner",
    category: "Debate Arena & Tug-of-War",
    description: "Friction burns mean you've put everything into pulling the debate rope. Awarded for total votes cast.",
    thresholds: ["5 votes", "50 votes", "250 votes", "1,000 votes", "5,000 votes"],
  },
  trend_breaker: {
    id: "trend_breaker",
    name: "Trend Breaker",
    category: "Debate Arena & Tug-of-War",
    description: "Voted for the minority side when it was under 30% and helped pull the momentum back.",
    thresholds: ["1 vote", "10 votes", "50 votes", "200 votes", "1,000 votes"],
  },
  crowd_commander: {
    id: "crowd_commander",
    name: "Crowd Commander",
    category: "Debate Arena & Tug-of-War",
    description: "Triggers the live traffic simulation to sway the crowds on debate cards.",
    thresholds: ["5 triggers", "25 triggers", "100 triggers", "500 triggers", "2,000 triggers"],
  },
  debate_architect: {
    id: "debate_architect",
    name: "Debate Architect",
    category: "Debate Arena & Tug-of-War",
    description: "Created hot debates that divided opinions across the arena.",
    thresholds: ["1 debate created", "5 debates created", "20 debates created", "100 debates created", "500 debates created"],
  },
  hitmans_vanguard: {
    id: "hitmans_vanguard",
    name: "Hitman's Vanguard",
    category: "Debate Arena & Tug-of-War",
    description: "Voted on debates specifically defending Rohit Sharma's statistics.",
    thresholds: ["5 votes", "25 votes", "100 votes", "500 votes", "2,000 votes"],
  },
  kings_shield: {
    id: "kings_shield",
    name: "King's Shield",
    category: "Debate Arena & Tug-of-War",
    description: "Guarded the legacy of Virat Kohli in the debate arena.",
    thresholds: ["5 votes", "25 votes", "100 votes", "500 votes", "2,000 votes"],
  },
  thalas_anchor: {
    id: "thalas_anchor",
    name: "Thala's Anchor",
    category: "Debate Arena & Tug-of-War",
    description: "Maintained the balance of the rope in MS Dhoni debates.",
    thresholds: ["5 votes", "25 votes", "100 votes", "500 votes", "2,000 votes"],
  },
  heavy_puller: {
    id: "heavy_puller",
    name: "Heavy Puller",
    category: "Debate Arena & Tug-of-War",
    description: "Voted on the winning side of debates that ended in a landslide victory (>80% margin).",
    thresholds: ["1 time", "10 times", "50 times", "200 times", "1,000 times"],
  },
  iron_grip: {
    id: "iron_grip",
    name: "Iron Grip",
    category: "Debate Arena & Tug-of-War",
    description: "Cast at least one vote in active debates on consecutive days.",
    thresholds: ["3-day streak", "7-day streak", "15-day streak", "30-day streak", "90-day streak"],
  },
  the_tie_breaker: {
    id: "the_tie_breaker",
    name: "The Tie-Breaker",
    category: "Debate Arena & Tug-of-War",
    description: "Voted on a debate card that was split exactly 50-50, shifting the balance of power.",
    thresholds: ["1 time", "5 times", "20 times", "100 times", "500 times"],
  },
  neural_seer: {
    id: "neural_seer",
    name: "Neural Seer",
    category: "Oracle & Predictions (Cricarena)",
    description: "Placed predictions in the multiplayer prediction rooms.",
    thresholds: ["5 predictions", "25 predictions", "100 predictions", "500 predictions", "2,000 predictions"],
  },
  calculated_fortune: {
    id: "calculated_fortune",
    name: "Calculated Fortune",
    category: "Oracle & Predictions (Cricarena)",
    description: "Decimated prediction rooms with accurate outcome selections.",
    thresholds: ["3 wins", "15 wins", "60 wins", "300 wins", "1,000 wins"],
  },
  streak_weaver: {
    id: "streak_weaver",
    name: "Streak Weaver",
    category: "Oracle & Predictions (Cricarena)",
    description: "Maintained an active winning streak in match predictions.",
    thresholds: ["3 wins in a row", "5 wins in a row", "8 wins in a row", "12 wins in a row", "20 wins in a row"],
  },
  underdog_alchemist: {
    id: "underdog_alchemist",
    name: "Underdog Alchemist",
    category: "Oracle & Predictions (Cricarena)",
    description: "Backed outside odds (>2.5x multiplier) in prediction matchups and won.",
    thresholds: ["1 win", "5 wins", "20 wins", "100 wins", "400 wins"],
  },
  smart_xi_tactician: {
    id: "smart_xi_tactician",
    name: "Smart XI Tactician",
    category: "Oracle & Predictions (Cricarena)",
    description: "Drafted fantasy teams utilizing the Smart XI selection engine.",
    thresholds: ["1 squad", "10 squads", "50 squads", "200 squads", "1,000 squads"],
  },
  monte_carlo_survivor: {
    id: "monte_carlo_survivor",
    name: "Monte Carlo Survivor",
    category: "Oracle & Predictions (Cricarena)",
    description: "Ran full Monte Carlo predictions inside the Oracle Simulation console.",
    thresholds: ["5 runs", "20 runs", "100 runs", "400 runs", "1,500 runs"],
  },
  high_roller: {
    id: "high_roller",
    name: "High Roller",
    category: "Oracle & Predictions (Cricarena)",
    description: "Total coins wagered in prediction games.",
    thresholds: ["500 coins", "2,500 coins", "10,000 coins", "50,000 coins", "250,000 coins"],
  },
  the_hedger: {
    id: "the_hedger",
    name: "The Hedger",
    category: "Oracle & Predictions (Cricarena)",
    description: "Covered both outcomes across different matching pools to secure a split payout.",
    thresholds: ["1 match", "10 matches", "50 matches", "200 matches", "800 matches"],
  },
  clean_sweep: {
    id: "clean_sweep",
    name: "Clean Sweep",
    category: "Oracle & Predictions (Cricarena)",
    description: "Predicted every single match outcome correctly in a single day's schedule.",
    thresholds: ["1 day", "3 days", "7 days", "15 days", "45 days"],
  },
  oracle_override: {
    id: "oracle_override",
    name: "Oracle Override",
    category: "Oracle & Predictions (Cricarena)",
    description: "Won a prediction where you picked the opposite team recommended by the AI.",
    thresholds: ["1 override", "5 overrides", "20 overrides", "80 overrides", "300 overrides"],
  },
  coin_accumulator: {
    id: "coin_accumulator",
    name: "Coin Accumulator",
    category: "Economy & Store",
    description: "Unlocked by holding a massive balance of Crinava Coins simultaneously.",
    thresholds: ["1,000 coins", "5,000 coins", "25,000 coins", "100,000 coins", "500,000 coins"],
  },
  patron_of_crinava: {
    id: "patron_of_crinava",
    name: "Patron of Crinava",
    category: "Economy & Store",
    description: "Supported development by purchasing coin packs via the Razorpay interface.",
    thresholds: ["1 purchase", "3 purchases", "10 purchases", "25 purchases", "100 purchases"],
  },
  star_trader: {
    id: "star_trader",
    name: "Star Trader",
    category: "Economy & Store",
    description: "Upgraded user standing levels within the VIP store packages.",
    thresholds: ["Basic VIP", "Silver VIP", "Gold VIP", "Platinum VIP", "Obsidian VIP"],
  },
  coin_burner: {
    id: "coin_burner",
    name: "Coin Burner",
    category: "Economy & Store",
    description: "Total coins spent buying store cosmetics or raffle rooms.",
    thresholds: ["100 spent", "500 spent", "2,500 spent", "10,000 spent", "50,000 spent"],
  },
  daily_collector: {
    id: "daily_collector",
    name: "Daily Collector",
    category: "Economy & Store",
    description: "Collected daily login rewards.",
    thresholds: ["5 days", "25 days", "100 days", "300 days", "1,000 days"],
  },
  ledger_sync: {
    id: "ledger_sync",
    name: "Ledger Sync",
    category: "Economy & Store",
    description: "Verified purchases and synced wallets successfully.",
    thresholds: ["1 sync", "5 syncs", "25 syncs", "100 syncs", "400 syncs"],
  },
  ticket_master: {
    id: "ticket_master",
    name: "Ticket Master",
    category: "Raffle Room (Luck Base)",
    description: "Purchased tickets in the Raffle Room.",
    thresholds: ["5 tickets", "25 tickets", "100 tickets", "500 tickets", "2,500 tickets"],
  },
  raffle_reaver: {
    id: "raffle_reaver",
    name: "Raffle Reaver",
    category: "Raffle Room (Luck Base)",
    description: "Won items or currency prizes from dynamic raffles.",
    thresholds: ["1 win", "5 wins", "15 wins", "50 wins", "200 wins"],
  },
  lucky_escape: {
    id: "lucky_escape",
    name: "Lucky Escape",
    category: "Raffle Room (Luck Base)",
    description: "Won a raffle where your winning probability was under 5%.",
    thresholds: ["1 time", "2 times", "5 times", "15 times", "50 times"],
  },
  high_stakes_bidding: {
    id: "high_stakes_bidding",
    name: "High Stakes Bidding",
    category: "Raffle Room (Luck Base)",
    description: "Entered premium, high-value coin pools in the Raffle Room.",
    thresholds: ["1 entry", "5 entries", "20 entries", "80 entries", "300 entries"],
  },
  jackpot_hunter: {
    id: "jackpot_hunter",
    name: "Jackpot Hunter",
    category: "Raffle Room (Luck Base)",
    description: "Entered consecutive raffle draws without missing a cycle.",
    thresholds: ["3 events", "10 events", "30 events", "100 events", "400 events"],
  },
  dna_decoder: {
    id: "dna_decoder",
    name: "DNA Decoder",
    category: "Matches & Analytics Telemetry",
    description: "Evaluated profile DNA matches with pro players.",
    thresholds: ["1 check", "5 checks", "25 checks", "100 checks", "500 checks"],
  },
  telemetry_inspector: {
    id: "telemetry_inspector",
    name: "Telemetry Inspector",
    category: "Matches & Analytics Telemetry",
    description: "Inspected detailed scorecards generated from Cricsheet telemetry logs.",
    thresholds: ["5 matches", "25 matches", "100 matches", "500 matches", "2,000 matches"],
  },
  momentum_watcher: {
    id: "momentum_watcher",
    name: "Momentum Watcher",
    category: "Matches & Analytics Telemetry",
    description: "Examined Match Momentum charts, Heatmaps, and Radar metrics.",
    thresholds: ["5 checks", "20 checks", "80 checks", "300 checks", "1,000 checks"],
  },
  smart_selector: {
    id: "smart_selector",
    name: "Smart Selector",
    category: "Matches & Analytics Telemetry",
    description: "Cast votes on match MVP selection items.",
    thresholds: ["3 votes", "15 votes", "60 votes", "250 votes", "1,000 votes"],
  },
  global_fan: {
    id: "global_fan",
    name: "Global Fan",
    category: "Matches & Analytics Telemetry",
    description: "Analyzed matches across different series and tournament tiers.",
    thresholds: ["2 formats", "4 formats", "8 formats", "15 formats", "30 formats"],
  },
  turning_point_spotter: {
    id: "turning_point_spotter",
    name: "Turning Point Spotter",
    category: "Matches & Analytics Telemetry",
    description: "Inspected dynamic Turning Point heatmaps to check momentum shifts.",
    thresholds: ["3 matches", "15 matches", "50 matches", "200 matches", "800 matches"],
  },
  bloggers_guild: {
    id: "bloggers_guild",
    name: "Blogger's Guild",
    category: "Social, Identity & Completionist",
    description: "Read and rated articles on the blog platform page.",
    thresholds: ["2 blogs", "10 blogs", "40 blogs", "150 blogs", "600 blogs"],
  },
  core_identity: {
    id: "core_identity",
    name: "Core Identity",
    category: "Social, Identity & Completionist",
    description: "Completed auth integration and set up security levels.",
    thresholds: ["Authentication complete", "Custom badge active", "Premium display enabled", "Full security clearance", "Master profile status"],
  },
  onyx_ascendant: {
    id: "onyx_ascendant",
    name: "Onyx Ascendant",
    category: "Social, Identity & Completionist",
    description: "Earned top-tier Onyx status on multiple achievements.",
    thresholds: ["1 Onyx badge", "3 Onyx badges", "7 Onyx badges", "15 Onyx badges", "30 Onyx badges"],
  },
};

export function calculateCurrentStage(achievementId: string, currentStat: number): number {
  // Logic left to UI if using strings, or keep a mock function here.
  return 0; 
}
