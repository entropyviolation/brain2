/**
 * components/Analytics/cycle-phase-stats.ts — Phase counts and day-aligned joins
 *
 * Pure. The phase a day shows is `assessCycleDay`, batched with `assessCycleRange`.
 * Marked days and estimated days stay apart. Metric comparisons use marked days.
 * An estimated split keeps its own n and is not a finding.
 * Spotting is not a phase. Unknown stays its own bucket. A missing reading
 * stays out of the mean; a caller that wants “no log = 0” passes zeros.
 * This describes logs. It is not a diagnosis.
 */
import type { CycleDayMark } from "@/lib/cycle-marks"
import { assessCycleRange, summarizeCycleEstimates, type CycleBasis } from "@/lib/cycle-estimate"
import type { CyclePhase } from "@/lib/cycle-phase"

export const PHASE_ORDER = ["menstrual", "follicular", "ovulatory", "luteal", "unknown"] as const

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulatory: "Ovulatory",
  luteal: "Luteal",
  unknown: "Unknown",
}

/** Below this, a phase cell is listed and named as thin. Not a finding. */
export const PHASE_COMPARE_FLOOR = 5

export type PhaseDayCount = {
  phase: CyclePhase
  /** Shown phase: marked and estimated together. */
  days: number
  marked: number
  estimated: number
}

export type PhaseComparison = {
  phase: CyclePhase
  /** Days of this basis in the window with this shown phase. */
  days: number
  /** Days that contributed a finite number. */
  n: number
  mean: number | null
  median: number | null
}

export type CyclePhaseMetricFormat = "hours" | "minutes" | "count" | "score" | "percent"

export type CyclePhaseMetricInput = {
  id: string
  title: string
  note: string
  format: CyclePhaseMetricFormat
  values: Readonly<Record<string, number | null | undefined>>
  /** Drop the metric when every finite value is 0 (a silent log, not a pattern). */
  skipIfAllZero?: boolean
}

export type CyclePhaseMetricResult = CyclePhaseMetricInput & {
  /** Marked days only. */
  rows: PhaseComparison[]
  thinNote: string | null
  /** Null when the window has no estimated day. */
  estimatedRows: PhaseComparison[] | null
  estimatedNote: string | null
}

export type DatedPhase = {
  date: string
  /** Phase to show. May differ from markedPhase only when basis is estimated. */
  phase: CyclePhase
  markedPhase: CyclePhase
  basis: CycleBasis
}

/** Bleed or ovulation anywhere in the store. Spotting alone does not count. */
export function hasCyclePhaseMarks(marks: Record<string, CycleDayMark>): boolean {
  return Object.values(marks).some((mark) => mark?.bleeding === true || mark?.ovulation === true)
}

export function cyclePhaseEmptySentence(marks: Record<string, CycleDayMark>): string {
  const base = "Phases appear after bleed days are marked in the Tracking log."
  const spotting = Object.values(marks).some((mark) => mark?.spotting === true)
  if (spotting) return `${base} Spotting is stored and does not set a phase.`
  return base
}

export function phasesForDates(dateKeys: readonly string[], marks: Record<string, CycleDayMark>): DatedPhase[] {
  return assessCycleRange([...dateKeys], marks).map((day) => ({
    date: day.date,
    phase: day.phase,
    markedPhase: day.markedPhase,
    basis: day.basis,
  }))
}

export function phaseDayCounts(dated: readonly DatedPhase[]): PhaseDayCount[] {
  return PHASE_ORDER.map((phase) => {
    const inPhase = dated.filter((day) => day.phase === phase)
    const marked = inPhase.filter((day) => day.basis === "marked").length
    const estimated = inPhase.length - marked
    return { phase, days: inPhase.length, marked, estimated }
  })
}

export function phaseMixNote(counts: readonly PhaseDayCount[]): string | null {
  const markedLabeled = counts
    .filter((row) => row.phase !== "unknown")
    .reduce((sum, row) => sum + row.marked, 0)
  const estimated = counts.reduce((sum, row) => sum + row.estimated, 0)
  if (markedLabeled === 0 && estimated === 0) {
    return "Every day in this window is unknown. A phase starts after a bleed day, or on an ovulation mark."
  }
  const parts: string[] = []
  if (markedLabeled === 0) {
    parts.push("No marked day in this window has a phase other than unknown.")
  } else if (markedLabeled < PHASE_COMPARE_FLOOR) {
    const word = markedLabeled === 1 ? "day has" : "days have"
    parts.push(
      `${markedLabeled} marked ${word} a phase other than unknown in this window. Too few to treat the mix as a pattern.`,
    )
  }
  if (estimated > 0) {
    const word = estimated === 1 ? "day is" : "days are"
    parts.push(`${estimated} ${word} estimated. An estimate is not a logged phase.`)
  }
  return parts.length > 0 ? parts.join(" ") : null
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Even counts use the mean of the two middle values. Empty is null. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const left = sorted[mid - 1]
  const right = sorted[mid]
  if (left === undefined || right === undefined) return null
  return (left + right) / 2
}

