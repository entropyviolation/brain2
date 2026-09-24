/**
 * components/Home/ToDo/TodoPeriodNav.tsx — Date navigation for To-Do periods
 *
 * Prev / centered label / Next / Today — same furniture as Plan’s period toolbar.
 */
"use client"

import { navigateDate } from "@/components/Scheduler/scheduler-utils"
import { getPeriodNavLabel, isCurrentPeriod, type TodoPeriod } from "./todo-utils"

export function TodoPeriodNav({
  period,
  focusedDate,
  onFocusedDateChange,
}: {
  period: TodoPeriod
  focusedDate: Date
  onFocusedDateChange: (date: Date) => void
}) {
  const atCurrent = isCurrentPeriod(period, focusedDate)
  const prevLabel = period === "day" ? "Previous day" : period === "week" ? "Previous week" : "Previous month"
  const nextLabel = period === "day" ? "Next day" : period === "week" ? "Next week" : "Next month"

  return (
    <div className="todo-period">
      <button
        type="button"
        className="todo-btn todo-btn-icon"
        title="Previous"
        aria-label={prevLabel}
        onClick={() => onFocusedDateChange(navigateDate(focusedDate, period, -1))}
      >
        ‹
      </button>
      <h3>{getPeriodNavLabel(period, focusedDate)}</h3>
      <button
        type="button"
        className="todo-btn todo-btn-icon"
        title="Next"
        aria-label={nextLabel}
        onClick={() => onFocusedDateChange(navigateDate(focusedDate, period, 1))}
      >
        ›
      </button>
      <button
        type="button"
        className="todo-btn"
        disabled={atCurrent}
        onClick={() => onFocusedDateChange(new Date())}
      >
        Today
      </button>
    </div>
  )
}
