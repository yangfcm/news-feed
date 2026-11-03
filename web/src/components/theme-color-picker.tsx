"use client";

import { PaletteIcon } from "lucide-react";
import { useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { applyThemeColor, getStoredThemeColor, setThemeColor, useThemeColor } from "@/hooks/use-theme-color";
import { DEFAULT_THEME_COLOR, THEME_COLOR_STORAGE_KEY, THEME_COLORS, type ThemeColor } from "@/lib/theme-color";
import { cn } from "@/lib/utils";

const LABEL = "Theme color";

const NAMES: Record<ThemeColor, string> = {
  default: "Default",
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
};

export function ThemeColorPicker() {
  const color = useThemeColor();

  useLayoutEffect(() => {
    // Re-apply after React's dev-mode remount resets <html> attributes; a no-op in production.
    applyThemeColor(getStoredThemeColor());

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_COLOR_STORAGE_KEY) applyThemeColor(getStoredThemeColor());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="cursor-pointer" />} />
          }
          aria-label={LABEL}
        >
          <PaletteIcon className="text-brand-text" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{LABEL}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuRadioGroup value={color} onValueChange={(value: ThemeColor) => setThemeColor(value)}>
          {THEME_COLORS.map((option) => {
            const isDefault = option === DEFAULT_THEME_COLOR;
            return (
              <DropdownMenuRadioItem key={option} value={option} className="cursor-pointer">
                {/* The default swatch skips the attribute so it isn't tinted by the current color. */}
                <span
                  data-theme-color={isDefault ? undefined : option}
                  className={cn("size-3 rounded-full", isDefault ? "bg-primary" : "bg-brand")}
                />
                {NAMES[option]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
