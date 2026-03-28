import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "indentix-theme";

type ThemeContextValue = {
  dark: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(readInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  const value = useMemo(() => ({ dark, toggle }), [dark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
