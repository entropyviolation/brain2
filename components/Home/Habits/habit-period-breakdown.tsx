/**
 * components/Home/Habits/habit-period-breakdown.tsx — Period percent, titles only
 *
 * Double-click a footer period percent. The window is that day or span.
 * The body is the habit names in the percent, with Completed / Not yet completed / All.
 * Closing writes nothing.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  periodBreakdownRows,
  periodBreakdownTitles,
  type PeriodBreakdownFilter,
  type PeriodBreakdownInput,
} from "@/lib/habit-period-breakdown"
import "./habit-form-dialog.css"

const FILTERS: { id: PeriodBreakdownFilter; label: string }[] = [
  { id: "completed", label: "Completed" },
  { id: "open", label: "Not yet completed" },
  { id: "all", label: "All" },
]

function quietEmpty(filter: PeriodBreakdownFilter, total: number): string | null {
  if (total === 0) return "Nothing in this period."
  if (filter === "completed") return "None completed."
  if (filter === "open") return "None still open."
  return null
}

export function HabitPeriodBreakdown({
  open,
  onOpenChange,
  title,
  tasks,
  period,
  data,
  isExempt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
} & PeriodBreakdownInput) {
  const [filter, setFilter] = useState<PeriodBreakdownFilter>("all")
  const input = useMemo(
    () => ({ tasks, period, data, isExempt }),
    [tasks, period, data, isExempt],
  )

  useEffect(() => {
    if (open) setFilter("all")
  }, [open, period.key])

  const total = periodBreakdownTitles(input).length
  const rows = periodBreakdownRows(input, filter)
  const empty = rows.length === 0 ? quietEmpty(filter, total) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="habit95-dialog habit95-list-popup flex flex-col"
        hideClose
        data-ui-name="Period breakdown"
        data-ui-docs="components/Home/Habits/README.md"
        data-testid="habit-period-breakdown"
      >
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Habit titles in {title}. Closing writes nothing.
          </DialogDescription>
          <button
            type="button"
            className="habit95-title-btn b2-close-key"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </DialogHeader>
        <div className="habit95-body">
          <div className="habit95-list-popup-tools" role="group" aria-label="Which habits">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="habit95-btn"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="habit95-list-popup-body">
            <ul className="habit95-list-names" aria-label={title}>
              {rows.map((row) => (
                <li key={row.id}>{row.title}</li>
              ))}
            </ul>
            {empty ? <p className="habit95-list-empty">{empty}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
