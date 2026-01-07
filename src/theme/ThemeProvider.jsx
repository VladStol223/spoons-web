import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "spoonsTheme";

function getInitialTheme() {
  const saved = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (saved === "dark" || saved === "light") return saved;
  const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark"))
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}
