/**
 * lib/phone-sync/walks.ts — Walks found in Apple Health's per-minute steps
 *
 * A workout is something you started on the watch. A walk is not: you just
 * walked. Health still has the steps, one bucket per minute
 * (`stepMinutes` on a page from `ios/App/App/HealthPlugin.swift`), already
 * merged across the iPhone and the watch. This file turns those minutes into
 * walk bouts and the bouts into Activity blocks.
 *
 * A minute counts at `WALK_STEPS_PER_MIN` steps or more. Stops of up to
 * `WALK_BRIDGE_MIN` minutes (a crosswalk) stay inside the bout. A bout is kept
 * when it lasts the shortest walk the person set, and only once it has been
 * over for `WALK_SETTLE_MS`, so a walk still in progress is not written short.
 * At `RUN_STEPS_PER_MIN` or more it is a run.
 *
 * A walk never paints over time already on Activity. Hand paint, a clock, a
 * workout, and sleep all win; the walk keeps the free pieces that are still
 * long enough. Ids come from the day and the start minute, so a second read
 * writes nothing new and a deleted walk stays deleted.
 *
 * Place names: a block made here or by a workout is titled with the Location
 * block beside it ("Walk · Home → Park"). Only a bare automatic title is
 * touched, so a block the person renamed is left alone.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { phoneEntryId, phoneStamp } from "./ids"

export const WALK_STEPS_PER_MIN = 60
export const RUN_STEPS_PER_MIN = 140
export const WALK_BRIDGE_MIN = 2
export const WALK_SETTLE_MS = 5 * 60_000
/** Choices for the shortest walk kept, in minutes. */
export const WALK_MIN_STEPS = [5, 10, 15, 20] as const
export const DEFAULT_WALK_MIN_MINUTES = 5

export const WALK_TITLE = "Walk"
export const RUN_TITLE = "Run"
/** How far, in minutes, a Location block may sit from a block's edge and still name it. */
export const PLACE_SLACK_MIN = 10

const MINUTE_MS = 60_000
const MINUTES_PER_DAY = 1440
const LOCATION_SCOPE_ID = "location"
const MOVING_PEN_ID = "phone-location-moving"
const COORD_LABEL_RE = /^-?\d+\.\d+,\s*-?\d+\.\d+$/
const PLACE_SEP = " · "

export interface StepMinute {
  /** Epoch ms of the minute's start. */
  at: number
  steps: number
  meters: number
}

export interface WalkBout {
  startMs: number
  /** Exclusive. */
  endMs: number
  steps: number
  meters: number
  kind: "walk" | "run"
}

/** `[[ms, steps, meters], …]` from the plugin. Bad rows are dropped. */
export function parseStepMinutes(raw: unknown): StepMinute[] {
  if (!Array.isArray(raw)) return []
  const out: StepMinute[] = []
  for (const row of raw) {
    if (!Array.isArray(row)) continue
    const [at, steps, meters] = row as unknown[]
    if (typeof at !== "number" || !Number.isFinite(at)) continue
    if (typeof steps !== "number" || !Number.isFinite(steps) || steps <= 0) continue
    out.push({
      at: Math.floor(at / MINUTE_MS) * MINUTE_MS,
      steps,
      meters: typeof meters === "number" && Number.isFinite(meters) && meters > 0 ? meters : 0,
    })
  }
  return out
}

