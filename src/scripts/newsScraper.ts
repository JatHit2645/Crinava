import { aiClient } from "../lib/ai";

export const scrapeAndRefineNews = async () => {
  try {
    console.log("[News Scraper] Harvesting live cricket feeds...");
    
    // 1. Simulating a raw RSS/Scraped feed payload
    const mockFeed = [
      { id: 1, title: "Kohli hits brilliant century in final test", content: "Virat Kohli scored his 80th international century today in a stunning display against Australia..." },
      { id: 2, title: "Virat Kohli's majestic 100", content: "A phenomenal knock from Kohli, reaching another century mark in Test cricket..." },
      { id: 3, title: "Pant returns to Test squad", content: "Rishabh Pant is officially back in the Test squad after his long recovery..." },
      { id: 4, title: "Kohli reigns supreme with 100", content: "The Australian attack had no answers for Virat Kohli as he scored yet another century..." },
      { id: 5, title: "Bumrah takes 5-fer", content: "Jasprit Bumrah destroyed the top order with a 5-wicket haul..." }
    ];

    // 2. Semantic Clustering (Grouping) via Gemini
    console.log("[News Scraper] Performing Semantic Clustering via Gemini...");
    const clusterPrompt = `Analyze the following news articles and group them by exact same event. Return ONLY a JSON array of clusters, where each cluster is an array of article IDs. Example: [[1, 2, 4], [3], [5]].\n\nArticles:\n${JSON.stringify(mockFeed)}`;
    
    const clusterRes = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: clusterPrompt,
      generationConfig: { responseMimeType: "application/json" }
    });

    const clusters = JSON.parse(clusterRes.text || "[]");
    const synthesizedDrafts = [];
    
    // 3. Synthesis & Refinement
    for (const cluster of clusters) {
      // Only refine if multiple sources confirm the same event (Anti-Slop filtering)
      if (cluster.length >= 2) { 
        console.log(`[News Scraper] Synthesizing cluster with ${cluster.length} sources...`);
        const sources = mockFeed.filter(a => cluster.includes(a.id));
        
        const refinePrompt = `You are an expert cricket journalist. Synthesize these ${cluster.length} news articles into a single, comprehensive, engaging, and highly accurate Markdown blog post. Do not hallucinate facts outside these articles. Include a catchy title on the first line starting with #.\n\nArticles: ${JSON.stringify(sources)}`;
        
        const refineRes = await aiClient.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: refinePrompt
        });

        synthesizedDrafts.push(refineRes.text);
      }
    }
    
    console.log(`[News Scraper] Generated ${synthesizedDrafts.length} high-quality drafts.`);
    return synthesizedDrafts;
  } catch (error) {
    console.error("[News Scraper] Error:", error);
    return [];
  }
};
