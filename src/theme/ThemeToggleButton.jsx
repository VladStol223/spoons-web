import React from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggleButton({ className = "", size = "md" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Dark" : "Light";
  const cls = `themeToggleBtn themeToggleBtn_${size} ${className}`.trim();
  return <button type="button" className={cls} onClick={toggleTheme} aria-label="Toggle dark mode">{label} Mode</button>;
}
