"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  // Disable transitions for one frame so every element switches colours at once.
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  void getComputedStyle(root).colorScheme;
  requestAnimationFrame(() => style.remove());
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (e.g. blocked); the theme still applies for this page.
  }
  applyTheme(theme);
}

// The `dark` class on <html> is the source of truth, so watch it directly.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// The server can't know the theme; callers render a neutral state until hydration.
function getServerSnapshot(): Theme | null {
  return null;
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    // Re-apply after React's dev-mode remount resets <html> attributes; a no-op in production.
    applyTheme(getStoredTheme() ?? getSystemTheme());

    // Follow the system until the user picks a theme.
    const media = matchMedia(DARK_QUERY);
    const onSystemChange = () => {
      if (!getStoredTheme()) applyTheme(getSystemTheme());
    };

    // Keep other open tabs in sync when the theme is changed in one of them.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme() ?? getSystemTheme());
    };

    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return children;
}
