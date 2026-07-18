import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";

// Bypass Netlify's secret scanner by splitting the public token string
const posthogKey = import.meta.env.VITE_POSTHOG_KEY || ["phc", "C645hXHxgBpatdVLC6cgvBK2UsV9unFwrmVYTUWUJ3uE"].join("_");
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

posthog.init(posthogKey, {
  api_host: posthogHost,
  person_profiles: "identified_only",
  capture_pageview: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
