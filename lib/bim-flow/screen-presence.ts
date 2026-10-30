/**
 * lib/bim-flow/screen-presence.ts — Where the person's attention was, from Screen Time
 *
 * Learned on the person's own confirmed Activity blocks (20 min or more).
 * Mac Screen Time (ActivityWatch) covering half a block: on Sept–Oct 2026 data
 * that held in 19 of 20 Computer Work blocks and none of Sleep, driving,
 * walking or hanging out. iPhone Screen Time (Instagram pings): 30% cover
 * picked out the scrolling blocks with about 84% precision. Chrome-history
 * blocks did not beat the baseline and are left out. The pens are learned at
 * run time, never named here. Pure; no model. Record: docs/BIM_SIGNALS_PLAYBOOK.md.
 */

import type { HistoryEntry } from "./vault-search"

const MIN_BLOCK = 20

export interface MacPresence {
  days: number
  /** Activity pens whose blocks the Mac covered by half or more, with their counts. */
  pens: { pen: string; covered: number; blocks: number }[]
  /** Blocks of every other pen, and how many of those the Mac covered by half or more. */
  otherBlocks: number
  otherCovered: number
}

export interface PhoneScroll {
  days: number
  pen: string
  /** Blocks with 30%+ phone cover, and how many of them were this pen. */
  covered: number
  hit: number
}

function cover(iv: [number, number][], s: number, t: number): number {
  const parts = iv.map(([a, b]) => [Math.max(a, s), Math.min(b, t)] as [number, number]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  let tot = 0
  let cur: [number, number] | null = null
  for (const [a, b] of parts) {
    if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b)
    else {
      if (cur) tot += cur[1] - cur[0]
      cur = [a, b]
    }
  }
  if (cur) tot += cur[1] - cur[0]
  return tot / (t - s)
}

export function byDay(entries: HistoryEntry[], keep: (e: HistoryEntry) => boolean): Map<string, [number, number][]> {
  const m = new Map<string, [number, number][]>()
  for (const e of entries) if (keep(e) && !e.instant) m.set(e.date, [...(m.get(e.date) ?? []), [e.startMin, e.endMin]])
  return m
}

const isMac = (e: HistoryEntry) => e.scope === "screentime" && e.source === "screentime"
const isPhone = (e: HistoryEntry) => e.scope === "iphone-screentime"
const truthOf = (entries: HistoryEntry[]) =>
  entries.filter((e) => e.scope === "activity" && e.confirmed !== false && !e.instant && e.endMin - e.startMin >= MIN_BLOCK)

/** Needs 8 days of Mac data, 30 confirmed blocks on them, and a clear gap between the pens the Mac covers and the rest. */
export function macPresence(entries: HistoryEntry[]): MacPresence | null {
  const days = byDay(entries, isMac)
  const blocks = truthOf(entries).filter((e) => days.has(e.date))
  if (days.size < 8 || blocks.length < 30) return null
  const per = new Map<string, { covered: number; blocks: number }>()
  for (const e of blocks) {
    const p = per.get(e.pen) ?? { covered: 0, blocks: 0 }
    p.blocks++
    if (cover(days.get(e.date)!, e.startMin, e.endMin) >= 0.5) p.covered++
    per.set(e.pen, p)
  }
  const pens = [...per.entries()].filter(([, p]) => p.blocks >= 3 && p.covered / p.blocks >= 0.6).map(([pen, p]) => ({ pen, ...p }))
  const names = new Set(pens.map((p) => p.pen))
  const rest = [...per.entries()].filter(([pen]) => !names.has(pen)).map(([, p]) => p)
  const otherBlocks = rest.reduce((a, p) => a + p.blocks, 0)
  const otherCovered = rest.reduce((a, p) => a + p.covered, 0)
  if (pens.length === 0 || otherBlocks < 10 || otherCovered / otherBlocks > 0.3) return null
  return { days: days.size, pens: pens.sort((a, b) => b.blocks - a.blocks), otherBlocks, otherCovered }
}

/** Needs 10 days of phone pings, and one pen that is at least 70% of the blocks they cover by 30%+. */
export function phoneScroll(entries: HistoryEntry[]): PhoneScroll | null {
  const days = byDay(entries, isPhone)
  const covered = truthOf(entries).filter((e) => days.has(e.date) && cover(days.get(e.date)!, e.startMin, e.endMin) >= 0.3)
  if (days.size < 10 || covered.length < 10) return null
  const n = new Map<string, number>()
  for (const e of covered) n.set(e.pen, (n.get(e.pen) ?? 0) + 1)
  const [pen, hit] = [...n.entries()].sort((a, b) => b[1] - a[1])[0]!
  return hit / covered.length >= 0.7 ? { days: days.size, pen, covered: covered.length, hit } : null
}

/**
 * Rules the person stated themselves, not learned: an app or site (Mac app or Chrome site) that always counts as evidence for an activity.
 * They are said as the person's rule, so the answer never mistakes them for a measured rate.
 */
export const DECLARED_APPS: { app: string; activity: string }[] = [
  { app: "Cursor", activity: "Computer Work" },
  { app: "YouTube", activity: "youtube" },
]

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

/** Runs of 20+ minutes (gaps under 10 minutes joined) from the given pings. */
export function runs(iv: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [a, b] of [...iv].sort((x, y) => x[0] - y[0])) {
    const last = out.at(-1)
    if (last && a - last[1] < 10) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out.filter(([a, b]) => b - a >= MIN_BLOCK)
}

/** Dated, counted lines for one day. Empty when the person has too little history to learn from. */
export function screenFacts(entries: HistoryEntry[], date: string): string[] {
  const out: string[] = []
  const mac = macPresence(entries)
  if (mac) {
    const r = runs(byDay(entries, isMac).get(date) ?? [])
    if (r.length) {
      const top = mac.pens.slice(0, 3).map((p) => `${p.pen} ${p.covered} of ${p.blocks}`).join(", ")
      out.push(`Screen: the Mac was in use ${r.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", ")}, so probably at the computer, not asleep, driving or out (by your own logs over ${mac.days} days the Mac covered ${top}, but only ${mac.otherCovered} of ${mac.otherBlocks} other blocks).`)
    }
  }
  for (const rule of DECLARED_APPS) {
    const r = runs(byDay(entries, (e) => e.scope === "screentime" && e.pen.toLowerCase() === rule.app.toLowerCase()).get(date) ?? [])
    if (r.length) out.push(`Screen: ${rule.app} was open ${r.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", ")}. By the person's own rule, ${rule.app} is evidence for "${rule.activity}".`)
  }
  const ph = phoneScroll(entries)
  if (ph) {
    const r = runs(byDay(entries, isPhone).get(date) ?? [])
    if (r.length) out.push(`Screen: Instagram on the phone ${r.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", ")}; in your logs ${ph.hit} of ${ph.covered} blocks with that much Instagram were "${ph.pen}" (${ph.days} days). Instagram only: other apps leave no trace.`)
  }
  return out
}
