"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_VIEW, VIEW_ATTRIBUTES, VIEW_STORAGE_KEYS, VIEWS, type View, type ViewScope } from "@/lib/view";

function isView(value: string | null): value is View {
  return VIEWS.includes(value as View);
}

export function getStoredView(scope: ViewScope): View {
  try {
    const value = localStorage.getItem(VIEW_STORAGE_KEYS[scope]);
    return isView(value) ? value : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

export function applyView(scope: ViewScope, view: View) {
  document.documentElement.setAttribute(VIEW_ATTRIBUTES[scope], view);
}

export function setView(scope: ViewScope, view: View) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEYS[scope], view);
  } catch {
    // Storage unavailable (e.g. blocked); the view still applies for this page.
  }
  applyView(scope, view);
}

// The attribute on <html> is the source of truth, so watch it directly.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: Object.values(VIEW_ATTRIBUTES) });
  return () => observer.disconnect();
}

/** The scope's current view, or null while prerendering and hydrating. */
export function useView(scope: ViewScope): View | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const value = document.documentElement.getAttribute(VIEW_ATTRIBUTES[scope]);
      return isView(value) ? value : DEFAULT_VIEW;
    },
    () => null,
  );
}
