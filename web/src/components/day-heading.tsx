import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { SidebarMenu } from "@/components/sidebar-menu";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function DayLink({ date, label, children }: { date?: string; label: string; children: React.ReactNode }) {
  if (!date) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  const text = `${label}: ${date}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Link href={`/${date}/`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))} />}
        aria-label={text}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{text}</TooltipContent>
    </Tooltip>
  );
}

export function DayHeading({
  date,
  dates,
  badge,
  actions,
  children,
}: {
  date: string;
  /** Every date with content, newest first; the arrows step through these. */
  dates: string[];
  badge?: React.ReactNode;
  /** Shown at the right end of the heading. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const previous = dates.find((d) => d < date);
  const next = dates.findLast((d) => d > date);

  return (
    <div className="sticky top-14 z-30 -mt-3 mb-3 flex flex-col gap-2 bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DayLink date={previous} label="Previous Date">
            <ArrowLeftIcon />
          </DayLink>
          <h1 className="text-3xl font-semibold tracking-tight whitespace-nowrap">{date}</h1>
          <DayLink date={next} label="Next Date">
            <ArrowRightIcon />
          </DayLink>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <SidebarMenu />
        </div>
      </div>
      {badge || children ? (
        <div className="flex flex-wrap items-center gap-3">
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
