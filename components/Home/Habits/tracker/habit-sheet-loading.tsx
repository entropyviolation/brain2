/**
 * tracker/habit-sheet-loading.tsx — Busy well before the habits vault hydrates.
 *
 * The ellipsis is the single character ….
 */
"use client"

export function HabitSheetLoading() {
  return (
    <div className="habit-grid-wrap" aria-busy="true">
      <p className="text-sm text-muted-foreground p-4">Loading habits…</p>
    </div>
  )
}
