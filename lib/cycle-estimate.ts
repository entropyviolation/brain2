/**
 * lib/cycle-estimate.ts — A visible guess beside phaseForDate
 *
 * Explicit bleeding and ovulation stay authoritative. This module never writes
 * marks and never replaces `phaseForDate`. A day is `estimated` only when no
 * ovulation was marked for that cycle and a guess can be said out loud.
 * Spotting does not start or extend a bleed (same rule as cycle-phase.ts).
 *
 * Not medical advice. Not a fertility method. Not a diagnosis.
 *
 * Cycle length is bleed-start to the next bleed-start. Lengths under 18 or
 * over 60 days are not used for the median; they are not deleted. A gap under
 * 18 days is also not subdivided into estimated phases — `phaseForDate` stands,
 * with a hint when a one-day hole or spotting asks for one. A longer gap still
 * places a guess from the known next bleed.
 *
 * Luteal length is the distance from an ovulation day to the next bleed start,
 * so subtracting it lands on that ovulation day. The luteal days themselves
 * are the ones after ovulation and before the bleed (that distance minus one).
 * With no such pair the length is a 14-day prior, not a measurement from this
 * body. Learned medians are clamped to 8–18 days. Day placement rounds a
 * half-day median to the nearest calendar day; the summary keeps the median.
 */
import type { CycleDayMark } from "@/lib/cycle-marks"
import { phaseForDate, type CyclePhase } from "@/lib/cycle-phase"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"

/** Bleed-start to next bleed-start. Outside this, the interval is not used for the median. */
const MIN_CYCLE_DAYS = 18
const MAX_CYCLE_DAYS = 60

/** Distance from ovulation day to the next bleed start. Prior when nothing was marked. */
const LUTEAL_PRIOR_DAYS = 14
const MIN_LUTEAL_DAYS = 8
const MAX_LUTEAL_DAYS = 18

/** Open-cycle stand-in, used only when there is no median length. */
const CYCLE_PRIOR_DAYS = 28

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * What a watch can add, and what it cannot. Checked against Apple's Cycle
 * Tracking and wrist-temperature notes (ovulation estimates, 7 Nov 2025;
 * wrist temperature and Cycle Tracking, 14 Sep 2026).
 */
export const OVULATION_SIGNALS_NOTE =
  "Apple Watch Series 8 and later, and Apple Watch Ultra, can use overnight wrist temperature to suggest a likely ovulation day only after it has passed. The estimate looks for a biphasic rise, the temperature shift that often appears on later nights once progesterone is higher, not a signal that ovulation is happening that day. It is not a urine LH test, not an ultrasound, and not a same-day alarm; Apple describes it as a retrospective estimate that does not guarantee ovulation occurred. You can mark Ovulation here on the day you judge, including a past day a watch points to afterward. A urine LH surge about a day before ovulation, cervical fluid, and waking temperature are other signs some people already notice, and any of those can be a reason you mark a day. This is context for your own marks, not a diagnosis and not a fertility method."

export type CycleBasis = "marked" | "estimated"

export type CycleDayAssessment = {
  date: string
  /** The phase to SHOW. May differ from phaseForDate only when basis is "estimated". */
  phase: CyclePhase
  /** What phaseForDate currently says. Never hidden. */
  markedPhase: CyclePhase
  basis: CycleBasis
  /** One short sentence a UI can show. */
  reason: string
  /** 1 when basis is marked. Lower when estimated. */
  confidence: number
  /** Optional hint, e.g. a one-day hole inside a bleed. */
  hint?: string
}

export type CycleEstimateSummary = {
  completedCycles: number
  medianCycleLength: number | null
  medianBleedLength: number | null
  /** Learned only if the user has ovulation marks; otherwise the prior. */
  lutealLengthDays: number
  lutealSource: "marks" | "prior"
  /** Plain sentence: how many cycles the estimate rests on, and that it is not a diagnosis. */
  basisNote: string
}

interface BleedRun {
  start: string
  end: string
}

interface Analysis {
  summary: CycleEstimateSummary
  runs: BleedRun[]
  ovulations: string[]
}

