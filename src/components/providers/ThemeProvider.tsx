"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
export type ColorPalette = "berry" | "tangerine" | "teal" | "marigold" | "green";

export const COLOR_PALETTES: Array<{ id: ColorPalette; name: string; color: string }> = [
  { id: "berry", name: "Berry", color: "#4B1426" },
  { id: "tangerine", name: "Tangerine", color: "#EB7D00" },
  { id: "teal", name: "Teal", color: "#287A74" },
  { id: "marigold", name: "Marigold", color: "#E4B028" },
  { id: "green", name: "Green", color: "#00A95C" },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: ColorPalette;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "mypos.theme";
const PALETTE_STORAGE_KEY = "mypos.palette";

function isPalette(value: string | null): value is ColorPalette {
  return COLOR_PALETTES.some((palette) => palette.id === value);
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(theme: Theme) {
  return theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [palette, setPaletteState] = useState<ColorPalette>("teal");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) setThemeState(stored);
    const storedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (isPalette(storedPalette)) setPaletteState(storedPalette);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");

    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => document.documentElement.classList.toggle("dark", media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const setPalette = useCallback((next: ColorPalette) => {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    setPaletteState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
