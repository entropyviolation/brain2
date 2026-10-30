/**
 * tracker/habits-scratch-pad.tsx — Habits scratch pad under every Habits tab.
 *
 * A `PlanTextLog` (the Plan tab's composer) scoped to the period on screen:
 * the day in Day View, otherwise the viewed week on Daily / Weekly, the viewed
 * month, or the viewed season. Changing the period loads that period's notes.
 * Desktop mounts it below the desk; the phone page puts it in the plan slot.
 */
"use client"

import { format } from "date-fns"
import { PlanTextLog, PLAN_DOCS } from "@/components/Home/Plan/plan-text-log"
import { HABITS_SCRATCH_PERIOD, habitsScratchKey, type PlanTextPeriod } from "@/lib/plan-text"
import { addCalendarDays, formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterLabel } from "@/lib/seasons"
import type { HabitFrequency } from "@/lib/types"
import type { UiNameStamp } from "@/components/append-log"

export const HABITS_SCRATCH_STAMP: UiNameStamp = {
  name: "Habits scratch pad",
  help: "Loose notes for the day, week, month, or season showing on Habits. Submit stamps an entry.",
  docs: "components/Home/Habits/README.md",
}

export type HabitsScratchTarget = { scope: PlanTextPeriod; periodKey: string; label: string }

export function habitsScratchTarget({
  habitTab,
  dayView,
  currentDate,
  currentWeekStart,
  currentMonth,
  currentQuarter,
}: {
  habitTab: HabitFrequency
  dayView: boolean
  currentDate: Date
  currentWeekStart: Date
  currentMonth: Date
  currentQuarter: Date
}): HabitsScratchTarget {
  if (habitTab === "daily" && dayView) {
    return { scope: "day", periodKey: formatLocalDateKey(currentDate), label: format(currentDate, "MMMM dd, yyyy") }
  }
  if (habitTab === "monthly") {
    return { scope: "month", periodKey: format(currentMonth, "yyyy-MM"), label: format(currentMonth, "MMMM yyyy") }
  }
  if (habitTab === "quarterly") {
    const key = quarterKey(currentQuarter)
    return { scope: "quarter", periodKey: key, label: quarterLabel(key) }
  }
  return {
    scope: "week",
    periodKey: getWeekString(currentWeekStart),
    label: `${format(currentWeekStart, "MMM d")} to ${format(addCalendarDays(currentWeekStart, 6), "MMM d")}`,
  }
}

export function HabitsScratchPad({ target }: { target: HabitsScratchTarget }) {
  return (
    <fieldset
      className="hab-period-plan hab-plan-frame hab-scratch-pad"
      data-ui-name={HABITS_SCRATCH_STAMP.name}
      data-ui-help={HABITS_SCRATCH_STAMP.help}
      data-ui-docs={HABITS_SCRATCH_STAMP.docs ?? PLAN_DOCS}
    >
      <legend>Habits scratch pad — {target.label}</legend>
      <PlanTextLog
        period={HABITS_SCRATCH_PERIOD}
        periodKey={habitsScratchKey(target.scope, target.periodKey)}
        placeholder="Scratch notes about your habits — ideas, tweaks, what's working..."
        size="period"
        stamp={HABITS_SCRATCH_STAMP}
      />
    </fieldset>
  )
}
