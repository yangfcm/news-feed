import { Badge } from "@/components/ui/badge";

export function DayHeading({
  date,
  badge,
  children,
}: {
  date: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{date}</h1>
        {badge ? <Badge variant="secondary">{badge}</Badge> : null}
      </div>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}
