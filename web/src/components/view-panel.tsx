"use client";

import { useView } from "@/hooks/use-view";
import { cn } from "@/lib/utils";
import { VIEW_PANEL_CLASSES, type View, type ViewScope } from "@/lib/view";

/**
 * One view of a page's entries. Until hydration every view is rendered and CSS shows the
 * saved one; after that only the current view stays mounted, so switching away from a view
 * stops any audio or video playing in it.
 */
export function ViewPanel({
  scope,
  view,
  className,
  children,
}: {
  scope: ViewScope;
  view: View;
  className?: string;
  children: React.ReactNode;
}) {
  const current = useView(scope);
  if (current && current !== view) return null;
  return <div className={cn(VIEW_PANEL_CLASSES[scope][view], className)}>{children}</div>;
}
