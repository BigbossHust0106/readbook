import "./readerFonts.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ParentGate } from "./ParentLock";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ParentGate><App /></ParentGate>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
