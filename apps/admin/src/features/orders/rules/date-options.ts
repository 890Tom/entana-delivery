export interface DateOption {
  /** YYYY-MM-DD, or "" for every date. */
  readonly value: string;
  readonly kind: "all" | "today" | "yesterday" | "earlier";
  readonly day: string | null;
}

const DAY_MS = 86_400_000;
const EARLIER_DAYS = 5;

function daysBefore(today: string, count: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - count * DAY_MS).toISOString().slice(0, 10);
}

/** Every date, today, yesterday, then the 5 days before: the days one may still look back at. */
export function buildDateOptions(today: string): readonly DateOption[] {
  const earlier = Array.from({ length: EARLIER_DAYS }, (_, index) =>
    daysBefore(today, index + 2),
  ).map((day): DateOption => ({ value: day, kind: "earlier", day }));
  return [
    { value: "", kind: "all", day: null },
    { value: today, kind: "today", day: today },
    { value: daysBefore(today, 1), kind: "yesterday", day: daysBefore(today, 1) },
    ...earlier,
  ];
}
