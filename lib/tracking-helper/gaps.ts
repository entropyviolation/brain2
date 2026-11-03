/**
 * lib/tracking-helper/gaps.ts — Gap questions: how much of the past 7 days is tracked, and what to ask
 *
 * The Tracking BIMBY's second pipeline. Pure code, no model, writes nothing.
 * `WINDOW → MEASURE → FIND → ASK`. Each day has an awake window (the complement of its Sleep blocks, else
 * 07:00–23:00, clipped to now for today, never into the future). MEASURE counts how much of that window the
 * Activity, Location and Company lanes cover, and how many food entries the day has. FIND keeps the big
 * holes. ASK turns each into one question with a `seed`: the opening words of an account the person can
 * finish and send to the description-to-timeblock pipeline, so an answer becomes blocks without retyping.
 */

import { MINUTES_PER_DAY, isInstant, isSleepBlock, type TimeEntry } from "@/lib/time-entries"
import { clockText } from "./clock"

export const GAP_LANES = ["activity", "location", "company"] as const
export type GapLane = (typeof GAP_LANES)[number] | "food"

export const GAP_DEFAULTS = {
  /** Awake window when a day has no Sleep block. */
  wakeMin: 7 * 60,
  sleepMin: 23 * 60,
  /** A hole this long in Activity is a gap worth asking about. */
  activityGapMin: 60,
  /** A lane (Location, Company) is only asked about when Activity is tracked for at least this much of the day. */
  laneNeedsActivityMin: 120,
  /** Food: this many awake minutes with no food entry (and Activity tracked through them) is a gap. */
  foodGapMin: 6 * 60,
  maxQuestions: 8,
}
export type GapOptions = Partial<typeof GAP_DEFAULTS>

export interface DayWindow {
  date: string
  /** Awake runs as [startMin, endMin), up to now for today. Empty for a future day. */
  runs: [number, number][]
  awakeMin: number
  /** True when no Sleep block was found and the default window was used. */
  assumed: boolean
}

export interface LaneCoverage {
  coveredMin: number
  /** 0–100, of the awake window. */
  percent: number
}

export interface DayCoverage {
  date: string
  awakeMin: number
  lanes: Record<(typeof GAP_LANES)[number], LaneCoverage>
  foodEntries: number
}

export interface Gap {
  lane: GapLane
  date: string
  startMin: number
  endMin: number
}

export interface GapQuestion {
  id: string
  lane: GapLane
  date: string
  startMin: number
  endMin: number
  /** What to show. */
  text: string
  /** Why this one, in plain words. */
  reason: string
  /** Opening words of an account to finish and send to the description-to-timeblock pipeline. Empty for lanes it cannot file. */
  seed: string
  /** Minutes of hole. Questions sort on this, largest first. */
  size: number
}

export interface GapStage {
  stage: "window" | "measure" | "find" | "ask"
  ms: number
  note: string
  output?: unknown
}

export interface GapRun {
  dates: string[]
  windows: DayWindow[]
  coverage: DayCoverage[]
  gaps: Gap[]
  questions: GapQuestion[]
  /** Totals over the dates, 0–100 per lane, and food entries. */
  summary: Record<(typeof GAP_LANES)[number], number> & { foodEntries: number; awakeMin: number }
  trace: GapStage[]
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** The last `n` days ending today, oldest first. Default 7: a rolling week, not the days since Monday. */
export function pastDates(now: Date, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i))))
}

/** Merge `[start, end)` runs that touch or overlap. */
function merge(runs: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const [a, b] of [...runs].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

function subtract(runs: [number, number][], cut: [number, number][]): [number, number][] {
  let out = runs
  for (const [ca, cb] of merge(cut)) {
    out = out.flatMap(([a, b]): [number, number][] => {
      if (cb <= a || ca >= b) return [[a, b]]
      return [[a, Math.min(b, ca)], [Math.max(a, cb), b]].filter(([x, y]) => y > x) as [number, number][]
    })
  }
  return out
}

const total = (runs: [number, number][]) => runs.reduce((n, [a, b]) => n + (b - a), 0)

export function windowFor(date: string, entries: TimeEntry[], now: Date, o: typeof GAP_DEFAULTS): DayWindow {
  const today = isoOf(now)
  if (date > today) return { date, runs: [], awakeMin: 0, assumed: false }
  const sleeps = entries
    .filter((e) => e.date === date && e.scopeId === "activity" && !isInstant(e) && isSleepBlock(e))
    .map((e): [number, number] => [e.startMin, e.endMin])
  const assumed = sleeps.length === 0
  let runs: [number, number][] = assumed ? [[o.wakeMin, o.sleepMin]] : subtract([[0, MINUTES_PER_DAY]], sleeps)
  if (date === today) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    runs = runs.map(([a, b]): [number, number] => [a, Math.min(b, nowMin)]).filter(([a, b]) => b > a)
  }
  return { date, runs, awakeMin: total(runs), assumed }
}

/** Awake runs of `win` that the entries of one lane do not cover. */
function holes(win: DayWindow, covers: [number, number][]): [number, number][] {
  return subtract(win.runs, covers)
}

const dayName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })
const span = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} m` : ""}` : `${m} m`)

