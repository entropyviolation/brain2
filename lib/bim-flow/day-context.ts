/**
 * lib/bim-flow/day-context.ts — What is already known about a day, for time-block making
 *
 * When a flow is about to make time blocks, the model is shown this first:
 * the blocks the person confirmed (Activity, not guessed, not generated),
 * the unknown stretches between them, and whatever else tracking holds for
 * those stretches (location, screen time, company, mood, instants, the day's
 * Health numbers). Code also uses `confirmedSpans` to trim any block the flow
 * builds, so a confirmed block is never overwritten. Pure; no stores.
 */

import type { HistoryEntry, VaultHistory } from "./vault-search"

const MIN = 60_000
const MINUTES_PER_DAY = 1440

export interface Gap {
  startMin: number
  endMin: number
  /** What other tracking says inside this gap, one short phrase each. */
  signals: string[]
}

export interface DayContext {
  date: string
  confirmed: HistoryEntry[]
  gaps: Gap[]
  /** The day's Health numbers, already worded. */
  health: string
  /** Where unknown time is counted up to: the message minute when the day is today, else midnight. */
  untilMin: number
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Activity time the person stated or confirmed: exact, not generated, a real interval. */
export function isConfirmed(e: HistoryEntry): boolean {
  return e.scope === "activity" && !e.instant && e.confirmed !== false && e.endMin > e.startMin
}

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
const span = (a: number, b: number) => `${clock(a)}–${b >= MINUTES_PER_DAY ? "24:00" : clock(b)}`

function overlapMin(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** Minutes of `[0, untilMin)` no confirmed block covers, as runs. */
function unknownRuns(confirmed: HistoryEntry[], untilMin: number): [number, number][] {
  const covered = new Uint8Array(MINUTES_PER_DAY)
  for (const e of confirmed) covered.fill(1, Math.max(0, e.startMin), Math.min(MINUTES_PER_DAY, e.endMin))
  const runs: [number, number][] = []
  let from = -1
  for (let m = 0; m <= untilMin; m++) {
    const open = m < untilMin && !covered[m]
    if (open && from < 0) from = m
    if (!open && from >= 0) {
      runs.push([from, m])
      from = -1
    }
  }
  return runs
}

function signalsFor(entries: HistoryEntry[], a: number, b: number): string[] {
  const out: string[] = []
  for (const scope of ["location", "company", "mood"]) {
    const names = [...new Set(entries.filter((e) => e.scope === scope && overlapMin(a, b, e.startMin, Math.max(e.endMin, e.startMin + 1)) > 0).map((e) => e.pen))]
    if (names.length) out.push(`${scope}: ${names.slice(0, 4).join(", ")}`)
  }
  const screen = new Map<string, number>()
  for (const e of entries) {
    if (e.scope !== "screentime") continue
    const m = overlapMin(a, b, e.startMin, e.endMin)
    if (m > 0) screen.set(e.pen, (screen.get(e.pen) ?? 0) + m)
  }
  const top = [...screen].sort((x, y) => y[1] - x[1]).slice(0, 3)
  if (top.length) out.push(`screen time: ${top.map(([p, m]) => `${p} ${m}m`).join(", ")}`)
  // The person's own guessed blocks and everything a machine painted that is not covered above.
  const guessed = entries.filter((e) => e.scope === "activity" && !isConfirmed(e) && !e.instant && overlapMin(a, b, e.startMin, e.endMin) > 0)
  if (guessed.length) out.push(`guessed, not confirmed: ${guessed.slice(0, 3).map((e) => `${e.pen} ${span(e.startMin, e.endMin)}`).join(", ")}`)
  const instants = entries.filter((e) => e.instant && e.startMin >= a && e.startMin < b)
  if (instants.length) out.push(`events: ${instants.slice(0, 4).map((e) => `${clock(e.startMin)} ${e.pen}${e.text ? ` (${e.text})` : ""}`).join(", ")}`)
  return out
}

function healthLine(day: NonNullable<VaultHistory["health"]>[string] | undefined): string {
  if (!day) return ""
  const parts = [
    day.steps !== undefined ? `${Math.round(day.steps)} steps` : "",
    day.distanceM !== undefined ? `${(day.distanceM / 1000).toFixed(1)} km walked or run` : "",
    day.activeKcal !== undefined ? `${Math.round(day.activeKcal)} active kcal` : "",
    day.heartAvg !== undefined ? `heart rate avg ${Math.round(day.heartAvg)}${day.heartMax !== undefined ? `, max ${Math.round(day.heartMax)}` : ""}` : "",
  ].filter(Boolean)
  return parts.join(" · ")
}

export function buildDayContext(history: VaultHistory | undefined, at: Date): DayContext {
  const date = localDateKey(at)
  const todayKey = localDateKey(new Date())
  const untilMin = date === todayKey ? at.getHours() * 60 + at.getMinutes() : MINUTES_PER_DAY
  const entries = (history?.entries ?? []).filter((e) => e.date === date)
  const confirmed = entries.filter(isConfirmed).sort((x, y) => x.startMin - y.startMin)
  return {
    date,
    confirmed,
    untilMin,
    gaps: unknownRuns(confirmed, untilMin).map(([a, b]) => ({ startMin: a, endMin: b, signals: signalsFor(entries, a, b) })),
    health: healthLine(history?.health?.[date]),
  }
}

/** The block the model reads. Empty when tracking knows nothing for the day. */
export function dayContextText(ctx: DayContext): string {
  const lines = [`TRACKED ON ${ctx.date} (what is already known; time blocks fill only the unknown time)`]
  lines.push("CONFIRMED by the person, do not change or overlap:")
  lines.push(...(ctx.confirmed.length ? ctx.confirmed.map((e) => `- ${span(e.startMin, e.endMin)} ${e.pen}${e.text ? ` · ${e.text}` : ""}`) : ["- none yet"]))
  lines.push(`UNKNOWN, no confirmed block (up to ${clock(Math.min(ctx.untilMin, MINUTES_PER_DAY - 1))}):`)
  lines.push(
    ...(ctx.gaps.length
      ? ctx.gaps.map((g) => `- ${span(g.startMin, g.endMin)} (${g.endMin - g.startMin}m)${g.signals.length ? ` · ${g.signals.join(" · ")}` : " · nothing else tracked"}`)
      : ["- none"]),
  )
  if (ctx.health) lines.push(`HEALTH today: ${ctx.health}`)
  return lines.join("\n")
}

export interface Span {
  start: number
  end: number
}

/** Confirmed activity as epoch spans over every day in the history, for trimming built blocks. */
export function confirmedSpans(history: VaultHistory | undefined): Span[] {
  return (history?.entries ?? []).filter(isConfirmed).map((e) => {
    const [y, mo, d] = e.date.split("-").map(Number)
    const day = new Date(y, mo - 1, d).getTime()
    return { start: day + e.startMin * MIN, end: day + e.endMin * MIN }
  })
}
