import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeCtx = { isDark: boolean; toggleTheme: () => void };

const ThemeContext = createContext<ThemeCtx>({ isDark: true, toggleTheme: () => {} });

const STORAGE_KEY = "sg-theme";

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "light";
  } catch {
    return true; // default dark
  }
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const pref = readPreference();
    applyTheme(pref);
    return pref;
  });

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Keep html class in sync if something external changes it
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeToggle() {
  return useContext(ThemeContext);
}