export function runGapQuestions(entries: TimeEntry[], now: Date = new Date(), dates: string[] = pastDates(now), options: GapOptions = {}): GapRun {
  const o = { ...GAP_DEFAULTS, ...options }
  const trace: GapStage[] = []
  let t = performance.now()
  const tick = (stage: GapStage["stage"], note: string, output?: unknown) => {
    const n = performance.now()
    trace.push({ stage, ms: Math.round(n - t), note, output })
    t = n
  }

  // WINDOW
  const windows = dates.map((d) => windowFor(d, entries, now, o))
  tick("window", `${windows.filter((w) => w.awakeMin > 0).length} days with awake time`, windows)

  // MEASURE
  const laneRuns = (date: string, lane: string) =>
    merge(entries.filter((e) => e.date === date && e.scopeId === lane && !isInstant(e) && e.endMin > e.startMin).map((e): [number, number] => [e.startMin, e.endMin]))
  const coverage: DayCoverage[] = windows.map((w) => {
    const lanes = {} as DayCoverage["lanes"]
    for (const lane of GAP_LANES) {
      const covered = total(subtract(w.runs, holes(w, laneRuns(w.date, lane))))
      lanes[lane] = { coveredMin: covered, percent: w.awakeMin ? Math.round((covered / w.awakeMin) * 100) : 0 }
    }
    const foodEntries = entries.filter((e) => e.date === w.date && isInstant(e) && (e.intakeClass === "food" || e.eventKind === "intake.food")).length
    return { date: w.date, awakeMin: w.awakeMin, lanes, foodEntries }
  })
  const awakeMin = coverage.reduce((n, c) => n + c.awakeMin, 0)
  const pct = (lane: (typeof GAP_LANES)[number]) => (awakeMin ? Math.round((coverage.reduce((n, c) => n + c.lanes[lane].coveredMin, 0) / awakeMin) * 100) : 0)
  const summary = { activity: pct("activity"), location: pct("location"), company: pct("company"), foodEntries: coverage.reduce((n, c) => n + c.foodEntries, 0), awakeMin }
  tick("measure", `activity ${summary.activity}% · location ${summary.location}% · company ${summary.company}% · ${summary.foodEntries} food entries`, coverage)

  // FIND
  const gaps: Gap[] = []
  for (const w of windows) {
    if (!w.awakeMin) continue
    const actHoles = holes(w, laneRuns(w.date, "activity"))
    for (const [a, b] of actHoles) if (b - a >= o.activityGapMin) gaps.push({ lane: "activity", date: w.date, startMin: a, endMin: b })
    const activityTracked = w.awakeMin - total(actHoles)
    if (activityTracked >= o.laneNeedsActivityMin) {
      // Where Activity is known but Location or Company is blank: the holes inside the tracked stretches.
      const known: [number, number][] = subtract(w.runs, actHoles)
      for (const lane of ["location", "company"] as const) {
        for (const [a, b] of subtract(known, laneRuns(w.date, lane))) if (b - a >= o.activityGapMin) gaps.push({ lane, date: w.date, startMin: a, endMin: b })
      }
    }
    // Food: the awake runs with no food entry for foodGapMin, where the day has otherwise been tracked.
    if (activityTracked >= o.laneNeedsActivityMin) {
      const food = entries.filter((e) => e.date === w.date && isInstant(e) && (e.intakeClass === "food" || e.eventKind === "intake.food")).map((e) => e.startMin)
      const marks = [...food].sort((x, y) => x - y)
      for (const [a, b] of w.runs) {
        let from = a
        for (const m of [...marks.filter((x) => x >= a && x < b), b]) {
          if (m - from >= o.foodGapMin) gaps.push({ lane: "food", date: w.date, startMin: from, endMin: m })
          from = m
        }
      }
    }
  }
  tick("find", `${gaps.length} gaps`, gaps)

  // ASK
  const questions: GapQuestion[] = gaps
    .map((g): GapQuestion => {
      const day = dayName(g.date)
      const when = `${clockText(g.startMin)}–${clockText(g.endMin)}`
      const size = g.endMin - g.startMin
      const base = { id: `gap-${g.lane}-${g.date}-${g.startMin}`, lane: g.lane, date: g.date, startMin: g.startMin, endMin: g.endMin, size }
      if (g.lane === "activity") return { ...base, text: `What were you doing ${day} ${when}?`, reason: `${span(size)} of awake time with no Activity block.`, seed: `On ${day} from ${clockText(g.startMin)} to ${clockText(g.endMin)} I ` }
      if (g.lane === "location") return { ...base, text: `Where were you ${day} ${when}?`, reason: `Activity is tracked for these ${span(size)} but Location is blank.`, seed: `On ${day} from ${clockText(g.startMin)} to ${clockText(g.endMin)} I was at ` }
      if (g.lane === "company") return { ...base, text: `Who were you with ${day} ${when}, or were you alone?`, reason: `Activity is tracked for these ${span(size)} but Company is blank.`, seed: `On ${day} from ${clockText(g.startMin)} to ${clockText(g.endMin)} I was with ` }
      return { ...base, text: `What did you eat ${day} ${when}?`, reason: `${span(size)} awake with no food entry.`, seed: "" }
    })
    .sort((a, b) => b.size - a.size || a.date.localeCompare(b.date))
    .slice(0, o.maxQuestions)
  tick("ask", `${questions.length} questions`, questions.map((q) => q.text))

  return { dates, windows, coverage, gaps, questions, summary, trace }
}
