import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/studio.css";
import "./styles/studio-refinements.css";
import "./styles/premium-layout.css";
import "./styles/proportions-v2.css";
import "./styles/stable-layout-v1.css";
import "./styles/canvas-module-v1.css";
import "./styles/timeline-drag-feedback.css";
import "./styles/timeline-reference-v2.css";
import "./styles/canvas-interaction-v1.css";
import "./styles/audio-workflow-v1.css";
import "./styles/caption-tools-v1.css";
import "./styles/transition-tools-v1.css";
import "./styles/effects-tools-v1.css";
import "./styles/beat-markers-v1.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
