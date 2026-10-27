import { describe, expect, it } from "vitest"
import type { CycleDayMark } from "@/lib/cycle-marks"
import { assessCycleDay } from "@/lib/cycle-estimate"
import {
  compareMetricByPhase,
  cyclePhaseEmptySentence,
  cyclePhaseReport,
  dailyMean,
  formatPhaseNumber,
  hasCyclePhaseMarks,
  medianOf,
  phaseDayCounts,
  phasesForDates,
  zeroFill,
} from "./cycle-phase-stats"

const marks: Record<string, CycleDayMark> = {
  "2026-06-18": { date: "2026-06-18", bleeding: true },
  "2026-06-20": { date: "2026-06-20", ovulation: true, spotting: true },
  "2026-06-21": { date: "2026-06-21", spotting: true },
}

const dates = ["2026-01-01", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"]

describe("cycle phase stats", () => {
  it("counts every phase, including unknown, and does not treat spotting as a phase", () => {
    expect(hasCyclePhaseMarks({})).toBe(false)
    expect(hasCyclePhaseMarks({ "2026-06-01": { date: "2026-06-01", spotting: true } })).toBe(false)
    expect(hasCyclePhaseMarks(marks)).toBe(true)
    expect(cyclePhaseEmptySentence({})).toMatch(/bleed days/)
    expect(cyclePhaseEmptySentence({ "2026-06-01": { date: "2026-06-01", spotting: true } })).toMatch(/Spotting/)

    const dated = phasesForDates(dates, marks)
    expect(dated.map((day) => day.phase)).toEqual([
      "unknown",
      "menstrual",
      "follicular",
      "ovulatory",
      "luteal",
    ])
    expect(dated.map((day) => day.basis)).toEqual(["marked", "marked", "marked", "marked", "marked"])
    for (const day of dated) {
      const assessed = assessCycleDay(day.date, marks)
      expect(day.phase).toBe(assessed.phase)
      expect(day.markedPhase).toBe(assessed.markedPhase)
      expect(day.basis).toBe(assessed.basis)
      expect(day.phase).toBe(day.markedPhase)
    }
    expect(phaseDayCounts(dated)).toEqual([
      { phase: "menstrual", days: 1, marked: 1, estimated: 0 },
      { phase: "follicular", days: 1, marked: 1, estimated: 0 },
      { phase: "ovulatory", days: 1, marked: 1, estimated: 0 },
      { phase: "luteal", days: 1, marked: 1, estimated: 0 },
      { phase: "unknown", days: 1, marked: 1, estimated: 0 },
    ])
  })

  it("leaves a missing day out of the mean and keeps a passed zero", () => {
    const dated = phasesForDates(dates, marks)
    const rows = compareMetricByPhase(dated, {
      "2026-06-18": 480,
      "2026-06-19": null,
      "2026-06-20": 420,
      "2026-06-21": 400,
      "2026-01-01": 300,
    })
    expect(rows.find((row) => row.phase === "follicular")).toMatchObject({ days: 1, n: 0, mean: null, median: null })
    expect(rows.find((row) => row.phase === "menstrual")).toMatchObject({ n: 1, mean: 480, median: 480 })
    expect(rows.find((row) => row.phase === "unknown")).toMatchObject({ days: 1, n: 1, mean: 300 })

    const zeros = compareMetricByPhase(dated, zeroFill(dates, { "2026-06-18": 2 }))
    expect(zeros.find((row) => row.phase === "menstrual")).toMatchObject({ n: 1, mean: 2 })
    expect(zeros.find((row) => row.phase === "luteal")).toMatchObject({ n: 1, mean: 0, median: 0 })
  })

  it("averages one day before the phase join, and takes the middle pair for an even median", () => {
    expect(dailyMean([
      { date: "2026-06-18", value: 40 },
      { date: "2026-06-18", value: 80 },
      { date: "2026-06-18", value: Number.NaN },
    ])).toEqual({ "2026-06-18": 60 })
    expect(medianOf([4, 1, 3, 2])).toBe(2.5)
    expect(medianOf([3])).toBe(3)
    expect(medianOf([])).toBeNull()
    expect(formatPhaseNumber(null)).toBe("—")
    expect(formatPhaseNumber(7.25)).toBe("7.3")
    expect(formatPhaseNumber(8)).toBe("8")
  })

  it("drops an all-zero log and names a thin sample without a finding", () => {
    const report = cyclePhaseReport(dates, marks, [
      {
        id: "food",
        title: "Food logs",
        note: "logs",
        format: "count",
        values: zeroFill(dates, {}),
        skipIfAllZero: true,
      },
      {
        id: "sleep",
        title: "Sleep",
        note: "hours",
        format: "hours",
        values: { "2026-06-18": 480, "2026-06-21": 400 },
      },
    ])
    expect(report.metrics.map((metric) => metric.id)).toEqual(["sleep"])
    expect(report.metrics[0]?.thinNote).toMatch(/fewer than 5/)
    expect(report.metrics[0]?.thinNote).not.toMatch(/drops|rises|pattern/)
    expect(report.metrics[0]?.estimatedRows).toBeNull()
    expect(report.estimatedDays).toBe(0)
    expect(report.basisNote).toMatch(/not a diagnosis/i)
    expect(report.mixNote).toMatch(/Too few/)
    expect(report.mixNote).not.toMatch(/estimated/)
  })

  it("keeps an estimated luteal day out of the marked comparison", () => {
    const book: Record<string, CycleDayMark> = {
      "2026-01-01": { date: "2026-01-01", bleeding: true },
      "2026-01-29": { date: "2026-01-29", bleeding: true },
      "2026-02-26": { date: "2026-02-26", bleeding: true },
      "2026-03-26": { date: "2026-03-26", bleeding: true },
    }
    const window = ["2026-01-01", "2026-01-14", "2026-01-15", "2026-01-20"]
    const dated = phasesForDates(window, book)
    expect(dated.map((day) => [day.date, day.phase, day.markedPhase, day.basis])).toEqual([
      ["2026-01-01", "menstrual", "menstrual", "marked"],
      ["2026-01-14", "follicular", "follicular", "estimated"],
      ["2026-01-15", "ovulatory", "follicular", "estimated"],
      ["2026-01-20", "luteal", "follicular", "estimated"],
    ])
    expect(phaseDayCounts(dated)).toEqual([
      { phase: "menstrual", days: 1, marked: 1, estimated: 0 },
      { phase: "follicular", days: 1, marked: 0, estimated: 1 },
      { phase: "ovulatory", days: 1, marked: 0, estimated: 1 },
      { phase: "luteal", days: 1, marked: 0, estimated: 1 },
      { phase: "unknown", days: 0, marked: 0, estimated: 0 },
    ])

    const values = { "2026-01-01": 480, "2026-01-20": 400 }
    const marked = compareMetricByPhase(dated, values, "marked")
    expect(marked.find((row) => row.phase === "menstrual")).toMatchObject({ days: 1, n: 1, mean: 480, median: 480 })
    expect(marked.find((row) => row.phase === "luteal")).toMatchObject({ days: 0, n: 0, mean: null, median: null })
    expect(marked.find((row) => row.phase === "follicular")).toMatchObject({ days: 0, n: 0, mean: null })

    const estimated = compareMetricByPhase(dated, values, "estimated")
    expect(estimated.find((row) => row.phase === "luteal")).toMatchObject({ days: 1, n: 1, mean: 400, median: 400 })
    expect(estimated.find((row) => row.phase === "menstrual")).toMatchObject({ days: 0, n: 0, mean: null })
    expect(estimated.find((row) => row.phase === "ovulatory")).toMatchObject({ days: 1, n: 0, mean: null })

    const report = cyclePhaseReport(window, book, [
      { id: "sleep", title: "Sleep", note: "hours", format: "hours", values },
    ])
    expect(report.markedDays).toBe(1)
    expect(report.estimatedDays).toBe(3)
    expect(report.mixNote).toMatch(/1 marked day has/)
    expect(report.mixNote).toMatch(/Too few/)
    expect(report.mixNote).toMatch(/3 days are estimated/)
    expect(report.mixNote).toMatch(/not a logged phase/)
    expect(report.basisNote).toMatch(/not a diagnosis/i)
    expect(report.basisNote).toMatch(/14-day prior/)
    const sleep = report.metrics[0]
    expect(sleep?.rows.find((row) => row.phase === "luteal")?.mean).toBeNull()
    expect(sleep?.rows.find((row) => row.phase === "menstrual")?.mean).toBe(480)
    expect(sleep?.estimatedRows?.find((row) => row.phase === "luteal")).toMatchObject({ n: 1, mean: 400 })
    expect(sleep?.estimatedNote).toMatch(/not a logged phase/)
    expect(sleep?.estimatedNote).toMatch(/not a finding/)
    expect(sleep?.estimatedNote).not.toMatch(/drops|rises|pattern/)
    expect(sleep?.thinNote).toMatch(/fewer than 5/)
    expect(sleep?.thinNote).toMatch(/not a finding/)
  })
})
