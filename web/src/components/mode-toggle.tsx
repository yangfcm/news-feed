"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = theme ? `Switch to ${next} mode` : "Toggle theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="outline" size="icon" className="cursor-pointer" />}
        onClick={() => setTheme(next)}
        aria-label={label}
      >
        {/* Driven by the `dark` class so the right icon shows before hydration. */}
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
