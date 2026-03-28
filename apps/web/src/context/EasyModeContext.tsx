import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "indentix_easy_mode";

type EasyModeValue = {
  easyMode: boolean;
  setEasyMode: (v: boolean) => void;
};

const EasyModeContext = createContext<EasyModeValue | null>(null);

export function EasyModeProvider({ children }: { children: ReactNode }) {
  const [easyMode, setEasyModeState] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setEasyModeState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const setEasyMode = useCallback((v: boolean) => {
    setEasyModeState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ easyMode, setEasyMode }), [easyMode, setEasyMode]);

  return <EasyModeContext.Provider value={value}>{children}</EasyModeContext.Provider>;
}

export function useEasyMode(): EasyModeValue {
  const ctx = useContext(EasyModeContext);
  if (!ctx) throw new Error("useEasyMode must be used within EasyModeProvider");
  return ctx;
}
