import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { seedFromDocument } from "./lib/data";
import { installLinkHandler } from "./lib/router";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/prose.css";
import "./styles/content.css";
import "./styles/views.css";

// The static page already shows the note; keep its HTML before React takes over the root.
seedFromDocument();
installLinkHandler();

const root = document.getElementById("clio-root");
if (root) {
  root.removeAttribute("data-static");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
