/**
 * tracker/single-period.ts — Current column for a solo period view.
 *
 * Week, Month, and Season View show one column. The full window list stays
 * in the grade memo.
 */
import type { PeriodColumn } from "@/components/Home/Habits/period-habit-list"

/** Current column when a single-period rocker is on. The window list stays intact for grades. */
export function singlePeriodColumns(periods: PeriodColumn[]): PeriodColumn[] {
  if (periods.length === 0) return periods
  const current = periods.find((column) => column.isCurrent)
  return [current ?? periods[periods.length - 1]]
}
