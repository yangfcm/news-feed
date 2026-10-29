import Link from "next/link";
import { DayHeading } from "@/components/day-heading";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyDay({ date, latest }: { date: string; latest?: string }) {
  return (
    <>
      <DayHeading date={date} />
      <Card>
        <CardContent className="flex flex-col gap-2 text-muted-foreground">
          <p>No content for {date} yet.</p>
          {latest ? (
            <p>
              Latest digest:{" "}
              <Link href={`/${latest}/`} className="text-foreground underline underline-offset-4">
                {latest}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
