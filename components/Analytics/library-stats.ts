/**
 * components/Analytics/library-stats.ts — Pure math for the Library views
 *
 * Item Types, Lists & areas, Attributes, Tags, Stages, Weight. No store reads.
 * Docs: `docs/analytics/library-*.md`.
 */

export interface Summary {
  n: number
  mean: number
  median: number
  sd: number
  min: number
  max: number
  q1: number
  q3: number
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** Five-number summary plus mean and sample SD. Empty input gives n = 0. */
export function summarize(values: number[]): Summary {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b)
  const n = xs.length
  if (n === 0) return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, q1: 0, q3: 0 }
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0
  return {
    n,
    mean,
    median: quantileSorted(xs, 0.5),
    sd,
    min: xs[0],
    max: xs[n - 1],
    q1: quantileSorted(xs, 0.25),
    q3: quantileSorted(xs, 0.75),
  }
}

/** Shannon entropy in bits and Pielou evenness (H / log2 k, 1 = all equal). */
export function shannon(counts: number[]): { bits: number; evenness: number; k: number } {
  const live = counts.filter((c) => c > 0)
  const total = live.reduce((s, c) => s + c, 0)
  const k = live.length
  if (total === 0) return { bits: 0, evenness: 0, k: 0 }
  const bits = -live.reduce((s, c) => s + (c / total) * Math.log2(c / total), 0)
  return { bits, evenness: k > 1 ? bits / Math.log2(k) : 1, k }
}

function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(xs.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k][1]] = avg
    i = j + 1
  }
  return out
}

/** Spearman ρ with average ranks for ties. Null below 3 pairs or no spread. */
export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const rx = ranks(xs.slice(0, n))
  const ry = ranks(ys.slice(0, n))
  const mx = rx.reduce((s, x) => s + x, 0) / n
  const my = ry.reduce((s, y) => s + y, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

export interface TagPair {
  a: string
  b: string
  count: number
  /** |A∩B| / |A∪B| over items. */
  jaccard: number
  /** P(A∩B) / (P(A)·P(B)) over tagged items. 1 = independent. */
  lift: number
  ids: string[]
}

/** Every tag pair that shares at least `minCount` items. */
export function tagPairs(items: { id: string; tags?: string[] }[], minCount = 1): TagPair[] {
  const single = new Map<string, number>()
  const pairs = new Map<string, { count: number; ids: string[] }>()
  let tagged = 0
  for (const item of items) {
    const tags = [...new Set((item.tags ?? []).map((t) => t.trim()).filter(Boolean))].sort()
    if (tags.length === 0) continue
    tagged += 1
    for (const t of tags) single.set(t, (single.get(t) ?? 0) + 1)
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = `${tags[i]}\u0000${tags[j]}`
        const row = pairs.get(key) ?? { count: 0, ids: [] }
        row.count += 1
        row.ids.push(item.id)
        pairs.set(key, row)
      }
    }
  }
  const out: TagPair[] = []
  for (const [key, row] of pairs) {
    if (row.count < minCount) continue
    const [a, b] = key.split("\u0000")
    const na = single.get(a) ?? 0
    const nb = single.get(b) ?? 0
    out.push({
      a,
      b,
      count: row.count,
      jaccard: row.count / (na + nb - row.count),
      lift: (row.count * tagged) / (na * nb),
      ids: row.ids,
    })
  }
  return out.sort((x, y) => y.count - x.count || y.lift - x.lift)
}

export interface CrossCell {
  x: number
  y: number
  count: number
  ids: string[]
}

/** Count items on an integer grid. Picks return null to skip an item. */
export function crossTab<T extends { id: string }>(
  items: T[],
  pickX: (t: T) => number | null,
  pickY: (t: T) => number | null,
): CrossCell[] {
  const cells = new Map<string, CrossCell>()
  for (const item of items) {
    const x = pickX(item)
    const y = pickY(item)
    if (x === null || y === null) continue
    const key = `${x}:${y}`
    const cell = cells.get(key) ?? { x, y, count: 0, ids: [] }
    cell.count += 1
    cell.ids.push(item.id)
    cells.set(key, cell)
  }
  return [...cells.values()]
}

