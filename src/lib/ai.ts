// Force Vercel rebuild trigger
console.log("ai.ts: Initializing AI client...");
const apiKey = (process.env.NVIDIA_API_KEY || process.env.MISTRAL_API_KEY)
  ?.trim()
  ?.replace(/^["']|["']$/g, "");
console.log(
  "ai.ts: API Key found:",
  !!apiKey,
  apiKey ? `(Prefix: ${apiKey.substring(0, 10)}...)` : "(NONE)",
);

let baseURL =
  process.env.NVIDIA_API_URL || ("https://integrate.api" + ".nvidia.com/v1");
console.log(
  "ai.ts: Raw NVIDIA_API_URL:",
  process.env.NVIDIA_API_URL || "(DEFAULT)",
);
// Sanitize: remove trailing slashes and common path segments if they exist
baseURL = baseURL.trim().replace(/\/+$/, "");
// Remove /chat/completions if it exists at the end (with or without trailing slash was handled above)
if (baseURL.toLowerCase().endsWith("/chat/completions")) {
  baseURL = baseURL.substring(0, baseURL.length - "/chat/completions".length);
}
// Final trim and slash removal
baseURL = baseURL.replace(/\/+$/, "");
console.log("ai.ts: Final sanitized baseURL:", baseURL);
// Ensure it doesn't end with /v1/ if the SDK is going to add it?
// Actually OpenAI SDK adds /chat/completions to whatever baseURL is provided.
// So if baseURL is https://api.example.com/v1, it hits https://api.example.com/v1/chat/completions

export const aiClient = {
  chat: {
    completions: {
      create: () => {
        throw new Error(
          "SDK_USAGE_DETECTED: The OpenAI SDK is being used instead of direct fetch!",
        );
      },
    },
  },
  baseURL: baseURL,
} as any;
console.log("ai.ts: AI client initialized:", !!aiClient);
