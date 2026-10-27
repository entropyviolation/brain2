/**
 * components/Reviews/morning/WalkSlot.tsx — One field on the to-do walk.
 *
 * Empty shows the stored value greyed as the placeholder. Typing replaces it.
 * `latestDayRating` and `latestResistance` decide stored vs logged today.
 */
"use client"

import { localDayKey } from "@/lib/reviews-store"
import type { Task } from "@/lib/types"

/** A stored value, and whether it was written on this ritual's day. */
export type StoredSlot = { value: string; today: boolean } | null

export function latestDayRating(task: Task, dayKey: string, field: "importance" | "excitement"): StoredSlot {
  const ratings = task.dayRatings ?? {}
  const own = ratings[dayKey]?.[field]
  if (own != null) return { value: String(own), today: true }
  const prior = Object.keys(ratings)
    .filter((key) => key < dayKey && ratings[key]?.[field] != null)
    .sort()
    .pop()
  return prior ? { value: String(ratings[prior]![field]), today: false } : null
}

export function latestResistance(task: Task, dayKey: string): StoredSlot {
  const last = task.resistanceReadings?.[task.resistanceReadings.length - 1]
  if (!last) return null
  return { value: String(last.value), today: localDayKey(new Date(last.at)) === dayKey }
}

/** One walk field. Empty shows the stored value greyed as the placeholder; typing replaces it. */
export function WalkSlot({
  label,
  value,
  stored,
  onChange,
}: {
  label: string
  value: string
  stored: StoredSlot
  onChange: (next: string) => void
}) {
  const state = value.trim() ? "new" : stored ? (stored.today ? "today" : "stored") : "empty"
  return (
    <label className="mr-slot" data-state={state}>
      <span className="mr-slot-label">
        {label}
        {state === "new" && stored ? (
          <button type="button" className="mr-slot-revert" onClick={() => onChange("")} title={`Keep ${stored.value}`}>
            keep {stored.value}
          </button>
        ) : (
          <span className="mr-slot-state">{state === "new" ? "new" : state === "today" ? "today" : state === "stored" ? "stored" : ""}</span>
        )}
      </span>
      <input
        className="mr-slot-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored?.value ?? "—"}
        inputMode="decimal"
        aria-label={label}
      />
    </label>
  )
}
