/**
 * components/Home/Habits/period/week-navigation.tsx — Habit week picker
 *
 * ‹, the date-range nameplate, ›, then Today / This month — the house order
 * (`TrackingPeriodNav`, `PlanPeriodNav`). The keys are silver keycaps
 * (`habit-chrome.css`) and carry `data-no95`, so the global Win95 button skin
 * in `app/win95.css` cannot repaint them. Today parks (hidden, its slot kept)
 * when the view already holds today, so the plate never moves. Double-clicking
 * the plate opens a date picker when `onPick` is set.
 *
 * Spec: §9.3 (display & interaction).
 */
"use client"

import { formatDateRange } from "@/lib/date-utils"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { usePeriodPicker } from "@/components/Home/Habits/period/period-picker"

interface WeekNavigationProps {
  currentWeekStart: Date
  weekEndDate: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onCurrentWeek: () => void
  rangeLabel?: string
  currentButtonLabel?: string
  previousAriaLabel?: string
  nextAriaLabel?: string
  /** The view already holds today. Today parks: hidden, its slot kept. */
  isCurrentPeriod?: boolean
  /** Double-click the nameplate to jump. The caller snaps the day to its period. */
  onPick?: (date: Date) => void
  /** Day the picker opens on. Defaults to `currentWeekStart`. */
  pickValue?: Date
}

export function WeekNavigation({
  currentWeekStart,
  weekEndDate,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  rangeLabel,
  currentButtonLabel = "Today",
  previousAriaLabel = "Previous Week",
  nextAriaLabel = "Next Week",
  isCurrentPeriod = false,
  onPick,
  pickValue,
}: WeekNavigationProps) {
  const picker = usePeriodPicker(pickValue ?? currentWeekStart, onPick)
  return (
    <div className="habit-week-nav">
      <button type="button" className="habit-chrome-btn" data-no95="" onClick={onPreviousWeek}>
        <ChevronLeft className="h-3 w-3" />
        <span className="sr-only">{previousAriaLabel}</span>
      </button>

      <span
        className="habit-week-nav-range"
        onDoubleClick={onPick ? picker.open : undefined}
        title={onPick ? "Double-click to pick a date" : undefined}
      >
        {rangeLabel ?? formatDateRange(currentWeekStart, weekEndDate)}
        {picker.input}
      </span>

      <button type="button" className="habit-chrome-btn" data-no95="" onClick={onNextWeek}>
        <ChevronRight className="h-3 w-3" />
        <span className="sr-only">{nextAriaLabel}</span>
      </button>

      <button
        type="button"
        data-no95=""
        className={`habit-chrome-btn habit-week-nav-today${isCurrentPeriod ? " is-parked" : ""}`}
        aria-hidden={isCurrentPeriod || undefined}
        tabIndex={isCurrentPeriod ? -1 : undefined}
        onClick={onCurrentWeek}
      >
        <Calendar className="h-3 w-3" />
        {currentButtonLabel}
      </button>
    </div>
  )
}
