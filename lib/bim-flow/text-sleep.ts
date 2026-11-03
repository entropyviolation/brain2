/**
 * lib/bim-flow/text-sleep.ts — When the person was probably asleep, from when they stop and start texting
 *
 * Learned on the person's own Sleep blocks (Sept–Oct 2026, 26 blocks of 3 h or
 * more): no text was sent inside any of them, the last sent text came a median
 * of about 2 h before the logged start (they lie in bed on the phone first),
 * and the first came about 1 h after the logged wake. So the quiet stretch
 * between a night's last and first sent text holds the sleep, and the logged
 * edges sit inside it by those medians. Pure; no model.
 */

import type { TextRow } from "./texts"
import type { HistoryEntry } from "./vault-search"

const MIN = 60_000

export interface SleepOffsets {
  n: number
  /** Median minutes from the last sent text to the logged sleep start. */
  leadMin: number
  /** Median minutes from the logged wake to the first sent text. */
  lagMin: number
  /** Sent texts that fell inside a logged sleep block (should be about zero). */
  textsInside: number
}

const startOf = (date: string, min: number) => new Date(`${date}T00:00:00`).getTime() + min * MIN
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

/** Learn the offsets from Activity blocks named Sleep (3 h or more, not generated). Needs 8 nights. */
export function sleepOffsets(rows: TextRow[], activity: HistoryEntry[]): SleepOffsets | null {
  const sent = rows.filter((r) => r.dir === "out").map((r) => new Date(r.at).getTime()).sort((a, b) => a - b)
  const leads: number[] = []
  const lags: number[] = []
  let inside = 0
  let counted = 0
  for (const e of activity) {
    if (e.scope !== "activity" || e.pen.toLowerCase() !== "sleep" || e.confirmed === false || e.endMin - e.startMin < 180) continue
    const s = startOf(e.date, e.startMin)
    const w = startOf(e.date, e.endMin)
    counted++
    inside += sent.filter((t) => t > s + 30 * MIN && t < w - 30 * MIN).length
    const before = sent.filter((t) => t >= s - 5 * 60 * MIN && t <= s + 30 * MIN).at(-1)
    const after = sent.find((t) => t >= w - 30 * MIN && t <= w + 4 * 60 * MIN)
    if (before != null) leads.push((s - before) / MIN)
    if (after != null) lags.push((after - w) / MIN)
  }
  if (counted < 8 || leads.length < 6 || lags.length < 6) return null
  return { n: counted, leadMin: Math.round(median(leads)), lagMin: Math.round(median(lags)), textsInside: inside }
}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/**
 * The night that ends on `date`: from the last text sent before 06:00 that morning
 * (looking back 12 h) to the first text sent that day. A fact only when the gap is 4 h or more.
 */
export function sleepFact(rows: TextRow[], date: string, offsets: SleepOffsets | null): string | null {
  const dayStart = new Date(`${date}T00:00:00`).getTime()
  const sent = rows.filter((r) => r.dir === "out").map((r) => new Date(r.at).getTime())
  const first = sent.filter((t) => t >= dayStart).sort((a, b) => a - b)[0]
  const last = sent.filter((t) => t < dayStart + 6 * 60 * MIN && t >= dayStart - 12 * 60 * MIN).sort((a, b) => b - a)[0]
  if (first == null || last == null || first - last < 4 * 60 * MIN) return null
  const quiet = `Sleep: no text sent from ${hhmm(last)} to ${hhmm(first)} (${Math.round((first - last) / (60 * MIN) * 10) / 10} h).`
  if (!offsets) return quiet
  const from = last + offsets.leadMin * MIN
  const to = first - offsets.lagMin * MIN
  if (to <= from) return quiet
  return `${quiet} By the person's own logs (${offsets.n} nights) they start about ${offsets.leadMin} min after the last text and wake about ${offsets.lagMin} min before the first, so likely asleep ${hhmm(from)}–${hhmm(to)}; ${offsets.textsInside} texts were ever sent inside a logged sleep block.`
}
