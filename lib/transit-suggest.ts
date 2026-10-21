/**
 * lib/transit-suggest.ts — Tentative "Transit from A to B?" tiles for the Location view
 *
 * When two neighbouring Location blocks both sit on pens with a picked address
 * (`TrackPen.place` lat/lng) and there is a gap between them, a transit tile
 * may be guessed to fill the start of that gap. Pure: the travel time comes in
 * from `lib/transit-time.ts`. Tiles are `precision: "estimated"` so the grid
 * hatches them, and they are never stored: they are drawn, not written.
 */

import { entriesForDay, isInstant, type TimeEntry } from "@/lib/time-entries"
import type { TrackPen, TrackScope } from "@/lib/time-tracking-store"

export const SUGGEST_PREFIX = "suggest-transit:"
/** Closer than this and it is the same place. */
const SAME_PLACE_M = 150
const MIN_GAP_MIN = 5

export interface TransitCandidate {
  id: string
  date: string
  scopeId: string
  from: { lat: number; lng: number; name: string }
  to: { lat: number; lng: number; name: string }
  /** The gap: after the first block ends, before the next begins. */
  gapStart: number
  gapEnd: number
}

export const isLocationScope = (scope: Pick<TrackScope, "id" | "name"> | undefined) =>
  !!scope && (scope.id === "location" || scope.name.trim().toLowerCase() === "location")

export const transitPenOf = (scope: TrackScope): TrackPen | undefined =>
  scope.pens.find((p) => p.id === "loc-transit") ?? scope.pens.find((p) => /^transit$/i.test(p.name.trim()))

export const pinOf = (pen: TrackPen | undefined) => {
  const lat = pen?.place?.lat
  const lng = pen?.place?.lng
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Neighbouring addressed blocks with room between them. Nothing here is a guess yet. */
export function transitCandidates(entries: TimeEntry[], date: string, scope: TrackScope | undefined): TransitCandidate[] {
  if (!scope || !isLocationScope(scope) || !transitPenOf(scope)) return []
  const day = entriesForDay(entries, date, scope.id).filter((e) => !isInstant(e)).sort((a, b) => a.startMin - b.startMin)
  const out: TransitCandidate[] = []
  for (let i = 0; i + 1 < day.length; i++) {
    const a = day[i]
    const b = day[i + 1]
    if (a.penId === b.penId || b.startMin - a.endMin < MIN_GAP_MIN) continue
    const penA = scope.pens.find((p) => p.id === a.penId)
    const penB = scope.pens.find((p) => p.id === b.penId)
    const pa = pinOf(penA)
    const pb = pinOf(penB)
    if (!penA || !penB || !pa || !pb || distanceM(pa, pb) < SAME_PLACE_M) continue
    out.push({
      id: `${SUGGEST_PREFIX}${a.id}>${b.id}`,
      date,
      scopeId: scope.id,
      from: { ...pa, name: a.title || penA.name },
      to: { ...pb, name: b.title || penB.name },
      gapStart: a.endMin,
      gapEnd: b.startMin,
    })
  }
  return out
}

/**
 * Does a transit of `travelMin` plausibly fill this gap? Not when the gap is
 * much shorter than the trip, nor when it is so long that something else
 * happened in between.
 */
export function makesSense(travelMin: number, gap: number): boolean {
  return travelMin > 0 && gap >= Math.max(MIN_GAP_MIN, travelMin * 0.6) && gap <= Math.max(travelMin * 2.5, travelMin + 60)
}

/** Tentative blocks for the candidates whose travel time is known and sensible. */
export function transitEntries(cands: TransitCandidate[], minutes: ReadonlyMap<string, number | undefined>, scope: TrackScope): TimeEntry[] {
  const pen = transitPenOf(scope)
  if (!pen) return []
  const out: TimeEntry[] = []
  for (const c of cands) {
    const t = minutes.get(c.id)
    if (t == null) continue
    const gap = c.gapEnd - c.gapStart
    if (!makesSense(t, gap)) continue
    out.push({
      id: c.id,
      date: c.date,
      scopeId: c.scopeId,
      penId: pen.id,
      startMin: c.gapStart,
      endMin: c.gapStart + Math.min(Math.max(1, Math.round(t)), gap),
      precision: "estimated",
      title: `Transit from ${c.from.name} to ${c.to.name}?`,
    } as TimeEntry)
  }
  return out
}

/** Minute map of only the suggestions: what to draw where nothing is painted. */
export function overlaySuggestions(base: (TimeEntry | null)[], suggestions: TimeEntry[]): (TimeEntry | null)[] {
  if (!suggestions.length) return base
  const next = base.slice()
  for (const s of suggestions) for (let m = s.startMin; m < s.endMin; m++) if (!next[m]) next[m] = s
  return next
}

export const isSuggestion = (e: { id: string } | null | undefined): e is TimeEntry => !!e && e.id.startsWith(SUGGEST_PREFIX)

/** Confirm a tentative tile: write it as a real, definite block (the "?" comes off its title). */
export function acceptSuggestion(
  s: TimeEntry,
  paint: (date: string, scopeId: string, startMin: number, endMin: number, penId: string | null, variantIds?: string[], spanId?: string, precision?: "estimated" | "definite", extras?: { title?: string }) => void,
): void {
  paint(s.date, s.scopeId, s.startMin, s.endMin, s.penId, [], undefined, "definite", { title: s.title?.replace(/\?$/, "") })
}
