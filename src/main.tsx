import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const host = window.location.hostname;
const isLocalHost = host === "localhost" || host === "127.0.0.1";
if (!isLocalHost || import.meta.env.VITE_ENABLE_PWA_LOCAL === "1") {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
