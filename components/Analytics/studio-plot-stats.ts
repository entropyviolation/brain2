/**
 * components/Analytics/studio-plot-stats.ts — Classical plot math for Analytics canvases
 *
 * KDE / histogram / horizon / beeswarm / alluvial layout / UpSet intersections /
 * weekday ridges. Primitives only — no store. Display lives in studio-plots.tsx.
 *
 * Sources: Silverman (1986) KDE bandwidth; Freedman–Diaconis bins; Reijner /
 * Heer & van Wijk (2009) horizon layers; Cleveland (1993) cycle plots;
 * Lex et al. (2014) UpSet; Sankey/alluvial as flow of Markov counts.
 */
import { parseLocalDate } from "@/lib/date-utils"
import { entryMinutes, type TimeEntry } from "@/lib/time-entries"
import type { TransitionCell } from "./signal-stats"

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export function quantile(values: number[], q: number): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = xs.length
  if (n === 0) return 0
  if (n === 1) return xs[0]
  const pos = (n - 1) * Math.min(1, Math.max(0, q))
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const h = pos - lo
  return xs[lo] * (1 - h) + xs[hi] * h
}

export function median(values: number[]): number {
  return quantile(values, 0.5)
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / values.length)
}

/**
 * Gaussian KDE. Bandwidth is Silverman's rule of thumb h = 1.06 σ n^(−1/5).
 * A singleton still draws a bump (h floored to 1) so empty-frame honesty stays
 * a ChartFrame concern, not a silent zero path.
 */
export function silvermanBandwidth(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v))
  if (xs.length < 2) return 1
  const s = stddev(xs)
  if (s === 0) return 1
  return 1.06 * s * Math.pow(xs.length, -0.2)
}

function gaussian(u: number): number {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
}

export function kernelDensityEstimate(values: number[], xs: number[]): number[] {
  const sample = values.filter((v) => Number.isFinite(v))
  if (sample.length === 0) return xs.map(() => 0)
  const h = silvermanBandwidth(sample)
  return xs.map((x) => {
    let s = 0
    for (const v of sample) s += gaussian((x - v) / h)
    return s / (sample.length * h)
  })
}

export interface HistogramBin {
  start: number
  end: number
  count: number
}

/**
 * Equal-width histogram. Default bin count is Freedman–Diaconis
 * 2 IQR n^(−1/3), clamped 4–24. Degenerate (all equal) → one bin of width 1.
 */
export function histogram(values: number[], binCount?: number): HistogramBin[] {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (xs.length === 0) return []
  const min = xs[0]
  const max = xs[xs.length - 1]
  let k = binCount
  if (k == null) {
    const iqr = quantile(xs, 0.75) - quantile(xs, 0.25)
    const h = iqr > 0 ? 2 * iqr * Math.pow(xs.length, -1 / 3) : 0
    k = h > 0 ? Math.max(4, Math.min(24, Math.round((max - min) / h) || 8)) : 8
  }
  k = Math.max(1, k)
  if (max === min) return [{ start: min, end: min + 1, count: xs.length }]
  const width = (max - min) / k
  const bins: HistogramBin[] = Array.from({ length: k }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }))
  for (const v of xs) {
    const i = Math.min(k - 1, Math.max(0, Math.floor((v - min) / width)))
    bins[i].count++
  }
  return bins
}

/**
 * Layered horizon (Reijner; Heer & van Wijk 2009). Fold a non-negative series
 * into `layers` bands of amplitude peak/layers. Each cell is 0–1 fill of that band.
 */
export function horizonBands(values: number[], layers = 3, peak?: number): number[][] {
  const xs = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const p = peak ?? Math.max(...xs, 1)
  const amp = p / Math.max(1, layers)
  return Array.from({ length: layers }, (_, L) =>
    xs.map((v) => {
      const lo = L * amp
      return Math.max(0, Math.min(1, (v - lo) / amp))
    }),
  )
}

export interface SwarmPoint {
  value: number
  y: number
  x: number
  i: number
}

/**
 * 1-D beeswarm: y is the value, x is the smallest offset that clears `radius`.
 * Suitable for modest n (open-item ages). Overlap is greedy, not a force layout.
 */
export function beeswarmOffsets(
  values: number[],
  opts: { radius?: number; height?: number; min?: number; max?: number } = {},
): SwarmPoint[] {
  const radius = opts.radius ?? 4
  const height = opts.height ?? 120
  const sample = values.filter((v) => Number.isFinite(v))
  if (sample.length === 0) return []
  const min = opts.min ?? Math.min(...sample)
  const max = opts.max ?? Math.max(...sample)
  const span = max - min || 1
  const yAt = (v: number) => ((v - min) / span) * height
  const placed: SwarmPoint[] = []
  const order = sample.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value)
  const collide = (cx: number, y: number) =>
    placed.some((p) => {
      const dy = p.y - y
      const dx = p.x - cx
      return dx * dx + dy * dy < 4 * radius * radius - 0.01
    })
  for (const item of order) {
    const y = yAt(item.value)
    let x = 0
    if (collide(0, y)) {
      let step = radius
      while (step < 90) {
        if (!collide(step, y)) {
          x = step
          break
        }
        if (!collide(-step, y)) {
          x = -step
          break
        }
        step += radius
      }
    }
    placed.push({ value: item.value, y, x, i: item.i })
  }
  return placed.sort((a, b) => a.i - b.i)
}

export interface AlluvialNode {
  id: string
  name: string
  color: string
  y0: number
  y1: number
  total: number
}

export interface AlluvialFlow {
  fromId: string
  toId: string
  count: number
  y0s: number
  y1s: number
  y0t: number
  y1t: number
}

