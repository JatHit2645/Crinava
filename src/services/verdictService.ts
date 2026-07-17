import { supabase } from "../lib/supabaseServer";
import { calculateImpact } from "../lib/impactEngine";

export interface VerdictResponse {
  verdict: string;
  confidence: number;
  explanation: string;
  proof: {
    type: "bar" | "line" | "pie";
    data: any[];
    xAxis: string;
    yAxis: string;
    title: string;
  } | null;
  outOfScope?: boolean;
}

/**
 * Fetches all available rows from a database query in paginated batches and returns the combined results.
 * @example
 * fetchFullData("users", "id,name", dbQuery)
 * []
 * @param {string} table - The table name used for logging error context.
 * @param {string} select - The selected columns/query string.
 * @param {any} dbQuery - The database query builder or client supporting range requests.
 * @returns {Promise<any[]>} A promise that resolves to an array containing all fetched records.
 */
async function fetchFullData(
  table: string,
  select: string,
  dbQuery: any,
): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  let to = 999;
  let hasMore = true;

  /* eslint-disable no-await-in-loop */
  while (hasMore) {
    const { data, error } = await dbQuery.range(from, to);

    if (error) {
      console.error(`Verdict Engine - Error fetching ${table}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      if (data.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    }
    if (allData.length > 50000) break;
  }

  return allData;
}

/**
 * Extracts and parses JSON from a string, returning an empty object when parsing fails.
 * @example
 * extractJson('{"key":"value"}')
 * { key: "value" }
 * @param {string | null} content - The input string that may contain valid JSON.
 * @returns {any} The parsed JSON object, or an empty object if parsing is unsuccessful.
 **/
function extractJson(content: string | null): any {
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch (e) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.debug("JSON parsing failed", e2);
      }
    }
    return {};
  }
}

/**
* Calls the configured AI chat completions API with the provided message list.
* @example
* callAIApi([{ role: "user", content: "Hello" }])
* { choices: [...] }
* @param {any[]} messages - Array of chat message objects to send to the AI API.
* @returns {Promise<any>} Resolves with the JSON response from the AI API.
**/
async function callAIApi(messages: any[]): Promise<any> {
  const apiKey = (process.env.NVIDIA_API_KEY || process.env.MISTRAL_API_KEY)
    ?.trim()
    ?.replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("AI API Key not found.");

  let model = process.env.NVIDIA_MODEL_NAME || "meta/llama-3.1-70b-instruct";
  if (model.includes("nvapi-")) model = "meta/llama-3.1-70b-instruct";

  let rawBaseUrl = (
    process.env.NVIDIA_API_URL || ("https://integrate.api" + ".nvidia.com/v1")
  )
    .trim()
    .replace(/\/+$/, "");
  if (rawBaseUrl.toLowerCase().endsWith("/chat/completions")) {
    rawBaseUrl = rawBaseUrl
      .substring(0, rawBaseUrl.length - "/chat/completions".length)
      .replace(/\/+$/, "");
  }
  const url = `${rawBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) throw new Error(`AI API Error: ${await response.text()}`);
  return await response.json();
}

/**
 * Generates a data-backed cricket verdict for a query within a specified scope.
 *
 * @example
 * generateVerdict("Who is better?", "match", { matchId: 123 })
 * { verdict: "Player A is mathematically superior.", confidence: 85, explanation: "...", proof: {...} }
 *
 * @param {string} query - User statement to analyze and convert into a verdict.
 * @param {"global" | "series" | "match"} scope - Analysis scope for the verdict.
 * @param {{ matchId?: number; eventName?: string; season?: string; scorecard?: any[] }} [context] - Optional contextual data for series or match-level analysis.
 * @returns {Promise<VerdictResponse>} A promise that resolves to the final verdict response object.
 **/
export async function generateVerdict(
  query: string,
  scope: "global" | "series" | "match",
  context?: {
    matchId?: number;
    eventName?: string;
    season?: string;
    scorecard?: any[];
  },
): Promise<VerdictResponse> {
  console.log("DEBUG: generateVerdict called with scope:", scope);

  const scopePrompt = `
    You are a Cricket Data Analyst. Analyze the user's statement and provide a data-backed verdict.
    
    CURRENT SCOPE: ${scope}
    ${scope === "series" ? `CONTEXT: Series "${context?.eventName}" Season "${context?.season}"` : ""}
    ${scope === "match" ? `CONTEXT: Match ID ${context?.matchId}` : ""}

    USER STATEMENT: "${query}"

    RULES:
    1. PLAYER ID RESOLUTION: Use "batter_name" or "bowler_name" with "eq" for player filters.
    2. BOWLING STYLE: Use "bowler_style" with "eq" ("spin" or "pace").
    3. DATA SOURCE: Query "deliveries" table. Select ONLY needed columns: "runs_batter, wicket_kind, batter_id, bowler_id, runs_extras, wicket_player_out".
    4. Return JSON with {"queries": Array of {table, select, filters}, "reasoning": string}.
  `;

  const scopeResponse = await callAIApi([
    {
      role: "system",
      content: "You are a cricket data expert. Return ONLY valid JSON.",
    },
    { role: "user", content: scopePrompt },
  ]);

  const scopeResult = extractJson(scopeResponse.choices[0].message.content);

  const aggregatedStats: any[] = [];
  const fetchedData: any[] = [];

  if (scopeResult.queries) {
    /* eslint-disable no-await-in-loop */
    for (const q of scopeResult.queries) {
      console.log(
        `Verdict Engine - Processing query for ${q.table} with select: ${q.select}`,
      );
      if (!q.table || !q.select) continue;

      let dbQuery = supabase.from(q.table).select(String(q.select));
      const targetPlayers: { id: string; name: string }[] = [];
      let pendingStyleFilter: string | null = null;

      if (q.filters) {
        for (const [key, filter] of Object.entries(q.filters)) {
          const filterEntries = Object.entries(filter as any);
          if (filterEntries.length === 0) continue;
          const [[op, val]] = filterEntries;

          if (
            q.table === "deliveries" &&
            (key === "batter_name" || key === "bowler_name")
          ) {
            const names = Array.isArray(val) ? val : [String(val)];
            const resolvedIds: string[] = [];

            for (const rawName of names) {
              const name = rawName.trim();
              const lastName = name.split(" ").pop() || "";

              // Robust resolution: Try exact, then ilike full, then ilike last
              const { data: players } = await supabase
                .from("players")
                .select(
                  "player_id, player_name, player_career_stats(matches_played)",
                )
                .or(
                  `player_name.eq."${name}",player_name.ilike."%${name}%",player_name.ilike."%${lastName}"`,
                );

              if (players && players.length > 0) {
                const getMatches = (p: any) => {
                  const stats = p.player_career_stats;
                  if (Array.isArray(stats))
                    return stats[0]?.matches_played || 0;
                  return (stats as any)?.matches_played || 0;
                };
                const best = players.sort(
                  (a: any, b: any) => getMatches(b) - getMatches(a),
                )[0];
                resolvedIds.push(best.player_id);
                targetPlayers.push({
                  id: String(best.player_id),
                  name: best.player_name,
                });
              }
            }

            const idKey = key === "batter_name" ? "batter_id" : "bowler_id";
            if (resolvedIds.length > 0) {
              if (op === "in" || resolvedIds.length > 1)
                dbQuery = dbQuery.in(idKey, resolvedIds);
              else dbQuery = dbQuery.eq(idKey, resolvedIds[0]);
            } else {
              dbQuery = dbQuery.eq(idKey, "NON_EXISTENT");
            }
          } else if (key === "bowler_style") {
            pendingStyleFilter = (val as string).toLowerCase();
          } else {
            if (op === "eq") dbQuery = dbQuery.eq(key, val);
            if (op === "in") dbQuery = dbQuery.in(key, val as any[]);
          }
        }
      }

      let data = await fetchFullData(q.table, q.select, dbQuery);

      if (pendingStyleFilter && data.length > 0) {
        const ids = Array.from(new Set(data.map((d) => d.bowler_id)));
        const { data: styles } = await supabase
          .from("players")
          .select("player_id, bowling_style")
          .in("player_id", ids);
        if (styles) {
          const styleMap = new Map(
            styles.map((s) => [
              s.player_id,
              s.bowling_style?.toLowerCase() || "",
            ]),
          );
          const beforeCount = data.length;
          data = data.filter((d) => {
            const s = styleMap.get(d.bowler_id) || "";
            if (pendingStyleFilter === "spin")
              return (
                s.includes("spin") ||
                s.includes("break") ||
                s.includes("orthodox") ||
                s.includes("slow")
              );
            return s.includes("fast") || s.includes("medium");
          });
          console.log(
            `Verdict Engine - Filtered ${beforeCount} rows to ${data.length} rows for style: ${pendingStyleFilter}`,
          );
        }
      }

      if (targetPlayers.length > 0) {
        targetPlayers.forEach((p) => {
          const role =
            q.filters && JSON.stringify(q.filters).includes("bowler_name")
              ? "bowler"
              : "batter";

          // Use real league baselines
          let baselines = { expectedRunsPerBall: 0.478, wicketValue: 26.56 }; // Overall
          if (pendingStyleFilter === "spin") {
            baselines = { expectedRunsPerBall: 0.4401, wicketValue: 28.36 };
          } else if (pendingStyleFilter === "pace") {
            baselines = { expectedRunsPerBall: 0.5468, wicketValue: 24.33 };
          }

          const stats = calculateImpact(data, p.id, p.name, role, baselines);
          aggregatedStats.push({
            ...stats,
            appliedFilter: pendingStyleFilter || "none",
          });
        });
      } else {
        fetchedData.push({ data });
      }
    }
  }

  // Deterministic Math Evaluation (The "Ruler")
  let mathVerdict = "Insufficient data to make a mathematical determination.";
  let mathConfidence = 0;

  if (aggregatedStats.length === 2) {
    const [p1, p2] = aggregatedStats;

    if (p1.normalizedScore > p2.normalizedScore + 2) {
      mathVerdict = `${p1.name} is mathematically superior.`;
    } else if (p2.normalizedScore > p1.normalizedScore + 2) {
      mathVerdict = `${p2.name} is mathematically superior.`;
    } else {
      mathVerdict = `It is a statistical tie between ${p1.name} and ${p2.name}.`;
    }

    // Confidence based on sample size (balls)
    const minBalls = Math.min(p1.balls, p2.balls);
    if (minBalls < 50) mathConfidence = 30;
    else if (minBalls < 200) mathConfidence = 60;
    else if (minBalls < 1000) mathConfidence = 85;
    else mathConfidence = 99;
  } else if (aggregatedStats.length === 1) {
    const p1 = aggregatedStats[0];
    if (p1.normalizedScore > 60)
      mathVerdict = `${p1.name} is an elite performer in this context.`;
    else if (p1.normalizedScore > 40)
      mathVerdict = `${p1.name} is an average performer in this context.`;
    else mathVerdict = `${p1.name} performs below average in this context.`;

    mathConfidence = p1.balls > 500 ? 95 : p1.balls > 100 ? 75 : 40;
  }

  const synthPrompt = `
    You are the reporter for the Verdict Engine. The Math Engine has already calculated the absolute truth.
    You MUST NOT guess, be diplomatic, or change the verdict. You MUST report the Math Engine's findings as absolute fact.

    USER QUERY: "${query}"
    
    MATH ENGINE VERDICT: "${mathVerdict}"
    MATH ENGINE CONFIDENCE: ${mathConfidence}%
    
    CRITICAL INSTRUCTIONS:
    1. Your "verdict" field MUST align perfectly with the MATH ENGINE VERDICT. Do not be diplomatic.
    2. Your "confidence" field MUST be exactly ${mathConfidence}.
    3. In your "explanation", explain the result using the "Impact Score" (normalizedScore) from the STATS. 
       Explain that an Impact Score of 50 is average, above 50 is positive impact, and below 50 is negative impact.
       Cite the exact Impact Scores and Balls Faced to prove the point.
    4. Do NOT use raw averages or strike rates to justify the answer. Use the Impact Score.

    STATS: ${JSON.stringify(aggregatedStats)}
    
    Return JSON with:
    {
      "verdict": "Short, definitive verdict",
      "confidence": ${mathConfidence},
      "explanation": "Detailed explanation citing exact Impact Scores and balls faced.",
      "proof": {
        "type": "bar",
        "data": [{"name": "Player 1", "value": 75.2}, {"name": "Player 2", "value": 45.1}],
        "xAxis": "Player",
        "yAxis": "Impact Score (0-100)",
        "title": "Mathematical Impact Comparison"
      }
    }
  `;

  const synthResponse = await callAIApi([
    {
      role: "system",
      content: "You are a cricket data expert. Return ONLY valid JSON.",
    },
    { role: "user", content: synthPrompt },
  ]);

  return extractJson(synthResponse.choices[0].message.content);
}
