"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-period-notes.tsx — Food notes for a period
 *
 * Day, week, month, and year each keep their own note. A week shows its note
 * and the seven day notes. A month shows its note and the weeks inside it.
 * A year shows its note and the twelve month notes. Editing a child writes
 * that child, not the period above it.
 * These notes are not the Tracking day summary.
 */

import { foodDayLabel } from "@/components/Home/Tracking/tracking-log/food/food-day-rail"
import { parseLocalDate } from "@/lib/date-utils"
import { foodNoteKey, monthFoodNotes, useKitchenDayNotes, weekFoodNotes, writeDayNote, writeFoodNote, yearFoodNotes, type FoodNotePeriod } from "@/lib/kitchen-day-note"
import { format } from "date-fns"

function periodLabel(key: string): string {
  const date = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return foodDayLabel(date)
  if (/^\d{4}-\d{2}$/.test(date)) {
    const parsed = parseLocalDate(`${date}-01`)
    return parsed ? format(parsed, "MMM yyyy") : date
  }
  return foodDayLabel(date)
}

function NoteField({ label, storageKey, day }: { label: string; storageKey: string; day?: boolean }) {
  const value = useKitchenDayNotes((state) => state.notes[storageKey] ?? "")
  return (
    <label>
      {label}
      <textarea
        aria-label={label}
        value={value}
        onChange={(event) => {
          if (day) writeDayNote(storageKey, event.target.value)
          else writeFoodNote(storageKey, event.target.value)
        }}
      />
    </label>
  )
}

export function FoodPeriodNotes({
  period,
  anchor,
  days = [],
}: {
  period: FoodNotePeriod | "custom"
  anchor: Date
  days?: readonly string[]
}) {
  useKitchenDayNotes((state) => state.notes)
  if (period === "custom") {
    return (
      <section className="trk-food-notes" aria-label="Food notes">
        <h4>Notes</h4>
        <ul>
          {days.map((key) => (
            <li key={key}>
              <NoteField label={`Note for ${foodDayLabel(key)}`} storageKey={key} day />
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (period === "day") {
    const key = foodNoteKey("day", anchor)
    return (
      <section className="trk-food-notes" aria-label="Food note">
        <h4>Food note</h4>
        <NoteField label="Note" storageKey={key} day />
      </section>
    )
  }
  if (period === "week") {
    const bundle = weekFoodNotes(anchor)
    return (
      <section className="trk-food-notes" aria-label="Week food note">
        <h4>Week note</h4>
        <NoteField label="Week note" storageKey={bundle.weekKey} />
        <ul>
          {bundle.days.map((day) => (
            <li key={day.key}>
              <NoteField label={`Note for ${foodDayLabel(day.key)}`} storageKey={day.key} day />
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (period === "month") {
    const bundle = monthFoodNotes(anchor)
    return (
      <section className="trk-food-notes" aria-label="Month food note">
        <h4>Month note</h4>
        <NoteField label="Month note" storageKey={bundle.monthKey} />
        {bundle.weeks.map((week) => (
          <section key={week.weekKey} aria-label={week.weekKey}>
            <NoteField label={`Week note ${periodLabel(week.weekKey)}`} storageKey={week.weekKey} />
            <ul>
              {week.days.map((day) => (
                <li key={day.key}>
                  <NoteField label={`Note for ${foodDayLabel(day.key)}`} storageKey={day.key} day />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    )
  }
  const bundle = yearFoodNotes(anchor)
  return (
    <section className="trk-food-notes" aria-label="Year food note">
      <h4>Year note</h4>
      <NoteField label="Year note" storageKey={bundle.yearKey} />
      {bundle.months.map((month) => (
        <section key={month.monthKey} aria-label={month.monthKey}>
          <NoteField label={`Month note ${periodLabel(month.monthKey)}`} storageKey={month.monthKey} />
        </section>
      ))}
    </section>
  )
}
