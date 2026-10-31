import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
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
  children,
}: {
  date: string;
  /** Every date with content, newest first; the arrows step through these. */
  dates: string[];
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const previous = dates.find((d) => d < date);
  const next = dates.findLast((d) => d > date);

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <DayLink date={previous} label="Previous Date">
          <ArrowLeftIcon />
        </DayLink>
        <h1 className="text-3xl font-semibold tracking-tight">{date}</h1>
        <DayLink date={next} label="Next Date">
          <ArrowRightIcon />
        </DayLink>
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