/** Closed walk bouts, oldest first. Pure. */
export function walkBouts(minutes: readonly StepMinute[], opts: { minMinutes: number; nowMs: number }): WalkBout[] {
  const byAt = new Map<number, StepMinute>()
  for (const m of minutes) {
    const prev = byAt.get(m.at)
    if (!prev || m.steps > prev.steps) byAt.set(m.at, m)
  }
  const ordered = [...byAt.values()].sort((a, b) => a.at - b.at)
  const active = ordered.filter((m) => m.steps >= WALK_STEPS_PER_MIN)
  const spans: { startMs: number; endMs: number; activeSteps: number; activeCount: number }[] = []
  for (const m of active) {
    const last = spans[spans.length - 1]
    if (last && m.at - last.endMs <= WALK_BRIDGE_MIN * MINUTE_MS) {
      last.endMs = m.at + MINUTE_MS
      last.activeSteps += m.steps
      last.activeCount++
    } else {
      spans.push({ startMs: m.at, endMs: m.at + MINUTE_MS, activeSteps: m.steps, activeCount: 1 })
    }
  }
  const minMs = Math.max(1, opts.minMinutes) * MINUTE_MS
  const out: WalkBout[] = []
  for (const span of spans) {
    if (span.endMs - span.startMs < minMs) continue
    if (span.endMs > opts.nowMs - WALK_SETTLE_MS) continue
    let steps = 0
    let meters = 0
    for (const m of ordered) {
      if (m.at < span.startMs) continue
      if (m.at >= span.endMs) break
      steps += m.steps
      meters += m.meters
    }
    out.push({
      startMs: span.startMs,
      endMs: span.endMs,
      steps: Math.round(steps),
      meters: Math.round(meters),
      kind: span.activeSteps / span.activeCount >= RUN_STEPS_PER_MIN ? "run" : "walk",
    })
  }
  return out
}

interface Span {
  startMin: number
  endMin: number
}

/** The parts of `[startMin, endMin)` no busy span covers, each at least `minLen` long. Pure. */
export function freePieces(startMin: number, endMin: number, busy: readonly Span[], minLen: number): Span[] {
  const cuts = busy
    .filter((b) => b.endMin > startMin && b.startMin < endMin)
    .sort((a, b) => a.startMin - b.startMin)
  const out: Span[] = []
  let cursor = startMin
  for (const b of cuts) {
    if (b.startMin > cursor) out.push({ startMin: cursor, endMin: Math.min(b.startMin, endMin) })
    cursor = Math.max(cursor, b.endMin)
    if (cursor >= endMin) break
  }
  if (cursor < endMin) out.push({ startMin: cursor, endMin })
  return out.filter((p) => p.endMin - p.startMin >= minLen)
}

/** One bout as day slices: local date and minutes past midnight. */
function boutDaySlices(bout: WalkBout): { date: string; startMin: number; endMin: number }[] {
  const out: { date: string; startMin: number; endMin: number }[] = []
  let cursor = bout.startMs
  while (cursor < bout.endMs && out.length < 3) {
    const d = new Date(cursor)
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    const sliceEnd = Math.min(bout.endMs, nextMidnight)
    const startMin = d.getHours() * 60 + d.getMinutes()
    const e = new Date(sliceEnd)
    const endMin = sliceEnd === nextMidnight ? MINUTES_PER_DAY : e.getHours() * 60 + e.getMinutes()
    if (endMin > startMin) out.push({ date: formatLocalDateKey(d), startMin, endMin })
    cursor = sliceEnd
  }
  return out
}

function walkNotes(bout: WalkBout): string {
  const steps = `${bout.steps.toLocaleString("en-US")} steps`
  if (bout.meters < 50) return steps
  const km = bout.meters / 1000
  return `${steps} · ${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`
}

export interface WalkTargets {
  scopeId: string
  walkPenId: string
  runPenId: string
  /** Everything already on the grid. Activity intervals here are busy. */
  entries: readonly TimeEntry[]
  removedEntryIds: readonly string[]
  minMinutes: number
}

/**
 * Activity blocks for these bouts, on free minutes only. Returns the rows to
 * add and how many bouts landed at least one row. Pure.
 */
