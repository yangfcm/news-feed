"use client";

import { ChevronDownIcon, LayoutGridIcon, ListIcon, NewspaperIcon, type LucideIcon } from "lucide-react";
import { useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { applyView, getStoredView, setView, useView } from "@/hooks/use-view";
import { DEFAULT_VIEW, VIEW_STORAGE_KEYS, VIEWS, type View, type ViewScope } from "@/lib/view";

const OPTIONS: Record<View, { label: string; icon: LucideIcon }> = {
  article: { label: "Article", icon: NewspaperIcon },
  card: { label: "Card", icon: LayoutGridIcon },
  list: { label: "List", icon: ListIcon },
};

/** Icon + label on large screens, icon only on medium, a dropdown on small. */
export function ViewSwitcher({ scope }: { scope: ViewScope }) {
  const view = useView(scope);

  useLayoutEffect(() => {
    // Re-apply after React's dev-mode remount resets <html> attributes; a no-op in production.
    applyView(scope, getStoredView(scope));

    const onStorage = (event: StorageEvent) => {
      if (event.key === VIEW_STORAGE_KEYS[scope]) applyView(scope, getStoredView(scope));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [scope]);

  const CurrentIcon = OPTIONS[view ?? DEFAULT_VIEW].icon;

  return (
    <>
      <ButtonGroup aria-label="View" className="hidden sm:flex">
        {VIEWS.map((option) => {
          const { label, icon: Icon } = OPTIONS[option];
          const selected = option === view;
          return (
            <Tooltip key={option}>
              <TooltipTrigger
                render={
                  <Button
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    aria-label={label}
                    className="cursor-pointer"
                  />
                }
                onClick={() => setView(scope, option)}
              >
                <Icon data-icon="inline-start" />
                <span className="hidden lg:inline">{label}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="lg:hidden">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" aria-label="View" className="cursor-pointer sm:hidden" />}
        >
          <CurrentIcon data-icon="inline-start" />
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuRadioGroup value={view} onValueChange={(value: View) => setView(scope, value)}>
            {VIEWS.map((option) => {
              const { label, icon: Icon } = OPTIONS[option];
              return (
                <DropdownMenuRadioItem key={option} value={option} className="cursor-pointer">
                  <Icon />
                  {label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