type Span =
  | { kind: "completed"; nextStart: string; length: number; hasOvulation: boolean }
  | { kind: "open"; bleedStart: string; hasOvulation: boolean }

function parseDay(value: string): Date | null {
  const match = DAY_KEY.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function shift(day: string, days: number): string {
  const date = parseDay(day)
  if (!date) return day
  return formatLocalDateKey(addCalendarDays(date, days))
}

function daysBetween(earlier: string, later: string): number {
  const start = parseDay(earlier)
  const end = parseDay(later)
  if (!start || !end) return 0
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((utcEnd - utcStart) / 86_400_000)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Nearest calendar day. Halves round away from zero via Math.round. */
function wholeDays(value: number): number {
  return Math.round(value)
}

function bleedRuns(marks: Record<string, CycleDayMark>): BleedRun[] {
  const days = Object.keys(marks)
    .filter((key) => parseDay(key) && marks[key]?.bleeding === true)
    .sort()
  const runs: BleedRun[] = []
  for (const day of days) {
    const previous = runs[runs.length - 1]
    if (previous && shift(previous.end, 1) === day) previous.end = day
    else runs.push({ start: day, end: day })
  }
  return runs
}

function ovulationDates(marks: Record<string, CycleDayMark>): string[] {
  return Object.keys(marks)
    .filter((key) => parseDay(key) && marks[key]?.ovulation === true)
    .sort()
}

function basisNoteFor(
  completedCycles: number,
  lutealSource: "marks" | "prior",
  lutealClamped: boolean,
  excluded: number,
): string {
  const diagnosis = "This is not a diagnosis."
  const skipped =
    excluded > 0 ? " Lengths under 18 or over 60 days were not used for the median." : ""
  if (completedCycles === 0) {
    return `There is not enough history to measure a cycle. The luteal length is a 14-day prior, not a measurement from these marks.${skipped} ${diagnosis}`
  }
  if (completedCycles === 1) {
    return `This rests on 1 completed cycle, which is not enough history to treat as a measured cycle.${skipped} ${diagnosis}`
  }
  const luteal =
    lutealSource === "marks"
      ? lutealClamped
        ? "The luteal length is taken from marked ovulation and clamped into 8–18 days."
        : "The luteal length is the median distance from marked ovulation to the next bleed."
      : "The luteal length is a 14-day prior, not a measurement from these marks."
  const count = `${completedCycles} completed cycles`
  return `This rests on ${count}. ${luteal}${skipped} ${diagnosis}`
}

function analyze(marks: Record<string, CycleDayMark>): Analysis {
  const runs = bleedRuns(marks)
  const ovulations = ovulationDates(marks)
  const sane: number[] = []
  let excluded = 0
  for (let i = 0; i < runs.length - 1; i++) {
    const length = daysBetween(runs[i].start, runs[i + 1].start)
    if (length >= MIN_CYCLE_DAYS && length <= MAX_CYCLE_DAYS) sane.push(length)
    else excluded += 1
  }
  const distances: number[] = []
  for (const ovulation of ovulations) {
    const next = runs.find((run) => run.start > ovulation)
    if (!next) continue
    const distance = daysBetween(ovulation, next.start)
    if (distance > 0) distances.push(distance)
  }
  const rawLuteal = median(distances)
  const lutealClamped = rawLuteal != null && clamp(rawLuteal, MIN_LUTEAL_DAYS, MAX_LUTEAL_DAYS) !== rawLuteal
  const lutealLengthDays = rawLuteal == null ? LUTEAL_PRIOR_DAYS : clamp(rawLuteal, MIN_LUTEAL_DAYS, MAX_LUTEAL_DAYS)
  const lutealSource = rawLuteal == null ? "prior" : "marks"
  const completedCycles = sane.length
  return {
    runs,
    ovulations,
    summary: {
      completedCycles,
      medianCycleLength: median(sane),
      medianBleedLength: median(runs.map((run) => daysBetween(run.start, run.end) + 1)),
      lutealLengthDays,
      lutealSource,
      basisNote: basisNoteFor(completedCycles, lutealSource, lutealClamped, excluded),
    },
  }
}

/**
 * Confidence is coarse on purpose. Do not read extra precision into it.
 *
 * - 1    marked. The shown phase is phaseForDate.
 * - 0.6  estimated, at least 3 completed cycles, luteal length from marks.
 * - 0.5  estimated, 2 completed cycles, luteal length from marks.
 * - 0.35 estimated, luteal length is the 14-day prior and at least 2 cycles counted.
 * - 0.25 estimated, fewer than 2 completed cycles (a typical pattern).
 *
 * Prior-only or thin history stays at or below 0.35.
 */
function estimateConfidence(summary: CycleEstimateSummary): number {
  if (summary.completedCycles >= 3 && summary.lutealSource === "marks") return 0.6
  if (summary.completedCycles >= 2 && summary.lutealSource === "marks") return 0.5
  if (summary.completedCycles < 2) return 0.25
  return 0.35
}

function markedReason(date: string, phase: CyclePhase, marks: Record<string, CycleDayMark>): string {
  if (marks[date]?.bleeding === true) return "Bleeding is marked on this day, so the phase is menstrual."
  if (marks[date]?.ovulation === true) return "Ovulation is marked on this day, so the phase is ovulatory."
  if (phase === "luteal") return "This day follows a marked ovulation, so the phase is luteal until the next bleed."
  if (phase === "follicular") return "This day follows a bleed, and the phase stays the calendar reading."
  return "No bleed or ovulation is in effect, so the phase is unknown."
}

function guessReason(phase: CyclePhase, summary: CycleEstimateSummary, where: "completed" | "open"): string {
  if (where === "open" && summary.completedCycles < 2) {
    const prior =
      summary.medianCycleLength == null
        ? " A typical cycle is 28 days, with a 14-day luteal prior, not a measurement from these marks."
        : ""
    return `There is not enough history, so this estimated ${phase} day is a typical pattern, not a measured cycle.${prior}`
  }
  const luteal =
    summary.lutealSource === "marks"
      ? `${wholeDays(summary.lutealLengthDays)} days before the next bleed, from marked ovulation`
      : "a 14-day prior before the next bleed, not a measurement from these marks"
  if (where === "open") {
    return `Estimated ${phase}: the next bleed is projected from the median of ${summary.completedCycles} completed cycles, placing ovulation ${luteal}.`
  }
  if (summary.completedCycles < 2) {
    return `Estimated ${phase}: there is not enough history to measure a luteal length, so ovulation is placed using ${luteal}.`
  }
  return `Estimated ${phase}: no ovulation was marked in this cycle, so ovulation is placed using ${luteal}.`
}

function spottingHint(date: string, marks: Record<string, CycleDayMark>): string | undefined {
  if (marks[date]?.spotting !== true || marks[date]?.bleeding === true) return undefined
  const beside = marks[shift(date, -1)]?.bleeding === true || marks[shift(date, 1)]?.bleeding === true
  if (!beside) return undefined
  return "Spotting next to a bleed; if this was flow, the bleed may have been longer."
}

function forgottenBleedHint(date: string, marks: Record<string, CycleDayMark>): string | undefined {
  const mark = marks[date]
  const unmarked = !mark || (mark.bleeding !== true && mark.spotting !== true && mark.ovulation !== true)
  if (!unmarked) return undefined
  if (marks[shift(date, -1)]?.bleeding === true && marks[shift(date, 1)]?.bleeding === true) {
    return "This unmarked day sits between two bleeding days and may be a forgotten bleeding day."
  }
  return undefined
}

function withHint(day: CycleDayAssessment, hint?: string): CycleDayAssessment {
  if (!hint) return day
  return { ...day, hint }
}

function markedDay(
  date: string,
  phase: CyclePhase,
  marks: Record<string, CycleDayMark>,
  hint?: string,
): CycleDayAssessment {
  return withHint(
    {
      date,
      phase,
      markedPhase: phase,
      basis: "marked",
      reason: markedReason(date, phase, marks),
      confidence: 1,
    },
    hint,
  )
}

function spanFor(date: string, runs: BleedRun[], ovulations: string[]): Span | null {
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    if (date <= run.end) return null
    const next = runs[i + 1]
    if (next && date >= next.start) continue
    const hasOvulation = ovulations.some((day) => day >= run.start && (!next || day < next.start))
    if (!next) return { kind: "open", bleedStart: run.start, hasOvulation }
    return {
      kind: "completed",
      nextStart: next.start,
      length: daysBetween(run.start, next.start),
      hasOvulation,
    }
  }
  return null
}

function phaseAt(date: string, ovulationDay: string): CyclePhase {
  if (date < ovulationDay) return "follicular"
  if (date === ovulationDay) return "ovulatory"
  return "luteal"
}

function projectionDays(summary: CycleEstimateSummary): number {
  if (summary.completedCycles >= 2 && summary.medianCycleLength != null) return wholeDays(summary.medianCycleLength)
  if (summary.medianCycleLength != null) return wholeDays(summary.medianCycleLength)
  return CYCLE_PRIOR_DAYS
}

function assessWith(date: string, marks: Record<string, CycleDayMark>, analysis: Analysis): CycleDayAssessment {
  const markedPhase = phaseForDate(date, marks)
  if (!parseDay(date)) {
    return {
      date,
      phase: "unknown",
      markedPhase,
      basis: "marked",
      reason: "This is not a calendar day, so the phase is unknown.",
      confidence: 1,
    }
  }

  const hint = forgottenBleedHint(date, marks) ?? spottingHint(date, marks)
  if (marks[date]?.bleeding === true) return markedDay(date, markedPhase, marks, hint)
  if (marks[date]?.ovulation === true) return markedDay(date, markedPhase, marks, hint)
  if (hint && forgottenBleedHint(date, marks)) return markedDay(date, markedPhase, marks, hint)
  if (marks[date]?.spotting === true) return markedDay(date, markedPhase, marks, hint)
  if (markedPhase === "luteal" || markedPhase === "ovulatory") return markedDay(date, markedPhase, marks, hint)
  if (markedPhase === "unknown") return markedDay(date, markedPhase, marks, hint)

  const span = spanFor(date, analysis.runs, analysis.ovulations)
  if (!span || span.hasOvulation) return markedDay(date, markedPhase, marks, hint)
  if (span.kind === "completed" && span.length < MIN_CYCLE_DAYS) return markedDay(date, markedPhase, marks, hint)

  const { summary } = analysis
  const confidence = estimateConfidence(summary)
  if (span.kind === "completed") {
    const ovulationDay = shift(span.nextStart, -wholeDays(summary.lutealLengthDays))
    const phase = phaseAt(date, ovulationDay)
    return withHint(
      {
        date,
        phase,
        markedPhase,
        basis: "estimated",
        reason: guessReason(phase, summary, "completed"),
        confidence,
      },
      hint,
    )
  }

  const projected = shift(span.bleedStart, projectionDays(summary))
  if (date >= projected) {
    return withHint(
      {
        date,
        phase: markedPhase,
        markedPhase,
        basis: "estimated",
        reason: "Estimated: this day is past the one projected cycle and is not a logged bleed.",
        confidence: Math.min(confidence, 0.35),
      },
      hint,
    )
  }
  const ovulationDay = shift(projected, -wholeDays(summary.lutealLengthDays))
  const phase = phaseAt(date, ovulationDay)
  return withHint(
    {
      date,
      phase,
      markedPhase,
      basis: "estimated",
      reason: guessReason(phase, summary, "open"),
      confidence,
    },
    hint,
  )
}

export function summarizeCycleEstimates(marks: Record<string, CycleDayMark>): CycleEstimateSummary {
  return analyze(marks).summary
}

export function assessCycleDay(date: string, marks: Record<string, CycleDayMark>): CycleDayAssessment {
  return assessWith(date, marks, analyze(marks))
}

export function assessCycleRange(dates: string[], marks: Record<string, CycleDayMark>): CycleDayAssessment[] {
  const analysis = analyze(marks)
  return dates.map((date) => assessWith(date, marks, analysis))
}
