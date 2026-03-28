import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme";
import { EasyModeProvider } from "./context/EasyModeContext";
import { DesktopPhoneFrame } from "./components/DesktopPhoneFrame";
import { AppToastBridge } from "./components/ui/toast";
import { AppVersionFooter } from "./components/AppVersionFooter";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <EasyModeProvider>
        <AppToastBridge>
          <DesktopPhoneFrame>
            <App />
          </DesktopPhoneFrame>
          <AppVersionFooter />
        </AppToastBridge>
      </EasyModeProvider>
    </ThemeProvider>
  </StrictMode>,
);
