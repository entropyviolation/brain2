/**
 * components/Home/Tracking/entry-dialog/labels.ts — Span lock default, night label, objective floor
 *
 * Pure. `blockFloor` is the morning a sleep night is keyed by, and the start
 * of a completed objective logged on this block. No hooks.
 */
import { parseLocalDate } from "@/lib/date-utils"
import type { TimeEntry, SpanLock } from "@/lib/time-entries"

/** "the night ending Thu, Sep 17" — sleep is keyed by the morning it ended. */
export function blockFloor(entry: Pick<TimeEntry, "date" | "startMin">): Date {
  const [year, month, day] = entry.date.split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1, Math.floor(entry.startMin / 60), entry.startMin % 60, 0, 0)
}

export function initialSpanLock(entry: TimeEntry): SpanLock {
  if (entry.spanLock === "start" || entry.spanLock === "end" || entry.spanLock === "duration") return entry.spanLock
  const endLinked = Boolean(entry.endEventId || entry.endJoinId)
  const startLinked = Boolean(entry.startEventId || entry.startJoinId)
  if (endLinked && !startLinked) return "end"
  return "start"
}

export function nightLabel(date: string): string {
  const parsed = parseLocalDate(date)
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : date
}
