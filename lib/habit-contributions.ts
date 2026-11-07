/**
 * lib/habit-contributions.ts — The reading log: one logged action per measure, day, and thing
 *
 * When a module reports "3 pages of Dune" (`ModuleOutput`), the house keeps it as an Item, not
 * as a number in a cell. The Item is a logged action (`type: "action"`, `loggedAction: true`)
 * titled by its verb and subject ("read Dune"), linked to the Book, and carrying a
 * `ContributionRecord` in `attributes.habitContribution`: the day, the measure, the running total,
 * and each session with its own clock time. One record per (measure, day, subject), so a day of
 * speed reading is a handful of rows, not one per page.
 *
 * A habit's cell holds the sum (`incrementHabitProgress` adds to it). The cell's double-click
 * view reads these records back and lays the sum out by book. Whatever part of the cell no record
 * explains (typed by hand, from another source) is shown as its own line, so the breakdown always
 * adds up to the number on the screen.
 *
 * This file is pure: record math and reads over a list of items. Writing is
 * `lib/module-output-apply.ts`.
 */
import { describeAmount, localDayKey, measureDef, type ModuleOutput, type ModuleOutputSubject } from "@/lib/module-output"

/** Attribute key on the logged-action item that holds the record. */
export const CONTRIBUTION_ATTR = "habitContribution"

export interface ContributionSession {
  /** The `ModuleOutput.id`; the same id is never added twice. */
  id: string
  moduleId: string
  /** ISO time it happened. */
  at: string
  amount: number
  durationMs?: number
}

export interface ContributionRecord {
  measure: string
  /** Local `YYYY-MM-DD`. */
  day: string
  subject?: ModuleOutputSubject
  total: number
  sessions: ContributionSession[]
  /** Habits this record was counted into when it was written. */
  habitIds: string[]
}

/** A stable id: the same book on the same day for the same measure is the same row. */
export function contributionItemId(measure: string, day: string, subject: ModuleOutputSubject | undefined): string {
  const who = subject?.itemId ?? subject?.key ?? subject?.title ?? "none"
  const slug = who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "none"
  return `contrib-${measure}-${day}-${slug}`
}

/** "read Dune", "spent Meditation". */
export function contributionTitle(measure: string, subject: ModuleOutputSubject | undefined): string {
  const verb = measureDef(measure)?.verb ?? "logged"
  return subject ? `${verb} ${subject.title}` : `${verb} ${measure}`
}

/** One output folded into a record. Returns `added: 0` and the same record when it was already counted. */
export function foldOutput(
  record: ContributionRecord | undefined,
  output: ModuleOutput,
  habitIds: string[],
): { record: ContributionRecord; added: number } {
  const base: ContributionRecord = record ?? {
    measure: output.measure,
    day: localDayKey(output.at),
    ...(output.subject ? { subject: output.subject } : {}),
    total: 0,
    sessions: [],
    habitIds: [],
  }
  if (base.sessions.some((s) => s.id === output.id)) return { record: base, added: 0 }
  const session: ContributionSession = {
    id: output.id,
    moduleId: output.moduleId,
    at: output.at,
    amount: output.amount,
    ...(output.durationMs ? { durationMs: output.durationMs } : {}),
  }
  const sessions = [...base.sessions, session].sort((a, b) => a.at.localeCompare(b.at))
  const merged = [...new Set([...base.habitIds, ...habitIds])]
  const subject = base.subject ? { ...base.subject, ...(output.subject?.itemId ? { itemId: output.subject.itemId } : {}) } : output.subject
  return {
    record: { ...base, ...(subject ? { subject } : {}), sessions, habitIds: merged, total: Math.round((base.total + output.amount) * 100) / 100 },
    added: output.amount,
  }
}

type ItemWithAttrs = { id: string; attributes?: Record<string, unknown> | null }

/** Attribute values are scalars, so the record rides as one JSON string. */
export function encodeRecord(record: ContributionRecord): string {
  return JSON.stringify(record)
}

/** The record on an item, or undefined when it is not a contribution row or is malformed. */
export function recordOf(item: ItemWithAttrs): ContributionRecord | undefined {
  const text = item.attributes?.[CONTRIBUTION_ATTR]
  if (typeof text !== "string") return undefined
  let raw: Partial<ContributionRecord>
  try {
    raw = JSON.parse(text) as Partial<ContributionRecord>
  } catch {
    return undefined
  }
  if (!raw || typeof raw !== "object") return undefined
  if (typeof raw.measure !== "string" || typeof raw.day !== "string" || !Array.isArray(raw.sessions)) return undefined
  if (typeof raw.total !== "number" || !Number.isFinite(raw.total)) return undefined
  return {
    measure: raw.measure,
    day: raw.day,
    ...(raw.subject ? { subject: raw.subject } : {}),
    total: raw.total,
    sessions: raw.sessions.filter((s) => s && typeof s.id === "string" && typeof s.amount === "number" && typeof s.at === "string"),
    habitIds: Array.isArray(raw.habitIds) ? raw.habitIds.filter((x) => typeof x === "string") : [],
  }
}

export interface BreakdownGroup {
  key: string
  title: string
  /** Brain2 item id of the book, when there is one. */
  itemId?: string
  amount: number
  sessions: ContributionSession[]
}

export interface CellBreakdown {
  measure: string
  groups: BreakdownGroup[]
  /** The cell's number minus what the records explain. Positive: typed or from another source. Negative: lowered by hand. */
  rest: number
  /** Sum of the groups. */
  explained: number
}

/**
 * Lay a habit's day out by subject. `cellValue` is the number on the cell now.
 * Only records counted into this habit on this day are used.
 */
export function breakdownForCell(
  items: ItemWithAttrs[],
  habitId: string,
  measure: string,
  day: string,
  cellValue: number,
): CellBreakdown {
  const byKey = new Map<string, BreakdownGroup>()
  for (const item of items) {
    const rec = recordOf(item)
    if (!rec || rec.measure !== measure || rec.day !== day || !rec.habitIds.includes(habitId)) continue
    const key = rec.subject?.itemId ?? rec.subject?.key ?? rec.subject?.title ?? "none"
    const group = byKey.get(key) ?? {
      key,
      title: rec.subject?.title ?? "No book named",
      ...(rec.subject?.itemId ? { itemId: rec.subject.itemId } : {}),
      amount: 0,
      sessions: [],
    }
    group.amount = Math.round((group.amount + rec.total) * 100) / 100
    group.sessions = [...group.sessions, ...rec.sessions].sort((a, b) => a.at.localeCompare(b.at))
    byKey.set(key, group)
  }
  const groups = [...byKey.values()].sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title))
  const explained = Math.round(groups.reduce((n, g) => n + g.amount, 0) * 100) / 100
  const rest = Math.round((cellValue - explained) * 100) / 100
  return { measure, groups, rest, explained }
}

/** "3 pages across 2 sessions". */
export function describeGroup(group: BreakdownGroup, measure: string): string {
  const n = group.sessions.length
  return `${describeAmount(measure, group.amount)} in ${n} ${n === 1 ? "session" : "sessions"}`
}
