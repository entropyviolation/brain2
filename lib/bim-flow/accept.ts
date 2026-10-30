/**
 * lib/bim-flow/accept.ts — Write one accepted suggestion through the app's own paths
 *
 * Each accept is one undo step (`runAsAction`). A time block is painted as an Activity entry
 * (marked estimated when the flow guessed), an item goes through Quick Add capture onto the list the
 * flow picked, a habit goes through the same writer BIM's `habit:` command uses. The note on a
 * block says the flow made it. **Planned:** an `llm` kind on `generatedBy`, so these rows can be found and swept.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { ensureActivityPen } from "@/lib/ingest/apply-activity-span"
import { applyCapture } from "@/lib/ingest/apply-capture"
import { writeHabit } from "@/lib/ingest/apply-habit"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Suggestion } from "./suggestions"

export interface Accepted {
  ok: boolean
  message: string
}

const MINUTES_PER_DAY = 1440

/** Calendar-day pieces of [start, end): a block over midnight is stored as one entry per day. */
export function dayPieces(startIso: string, endIso: string): { date: string; startMin: number; endMin: number }[] {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const out: { date: string; startMin: number; endMin: number }[] = []
  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day < end; day.setDate(day.getDate() + 1)) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    const a = Math.max(start.getTime(), day.getTime())
    const b = Math.min(end.getTime(), next.getTime())
    const startMin = Math.round((a - day.getTime()) / 60_000)
    const endMin = b >= next.getTime() ? MINUTES_PER_DAY : Math.round((b - day.getTime()) / 60_000)
    if (endMin > startMin) out.push({ date: formatLocalDateKey(day), startMin, endMin })
  }
  return out
}

function acceptTimeblock(s: Suggestion): Accepted {
  if (!s.end) return { ok: false, message: "NO END TIME" }
  const pieces = dayPieces(s.at, s.end)
  const entries = useTimeTrackingStore.getState().entries
  // Someone may have painted this time since the suggestion was made.
  const taken = pieces.some((p) => entries.some((e) => e.scopeId === "activity" && e.date === p.date && e.startMin < p.endMin && e.endMin > p.startMin))
  if (taken) return { ok: false, message: "TIME NOW HAS AN ACTIVITY. RUN AGAIN." }
  runAsAction(`Accept suggested block: ${s.title}`, () => {
    const penId = ensureActivityPen(s.title)
    for (const p of pieces) {
      useTimeTrackingStore.getState().paintMinutes(p.date, "activity", p.startMin, p.endMin, penId, undefined, undefined, s.estimated ? "estimated" : undefined, {
        notes: `Suggested by BIM flow (${s.source}): ${s.why}`,
      })
    }
  })
  return { ok: true, message: `PAINTED ${s.title.toUpperCase()}` }
}

function acceptItem(s: Suggestion): Accepted {
  const result = runAsAction(`Accept suggested item: ${s.title}`, () => applyCapture(s.list ? `${s.list}: ${s.title}` : s.title, { sendToInbox: !s.list }))
  return { ok: result.status === "ok", message: (result.reply ?? "").toUpperCase() }
}

function acceptHabit(s: Suggestion): Accepted {
  const habit = useHabitsStore.getState().tasks.find((t) => t.id === s.habitId)
  if (!habit) return { ok: false, message: "HABIT NOT FOUND" }
  const result = runAsAction(`Accept suggested habit: ${s.title}`, () => writeHabit(habit, "", new Date(s.at)))
  return { ok: result.status === "ok", message: (result.reply ?? "").toUpperCase() }
}

export function acceptSuggestion(s: Suggestion): Accepted {
  try {
    return s.kind === "timeblock" ? acceptTimeblock(s) : s.kind === "item" ? acceptItem(s) : acceptHabit(s)
  } catch (err) {
    return { ok: false, message: `FAILED: ${err instanceof Error ? err.message.toUpperCase() : "ERROR"}` }
  }
}
