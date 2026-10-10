/**
 * components/Home/Habits/habit-span-breakdown.tsx — Far-right span %
 *
 * Double-click the % at the end of a habit row. The window is that habit and
 * the span. A habit that prints a current/target lists that amount beside
 * each day or period, the same pair the cell prints. A yes/no lamp stays the
 * period name. An in-progress span also shows Running and Total. Closing
 * writes nothing.
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { percentLedText } from "@/lib/habit-led"
import type { HabitSpanBreakdown } from "@/lib/habit-span-breakdown"
import "./habit-form-dialog.css"

function NameList({
  rows,
  label,
}: {
  rows: { key: string; title: string; amount?: string }[]
  label: string
}) {
  if (rows.length === 0) return null
  return (
    <ul className="habit95-list-names habit-span-names" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.title}</span>
          {row.amount ? (
            <span className="habit-span-amount" data-testid="habit-span-amount">
              {row.amount}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function HabitSpanBreakdownDialog({
  open,
  onOpenChange,
  breakdown,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  breakdown: HabitSpanBreakdown | null
}) {
  if (!breakdown) return null
  const started = breakdown.columns.filter((column) => column.started)
  const ahead = breakdown.columns.filter((column) => !column.started)
  const split = started.length > 0 && ahead.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="habit95-dialog habit95-list-popup flex flex-col"
        hideClose
        data-ui-name="Span breakdown"
        data-ui-docs="components/Home/Habits/README.md"
        data-testid="habit-span-breakdown"
      >
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{breakdown.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {breakdown.habitName} across {breakdown.spanLabel}. Closing writes nothing.
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
          <div className="habit95-list-popup-body">
            {split ? (
              <>
                <NameList rows={started} label="Through today" />
                <p className="habit95-hint">Still ahead</p>
                <NameList rows={ahead} label="Still ahead" />
              </>
            ) : (
              <NameList rows={breakdown.columns} label="Periods in this span" />
            )}
            {breakdown.vacant ? <p className="habit95-list-empty">Nothing required in this span.</p> : null}
          </div>
          {!breakdown.vacant ? (
            <ul className="habit95-stat-readout" aria-label="Span figures">
              {breakdown.inProgress && breakdown.running != null ? (
                <li>
                  <span>Running</span>
                  <span data-testid="habit-span-running">{percentLedText(breakdown.running)}</span>
                </li>
              ) : null}
              {breakdown.total != null ? (
                <li>
                  <span>Total</span>
                  <span data-testid="habit-span-total">{percentLedText(breakdown.total)}</span>
                </li>
              ) : null}
            </ul>
          ) : null}
          {breakdown.note ? <p className="habit95-hint">{breakdown.note}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
