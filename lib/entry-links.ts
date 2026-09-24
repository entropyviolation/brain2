/**
 * lib/entry-links.ts — "What else was true during this block?"
 *
 * The scopes are deliberately independent: the same four hours can be *Ian's
 * House* in Location and *Social* in Activity, and neither one owns the other.
 * That independence is right, but it makes honest logging tedious — the user
 * paints the afternoon once, then has to go paint it again in the next scope.
 *
 * This module is the join. It never invents a third record type: attaching
 * something to a block simply paints a **normal block** in the other scope over
 * the same minutes, so every existing view, rollup, tag path, and habit link
 * keeps working with no knowledge that an attachment happened.
 *
 * ## Two strengths of attachment
 *
 * - **This instance only** — `attachCompanion`. The BBQ at Ian's was social; a
 *   Tuesday of working from Ian's spare room is not. One click, no rule.
 * - **Always** — `PenLink` on the pen (`TrackPen.links`). "Ian's House always
 *   means Social" is a standing fact about the pen, applied by `applyPenLinks`
 *   every time that pen is painted.
 *
 * ## One rule, everywhere: never overwrite a statement
 *
 * An attachment only fills minutes the target scope has left **blank**. If the
 * user already said they were Working during part of that window, the app is not
 * entitled to overwrite it on the strength of a rule about a different scope —
 * it fills the gaps around it and leaves the disagreement visible. Overwriting is
 * possible, but only when a human asks for it explicitly (`overwrite: true`).
 *
 * Pure: intervals in, intervals out. The store is the only stateful layer.
 */

import { clampMinute, entriesForDay, paintRange, type TimeEntry } from "@/lib/time-entries"
import type { TrackPen, TrackScope } from "@/lib/time-tracking-store"

/**
 * A standing cross-scope implication carried by a pen: painting it means that
 * pen, in that scope, is true for the same minutes.
 */
export interface PenLink {
  scopeId: string
  penId: string
  /** Variants pre-ticked on the companion — "Social · Elijah" in one stroke. */
  variantIds?: string[]
}

export interface MinuteRange {
  startMin: number
  endMin: number
}

/** What one other scope has to say about this block's window. */
export interface CompanionScope {
  scope: TrackScope
  /** Blocks overlapping the window, with how much of it each covers. */
  covering: { entry: TimeEntry; pen: TrackPen | undefined; minutes: number }[]
  /** Minutes of the window that scope has left blank. */
  freeMinutes: number
  /** The window's length, so callers can say "covers all of it" vs "part". */
  windowMinutes: number
}

function overlap(a: MinuteRange, b: MinuteRange): number {
  return Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin))
}

/** Minutes of `[from, to)` that nothing occupies in `scopeId` on `date`. */
export function openRangesIn(
  entries: TimeEntry[],
  date: string,
  scopeId: string,
  from: number,
  to: number,
): MinuteRange[] {
  const lo = clampMinute(Math.min(from, to))
  const hi = clampMinute(Math.max(from, to))
  if (hi <= lo) return []

  const open: MinuteRange[] = []
  let cursor = lo
  for (const entry of entriesForDay(entries, date, scopeId)) {
    if (entry.endMin <= lo || entry.startMin >= hi) continue
    if (entry.startMin > cursor) open.push({ startMin: cursor, endMin: Math.min(entry.startMin, hi) })
    cursor = Math.max(cursor, entry.endMin)
    if (cursor >= hi) break
  }
  if (cursor < hi) open.push({ startMin: cursor, endMin: hi })
  return open.filter((r) => r.endMin > r.startMin)
}

/**
 * Every other scope's view of this block's window — what already covers it and
 * how much room is left. This is what the block editor lists.
 */
export function companionsFor(entries: TimeEntry[], entry: TimeEntry, scopes: TrackScope[]): CompanionScope[] {
  const windowMinutes = Math.max(0, entry.endMin - entry.startMin)
  return scopes
    .filter((scope) => scope.id !== entry.scopeId)
    .map((scope) => {
      const covering = entriesForDay(entries, entry.date, scope.id)
        .map((other) => ({
          entry: other,
          pen: scope.pens.find((p) => p.id === other.penId),
          minutes: overlap(entry, other),
        }))
        .filter((c) => c.minutes > 0)
      const covered = covering.reduce((sum, c) => sum + c.minutes, 0)
      return { scope, covering, freeMinutes: Math.max(0, windowMinutes - covered), windowMinutes }
    })
}

