/**
 * components/Analytics/research-report.ts — Which vault shapes earn a report line
 *
 * Pure. The view hands in rows already clipped to the shared Analytics window.
 * A section appears only when a stated rule clears its floor. Empty series are
 * named in "left out", not drawn as charts. No sentiment, no model.
 */
import { computeStreak } from "@/lib/streaks"
import { trend, type SeriesPoint } from "@/lib/metrics"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"

/** Days of habit %, tracking coverage, or sleep before an outlier is a finding. */
export const RESEARCH_DAY_FLOOR = 5
/** A fully met habit day, repeated, before the streak is named. */
export const RESEARCH_STREAK_FLOOR = 3
/** Habit % or tracking coverage, points away from the window median. */
export const RESEARCH_POINT_GAP = 25
/** Sleep minutes away from the window median. */
export const RESEARCH_SLEEP_GAP_MINUTES = 90
/** Curved week grade versus raw, in points, with at least the plan floor of days. */
export const RESEARCH_GRADE_GAP = 8

export type DatedValue = { date: string; value: number }

export type ResearchReportInput = {
  windowLabel: string
  /** Daily habit completion percent for days that have habits. 0 is a real day. */
  habitDays: DatedValue[]
  /** Dates in the window whose habit day was fully met (100%). */
  habitMetDates: string[]
  /** Anchor for the current streak. Defaults to now. */
  today?: Date
  /** Coverage of painted minutes, 0–100, only on days that have paint. */
  trackingDays: DatedValue[]
  sleepNights: { date: string; minutes: number; estimated: boolean }[]
  metrics: { name: string; points: SeriesPoint[] }[]
  weekGrade: { raw: number; curved: number; days: number } | null
  plannedMinutes: number | null
  trackedMinutes: number | null
  phoneStamped: number
  otherRows: number
  gratitude: { date: string; lines: number; sample: string }[]
  /** Classical counts of why text and blocked-reason labels. */
  whyNotes: { text: string; n: number }[]
}

export type ResearchBars = { name: string; value: number; unit: string }[]

export type ResearchSection = {
  id: string
  title: string
  sentence: string
  n: string
  bars?: ResearchBars
  trace?: { x: string; y: number }[]
  traceUnit?: string
}

