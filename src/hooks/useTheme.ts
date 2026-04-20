import { useEffect } from "react";
import type { ThemeMode } from "@shared/types";

function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldBeDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", shouldBeDark);
}

export function useTheme(theme: ThemeMode | undefined) {
  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
  }, [theme]);
}
