/**
 * components/Analytics/time-flow-stats.ts — Math for Transitions, Context switch,
 * Text events / spans, Log and Operations
 *
 * Pure. Every helper takes plain rows so the views stay thin and the math is
 * tested once (`time-flow-stats.test.ts`). Docs: `docs/analytics/time-*.md`.
 */
import { entriesForDay, entryMinutes, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"

// ---- Transitions ---------------------------------------------------------

type Cell = { fromId: string; toId: string; count: number; p: number }

/** One pen-id sequence per day, same-pen neighbours collapsed, zero-minute blocks dropped. */
export function penDaySequences(entries: TimeEntry[], dateKeys: readonly string[], scopeId: string): string[][] {
  const out: string[][] = []
  for (const date of dateKeys) {
    const seq: string[] = []
    for (const e of entriesForDay(entries, date, scopeId)) {
      if (entryMinutes(e) <= 0) continue
      if (seq[seq.length - 1] !== e.penId) seq.push(e.penId)
    }
    if (seq.length > 1) out.push(seq)
  }
  return out
}

/** Days on which `fromId` → `toId` happened, with how many times, newest first. */
export function switchDays(
  entries: TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
  fromId: string,
  toId: string,
): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = []
  for (const date of dateKeys) {
    let prev: string | null = null
    let count = 0
    for (const e of entriesForDay(entries, date, scopeId)) {
      if (entryMinutes(e) <= 0 || e.penId === prev) continue
      if (prev === fromId && e.penId === toId) count++
      prev = e.penId
    }
    if (count) out.push({ date, count })
  }
  return out.reverse()
}

export type PenFlow = {
  id: string
  outCount: number
  inCount: number
  /** inCount − outCount. Positive = a pen you land on; negative = a pen you leave from. */
  net: number
  /** Shannon entropy of where you go next, in bits. */
  exitBits: number
  /** 1 − H / log2(k): 1 = always the same next pen, 0 = any next pen equally. */
  predictability: number | null
}

export function penFlows(pens: readonly { id: string }[], cells: readonly Cell[]): PenFlow[] {
  return pens.map((pen) => {
    const out = cells.filter((c) => c.fromId === pen.id)
    const inCount = cells.filter((c) => c.toId === pen.id).reduce((s, c) => s + c.count, 0)
    const outCount = out.reduce((s, c) => s + c.count, 0)
    const exitBits = out.reduce((s, c) => (c.p > 0 ? s - c.p * Math.log2(c.p) : s), 0)
    const k = Math.max(0, pens.length - 1)
    const predictability = outCount === 0 || k < 2 ? null : 1 - exitBits / Math.log2(k)
    return { id: pen.id, outCount, inCount, net: inCount - outCount, exitBits, predictability }
  })
}

export type ReturnLoop = { aId: string; bId: string; count: number }

