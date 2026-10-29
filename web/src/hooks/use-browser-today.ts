"use client";

import { useSyncExternalStore } from "react";
import { toDateString } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Today's date in the viewer's local time, or null while prerendering and hydrating —
 * the static HTML was rendered on the build day, which may not be today any more.
 */
export function useBrowserToday(): string | null {
  return useSyncExternalStore(subscribe, () => toDateString(new Date()), () => null);
}
