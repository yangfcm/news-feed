"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SLOT_ID = "header-slot";
const LABEL = "Calendar and filters";

/** Where a page's own header controls go, left of the theme toggle. */
export function HeaderSlot() {
  return <div id={SLOT_ID} className="contents" />;
}

const subscribe = () => () => {};

/**
 * Below the lg breakpoint the sidebar is hidden, so it opens from a header button instead.
 * Portalled from the page, so the popover keeps the page's filter state.
 */
export function SidebarMenu({ children }: { children: React.ReactNode }) {
  // The header is in the root layout, so the slot exists once the page hydrates.
  const slot = useSyncExternalStore(subscribe, () => document.getElementById(SLOT_ID), () => null);
  if (!slot) return null;

  return createPortal(
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
        {children}
      </PopoverContent>
    </Popover>,
    slot,
  );
}
