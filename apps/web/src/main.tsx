import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { AppToastBridge } from "./components/ui/toast";
import { AppVersionFooter } from "./components/AppVersionFooter";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppToastBridge>
        <App />
        <AppVersionFooter />
      </AppToastBridge>
    </ThemeProvider>
  </StrictMode>,
);