export function walkEntries(bouts: readonly WalkBout[], t: WalkTargets): { entries: TimeEntry[]; bouts: number } {
  const busyByDate = new Map<string, Span[]>()
  for (const e of t.entries) {
    if (e.scopeId !== t.scopeId || e.kind === "instant" || e.endMin <= e.startMin) continue
    const list = busyByDate.get(e.date)
    if (list) list.push(e)
    else busyByDate.set(e.date, [e])
  }
  const gone = new Set(t.removedEntryIds)
  const out: TimeEntry[] = []
  let landed = 0
  for (const bout of bouts) {
    let wrote = false
    for (const slice of boutDaySlices(bout)) {
      const busy = busyByDate.get(slice.date) ?? []
      for (const piece of freePieces(slice.startMin, slice.endMin, busy, Math.max(1, t.minMinutes))) {
        const sourceId = `walk:${slice.date}:${piece.startMin}`
        const id = phoneEntryId("health", sourceId)
        if (gone.has(id)) continue
        const entry: TimeEntry = {
          id,
          date: slice.date,
          scopeId: t.scopeId,
          penId: bout.kind === "run" ? t.runPenId : t.walkPenId,
          startMin: piece.startMin,
          endMin: piece.endMin,
          title: bout.kind === "run" ? RUN_TITLE : WALK_TITLE,
          notes: walkNotes(bout),
          generatedBy: phoneStamp("health", sourceId),
          logSource: "phone-sync",
        }
        out.push(entry)
        busy.push(entry)
        if (!busyByDate.has(slice.date)) busyByDate.set(slice.date, busy)
        wrote = true
      }
    }
    if (wrote) landed++
  }
  return { entries: out, bouts: landed }
}

// ── Place names ──────────────────────────────────────────────────────────────

function gapTo(span: Span, min: number): number {
  if (min < span.startMin) return span.startMin - min
  if (min >= span.endMin) return min - span.endMin + 1
  return 0
}

/** The named Location block at, or within `PLACE_SLACK_MIN` of, this minute. Pure. */
export function placeNear(
  entries: readonly TimeEntry[],
  scopes: readonly TrackScope[],
  date: string,
  min: number,
): string | null {
  const pens = scopes.find((s) => s.id === LOCATION_SCOPE_ID)?.pens
  if (!pens) return null
  let best: { name: string; gap: number } | null = null
  for (const e of entries) {
    if (e.scopeId !== LOCATION_SCOPE_ID || e.date !== date || e.kind === "instant") continue
    if (e.penId === MOVING_PEN_ID) continue
    const gap = gapTo(e, min)
    if (gap > PLACE_SLACK_MIN || (best && gap >= best.gap)) continue
    const name = pens.find((p) => p.id === e.penId)?.name.trim()
    if (!name || COORD_LABEL_RE.test(name)) continue
    best = { name, gap }
  }
  return best?.name ?? null
}

/** "Walk · Home → Park", "Yoga · Studio", or the bare title when no place is known. */
export function titleWithPlaces(base: string, from: string | null, to: string | null): string {
  if (from && to && from !== to) return `${base}${PLACE_SEP}${from} → ${to}`
  const one = from ?? to
  return one ? `${base}${PLACE_SEP}${one}` : base
}

/**
 * Add place names to Health blocks that still carry a bare automatic title.
 * `bases` is the set of titles this import writes. Returns the same array when
 * nothing changed. Pure.
 */
export function tagHealthPlaces(
  entries: readonly TimeEntry[],
  scopes: readonly TrackScope[],
  opts: { sinceDate: string; bases: ReadonlySet<string> },
): TimeEntry[] {
  let out: TimeEntry[] | null = null
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    if (e.date < opts.sinceDate || e.kind === "instant") continue
    if (e.generatedBy?.kind !== "phone-sync" || !e.generatedBy.id.startsWith("health:")) continue
    if (!e.title || !opts.bases.has(e.title)) continue
    const title = titleWithPlaces(
      e.title,
      placeNear(entries, scopes, e.date, e.startMin),
      placeNear(entries, scopes, e.date, Math.max(e.startMin, e.endMin - 1)),
    )
    if (title === e.title) continue
    if (!out) out = [...entries]
    out[i] = { ...e, title }
  }
  return out ?? (entries as TimeEntry[])
}