export const STAGE_ORDER = ["inbox", "clarified", "scheduled", "completed"] as const

export interface StageStep {
  id: string
  count: number
  ids: string[]
  /** Median days since created (open) or created → completed (completed). */
  medianDays: number | null
}

const DAY_MS = 86_400_000

function toTime(value: Date | string | undefined): number | null {
  if (!value) return null
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

/** Lifecycle steps in order, then `list` last. Age is in days. */
export function stageSteps(
  tasks: { id: string; stage?: string; createdAt?: Date | string; completedDate?: Date | string }[],
  now = Date.now(),
): StageStep[] {
  const buckets = new Map<string, { ids: string[]; ages: number[] }>()
  for (const task of tasks) {
    const key = task.stage || "list"
    const row = buckets.get(key) ?? { ids: [], ages: [] }
    row.ids.push(task.id)
    const start = toTime(task.createdAt)
    const end = key === "completed" ? toTime(task.completedDate) : now
    if (start !== null && end !== null && end >= start) row.ages.push((end - start) / DAY_MS)
    buckets.set(key, row)
  }
  const order = [...STAGE_ORDER, "list", ...[...buckets.keys()].filter((k) => ![...STAGE_ORDER, "list"].includes(k as never))]
  return order.map((id) => {
    const row = buckets.get(id) ?? { ids: [], ages: [] }
    return { id, count: row.ids.length, ids: row.ids, medianDays: row.ages.length ? summarize(row.ages).median : null }
  })
}

export interface AreaRow {
  id: string
  name: string
  color: string
  count: number
  lists: { id: string; name: string; color: string; count: number }[]
}

/** Roll lists up to their top-level parent ("area"). Counts unique items per area. */
export function areaRollup(
  lists: { id: string; name: string; color: string; parentListId?: string }[],
  tasks: { id: string; lists?: string[] }[],
): AreaRow[] {
  const byId = new Map(lists.map((l) => [l.id, l]))
  const rootOf = (id: string): string => {
    let cur = byId.get(id)
    const seen = new Set<string>()
    while (cur?.parentListId && byId.has(cur.parentListId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.parentListId)
    }
    return cur?.id ?? id
  }
  const areas = new Map<string, { ids: Set<string>; lists: Map<string, number> }>()
  for (const task of tasks) {
    for (const listId of task.lists ?? []) {
      if (!byId.has(listId)) continue
      const root = rootOf(listId)
      const area = areas.get(root) ?? { ids: new Set(), lists: new Map() }
      area.ids.add(task.id)
      area.lists.set(listId, (area.lists.get(listId) ?? 0) + 1)
      areas.set(root, area)
    }
  }
  return [...areas.entries()]
    .map(([id, area]) => {
      const list = byId.get(id)!
      return {
        id,
        name: list.name,
        color: list.color || "#2a9b8f",
        count: area.ids.size,
        lists: [...area.lists.entries()]
          .map(([lid, count]) => {
            const l = byId.get(lid)!
            return { id: lid, name: l.name, color: l.color || "#2a9b8f", count }
          })
          .sort((a, b) => b.count - a.count),
      }
    })
    .sort((a, b) => b.count - a.count)
}

/** Equal-width bins across [min, max]. One bin when all values match. */
export function bins(values: number[], count = 8): { lo: number; hi: number; n: number }[] {
  const xs = values.filter(Number.isFinite)
  if (xs.length === 0) return []
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  if (min === max) return [{ lo: min, hi: max, n: xs.length }]
  const k = Math.max(1, Math.min(count, xs.length))
  const w = (max - min) / k
  const out = Array.from({ length: k }, (_, i) => ({ lo: min + i * w, hi: min + (i + 1) * w, n: 0 }))
  for (const x of xs) out[Math.min(k - 1, Math.floor((x - min) / w))].n += 1
  return out
}
