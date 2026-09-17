"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "light" | "dark" | "auto";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const STORAGE_KEY = "fpo-theme";

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline script in layout.tsx already applied the right class before
  // paint; this just syncs React's own state to what's in storage.
  const [theme, setThemeState] = useState<Theme>("auto");

  useEffect(() => {
    // Deliberately deferred to after mount: the server (and first client
    // render) always assumes "auto" so hydration matches, then this corrects
    // state to match whatever the pre-paint init script (layout.tsx) read
    // from localStorage.
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "light" || stored === "dark" || stored === "auto") setThemeState(stored);
  }, []);

  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
