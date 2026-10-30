"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Status = "idle" | "loading" | "done";

const NavigationProgressContext = createContext<{
  status: Status;
  start: (href: string) => void;
  onShown: () => void;
  onDone: () => void;
} | null>(null);

function normalize(path: string) {
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [shown, setShown] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (status === "loading") setStatus(shown ? "done" : "idle");
  }

  const start = useCallback((href: string) => {
    const target = new URL(href, window.location.href);
    if (normalize(target.pathname) === normalize(window.location.pathname)) return;
    setShown(false);
    setStatus("loading");
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (new URL(anchor.href).origin !== window.location.origin) return;
      start(anchor.href);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  const onShown = useCallback(() => setShown(true), []);
  const onDone = useCallback(() => setStatus("idle"), []);

  return (
    <NavigationProgressContext.Provider value={{ status, start, onShown, onDone }}>
      {children}
    </NavigationProgressContext.Provider>
  );
}

export function useStartNavigationProgress() {
  const context = useContext(NavigationProgressContext);
  if (!context) throw new Error("useStartNavigationProgress must be used within NavigationProgressProvider");
  return context.start;
}

export function NavigationProgressBar() {
  const context = useContext(NavigationProgressContext);
  if (!context || context.status === "idle") return null;

  return (
    <div
      key={context.status}
      aria-hidden="true"
      className={
        context.status === "loading"
          ? "absolute inset-x-0 -bottom-px h-0.5 origin-left animate-nav-progress bg-blue-500 dark:bg-blue-400"
          : "absolute inset-x-0 -bottom-px h-0.5 origin-left animate-nav-progress-done bg-blue-500 dark:bg-blue-400"
      }
      onAnimationStart={context.status === "loading" ? context.onShown : undefined}
      onAnimationEnd={context.status === "done" ? context.onDone : undefined}
    />
  );
}