export interface CompanionTarget {
  scopeId: string
  penId: string
  variantIds?: string[]
  tagIds?: string[]
  title?: string
}

/**
 * Paint `target` across `entry`'s window in another scope.
 *
 * Fills only blank minutes unless `overwrite` is set — see the module header on
 * why a rule about one scope does not get to delete a statement about another.
 */
export function attachCompanion(
  entries: TimeEntry[],
  entry: TimeEntry,
  target: CompanionTarget,
  options: { overwrite?: boolean } = {},
  makeId?: () => string,
): TimeEntry[] {
  if (target.scopeId === entry.scopeId) return entries
  const ranges = options.overwrite
    ? [{ startMin: entry.startMin, endMin: entry.endMin }]
    : openRangesIn(entries, entry.date, target.scopeId, entry.startMin, entry.endMin)

  let next = entries
  for (const range of ranges) {
    next = paintRange(
      next,
      {
        date: entry.date,
        scopeId: target.scopeId,
        penId: target.penId,
        startMin: range.startMin,
        endMin: range.endMin,
        variantIds: target.variantIds,
        tagIds: target.tagIds,
        title: target.title,
      },
      makeId,
    )
  }
  return next
}

/** The pen behind an entry, searched across every scope. */
function penFor(scopes: TrackScope[], scopeId: string, penId: string): TrackPen | undefined {
  return scopes.find((s) => s.id === scopeId)?.pens.find((p) => p.id === penId)
}

/**
 * Apply a pen's standing links to one freshly painted block.
 *
 * Idempotent by construction: a second run finds the companion already there,
 * sees no blank minutes, and paints nothing.
 */
export function applyPenLinks(
  entries: TimeEntry[],
  scopes: TrackScope[],
  entry: TimeEntry,
  makeId?: () => string,
): TimeEntry[] {
  const pen = penFor(scopes, entry.scopeId, entry.penId)
  if (!pen?.links?.length) return entries

  let next = entries
  for (const link of pen.links) {
    // A link to a deleted scope or pen is a dangling rule, not a reason to paint.
    if (!penFor(scopes, link.scopeId, link.penId)) continue
    next = attachCompanion(next, entry, link, {}, makeId)
  }
  return next
}

export interface CompanionSuggestion {
  scopeId: string
  penId: string
  penName: string
  color: string
  /** Minutes this pen has historically overlapped the source pen. */
  minutes: number
}

/**
 * What the user normally pairs this pen with, learned from their own history.
 *
 * Offering "Social — you usually pair Ian's House with it" turns the second
 * scope from a chore into one click. Only the source pen's own past is consulted;
 * nothing here generalizes across pens, because a suggestion that is wrong is
 * worse than no suggestion at all.
 */
export function suggestedCompanions(
  entries: TimeEntry[],
  scopes: TrackScope[],
  source: { scopeId: string; penId: string; id?: string },
  limit = 3,
): CompanionSuggestion[] {
  const sourceBlocks = entries.filter(
    (e) => e.scopeId === source.scopeId && e.penId === source.penId && e.id !== source.id,
  )
  if (!sourceBlocks.length) return []

  const byDate = new Map<string, TimeEntry[]>()
  for (const block of sourceBlocks) {
    const list = byDate.get(block.date)
    if (list) list.push(block)
    else byDate.set(block.date, [block])
  }

  const totals = new Map<string, number>()
  for (const other of entries) {
    if (other.scopeId === source.scopeId) continue
    const sameDay = byDate.get(other.date)
    if (!sameDay) continue
    const minutes = sameDay.reduce((sum, block) => sum + overlap(block, other), 0)
    if (minutes <= 0) continue
    const key = `${other.scopeId}::${other.penId}`
    totals.set(key, (totals.get(key) ?? 0) + minutes)
  }

  return [...totals.entries()]
    .map(([key, minutes]) => {
      const [scopeId, penId] = key.split("::")
      const pen = penFor(scopes, scopeId, penId)
      return pen ? { scopeId, penId, penName: pen.name, color: pen.color, minutes } : null
    })
    .filter((s): s is CompanionSuggestion => s !== null)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit)
}
