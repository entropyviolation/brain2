/**
 * lib/bim-flow/file-activity.ts — What the person was doing, from files they saved or changed
 *
 * Events come from the hub (`/api/file-activity`): a file created or modified,
 * with its path under the home folder. Two kinds of fact:
 *
 * 1. A rule the person stated: a folder whose files always mean an activity
 *    (`DECLARED_FOLDERS`: elijah/foxtide is Foxtide work). Said as their rule.
 * 2. Learned on their confirmed Activity blocks (20 min or more), Sept–Oct 2026:
 *    3+ files in a block meant a work activity in 59 of 82 blocks, and none
 *    meant not work in 196 of 206. Which pens count as work is learned (pens
 *    with 60%+ of blocks touched). A folder whose events mostly fall in clearly
 *    away blocks is dropped (`websites`: 73%). Pure; no model.
 * Record: docs/BIM_SIGNALS_PLAYBOOK.md.
 */

import type { HistoryEntry } from "./vault-search"

export interface FileEvent {
  /** Epoch ms. */
  at: number
  k: "new" | "mod"
  /** Path relative to the home folder. */
  p: string
}

/** Folders the person said always mean an activity. `needle` is matched against the lowercased path with ":" read as "/". */
export const DECLARED_FOLDERS: { label: string; needle: string; activity: string }[] = [{ label: "elijah/foxtide", needle: "elijah/foxtide", activity: "Foxtide work" }]

const MIN = 60_000
const MIN_BLOCK = 20
/** Pens that are clearly not at the computer. Used only to find noisy folders. */
const AWAY = /^(sleep|driving|walking|hanging out.*|scrolling|watching tv|youtube)$/i

