"use client";

import { EmptyDay } from "@/components/empty-day";
import { useBrowserToday } from "@/hooks/use-browser-today";

/**
 * The home page is prerendered for the build day. Once in the browser, if the viewer's
 * today is a later day, the build has no content for it yet, so show the empty state.
 */
export function TodayView({
  builtFor,
  latest,
  children,
}: {
  builtFor: string;
  latest?: string;
  children: React.ReactNode;
}) {
  const browserToday = useBrowserToday();
  if (browserToday && browserToday !== builtFor) return <EmptyDay date={browserToday} latest={latest} />;
  return children;
}
