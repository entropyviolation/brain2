/**
 * lib/plan-bimby/day/schedule.ts — Order the day and see whether it fits (pure)
 *
 * `orderDay` runs once, when the plan is built: urgent first, then must, important, the rest, each in spoken
 * order, and a thing that waits on another goes after it. After that the order is the person's. `layout`
 * puts the rows end to end from now and says which ones run past the end of the day.
 */

import { span } from "./estimate"
import type { DayItem, DayPlan, DayTier } from "./types"

const RANK: Record<DayTier, number> = { must: 0, important: 1, rest: 2 }
export const DEFAULT_UNTIL = "23:00"

export function orderDay<T extends Pick<DayItem, "id" | "tier" | "urgent" | "after">>(items: T[]): T[] {
  const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => Number(b.item.urgent) - Number(a.item.urgent) || RANK[a.item.tier] - RANK[b.item.tier] || a.i - b.i).map((x) => x.item)
  // A thing that waits on another moves to just after it. Bounded, so a loop of waits cannot spin.
  for (let pass = 0; pass < sorted.length; pass++) {
    let moved = false
    for (const item of [...sorted]) {
      if (!item.after) continue
      const at = sorted.indexOf(item)
      const dep = sorted.findIndex((x) => x.id === item.after)
      if (dep > at) {
        sorted.splice(at, 1)
        sorted.splice(sorted.findIndex((x) => x.id === item.after) + 1, 0, item)
        moved = true
      }
    }
    if (!moved) break
  }
  return sorted
}

const toMin = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  return m ? Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2])) : 23 * 60
}
export const hhmm = (min: number): string => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((min % 1440) + 1440) % 1440 % 60).padStart(2, "0")}`

/** The end of the day when none is given: 23:00, or midnight once it is past 22:00. */
export function defaultUntil(now: Date): string {
  return now.getHours() >= 22 ? "23:59" : DEFAULT_UNTIL
}

export interface Row {
  id: string
  /** Minutes from midnight. */
  start: number
  end: number
  /** Ends after the day does. */
  over: boolean
}

export interface Layout {
  rows: Row[]
  /** Minutes from now to the end of the day. */
  left: number
  need: number
  mustNeed: number
  /** Titles that run past the end, lowest weight first. */
  overflow: string[]
  lines: string[]
}

export function layout(plan: Pick<DayPlan, "items" | "until">, now: Date): Layout {
  const start = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5
  const end = toMin(plan.until)
  const open = plan.items.filter((i) => !i.doneAt)
  let at = start
  const rows: Row[] = open.map((item) => {
    const row = { id: item.id, start: at, end: at + item.estimate.minutes, over: at + item.estimate.minutes > end }
    at = row.end
    return row
  })
  const left = Math.max(0, end - start)
  const need = open.reduce((n, i) => n + i.estimate.minutes, 0)
  const mustNeed = open.filter((i) => i.tier === "must").reduce((n, i) => n + i.estimate.minutes, 0)
  const lines: string[] = [`${span(left)} left until ${plan.until}. Everything needs ${span(need)}; the musts need ${span(mustNeed)}.`]
  // What to let go of when it does not fit: lowest weight first, last in the order first.
  const overflow: string[] = []
  if (need > left) {
    let spare = need - left
    for (const item of [...open].reverse().sort((a, b) => RANK[b.tier] - RANK[a.tier])) {
      if (spare <= 0 || item.tier === "must") break
      overflow.push(item.title)
      spare -= item.estimate.minutes
    }
    if (mustNeed > left) lines.push(`The musts alone do not fit: ${span(mustNeed - left)} over. Shorten one, or move the end of the day.`)
    else lines.push(`It does not all fit: ${span(need - left)} over. First to let go: ${overflow.join(", ")}.`)
  } else {
    lines.push(`It fits, with ${span(left - need)} spare.`)
  }
  return { rows, left, need, mustNeed, overflow, lines }
}