export type ResearchReport = {
  lede: string
  sections: ResearchSection[]
  includedBecause: string[]
  leftOutBecause: string[]
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function farthest(rows: DatedValue[], threshold: number): { row: DatedValue; med: number } | null {
  if (rows.length === 0) return null
  const med = median(rows.map((row) => row.value))
  let best = rows[0]
  let bestAbs = Math.abs(best.value - med)
  for (const row of rows) {
    const abs = Math.abs(row.value - med)
    if (abs > bestAbs) {
      best = row
      bestAbs = abs
    }
  }
  if (bestAbs < threshold) return null
  return { row: best, med }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function dayGap(
  rows: DatedValue[],
  floor: number,
  threshold: number,
  windowLabel: string,
  empty: string,
  near: string,
): { hit: { row: DatedValue; med: number } | null; leftOut: string | null } {
  if (rows.length === 0) return { hit: null, leftOut: empty }
  if (isThinSample(rows.length, floor)) {
    return { hit: null, leftOut: thinWindowSentence(rows.length, floor, windowLabel) }
  }
  const hit = farthest(rows, threshold)
  if (!hit) return { hit: null, leftOut: `${near} (n = ${rows.length}).` }
  return { hit, leftOut: null }
}

export function buildResearchReport(input: ResearchReportInput): ResearchReport {
  const sections: ResearchSection[] = []
  const includedBecause: string[] = []
  const leftOutBecause: string[] = []
  const windowLabel = input.windowLabel

  const habit = dayGap(
    input.habitDays,
    RESEARCH_DAY_FLOOR,
    RESEARCH_POINT_GAP,
    windowLabel,
    "no habit days in the window",
    "habit days sit near the window median",
  )
  if (habit.hit) {
    const { row, med } = habit.hit
    const delta = Math.round(row.value - med)
    sections.push({
      id: "habit-day",
      title: "Habit day",
      sentence: `On ${row.date} habit completion was ${Math.round(row.value)}%, ${delta > 0 ? `${delta} points above` : `${Math.abs(delta)} points below`} the window median of ${Math.round(med)}%.`,
      n: `n = ${input.habitDays.length} habit days`,
      bars: [
        { name: row.date, value: Math.round(row.value), unit: "%" },
        { name: "median", value: Math.round(med), unit: "%" },
      ],
    })
    includedBecause.push(`habit day ${row.date} is ${Math.abs(delta)} points from the median (n = ${input.habitDays.length})`)
  } else if (habit.leftOut) leftOutBecause.push(habit.leftOut)

  const streak = computeStreak(input.habitMetDates, { today: input.today })
  if (streak.current >= RESEARCH_STREAK_FLOOR) {
    sections.push({
      id: "streak",
      title: "Streak",
      sentence: `The current run of fully met habit days is ${streak.current} days.`,
      n: `n = ${streak.current} days · longest in the dates given ${streak.longest}`,
    })
    includedBecause.push(`current fully met habit streak is ${streak.current} days`)
  } else if (input.habitMetDates.length === 0 && input.habitDays.length === 0) {
    /* already covered by no habit days */
  } else {
    leftOutBecause.push(
      streak.current === 0
        ? "no current streak of fully met habit days"
        : `current fully met streak is ${streak.current}, under ${RESEARCH_STREAK_FLOOR}`,
    )
  }

  const grade = input.weekGrade
  if (grade && grade.days >= SAMPLE_FLOORS.planVsReality && Math.abs(grade.curved - grade.raw) >= RESEARCH_GRADE_GAP) {
    const gap = Math.round(grade.curved - grade.raw)
    sections.push({
      id: "grade-gap",
      title: "Week grade",
      sentence: `The week grade is ${Math.round(grade.curved)}% against a raw ${Math.round(grade.raw)}% (${gap > 0 ? `${gap} points above` : `${Math.abs(gap)} points below`} raw).`,
      n: `n = ${grade.days} days in the grade`,
      bars: [
        { name: "raw", value: Math.round(grade.raw), unit: "%" },
        { name: "grade", value: Math.round(grade.curved), unit: "%" },
      ],
    })
    includedBecause.push(`week grade and raw grade differ by ${Math.abs(gap)} points (n = ${grade.days})`)
  } else if (!grade) {
    leftOutBecause.push("no week grade in the window")
  } else if (isThinSample(grade.days, SAMPLE_FLOORS.planVsReality)) {
    leftOutBecause.push(thinWindowSentence(grade.days, SAMPLE_FLOORS.planVsReality, windowLabel))
  } else {
    leftOutBecause.push(`week grade stays within ${RESEARCH_GRADE_GAP} points of raw (n = ${grade.days})`)
  }

  const tracking = dayGap(
    input.trackingDays,
    RESEARCH_DAY_FLOOR,
    RESEARCH_POINT_GAP,
    windowLabel,
    "no tracking days in the window",
    "tracking coverage sits near the window median",
  )
  if (tracking.hit) {
    const { row, med } = tracking.hit
    const delta = Math.round(row.value - med)
    sections.push({
      id: "tracking-day",
      title: "Tracking coverage",
      sentence: `On ${row.date} painted coverage was ${Math.round(row.value)}% of the day, ${delta > 0 ? `${delta} points above` : `${Math.abs(delta)} points below`} the median of ${Math.round(med)}%.`,
      n: `n = ${input.trackingDays.length} days with paint`,
      bars: [
        { name: row.date, value: Math.round(row.value), unit: "%" },
        { name: "median", value: Math.round(med), unit: "%" },
      ],
    })
    includedBecause.push(`tracking coverage on ${row.date} is ${Math.abs(delta)} points from the median (n = ${input.trackingDays.length})`)
  } else if (tracking.leftOut) leftOutBecause.push(tracking.leftOut)

  if (input.sleepNights.length === 0) {
    leftOutBecause.push("no sleep nights in the window")
  } else if (isThinSample(input.sleepNights.length, RESEARCH_DAY_FLOOR)) {
    leftOutBecause.push(thinWindowSentence(input.sleepNights.length, RESEARCH_DAY_FLOOR, windowLabel))
  } else {
    const asValues = input.sleepNights.map((night) => ({ date: night.date, value: night.minutes }))
    const hit = farthest(asValues, RESEARCH_SLEEP_GAP_MINUTES)
    if (!hit) {
      leftOutBecause.push(`sleep duration sits within ${RESEARCH_SLEEP_GAP_MINUTES} minutes of the median (n = ${input.sleepNights.length})`)
    } else {
      const night = input.sleepNights.find((row) => row.date === hit.row.date)
      const estimated = night?.estimated ? " The night is estimated." : ""
      const delta = Math.round(hit.row.value - hit.med)
      sections.push({
        id: "sleep-night",
        title: "Sleep",
        sentence: `The night of ${hit.row.date} was ${Math.round(hit.row.value)} minutes, ${delta > 0 ? `${delta} above` : `${Math.abs(delta)} below`} the median of ${Math.round(hit.med)} minutes.${estimated}`,
        n: `n = ${input.sleepNights.length} nights`,
        bars: [
          { name: hit.row.date, value: Math.round(hit.row.value), unit: "m" },
          { name: "median", value: Math.round(hit.med), unit: "m" },
        ],
      })
      includedBecause.push(`sleep on ${hit.row.date} is ${Math.abs(delta)} minutes from the median (n = ${input.sleepNights.length})`)
    }
  }

  const metricMoves = input.metrics
    .map((metric) => ({ metric, fit: trend(metric.points) }))
    .filter((row) => row.fit.n >= SAMPLE_FLOORS.correlation && row.fit.direction !== "flat" && Math.abs(row.fit.totalChange) >= 5)
    .sort((a, b) => Math.abs(b.fit.totalChange) - Math.abs(a.fit.totalChange))
  if (metricMoves.length > 0) {
    const { metric, fit } = metricMoves[0]
    sections.push({
      id: "wellbeing",
      title: metric.name,
      sentence: `${metric.name} is ${fit.direction} across the window, about ${round1(fit.totalChange)} points from the first reading to the last.`,
      n: `n = ${fit.n} readings`,
      trace: metric.points.map((point) => ({ x: point.date.slice(5), y: point.value })),
      traceUnit: "",
    })
    includedBecause.push(`${metric.name} ${fit.direction} (n = ${fit.n})`)
  } else {
    const any = input.metrics.reduce((sum, metric) => sum + metric.points.length, 0)
    if (any === 0) leftOutBecause.push("no wellbeing readings in the window")
    else {
      const richest = input.metrics.reduce((best, metric) => (metric.points.length > best.points.length ? metric : best))
      if (isThinSample(richest.points.length, SAMPLE_FLOORS.correlation)) {
        leftOutBecause.push(thinWindowSentence(richest.points.length, SAMPLE_FLOORS.correlation, windowLabel))
      } else leftOutBecause.push("no wellbeing series moved enough to report")
    }
  }

  const planned = input.plannedMinutes
  const tracked = input.trackedMinutes
  if (planned != null && planned > 0 && tracked != null && tracked > 0) {
    sections.push({
      id: "plan-occupancy",
      title: "Plan and occupancy",
      sentence: `The window holds ${Math.round(planned)} planned minutes and ${Math.round(tracked)} tracked minutes.`,
      n: `planned ${Math.round(planned)} · tracked ${Math.round(tracked)}`,
      bars: [
        { name: "planned", value: Math.round(planned), unit: "m" },
        { name: "tracked", value: Math.round(tracked), unit: "m" },
      ],
    })
    includedBecause.push(`both planned minutes (${Math.round(planned)}) and tracked minutes (${Math.round(tracked)}) are present`)
  } else {
    leftOutBecause.push("plan commitment and tracked occupancy are not both in the window")
  }

  if (input.phoneStamped > 0) {
    const stampWord = input.phoneStamped === 1 ? "row is" : "rows are"
    const carryWord = input.phoneStamped === 1 ? "row carries" : "rows carry"
    sections.push({
      id: "phone",
      title: "Phone stamps",
      sentence: `${input.phoneStamped} ${stampWord} stamped from the text pipeline, beside ${input.otherRows} other tracking rows in the window.`,
      n: `n = ${input.phoneStamped} phone-stamped · ${input.otherRows} other`,
    })
    includedBecause.push(`${input.phoneStamped} ${carryWord} a text-pipeline stamp`)
  } else {
    leftOutBecause.push("no phone stamps in the window")
  }

  const lists = input.gratitude.filter((row) => row.lines > 0)
  if (lists.length === 0) {
    leftOutBecause.push("no gratitude lines")
  } else {
    const longest = lists.reduce((best, row) => (row.lines > best.lines ? row : best))
    const sample = longest.sample.trim()
    sections.push({
      id: "gratitude",
      title: "Gratitude",
      sentence: sample
        ? `The longest gratitude list is ${longest.lines} lines on ${longest.date}. One line: “${sample}”.`
        : `The longest gratitude list is ${longest.lines} lines on ${longest.date}.`,
      n: `n = ${longest.lines} lines · ${lists.length} lists`,
    })
    includedBecause.push(`gratitude list on ${longest.date} has ${longest.lines} lines`)
  }

  const notes = input.whyNotes.filter((row) => row.text.trim() && row.n > 0)
  const repeated = notes.filter((row) => row.n >= 2).sort((a, b) => b.n - a.n || a.text.localeCompare(b.text))
  if (repeated.length > 0) {
    const top = repeated[0]
    sections.push({
      id: "why",
      title: "Why",
      sentence: `“${top.text}” shows up ${top.n} times among why and blocked-reason notes.`,
      n: `n = ${top.n}`,
    })
    includedBecause.push(`why note “${top.text}” recurs (n = ${top.n})`)
  } else if (notes.length === 0) {
    leftOutBecause.push("no why or blocked-reason notes")
  } else {
    const total = notes.reduce((sum, row) => sum + row.n, 0)
    sections.push({
      id: "why",
      title: "Why",
      sentence: `${total} why or blocked-reason notes in the window, none repeated.`,
      n: `n = ${total}`,
    })
    includedBecause.push(`${total} why or blocked-reason notes, none repeated`)
  }

  const dense = sections.map((section) => section.title.toLowerCase())
  const thin = leftOutBecause.slice(0, 4)
  const lede =
    sections.length === 0
      ? `${windowLabel}. Nothing in this window was dense enough to write about.`
      : `${windowLabel}. Dense enough to write about: ${dense.join(", ")}.${thin.length ? ` Left aside: ${thin.join("; ")}.` : ""}`

  return { lede, sections, includedBecause, leftOutBecause }
}

export function researchReportPlainText(report: ResearchReport): string {
  const lines = ["Produce research report", report.lede, ""]
  for (const section of report.sections) {
    lines.push(section.title, section.sentence, section.n, "")
  }
  lines.push("Included because")
  for (const reason of report.includedBecause) lines.push(`- ${reason}`)
  lines.push("", "Left out because")
  for (const reason of report.leftOutBecause) lines.push(`- ${reason}`)
  return lines.join("\n").trim()
}
