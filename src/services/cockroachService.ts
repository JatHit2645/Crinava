import axios from "axios";

// Get the URL from env or fallback to the current one
const ENGINE_URL =
  process.env.CRINAVA_ENGINE_URL ||
  "https://jathit2645-crinava-engine.hf.space";

export const getSeriesList = async () => {
  try {
    console.log(`📡 Fetching series from Engine: ${ENGINE_URL}/series`);
    const response = await axios.get(`${ENGINE_URL}/series`);
    return response.data.map((s: any) => ({
      event_name: s.event_name,
      season: s.season,
      match_count: s.match_count,
      match_type: s.match_type || "T20",
    }));
  } catch (error) {
    console.error("Engine fetch error:", error);
    return [];
  }
};

export const getMatchesBySeries = async (eventName: string, season: string) => {
  try {
    console.log(
      `🚀 Engine Request: /matches?event=${eventName}&season=${season}`,
    );
    const response = await axios.get(`${ENGINE_URL}/matches`, {
      params: { event: eventName, season: season },
    });
    return response.data;
  } catch (error) {
    console.error("Engine matches error:", error);
    return [];
  }
};

export const getMatchDetails = async (matchId: string) => {
  try {
    const response = await axios.get(`${ENGINE_URL}/match/${matchId}`);
    return response.data;
  } catch (error) {
    console.error("Engine details error:", error);
    return [];
  }
};
