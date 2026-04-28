import React from "react";
import { createRoot } from "react-dom/client";
import { enableMapSet } from 'immer';
import App from "./App.tsx";
import "./index.css";
import "./config"; // Import config to run validation at startup
import "./i18n"; // Initialize i18n

// immer MapSet 지원 활성화
enableMapSet();

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.warn('[ServiceWorker] registration failed:', error);
    });
  });
}
