/**
 * tracker/habit-plan-log.tsx — Plan fieldset under a solo Habits view.
 *
 * Same `PlanTextLog` as the Plan tab. The legend is the period stamp.
 */
"use client"

import { format } from "date-fns"
import { addCalendarDays } from "@/lib/date-utils"
import { PlanTextLog, planPeriodStampProps } from "@/components/Home/Plan/plan-text-log"
import type { PlanTextPeriod } from "@/lib/plan-text"
import type { PeriodColumn } from "@/components/Home/Habits/period-habit-list"

export function HabitPlanLog({
  period,
  periodKey,
  legend,
  placeholder,
  size = "period",
}: {
  period: PlanTextPeriod
  periodKey: string
  legend: string
  placeholder: string
  size?: "day" | "period"
}) {
  return (
    <fieldset className="hab-period-plan hab-plan-frame" {...planPeriodStampProps(period)}>
      <legend>{legend}</legend>
      <PlanTextLog period={period} periodKey={periodKey} placeholder={placeholder} size={size} />
    </fieldset>
  )
}

export function weekPlanLegend(column: PeriodColumn): string {
  const end = addCalendarDays(column.date, 6)
  return `Week Plan — ${format(column.date, "MMM d")} to ${format(end, "MMM d")}`
}
