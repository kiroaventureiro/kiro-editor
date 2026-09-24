import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import WorkspaceLayoutControls from "./components/WorkspaceLayoutControls";
import "./styles/studio.css";
import "./styles/studio-refinements.css";
import "./styles/premium-layout.css";
import "./styles/proportions-v2.css";
import "./styles/modular-workspace.css";
import "./styles/dock-layout-v2.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <WorkspaceLayoutControls />
  </React.StrictMode>,
);