const norm = (p: string) => p.toLowerCase().replace(/:/g, "/")
const top = (p: string) => p.split("/")[0] ?? ""
export const dayOf = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const minOf = (at: number) => {
  const d = new Date(at)
  return d.getHours() * 60 + d.getMinutes()
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

export interface FileLearned {
  days: number
  blocks: number
  /** Pens whose blocks were touched by 3+ files at least 60% of the time. */
  workPens: string[]
  /** Blocks with 3+ files, and how many were a work pen. */
  activeBlocks: number
  activeWork: number
  /** Blocks with fewer than 3, and how many were not a work pen. */
  quietBlocks: number
  quietNotWork: number
  /** Top folders whose events land mostly in away blocks. Their events are ignored. */
  noisy: string[]
}

function confirmedBlocks(entries: HistoryEntry[], days: Set<string>) {
  return entries.filter((e) => e.scope === "activity" && e.confirmed !== false && !e.instant && e.endMin - e.startMin >= MIN_BLOCK && days.has(e.date))
}

function inside(byDay: Map<string, FileEvent[]>, e: HistoryEntry, skip: Set<string>) {
  return (byDay.get(e.date) ?? []).filter((x) => !skip.has(top(x.p)) && minOf(x.at) >= e.startMin && minOf(x.at) < e.endMin)
}

function groupByDay(events: FileEvent[]) {
  const m = new Map<string, FileEvent[]>()
  for (const x of events) m.set(dayOf(x.at), [...(m.get(dayOf(x.at)) ?? []), x])
  return m
}

/** Needs 8 days with events and 40 confirmed blocks on them, and some pen that files clearly mark. */
export function learnFiles(events: FileEvent[], entries: HistoryEntry[]): FileLearned | null {
  const byDay = groupByDay(events)
  const blocks = confirmedBlocks(entries, new Set(byDay.keys()))
  if (byDay.size < 8 || blocks.length < 40) return null
  const none = new Set<string>()
  // Which folders are noise: their blocks are mostly away blocks.
  const perTop = new Map<string, { n: number; away: number }>()
  for (const e of blocks) {
    for (const t of new Set(inside(byDay, e, none).map((x) => top(x.p)))) {
      const c = perTop.get(t) ?? { n: 0, away: 0 }
      c.n++
      if (AWAY.test(e.pen)) c.away++
      perTop.set(t, c)
    }
  }
  const noisy = new Set([...perTop].filter(([, c]) => c.n >= 5 && c.away / c.n > 0.4).map(([t]) => t))
  const rate = new Map<string, { n: number; hit: number }>()
  for (const e of blocks) {
    const r = rate.get(e.pen) ?? { n: 0, hit: 0 }
    r.n++
    if (inside(byDay, e, noisy).length >= 3) r.hit++
    rate.set(e.pen, r)
  }
  const workPens = new Set([...rate].filter(([, r]) => r.n >= 5 && r.hit / r.n >= 0.6).map(([p]) => p))
  if (workPens.size === 0) return null
  let activeBlocks = 0, activeWork = 0, quietBlocks = 0, quietNotWork = 0
  for (const e of blocks) {
    const work = workPens.has(e.pen)
    if (inside(byDay, e, noisy).length >= 3) {
      activeBlocks++
      if (work) activeWork++
    } else {
      quietBlocks++
      if (!work) quietNotWork++
    }
  }
  if (activeWork / Math.max(activeBlocks, 1) < 0.5 || quietNotWork / Math.max(quietBlocks, 1) < 0.8) return null
  return { days: byDay.size, blocks: blocks.length, workPens: [...workPens], activeBlocks, activeWork, quietBlocks, quietNotWork, noisy: [...noisy] }
}

/** Runs of events with gaps under `gap` minutes, as [start, end, count]. */
export function runsOf(events: FileEvent[], gap: number): [number, number, number][] {
  const out: [number, number, number][] = []
  for (const x of [...events].sort((a, b) => a.at - b.at)) {
    const m = minOf(x.at)
    const last = out.at(-1)
    if (last && m - last[1] <= gap) {
      last[1] = Math.max(last[1], m)
      last[2]++
    } else out.push([m, m, 1])
  }
  return out
}

/** Dated, counted lines for one day. The declared-folder lines need no history; the learned ones are empty without enough. */
export function fileFacts(events: FileEvent[], entries: HistoryEntry[], date: string): string[] {
  const day = events.filter((x) => dayOf(x.at) === date)
  const out: string[] = []
  for (const rule of DECLARED_FOLDERS) {
    const r = runsOf(day.filter((x) => norm(x.p).includes(rule.needle)), 20)
    if (r.length) out.push(`Files: saved or changed in ${rule.label} ${r.map(([a, b, n]) => `${hhmm(a)}–${hhmm(Math.max(b, a + 1))} (${n} ${n === 1 ? "file" : "files"})`).join(", ")}. By the person's own rule, files in ${rule.label} are evidence for "${rule.activity}".`)
  }
  const learned = learnFiles(events, entries)
  if (!learned || day.length === 0) return out
  const noisy = new Set(learned.noisy)
  const real = day.filter((x) => !noisy.has(top(x.p)))
  const active = top6(runsOf(real, 20).filter(([, , n]) => n >= 3), (r) => r[2])
  if (active.length) out.push(`Files: busy saving or changing files ${active.map(([a, b, n]) => `${hhmm(a)}–${hhmm(Math.max(b, a + 1))} (${n})`).join(", ")}, so probably working at the computer (by your own logs over ${learned.days} days, 3+ files meant a work activity in ${learned.activeWork} of ${learned.activeBlocks} blocks).`)
  if (real.length) {
    const ms = real.map((x) => minOf(x.at))
    const first = Math.min(...ms)
    const last = Math.max(...ms)
    const quiet = top6(gaps(real, 90), (g) => g[1] - g[0], 3)
    if (quiet.length && last > first) out.push(`Files: none saved or changed ${quiet.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(", ")}, so probably not working at the computer then (${learned.quietNotWork} of ${learned.quietBlocks} such blocks in your logs were not work).`)
  }
  return out
}

/** The `n` biggest by `size`, back in time order, so a long day stays readable. */
function top6<T>(xs: T[], size: (x: T) => number, n = 6): T[] {
  return [...xs].sort((a, b) => size(b) - size(a)).slice(0, n).sort((a, b) => xs.indexOf(a) - xs.indexOf(b))
}

/** Gaps of `min` minutes or more between consecutive events, inside the day's first and last event. */
function gaps(events: FileEvent[], min: number): [number, number][] {
  const ms = [...new Set(events.map((x) => minOf(x.at)))].sort((a, b) => a - b)
  const out: [number, number][] = []
  for (let i = 1; i < ms.length; i++) if (ms[i]! - ms[i - 1]! >= min) out.push([ms[i - 1]!, ms[i]!])
  return out
}
