/**
 * components/Analytics/signal-stats.ts — Classical compositions over vault data
 *
 * Shannon entropy, Gini, HHI, Markov transitions, weekday/weekend cut, and
 * open-item ages. Math primitives live in `lib/metrics.ts`; this file only
 * shapes persisted Tracking / Lists / tasks into those vectors. No store.
 *
 * Entropy H = −Σ pᵢ log₂ pᵢ of a day's pen-minute shares.
 * Gini of the window's pen totals (0 = even mix).
 * HHI = Σ sᵢ² of list item-count shares (1 = one list holds everything).
 * Transition P(j|i) = count(i→j) / count(i→·) on chronological pen changes.
 */
import { entriesForDay, entryMinutes, type TimeEntry } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"
import {
  giniCoefficient,
  herfindahlIndex,
  shannonEntropy,
  survivalCurve,
  type SurvivalPoint,
} from "@/lib/metrics"
import type { TrackPen } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

export interface EntropyDay {
  date: string
  entropy: number
  pens: number
  minutes: number
}

export function penMinutesByDay(
  entries: TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
): EntropyDay[] {
  return dateKeys.map((date) => {
    const day = entriesForDay(entries, date, scopeId).filter((e) => entryMinutes(e) > 0)
    const byPen = new Map<string, number>()
    for (const e of day) {
      byPen.set(e.penId, (byPen.get(e.penId) ?? 0) + entryMinutes(e))
    }
    const weights = [...byPen.values()]
    return {
      date,
      entropy: shannonEntropy(weights),
      pens: weights.length,
      minutes: weights.reduce((s, w) => s + w, 0),
    }
  })
}

export function allocationGini(minutes: number[]): number {
  return giniCoefficient(minutes.filter((m) => m > 0))
}

export function listHerfindahl(counts: number[]): number {
  return herfindahlIndex(counts)
}

export interface TransitionCell {
  fromId: string
  toId: string
  fromName: string
  toName: string
  count: number
  p: number
}

export interface TransitionMatrix {
  pens: { id: string; name: string; color: string }[]
  cells: TransitionCell[]
  n: number
}

export function penTransitionMatrix(
  entries: TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
  pens: TrackPen[],
): TransitionMatrix {
  const nameOf = (id: string) => pens.find((p) => p.id === id)?.name ?? id
  const colorOf = (id: string) => pens.find((p) => p.id === id)?.color ?? "#64748b"
  const counts = new Map<string, number>()
  let n = 0
  for (const date of dateKeys) {
    const day = entriesForDay(entries, date, scopeId).filter((e) => entryMinutes(e) > 0)
    for (let i = 1; i < day.length; i++) {
      const from = day[i - 1].penId
      const to = day[i].penId
      if (from === to) continue
      const key = `${from}\t${to}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
      n++
    }
  }
  const fromTotals = new Map<string, number>()
  for (const [key, count] of counts) {
    const from = key.split("\t")[0]
    fromTotals.set(from, (fromTotals.get(from) ?? 0) + count)
  }
  const used = new Set<string>()
  const cells: TransitionCell[] = []
  for (const [key, count] of counts) {
    const [fromId, toId] = key.split("\t")
    used.add(fromId)
    used.add(toId)
    const denom = fromTotals.get(fromId) ?? 1
    cells.push({
      fromId,
      toId,
      fromName: nameOf(fromId),
      toName: nameOf(toId),
      count,
      p: count / denom,
    })
  }
  const listed = pens.filter((p) => used.has(p.id)).map((p) => ({ id: p.id, name: p.name, color: p.color }))
  const extra = [...used]
    .filter((id) => !listed.some((p) => p.id === id))
    .map((id) => ({ id, name: nameOf(id), color: colorOf(id) }))
  return { pens: [...listed, ...extra], cells, n }
}

export interface WeekendCut {
  weekdayMinutes: number
  weekendMinutes: number
  weekdayDays: number
  weekendDays: number
  weekdayPerDay: number
  weekendPerDay: number
}

export function weekdayWeekendCut(entries: TimeEntry[], dateKeys: readonly string[]): WeekendCut {
  let weekdayMinutes = 0
  let weekendMinutes = 0
  let weekdayDays = 0
  let weekendDays = 0
  const wanted = new Set(dateKeys)
  const byDate = new Map<string, number>()
  for (const e of entries) {
    if (!wanted.has(e.date)) continue
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + entryMinutes(e))
  }
  for (const key of dateKeys) {
    const d = parseLocalDate(key)
    if (!d) continue
    const dow = d.getDay()
    const mins = byDate.get(key) ?? 0
    const weekend = dow === 0 || dow === 6
    if (weekend) {
      weekendDays++
      weekendMinutes += mins
    } else {
      weekdayDays++
      weekdayMinutes += mins
    }
  }
  return {
    weekdayMinutes,
    weekendMinutes,
    weekdayDays,
    weekendDays,
    weekdayPerDay: weekdayDays ? weekdayMinutes / weekdayDays : 0,
    weekendPerDay: weekendDays ? weekendMinutes / weekendDays : 0,
  }
}

export function openItemAges(tasks: Task[], today = new Date()): { ages: number[]; curve: SurvivalPoint[] } {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const ages: number[] = []
  for (const t of tasks) {
    if (t.completed) continue
    if ((t.importance ?? 0) < 3) continue
    const created = t.createdAt instanceof Date ? t.createdAt : parseLocalDate(String(t.createdAt ?? ""))
    if (!created) continue
    const age = Math.max(0, Math.round((t0 - created.getTime()) / 86_400_000))
    ages.push(age)
  }
  return { ages, curve: survivalCurve(ages) }
}
