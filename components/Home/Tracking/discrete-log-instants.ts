/**
 * components/Home/Tracking/discrete-log-instants.ts — Log ticks already in the vault
 *
 * Tracking log rows are TimeEntry instants. This reader collects the point logs
 * (intake, event, note, keyword, switch) so the Time grid's instant layer can
 * draw them. It does not write, migrate, or copy entries. An ordinary painted
 * interval stays a block even when a text pipeline stamped it.
 *
 * Older rows qualify from the fields they already have: `generatedBy.kind`
 * `"text"`, an Intake or Text log or Switch pen, `intakeClass`, an `eventKind`
 * that starts with `intake` or `switch`, or `switchFrom` / `switchTo`. A switch
 * painted on Location, Mood, Company, or Activity is included when it is that
 * tick, and it also stays on that scope's own grid.
 */
import { displayedPen, findPen, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { instantsForDay, type TimeEntry } from "@/lib/time-entries"

const INTAKE_PEN = "intake"
const TEXT_LOG_PEN = "text log"
const SWITCH_PEN = "switch"
const OBJECTIVE_PEN = "objective"

export function penNameById(scopes: readonly { pens: readonly { id: string; name: string }[] }[]): (penId: string) => string | undefined {
  const names = new Map<string, string>()
  for (const scope of scopes) {
    for (const pen of scope.pens) names.set(pen.id, pen.name)
  }
  return (penId) => names.get(penId)
}

/** Color for a tick. The active view's pen wins; a log on another view uses that pen. */
export function tickPen(scopes: readonly TrackScope[], active: TrackScope | undefined, penId: string): TrackPen | undefined {
  const onView = active ? displayedPen(active, penId) : undefined
  return onView ?? findPen([...scopes], penId)
}

function penIs(penName: string | undefined, expected: string): boolean {
  return (penName ?? "").trim().toLowerCase() === expected
}

function kindStarts(eventKind: string | undefined, prefix: string): boolean {
  const kind = (eventKind ?? "").trim().toLowerCase()
  return kind === prefix || kind.startsWith(`${prefix}.`) || kind.startsWith(`${prefix}-`)
}

/**
 * True for a point log. Intervals return false, including a text-pipeline span
 * such as Computer Work from 12:00 to 1:40.
 */
export function isDiscreteLogInstant(entry: Pick<TimeEntry, "kind" | "generatedBy" | "intakeClass" | "eventKind" | "switchFrom" | "switchTo">, penName?: string): boolean {
  if (entry.kind !== "instant") return false
  if (entry.generatedBy?.kind === "text") return true
  if (entry.intakeClass === "food" || entry.intakeClass === "drink" || entry.intakeClass === "drug") return true
  if (kindStarts(entry.eventKind, "intake") || kindStarts(entry.eventKind, "switch")) return true
  if ((entry.switchFrom ?? "").trim() || (entry.switchTo ?? "").trim()) return true
  if (penIs(penName, INTAKE_PEN) || penIs(penName, TEXT_LOG_PEN) || penIs(penName, SWITCH_PEN) || penIs(penName, OBJECTIVE_PEN)) {
    return true
  }
  return false
}

function byClock(a: TimeEntry, b: TimeEntry): number {
  if (a.startMin !== b.startMin) return a.startMin - b.startMin
  return a.id.localeCompare(b.id)
}

/** Every discrete log instant. Pass `date` to keep one local day. */
export function discreteLogInstants(
  entries: readonly TimeEntry[],
  penName?: (penId: string) => string | undefined,
  date?: string,
): TimeEntry[] {
  const rows: TimeEntry[] = []
  for (const entry of entries) {
    if (date && entry.date !== date) continue
    if (!isDiscreteLogInstant(entry, penName?.(entry.penId))) continue
    rows.push(entry)
  }
  return rows.sort(byClock)
}

/**
 * The scope's own instant ticks, plus every discrete log instant that day.
 * The same id is drawn once. Scope intervals are not in this list.
 */
export function scopeTicksWithDiscreteLogs(
  entries: readonly TimeEntry[],
  date: string,
  scopeId: string,
  penName?: (penId: string) => string | undefined,
): TimeEntry[] {
  const own = instantsForDay([...entries], date, scopeId)
  const logs = discreteLogInstants(entries, penName, date)
  if (logs.length === 0) return own
  const seen = new Set(own.map((entry) => entry.id))
  const extra = logs.filter((entry) => !seen.has(entry.id))
  if (extra.length === 0) return own
  return [...own, ...extra].sort(byClock)
}

/** Drop overlay ticks the discrete layer already drew, so a switch is one mark. */
export function overlayTicksBeside(
  overlayInstants: readonly TimeEntry[],
  shown: readonly TimeEntry[],
): TimeEntry[] {
  if (overlayInstants.length === 0 || shown.length === 0) return [...overlayInstants]
  const ids = new Set(shown.map((entry) => entry.id))
  return overlayInstants.filter((entry) => !ids.has(entry.id))
}
