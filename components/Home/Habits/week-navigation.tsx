/**
 * components/Home/Habits/week-navigation.tsx — Habit week picker
 *
 * Previous / next period, Today / This month, and the date-range nameplate.
 * Raised metal keys + engraved range inside the milled Habits fascia.
 *
 * Spec: §9.3 (display & interaction).
 */
"use client"

import { formatDateRange } from "@/lib/date-utils"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"

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
  /** Current period is a state (sunken), not a larger control. */
  isCurrentPeriod?: boolean
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
}: WeekNavigationProps) {
  return (
    <div className="habit-week-nav">
      <button type="button" className="habit-chrome-btn" onClick={onPreviousWeek}>
        <ChevronLeft className="h-3 w-3" />
        <span className="sr-only">{previousAriaLabel}</span>
      </button>

      <button
        type="button"
        className={`habit-chrome-btn${isCurrentPeriod ? " is-on" : ""}`}
        aria-pressed={isCurrentPeriod}
        onClick={onCurrentWeek}
      >
        <Calendar className="h-3 w-3" />
        {currentButtonLabel}
      </button>

      <span className="habit-week-nav-range">
        {rangeLabel ?? formatDateRange(currentWeekStart, weekEndDate)}
      </span>

      <button type="button" className="habit-chrome-btn" onClick={onNextWeek}>
        <ChevronRight className="h-3 w-3" />
        <span className="sr-only">{nextAriaLabel}</span>
      </button>
    </div>
  )
}
