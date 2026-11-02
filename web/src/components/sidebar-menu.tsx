"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LABEL = "Calendar and filters";

const SidebarContext = createContext<React.ReactNode>(null);

/** Makes the page's sidebar available to SidebarMenu, wherever the page's heading puts it. */
export function SidebarProvider({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return <SidebarContext value={sidebar}>{children}</SidebarContext>;
}

/**
 * Below the lg breakpoint the sidebar is hidden, so it opens from a button in the page's
 * heading instead. Nothing is rendered on pages without a sidebar.
 */
export function SidebarMenu() {
  const sidebar = useContext(SidebarContext);
  if (!sidebar) return null;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger render={<Button variant="outline" size="icon" className="cursor-pointer lg:hidden" />} />
          }
          aria-label={LABEL}
        >
          <SlidersHorizontalIcon />
        </TooltipTrigger>
        <TooltipContent side="bottom">{LABEL}</TooltipContent>
      </Tooltip>
      {/*
        A popup has to fit the viewport, so unlike the sidebar it scrolls. The popup is a flex
        column, and the filters Card (overflow-hidden) would otherwise shrink to fit and clip
        its own content instead, hence `*:shrink-0`.
      */}
      <PopoverContent
        align="end"
        className="max-h-(--available-height) w-[min(22rem,calc(100vw-2rem))] gap-4 overflow-y-auto p-3 *:shrink-0 lg:hidden"
      >
        {sidebar}
      </PopoverContent>
    </Popover>
  );
}
