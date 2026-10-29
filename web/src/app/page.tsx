import { DayView } from "@/components/day-view";
import { EmptyDay } from "@/components/empty-day";
import { EntryFilterProvider, EntryFilters } from "@/components/entry-filters";
import { PageShell } from "@/components/page-shell";
import { TodayOnly, TodayView } from "@/components/today-view";
import { getAvailableDates, getDay } from "@/lib/data";
import { toFilterItem } from "@/lib/filters";
import { toDateString } from "@/lib/format";

export default function Home() {
  // Rendered at build time, so this is the build day; TodayView rechecks in the browser.
  const builtFor = toDateString(new Date());
  const day = getDay(builtFor);
  const dates = getAvailableDates();

  if (!day) {
    return (
      <PageShell dates={dates}>
        <TodayView builtFor={builtFor} latest={dates[0]}>
          <EmptyDay date={builtFor} latest={dates[0]} />
        </TodayView>
      </PageShell>
    );
  }

  return (
    <EntryFilterProvider items={day.entries.map(toFilterItem)}>
      <PageShell
        dates={dates}
        selected={builtFor}
        sidebar={
          <TodayOnly builtFor={builtFor}>
            <EntryFilters />
          </TodayOnly>
        }
      >
        <TodayView builtFor={builtFor} latest={dates[0]}>
          <DayView day={day} />
        </TodayView>
      </PageShell>
    </EntryFilterProvider>
  );
}
