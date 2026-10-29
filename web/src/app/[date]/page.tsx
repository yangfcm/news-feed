import type { Metadata } from "next";
import { DayView } from "@/components/day-view";
import { EmptyDay } from "@/components/empty-day";
import { PageShell } from "@/components/page-shell";
import { getAvailableDates, getDay } from "@/lib/data";

// Only the dates in the index exist; a static export cannot render others on demand.
export const dynamicParams = false;

// A static export fails on an empty list, so before the first digest a single
// placeholder page is generated instead.
const NO_DATES = "no-digest-yet";

export function generateStaticParams() {
  const dates = getAvailableDates();
  return (dates.length ? dates : [NO_DATES]).map((date) => ({ date }));
}

export async function generateMetadata({ params }: PageProps<"/[date]">): Promise<Metadata> {
  const { date } = await params;
  return { title: `News Feed · ${date}` };
}

export default async function DayPage({ params }: PageProps<"/[date]">) {
  const { date } = await params;
  const day = getDay(date);
  const dates = getAvailableDates();

  return (
    <PageShell dates={dates} selected={day ? date : undefined}>
      {day ? <DayView day={day} /> : <EmptyDay date={date} latest={dates[0]} />}
    </PageShell>
  );
}
