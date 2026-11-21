"use client";

import { useLayoutEffect } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

/**
 * Re-applies the stored theme when the root layout is mounted again on the
 * client (switching language remounts <html> without running the head script).
 * A layout effect runs before paint, so there is no flash.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const dark = stored === "dark" || ((!stored || stored === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    } catch {
      // Storage unavailable: the head script already applied the system theme.
    }
  }, []);
  return null;
}
