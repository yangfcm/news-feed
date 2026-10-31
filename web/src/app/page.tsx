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
        <TodayView builtFor={builtFor} dates={dates}>
          <EmptyDay date={builtFor} dates={dates} />
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
          day.entries.length ? (
            <TodayOnly builtFor={builtFor}>
              <EntryFilters />
            </TodayOnly>
          ) : undefined
        }
      >
        <TodayView builtFor={builtFor} dates={dates}>
          <DayView day={day} dates={dates} />
        </TodayView>
      </PageShell>
    </EntryFilterProvider>
  );
}
