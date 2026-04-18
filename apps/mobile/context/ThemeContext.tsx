import { createContext, useContext, useState, type ReactNode } from "react";
import { darkTheme, lightTheme, type Theme } from "../theme";
import { getPref, setPref } from "../db/database";

type ThemeCtx = { theme: Theme; isDark: boolean; toggleTheme: () => void };

const ThemeContext = createContext<ThemeCtx>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

function loadSavedTheme(): boolean {
  try {
    const saved = getPref("theme_mode");
    if (saved === "light") return false;
    return true;
  } catch {
    return true;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => loadSavedTheme());

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      setPref("theme_mode", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeToggle() {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  return { isDark, toggleTheme };
}
