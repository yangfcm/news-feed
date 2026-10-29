"use client";

import { useRouter } from "next/navigation";
import { enUS } from "react-day-picker/locale";
import { useBrowserToday } from "@/hooks/use-browser-today";
import { Calendar } from "@/components/ui/calendar";
import { parseDateString, toDateString } from "@/lib/format";

/** Only dates that have a digest can be picked; picking one opens its page. */
export function DateCalendar({ dates, selected }: { dates: string[]; selected?: string }) {
  const router = useRouter();
  const browserToday = useBrowserToday();
  const available = new Set(dates);
  const hasContent = dates.map(parseDateString);
  const initial = selected ?? dates[0];

  return (
    <Calendar
      mode="single"
      required
      // A fixed locale, so dates format the same at build time and in the browser.
      locale={enUS}
      selected={selected ? parseDateString(selected) : undefined}
      defaultMonth={initial ? parseDateString(initial) : undefined}
      // Leave "today" unmarked until hydrated, so the prerendered HTML still matches.
      today={browserToday ? parseDateString(browserToday) : new Date(0)}
      disabled={(date) => !available.has(toDateString(date))}
      modifiers={{ hasContent }}
      modifiersClassNames={{ hasContent: "font-semibold [&_button]:font-semibold" }}
      onSelect={(date) => router.push(`/${toDateString(date)}/`)}
      className="w-full rounded-lg border [--cell-size:--spacing(9)]"
      classNames={{ root: "w-full" }}
    />
  );
}
