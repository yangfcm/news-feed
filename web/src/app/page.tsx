import { DayView } from "@/components/day-view";
import { EmptyDay } from "@/components/empty-day";
import { PageShell } from "@/components/page-shell";
import { TodayView } from "@/components/today-view";
import { getAvailableDates, getDay } from "@/lib/data";
import { toDateString } from "@/lib/format";

export default function Home() {
  // Rendered at build time, so this is the build day; TodayView rechecks in the browser.
  const builtFor = toDateString(new Date());
  const day = getDay(builtFor);
  const dates = getAvailableDates();

  return (
    <PageShell dates={dates} selected={day ? builtFor : undefined}>
      <TodayView builtFor={builtFor} latest={dates[0]}>
        {day ? <DayView day={day} /> : <EmptyDay date={builtFor} latest={dates[0]} />}
      </TodayView>
    </PageShell>
  );
}