/** Comparisons for one basis. Marked is the default. Estimated days stay out of it. */
export function compareMetricByPhase(
  dated: readonly DatedPhase[],
  values: Readonly<Record<string, number | null | undefined>>,
  basis: CycleBasis = "marked",
): PhaseComparison[] {
  return PHASE_ORDER.map((phase) => {
    const inPhase = dated.filter((day) => day.phase === phase && day.basis === basis)
    const nums: number[] = []
    for (const day of inPhase) {
      const value = values[day.date]
      if (finite(value)) nums.push(value)
    }
    const n = nums.length
    return {
      phase,
      days: inPhase.length,
      n,
      mean: n === 0 ? null : nums.reduce((sum, value) => sum + value, 0) / n,
      median: medianOf(nums),
    }
  })
}

export function phaseCompareNote(rows: readonly PhaseComparison[]): string | null {
  const observed = rows.filter((row) => row.n > 0)
  if (observed.length === 0) return null
  const thin = observed.filter((row) => row.n < PHASE_COMPARE_FLOOR)
  if (thin.length === 0) return null
  if (thin.length === observed.length) {
    return `Each phase has fewer than ${PHASE_COMPARE_FLOOR} days with this reading. The table is the log, not a finding.`
  }
  const names = thin.map((row) => PHASE_LABEL[row.phase])
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  const verb = names.length === 1 ? "has" : "have"
  return `${list} ${verb} fewer than ${PHASE_COMPARE_FLOOR} days with this reading.`
}

/** A guess stays a guess. Thin or not, this sentence is not a finding. */
export function estimatedCompareNote(rows: readonly PhaseComparison[]): string {
  const base = "Estimated days are a guess. They are not a logged phase."
  const thin = phaseCompareNote(rows)
  if (thin) return `${base} ${thin}`
  return `${base} Not a finding.`
}

function anyFinite(values: Readonly<Record<string, number | null | undefined>>): boolean {
  return Object.values(values).some((value) => finite(value))
}

function anyNonZero(values: Readonly<Record<string, number | null | undefined>>): boolean {
  return Object.values(values).some((value) => finite(value) && value !== 0)
}

export function cyclePhaseReport(
  dateKeys: readonly string[],
  marks: Record<string, CycleDayMark>,
  metrics: readonly CyclePhaseMetricInput[],
): {
  hasMarks: boolean
  basisNote: string
  dated: DatedPhase[]
  counts: PhaseDayCount[]
  mixNote: string | null
  markedDays: number
  estimatedDays: number
  metrics: CyclePhaseMetricResult[]
} {
  const dated = phasesForDates(dateKeys, marks)
  const counts = phaseDayCounts(dated)
  const markedDays = counts.reduce((sum, row) => sum + row.marked, 0)
  const estimatedDays = counts.reduce((sum, row) => sum + row.estimated, 0)
  const shown: CyclePhaseMetricResult[] = []
  for (const metric of metrics) {
    if (metric.skipIfAllZero) {
      if (!anyNonZero(metric.values)) continue
    } else if (!anyFinite(metric.values)) continue
    const rows = compareMetricByPhase(dated, metric.values, "marked")
    const estimatedRows = estimatedDays > 0 ? compareMetricByPhase(dated, metric.values, "estimated") : null
    shown.push({
      ...metric,
      rows,
      thinNote: phaseCompareNote(rows),
      estimatedRows,
      estimatedNote: estimatedRows ? estimatedCompareNote(estimatedRows) : null,
    })
  }
  return {
    hasMarks: hasCyclePhaseMarks(marks),
    basisNote: summarizeCycleEstimates(marks).basisNote,
    dated,
    counts,
    mixNote: phaseMixNote(counts),
    markedDays,
    estimatedDays,
    metrics: shown,
  }
}

/** One number per local day: the mean of that day’s samples. Non-finite samples are dropped. */
export function dailyMean(samples: readonly { date: string; value: number }[]): Record<string, number> {
  const buckets = new Map<string, number[]>()
  for (const sample of samples) {
    if (!Number.isFinite(sample.value)) continue
    const list = buckets.get(sample.date)
    if (list) list.push(sample.value)
    else buckets.set(sample.date, [sample.value])
  }
  const out: Record<string, number> = {}
  for (const [date, values] of buckets) {
    out[date] = values.reduce((sum, value) => sum + value, 0) / values.length
  }
  return out
}

/** Days missing from `counts` become 0. Days outside `dateKeys` are dropped. */
export function zeroFill(dateKeys: readonly string[], counts: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const date of dateKeys) {
    const value = counts[date]
    out[date] = typeof value === "number" && Number.isFinite(value) ? value : 0
  }
  return out
}

export function formatPhaseNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
