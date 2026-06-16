export interface FormatConfig {
  alpha: number;
  wicketImpact: number;
  boundaryBonus: number;
  baselineCRR: number;
}

export const FORMAT_CONFIGS: Record<string, FormatConfig> = {
  T20: { alpha: 0.3, wicketImpact: -8.0, boundaryBonus: 2.0, baselineCRR: 8.0 },
  ODI: { alpha: 0.2, wicketImpact: -12.0, boundaryBonus: 1.5, baselineCRR: 5.5 },
  TEST: { alpha: 0.1, wicketImpact: -20.0, boundaryBonus: 1.0, baselineCRR: 3.0 },
};

export interface CricketBallEvent {
  runs_scored: number;
  is_wicket: boolean;
  is_boundary: boolean;
  over_number: number;
  wickets_in_hand: number;
}

export function calculateBallByBallMomentum(
  event: CricketBallEvent,
  previous_es_impact: number,
  format: 'T20' | 'ODI' | 'TEST'
): { score: number; next_es_impact: number } {
  const config = FORMAT_CONFIGS[format];
  
  let immediate_impact = event.is_wicket ? config.wicketImpact : event.runs_scored;
  if (event.is_boundary) immediate_impact += config.boundaryBonus;

  const current_es_impact = (immediate_impact * config.alpha) + (previous_es_impact * (1.0 - config.alpha));
  
  // Normalize based on config
  const normalized_score = (current_es_impact / (config.baselineCRR / 6.0)) * 100.0;
  
  return {
    score: Math.max(-100, Math.min(100, Math.round(normalized_score * 10) / 10)),
    next_es_impact: current_es_impact
  };
}
