"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onLoad` when the end of a list scrolls into view. An observer only reports changes,
 * so remount it (a new `key`) after each load: if the end is still in view, it fires again.
 */
export function LoadMore({ onLoad }: { onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onLoad);

  useEffect(() => {
    latest.current = onLoad;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && latest.current(), {
      rootMargin: "0px 0px 200px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} aria-hidden />;
}
