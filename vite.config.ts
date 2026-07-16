import tailwindcss from "@tailwindcss/vite";
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
