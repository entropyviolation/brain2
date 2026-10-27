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
 * - **Always** — `PenLink` on the source pen only (`TrackPen.links`). "Driving
 *   always means Location · Transit" is a fact about Driving. Painting Transit
 *   does not paint Driving, and the reverse rule is a separate link on Transit
 *   if you want one. `applyPenLinks` reads the pen you just painted.
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

import { clampMinute, entriesForDay, isInstant, paintRange, type TimeEntry } from "@/lib/time-entries"
import type { TrackPen, TrackScope } from "@/lib/time-tracking-store"
import { COMPANY, variantPerson } from "@/lib/people-sync"

/**
 * A one-way standing implication on the source pen: painting that pen means the
 * named pen is true for the same minutes. The named pen does not point back.
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
    if (isInstant(entry)) continue
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
  /** More pens on the same companion block — several people at once in Company. */
  secondaryPenIds?: string[]
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
        secondaryPenIds: target.secondaryPenIds,
        title: target.title,
      },
      makeId,
    )
  }
  return next
}

export interface DetailWindow {
  date: string
  scopeId: string
  startMin: number
  endMin: number
}

/** Pens a block says are true: primary, extras, and the pens behind its ticked details. */
function statedPens(entry: TimeEntry, scope: TrackScope | undefined): Set<string> {
  const ids = new Set([entry.penId, ...(entry.secondaryPenIds ?? [])])
  const pen = scope?.pens.find((p) => p.id === entry.penId)
  for (const variant of pen?.variants ?? []) {
    if ((entry.variantIds ?? []).includes(variant.id) && variant.penId && !variant.scopeId) ids.add(variant.penId)
  }
  return ids
}

/**
 * Keep a cross-view detail and the view it names in agreement, both ways.
 *
 * - **Out**: a block in the window that ticks a cross-view detail ("Hanging
 *   out · Elijah", where Elijah is a Company pen) makes that view say so too.
 *   Blank minutes get a block on that pen; an existing Company block that is
 *   not Alone gains the person as an extra pen. Other views only fill blanks.
 * - **In**: a block in the window that states a pen (Company · Elijah) ticks
 *   the matching cross-view detail on overlapping blocks whose pen offers it —
 *   only where such a detail exists, so nothing new is invented.
 *
 * Idempotent; `isAlone(scopeId, penId)` keeps a person off an Alone block.
 */
export function mirrorCrossViewDetails(
  entries: TimeEntry[],
  scopes: TrackScope[],
  window: DetailWindow,
  makeId?: () => string,
  isAlone: (scopeId: string, penId: string) => boolean = () => false,
): TimeEntry[] {
  let next = entries
  const inWindow = (e: TimeEntry, scopeId: string) =>
    e.scopeId === scopeId && e.date === window.date && !isInstant(e) && overlap(e, window) > 0
  const sources = next.filter((e) => inWindow(e, window.scopeId))

  // Out: this view's cross-view details → the named view.
  for (const source of sources) {
    const pen = penFor(scopes, source.scopeId, source.penId)
    for (const raw of pen?.variants ?? []) {
      if (!(source.variantIds ?? []).includes(raw.id)) continue
      // A local "Who with?" detail stands for the same-named Company pen (`lib/people-sync.ts`).
      const person = raw.scopeId ? undefined : variantPerson(scopes, source.scopeId, pen, raw)
      const variant = person ? { ...raw, scopeId: COMPANY, penId: person } : raw
      if (!variant.scopeId || !variant.penId) continue
      if (!penFor(scopes, variant.scopeId, variant.penId)) continue
      const targetScope = scopes.find((s) => s.id === variant.scopeId)
      const span = { startMin: Math.max(source.startMin, window.startMin), endMin: Math.min(source.endMin, window.endMin) }
      next = next.map((other) => {
        if (!inWindow(other, variant.scopeId!) || overlap(other, span) <= 0) return other
        if (statedPens(other, targetScope).has(variant.penId!)) return other
        if (variant.scopeId !== "company" || isAlone(other.scopeId, other.penId)) return other
        return { ...other, secondaryPenIds: [...(other.secondaryPenIds ?? []), variant.penId!] }
      })
      next = attachCompanion(next, { ...source, ...span }, { scopeId: variant.scopeId, penId: variant.penId }, {}, makeId)
    }
  }

  // In: pens this view states → matching cross-view details on overlapping blocks elsewhere.
  const scope = scopes.find((s) => s.id === window.scopeId)
  const stated = new Set(sources.flatMap((source) => [...statedPens(source, scope)]))
  if (stated.size) {
    next = next.map((other) => {
      if (other.scopeId === window.scopeId || other.date !== window.date || isInstant(other)) return other
      if (overlap(other, window) <= 0) return other
      const pen = penFor(scopes, other.scopeId, other.penId)
      const add = (pen?.variants ?? [])
        .filter((v) => {
          if (v.scopeId === window.scopeId && v.penId) return stated.has(v.penId)
          const person = window.scopeId === COMPANY ? variantPerson(scopes, other.scopeId, pen, v) : undefined
          return Boolean(person && stated.has(person))
        })
        .map((v) => v.id)
        .filter((id) => !(other.variantIds ?? []).includes(id))
      return add.length ? { ...other, variantIds: [...(other.variantIds ?? []), ...add] } : other
    })
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
