"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_COLOR,
  THEME_COLOR_ATTRIBUTE,
  THEME_COLOR_STORAGE_KEY,
  THEME_COLORS,
  type ThemeColor,
} from "@/lib/theme-color";

function isThemeColor(value: string | null): value is ThemeColor {
  return THEME_COLORS.includes(value as ThemeColor);
}

export function getStoredThemeColor(): ThemeColor {
  try {
    const value = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
    return isThemeColor(value) ? value : DEFAULT_THEME_COLOR;
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

export function applyThemeColor(color: ThemeColor) {
  const root = document.documentElement;
  if (color === DEFAULT_THEME_COLOR) root.removeAttribute(THEME_COLOR_ATTRIBUTE);
  else root.setAttribute(THEME_COLOR_ATTRIBUTE, color);
}

export function setThemeColor(color: ThemeColor) {
  try {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
  } catch {
    // Storage unavailable (e.g. blocked); the color still applies for this page.
  }
  applyThemeColor(color);
}

// The attribute on <html> is the source of truth, so watch it directly.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_COLOR_ATTRIBUTE] });
  return () => observer.disconnect();
}

/** The current theme color, or null while prerendering and hydrating. */
export function useThemeColor(): ThemeColor | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const value = document.documentElement.getAttribute(THEME_COLOR_ATTRIBUTE);
      return isThemeColor(value) ? value : DEFAULT_THEME_COLOR;
    },
    () => null,
  );
}
