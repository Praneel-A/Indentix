import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { ThemeToggle } from "./components/ThemeToggle";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemeToggle />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
