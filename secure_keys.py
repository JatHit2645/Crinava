import re
import os

fallback_code = """const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("WARNING: VITE_GEMINI_API_KEY is missing. AI features will be disabled.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : {
  models: {
    generateContent: async () => ({ text: "AI functionality disabled due to missing API key." })
  }
} as any;"""

# Replace in App.tsx
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Pattern matching the old init
pattern = r'const\s+apiKey\s*=\s*(?:process\.env\.GEMINI_API_KEY\s*\|\|\s*)?["\']AIzaSy[A-Za-z0-9_-]+["\'];\s*const\s+ai\s*=\s*new\s+GoogleGenAI\(\{\s*apiKey\s*\}\);'
app_content = re.sub(pattern, fallback_code, app_content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_content)


# Replace in MatchesSection.tsx
fallback_code_matches = """const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("WARNING: VITE_GEMINI_API_KEY is missing. AI features will be disabled.");
}
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : {
  models: {
    generateContent: async () => ({ text: "AI functionality disabled due to missing API key." })
  }
} as any;"""

with open('src/components/MatchesSection.tsx', 'r', encoding='utf-8') as f:
    matches_content = f.read()

pattern_matches = r'const\s+apiKey\s*=\s*(?:process\.env\.GEMINI_API_KEY\s*\|\|\s*)?["\']AIzaSy[A-Za-z0-9_-]*["\'];?\s*const\s+genAI\s*=\s*new\s+GoogleGenAI\(\{\s*apiKey\s*\}\);'

matches_content = re.sub(pattern_matches, fallback_code_matches, matches_content)

# In MatchesSection.tsx it might just say const apiKey = process.env.GEMINI_API_KEY || ""; Let's do a broader replace
pattern_matches_broad = r'const\s+apiKey\s*=\s*(?:process\.env\.GEMINI_API_KEY\s*\|\|\s*)?["\'].*?["\'];?\s*const\s+genAI\s*=\s*new\s+GoogleGenAI\(\{\s*apiKey\s*\}\);'
matches_content = re.sub(pattern_matches_broad, fallback_code_matches, matches_content)


with open('src/components/MatchesSection.tsx', 'w', encoding='utf-8') as f:
    f.write(matches_content)

print("Replaced hardcoded API keys with secure environment variables.")
