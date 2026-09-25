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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