/**
 * Alluvial layout of a Markov count table: left stack = from-totals, right
 * stack = to-totals, flows = raw switch counts (not row-normalized p).
 */
export function layoutAlluvial(
  pens: { id: string; name: string; color: string }[],
  cells: Pick<TransitionCell, "fromId" | "toId" | "count">[],
  height: number,
  gap = 6,
): { sources: AlluvialNode[]; targets: AlluvialNode[]; flows: AlluvialFlow[] } {
  const fromTot = new Map<string, number>()
  const toTot = new Map<string, number>()
  for (const c of cells) {
    if (c.count <= 0) continue
    fromTot.set(c.fromId, (fromTot.get(c.fromId) ?? 0) + c.count)
    toTot.set(c.toId, (toTot.get(c.toId) ?? 0) + c.count)
  }
  const stack = (
    ids: string[],
    totals: Map<string, number>,
  ): AlluvialNode[] => {
    const present = ids.filter((id) => (totals.get(id) ?? 0) > 0)
    const mass = present.reduce((s, id) => s + (totals.get(id) ?? 0), 0) || 1
    const usable = Math.max(1, height - gap * Math.max(0, present.length - 1))
    let y = 0
    return present.map((id, i) => {
      const total = totals.get(id) ?? 0
      const h = (total / mass) * usable
      const node: AlluvialNode = {
        id,
        name: pens.find((p) => p.id === id)?.name ?? id,
        color: pens.find((p) => p.id === id)?.color ?? "#64748b",
        y0: y,
        y1: y + h,
        total,
      }
      y += h + (i < present.length - 1 ? gap : 0)
      return node
    })
  }
  const sources = stack(pens.map((p) => p.id), fromTot)
  const targets = stack(pens.map((p) => p.id), toTot)
  const fromCursor = new Map(sources.map((n) => [n.id, n.y0]))
  const toCursor = new Map(targets.map((n) => [n.id, n.y0]))
  const srcMass = Object.fromEntries(sources.map((n) => [n.id, n.total])) as Record<string, number>
  const tgtMass = Object.fromEntries(targets.map((n) => [n.id, n.total])) as Record<string, number>
  const srcH = Object.fromEntries(sources.map((n) => [n.id, n.y1 - n.y0])) as Record<string, number>
  const tgtH = Object.fromEntries(targets.map((n) => [n.id, n.y1 - n.y0])) as Record<string, number>
  const flows: AlluvialFlow[] = []
  for (const c of cells) {
    if (c.count <= 0) continue
    const sh = srcH[c.fromId]
    const th = tgtH[c.toId]
    if (!sh || !th) continue
    const hs = (c.count / (srcMass[c.fromId] || 1)) * sh
    const ht = (c.count / (tgtMass[c.toId] || 1)) * th
    const y0s = fromCursor.get(c.fromId) ?? 0
    const y0t = toCursor.get(c.toId) ?? 0
    flows.push({
      fromId: c.fromId,
      toId: c.toId,
      count: c.count,
      y0s,
      y1s: y0s + hs,
      y0t,
      y1t: y0t + ht,
    })
    fromCursor.set(c.fromId, y0s + hs)
    toCursor.set(c.toId, y0t + ht)
  }
  return { sources, targets, flows }
}

export interface UpsetRow {
  key: string
  tags: string[]
  n: number
  ids: string[]
}

/**
 * UpSet intersections (Lex et al. 2014): each unique combination of tags and
 * its item count. Empty tag sets omitted. Sorted by n descending.
 */
export function tagIntersections(items: { id: string; tags?: string[] }[]): UpsetRow[] {
  const map = new Map<string, { tags: string[]; ids: string[] }>()
  for (const item of items) {
    const tags = [...new Set((item.tags ?? []).map((t) => t.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    if (tags.length === 0) continue
    const key = tags.join("\t")
    const row = map.get(key) ?? { tags, ids: [] }
    row.ids.push(item.id)
    map.set(key, row)
  }
  return [...map.entries()]
    .map(([key, row]) => ({ key, tags: row.tags, n: row.ids.length, ids: row.ids }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
}

export interface WeekdayRidge {
  weekday: number
  label: string
  values: number[]
}

export function valuesByWeekday(rows: { date: string; value: number }[]): WeekdayRidge[] {
  const buckets: WeekdayRidge[] = WEEKDAY_SHORT.map((label, weekday) => ({
    weekday,
    label,
    values: [],
  }))
  for (const row of rows) {
    const d = parseLocalDate(row.date)
    if (!d || !Number.isFinite(row.value)) continue
    buckets[d.getDay()].values.push(row.value)
  }
  return buckets
}

/** Observed block lengths in minutes. Instants (0) stay out. */
export function blockLengths(entries: readonly TimeEntry[]): number[] {
  return entries.map((e) => entryMinutes(e)).filter((m) => m > 0)
}

export interface SlopeRow {
  id: string
  name: string
  left: number
  right: number
}

export function weekdayWeekendRates(
  dateKeys: readonly string[],
  metOn: (date: string) => boolean,
): { weekday: number; weekend: number; weekdayN: number; weekendN: number } {
  let weekdayMet = 0
  let weekendMet = 0
  let weekdayN = 0
  let weekendN = 0
  for (const key of dateKeys) {
    const d = parseLocalDate(key)
    if (!d) continue
    const weekend = d.getDay() === 0 || d.getDay() === 6
    if (weekend) {
      weekendN++
      if (metOn(key)) weekendMet++
    } else {
      weekdayN++
      if (metOn(key)) weekdayMet++
    }
  }
  return {
    weekday: weekdayN ? (weekdayMet / weekdayN) * 100 : 0,
    weekend: weekendN ? (weekendMet / weekendN) * 100 : 0,
    weekdayN,
    weekendN,
  }
}
