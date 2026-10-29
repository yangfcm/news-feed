export function DayHeading({ date, children }: { date: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-3xl font-semibold tracking-tight">{date}</h1>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}
