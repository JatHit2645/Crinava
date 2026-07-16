import os
import re

# 1. Update App.tsx
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

if "import React" not in app_content and "import * as React" not in app_content:
    app_content = 'import React, { Suspense } from "react";\n' + app_content
elif "Suspense" not in app_content:
    app_content = app_content.replace('import React', 'import React, { Suspense }')
    
replacements = [
    ('PredictionGame', './components/PredictionGame'),
    ('MatchesSection', './components/MatchesSection'),
    ('VerdictTool', './components/VerdictTool'),
    ('PlayerProfile', './pages/PlayerProfile'),
    ('AdminControlCenter', './pages/AdminControlCenter')
]

for comp, path in replacements:
    # Remove the static import
    static_import_pattern = r'^import\s+\{\s*' + comp + r'\s*\}\s+from\s+["\']' + path + r'["\'];?'
    app_content = re.sub(static_import_pattern, '', app_content, flags=re.MULTILINE)
    
    # Inject the lazy HOC right before `export default function App()`
    # Let's find a good spot.
    
lazy_code = "\n"
for comp, path in replacements:
    lazy_code += f"""
const Lazy{comp} = React.lazy(() => import("{path}").then(m => ({{ default: m.{comp} }})));
const {comp} = (props: any) => (
  <Suspense fallback={{<div className="flex w-full h-64 items-center justify-center text-white/50">Loading interface...</div>}}>
    <Lazy{comp} {{...props}} />
  </Suspense>
);
"""

app_start_idx = app_content.find("export default function App")
if app_start_idx != -1:
    app_content = app_content[:app_start_idx] + lazy_code + "\n" + app_content[app_start_idx:]

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_content)


# 2. Update vite.config.ts
vite_config = """import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'vendor-lucide';
              if (id.includes('framer-motion') || id.includes('motion')) return 'vendor-motion';
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/')) return 'vendor-react';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('zustand')) return 'vendor-zustand';
              return 'vendor-core'; 
            }
          }
        }
      },
      chunkSizeWarningLimit: 450
    },
    server: {
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== "true",
      watch: {
        ignored: ["**/match_cache.json", "**/logs/**"],
      },
    },
  };
});
"""

with open('vite.config.ts', 'w', encoding='utf-8') as f:
    f.write(vite_config)

print("Optimization applied.")
