import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import App from "./App";
import "./theme.css";
import "./styles.css";
import { StudioThemeProvider } from "./theme/StudioTheme";
import StudioRuntime from "./theme/StudioRuntime";
import "./theme/studio-tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StudioThemeProvider>
      <StudioRuntime>
        <App />
      </StudioRuntime>
    </StudioThemeProvider>
  </React.StrictMode>,
);