/** A → B → A inside one day. `rate` is loops over all three-step windows. */
export function returnLoops(sequences: readonly string[][]): { loops: ReturnLoop[]; windows: number; rate: number } {
  const counts = new Map<string, number>()
  let windows = 0
  let total = 0
  for (const seq of sequences) {
    for (let i = 2; i < seq.length; i++) {
      windows++
      if (seq[i] !== seq[i - 2]) continue
      total++
      const key = `${seq[i - 2]}\t${seq[i - 1]}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const loops = [...counts.entries()]
    .map(([key, count]) => {
      const [aId, bId] = key.split("\t")
      return { aId, bId, count }
    })
    .sort((a, b) => b.count - a.count || a.aId.localeCompare(b.aId))
  return { loops, windows, rate: windows ? total / windows : 0 }
}

// ---- Context switch ------------------------------------------------------

/** Mean switches per day for each clock hour, over days that had any switch. */
export function hourlyRate(hourCounts: readonly number[], activeDays: number): number[] {
  return hourCounts.map((c) => (activeDays > 0 ? c / activeDays : 0))
}

/** Switches per waking hour. `from` and `to` are clock hours; `to` may wrap past midnight. */
export function wakingRate(hourCounts: readonly number[], activeDays: number, from: number, to: number) {
  const hours: number[] = []
  for (let h = from; hours.length < 24; h = (h + 1) % 24) {
    hours.push(h)
    if (h === (to + 23) % 24) break
  }
  const sum = hours.reduce((s, h) => s + (hourCounts[h] ?? 0), 0)
  return { hours: hours.length, perHour: activeDays > 0 ? sum / activeDays / hours.length : 0 }
}

/** Mean switches by weekday (Mon = 0). Days in the window with no switch count as 0. */
export function weekdayMeans(byDate: ReadonlyMap<string, number>, dateKeys: readonly string[]): number[] {
  const sum = Array(7).fill(0)
  const n = Array(7).fill(0)
  for (const key of dateKeys) {
    const [y, m, d] = key.split("-").map(Number)
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7
    sum[wd] += byDate.get(key) ?? 0
    n[wd]++
  }
  return sum.map((s, i) => (n[i] ? s / n[i] : 0))
}

// ---- Log -----------------------------------------------------------------

export type ClockPoint = {
  date: string
  startMin: number
  kindKey: string
  clockCertainty?: TrackingClockCertainty
}

/** Circular mean of clock minutes. `r` is 0 (spread round the clock) to 1 (always the same time). */
export function circularClock(minutes: readonly number[]): { meanMin: number; r: number } | null {
  if (minutes.length === 0) return null
  let x = 0
  let y = 0
  for (const m of minutes) {
    const a = (m / 1440) * 2 * Math.PI
    x += Math.cos(a)
    y += Math.sin(a)
  }
  x /= minutes.length
  y /= minutes.length
  const r = Math.hypot(x, y)
  const a = Math.atan2(y, x)
  const meanMin = Math.round((((a / (2 * Math.PI)) * 1440) % 1440 + 1440) % 1440)
  return { meanMin, r }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function dayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

export type KindRhythm = {
  kind: string
  count: number
  exact: number
  estimated: number
  unknown: number
  clock: { meanMin: number; r: number } | null
  /** Median hours between consecutive events of this kind. Known clocks only. */
  medianGapH: number | null
}

export function kindRhythms(points: readonly ClockPoint[]): KindRhythm[] {
  const byKind = new Map<string, ClockPoint[]>()
  for (const p of points) byKind.set(p.kindKey, [...(byKind.get(p.kindKey) ?? []), p])
  return [...byKind.entries()]
    .map(([kind, rows]) => {
      const known = rows.filter((r) => r.clockCertainty !== "unknown")
      const stamps = known.map((r) => dayIndex(r.date) * 1440 + r.startMin).sort((a, b) => a - b)
      const gaps = stamps.slice(1).map((t, i) => (t - stamps[i]) / 60)
      return {
        kind,
        count: rows.length,
        exact: rows.filter((r) => !r.clockCertainty || r.clockCertainty === "exact").length,
        estimated: rows.filter((r) => r.clockCertainty === "estimated").length,
        unknown: rows.length - known.length,
        clock: circularClock(known.map((r) => r.startMin)),
        medianGapH: median(gaps),
      }
    })
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}

// ---- Text spans ----------------------------------------------------------

export function spanStats(minutes: readonly number[]) {
  const total = minutes.reduce((s, m) => s + m, 0)
  return {
    total,
    median: median([...minutes]),
    longest: minutes.length ? Math.max(...minutes) : 0,
  }
}

// ---- Operations ----------------------------------------------------------

export type DebriefPoint = { id: string; operationId: string; morale: number; execution: number; hours: number | null }

/** One point per report that scored both morale and execution (integers 1–10). */
export function debriefPoints(
  reviews: readonly { id: string; operationId: string; ratings?: Record<string, number>; hoursLogged?: number }[],
): DebriefPoint[] {
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10
  return reviews.flatMap((r) => {
    const morale = r.ratings?.morale
    const execution = r.ratings?.execution
    if (!ok(morale) || !ok(execution)) return []
    const h = r.hoursLogged
    return [{ id: r.id, operationId: r.operationId, morale, execution, hours: typeof h === "number" && h >= 0 ? h : null }]
  })
}

export type OpNeglect = { id: string; lastDate: string | null; daysSince: number | null; windowMin: number }

/** Days since each operation last had a time log, and minutes logged inside the window. */
export function operationNeglect(
  ops: readonly { id: string; timeLogs?: { date: string; durationMinutes: number }[] }[],
  keySet: ReadonlySet<string>,
  todayKey: string,
): OpNeglect[] {
  const today = dayIndex(todayKey)
  return ops
    .map((op) => {
      const logs = (op.timeLogs ?? []).filter((l) => /^\d{4}-\d{2}-\d{2}/.test(l.date))
      const last = logs.map((l) => l.date.slice(0, 10)).sort().pop() ?? null
      const windowMin = logs
        .filter((l) => keySet.has(l.date.slice(0, 10)))
        .reduce((s, l) => s + (Number.isFinite(l.durationMinutes) ? Math.max(0, l.durationMinutes) : 0), 0)
      return { id: op.id, lastDate: last, daysSince: last ? today - dayIndex(last) : null, windowMin }
    })
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity) || a.id.localeCompare(b.id))
}
