import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

const STORAGE_KEY = "indentix-theme";

type ThemeContextValue = {
  dark: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** App ships light mode only; dark class is cleared so UI stays cohesive. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ dark: false, toggle: () => {} }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
