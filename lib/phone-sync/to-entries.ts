/**
 * lib/phone-sync/to-entries.ts — Phone records to Tracking rows
 *
 * Texts are instants on iPhone Texts. Calls are intervals on iPhone Calls,
 * sliced at local midnight; a missed call is an instant. Exact clocks, so no
 * `precision: "estimated"` (the BIM `call:` / `text:` verbs stay estimated).
 * The row keeps a short preview only: full bodies live in the message archive
 * (`archive.ts`), because the origin's localStorage holds ~5 MB for every key.
 * Pure.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { phoneEntryId, phoneStamp } from "./ids"
import type { CallRecord, MessageRecord, PhoneRecord } from "./types"

export const PREVIEW_CHARS = 120
const MINUTES_PER_DAY = 1440

export interface EntryTargets {
  textsScopeId: string
  callsScopeId: string
  /** Pen for the record's person on the given scope. */
  penFor: (record: PhoneRecord, scopeId: string) => string
}

export function preview(body: string, max = PREVIEW_CHARS): string {
  const flat = body.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function localMinute(ms: number): { date: string; min: number; dayStart: number } {
  const d = new Date(ms)
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return { date: formatLocalDateKey(d), min: d.getHours() * 60 + d.getMinutes(), dayStart }
}

/** Wall-clock minute of `ms`, rounded up, so DST days line up with `localMinute`. */
function wallMinuteUp(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)
}

function messageEntry(record: MessageRecord, t: EntryTargets): TimeEntry {
  const { date, min } = localMinute(record.at)
  const arrow = record.direction === "out" ? "→" : "←"
  const text = preview(record.body) || (record.attachments?.length ? "attachment" : "")
  return {
    id: phoneEntryId(record.source, record.sourceId),
    date,
    scopeId: t.textsScopeId,
    penId: t.penFor(record, t.textsScopeId),
    kind: "instant",
    startMin: min,
    endMin: min,
    title: `${arrow} ${text}`.trim(),
    generatedBy: phoneStamp(record.source, record.sourceId),
    logSource: "phone-sync",
  }
}

function callEntries(record: CallRecord, t: EntryTargets): TimeEntry[] {
  const penId = t.penFor(record, t.callsScopeId)
  const stamp = phoneStamp(record.source, record.sourceId)
  const arrow = record.direction === "out" ? "→" : "←"
  if (!record.answered || record.durationSec <= 0) {
    const { date, min } = localMinute(record.at)
    return [
      {
        id: phoneEntryId(record.source, record.sourceId),
        date,
        scopeId: t.callsScopeId,
        penId,
        kind: "instant",
        startMin: min,
        endMin: min,
        title: record.direction === "in" ? "missed call" : `${arrow} no answer`,
        generatedBy: stamp,
        logSource: "phone-sync",
      },
    ]
  }
  const out: TimeEntry[] = []
  const end = record.at + record.durationSec * 1000
  const spanId = phoneEntryId(record.source, record.sourceId)
  let cursor = record.at
  let part = 0
  while (cursor < end && part < 7) {
    const { date, min, dayStart } = localMinute(cursor)
    const day = new Date(dayStart)
    const nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    const sliceEnd = Math.min(end, nextMidnight)
    // Round the end up so a 20-second call still fills its minute.
    let endMin = sliceEnd === nextMidnight ? MINUTES_PER_DAY : wallMinuteUp(sliceEnd)
    if (endMin <= min) endMin = min + 1
    out.push({
      id: phoneEntryId(record.source, record.sourceId, part),
      date,
      scopeId: t.callsScopeId,
      penId,
      startMin: min,
      endMin: Math.min(endMin, MINUTES_PER_DAY),
      title: `${arrow} call`,
      spanId,
      generatedBy: stamp,
      logSource: "phone-sync",
    })
    cursor = sliceEnd
    part++
  }
  return out
}

export function recordToEntries(record: PhoneRecord, targets: EntryTargets): TimeEntry[] {
  return record.type === "message" ? [messageEntry(record, targets)] : callEntries(record, targets)
}

/**
 * Add new rows. A row whose id is already there, or that the person deleted
 * (`removedEntryIds`), is skipped, so a re-read never duplicates or resurrects.
 */
export function mergePhoneEntries(
  existing: readonly TimeEntry[],
  removedIds: readonly string[],
  incoming: readonly TimeEntry[],
): { entries: TimeEntry[]; added: number; skipped: number } {
  const have = new Set(existing.map((e) => e.id))
  for (const id of removedIds) have.add(id)
  const fresh: TimeEntry[] = []
  for (const entry of incoming) {
    if (have.has(entry.id)) continue
    have.add(entry.id)
    fresh.push(entry)
  }
  return {
    entries: fresh.length ? [...existing, ...fresh] : [...existing],
    added: fresh.length,
    skipped: incoming.length - fresh.length,
  }
}
