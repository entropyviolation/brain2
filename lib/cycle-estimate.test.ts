import { describe, expect, it } from "vitest"
import type { CycleDayMark } from "./cycle-marks"
import { addCalendarDays, formatLocalDateKey } from "./date-utils"
import {
  OVULATION_SIGNALS_NOTE,
  assessCycleDay,
  assessCycleRange,
  summarizeCycleEstimates,
} from "./cycle-estimate"
import { phaseForDate } from "./cycle-phase"

function marks(rows: Array<[string, Partial<Omit<CycleDayMark, "date">>]>): Record<string, CycleDayMark> {
  const out: Record<string, CycleDayMark> = {}
  for (const [date, flags] of rows) out[date] = { date, ...flags }
  return out
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = []
  let cursor = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)))
  const last = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)))
  while (cursor.getTime() <= last.getTime()) {
    days.push(formatLocalDateKey(cursor))
    cursor = addCalendarDays(cursor, 1)
  }
  return days
}

/** Three 28-day cycles, bleed on the start day only, no ovulation marks. */
function regularBleeds(): Record<string, CycleDayMark> {
  return marks([
    ["2026-01-01", { bleeding: true }],
    ["2026-01-29", { bleeding: true }],
    ["2026-02-26", { bleeding: true }],
    ["2026-03-26", { bleeding: true }],
  ])
}

describe("assessCycleDay", () => {
  it("keeps an explicit ovulation and the luteal days after it marked", () => {
    const book = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-02", { bleeding: true }],
      ["2026-03-03", { bleeding: true }],
      ["2026-03-14", { ovulation: true }],
      ["2026-03-28", { bleeding: true }],
    ])
    const ovulation = assessCycleDay("2026-03-14", book)
    expect(ovulation.phase).toBe("ovulatory")
    expect(ovulation.basis).toBe("marked")
    expect(ovulation.confidence).toBe(1)
    expect(ovulation.phase).toBe(phaseForDate("2026-03-14", book))
    expect(ovulation.markedPhase).toBe(ovulation.phase)

    for (const date of ["2026-03-15", "2026-03-27"]) {
      const day = assessCycleDay(date, book)
      expect(day.phase).toBe("luteal")
      expect(day.basis).toBe("marked")
      expect(day.confidence).toBe(1)
      expect(day.phase).toBe(phaseForDate(date, book))
    }

    const before = assessCycleDay("2026-03-10", book)
    expect(before.phase).toBe("follicular")
    expect(before.basis).toBe("marked")
    expect(before.phase).toBe(phaseForDate("2026-03-10", book))
  })

  it("estimates luteal in a completed gap when no ovulation was marked", () => {
    const book = regularBleeds()
    const day = assessCycleDay("2026-01-20", book)
    expect(phaseForDate("2026-01-20", book)).toBe("follicular")
    expect(day.markedPhase).toBe("follicular")
    expect(day.phase).toBe("luteal")
    expect(day.basis).toBe("estimated")
    expect(day.reason.toLowerCase()).toContain("estimated")
    expect(day.confidence).toBe(0.35)

    const early = assessCycleDay("2026-01-08", book)
    expect(early.phase).toBe("follicular")
    expect(early.basis).toBe("estimated")
    expect(early.markedPhase).toBe("follicular")

    const ovulation = assessCycleDay("2026-01-15", book)
    expect(ovulation.phase).toBe("ovulatory")
    expect(ovulation.basis).toBe("estimated")

    const bleed = assessCycleDay("2026-01-01", book)
    expect(bleed.phase).toBe("menstrual")
    expect(bleed.basis).toBe("marked")
    expect(bleed.confidence).toBe(1)

    const summary = summarizeCycleEstimates(book)
    expect(summary.completedCycles).toBe(3)
    expect(summary.medianCycleLength).toBe(28)
    expect(summary.medianBleedLength).toBe(1)
    expect(summary.lutealLengthDays).toBe(14)
    expect(summary.lutealSource).toBe("prior")
    expect(summary.basisNote.toLowerCase()).toContain("not a diagnosis")
    expect(summary.basisNote).toContain("14-day prior")
  })

  it("uses marked luteal lengths without overwriting those ovulation days", () => {
    const book = marks([
      ["2026-01-01", { bleeding: true }],
      ["2026-01-15", { ovulation: true }],
      ["2026-01-29", { bleeding: true }],
      ["2026-02-12", { ovulation: true }],
      ["2026-02-26", { bleeding: true }],
      ["2026-03-26", { bleeding: true }],
    ])
    const markedOvulation = assessCycleDay("2026-01-15", book)
    expect(markedOvulation.phase).toBe("ovulatory")
    expect(markedOvulation.basis).toBe("marked")
    expect(markedOvulation.phase).toBe(phaseForDate("2026-01-15", book))

    const markedLuteal = assessCycleDay("2026-01-16", book)
    expect(markedLuteal.phase).toBe("luteal")
    expect(markedLuteal.basis).toBe("marked")

    const guessed = assessCycleDay("2026-03-20", book)
    expect(phaseForDate("2026-03-20", book)).toBe("follicular")
    expect(guessed.phase).toBe("luteal")
    expect(guessed.basis).toBe("estimated")
    expect(guessed.confidence).toBe(0.6)
    expect(guessed.reason.toLowerCase()).toContain("estimated")

    const guessedOvulation = assessCycleDay("2026-03-12", book)
    expect(guessedOvulation.phase).toBe("ovulatory")
    expect(guessedOvulation.basis).toBe("estimated")

    const summary = summarizeCycleEstimates(book)
    expect(summary.completedCycles).toBe(3)
    expect(summary.lutealLengthDays).toBe(14)
    expect(summary.lutealSource).toBe("marks")
    expect(summary.basisNote.toLowerCase()).toContain("not a diagnosis")
  })

  it("projects an open cycle from the median once two cycles exist", () => {
    const book = regularBleeds()
    const day = assessCycleDay("2026-04-16", book)
    expect(phaseForDate("2026-04-16", book)).toBe("follicular")
    expect(day.phase).toBe("luteal")
    expect(day.basis).toBe("estimated")
    expect(day.confidence).toBe(0.35)
    expect(day.reason.toLowerCase()).toContain("estimated")
  })

  it("offers a low-confidence typical pattern when history is a single bleed", () => {
    const book = marks([["2026-05-02", { bleeding: true }]])
    const day = assessCycleDay("2026-05-20", book)
    expect(day.basis).toBe("estimated")
    expect(day.phase).toBe("luteal")
    expect(day.markedPhase).toBe(phaseForDate("2026-05-20", book))
    expect(day.confidence).toBeLessThanOrEqual(0.35)
    expect(day.reason.toLowerCase()).toContain("not enough history")
    expect(day.reason.toLowerCase()).toContain("typical pattern")
    expect(day.reason).toContain("28")
    expect(day.basis).not.toBe("marked")

    const summary = summarizeCycleEstimates(book)
    expect(summary.completedCycles).toBe(0)
    expect(summary.medianCycleLength).toBeNull()
    expect(summary.lutealSource).toBe("prior")
    expect(summary.lutealLengthDays).toBe(14)
    expect(summary.basisNote.toLowerCase()).toContain("not enough history")
    expect(summary.basisNote.toLowerCase()).toContain("not a diagnosis")
  })

  it("hints at one unmarked day between bleeds and does not rewrite marks", () => {
    const book = marks([
      ["2026-06-01", { bleeding: true }],
      ["2026-06-03", { bleeding: true }],
    ])
    const before = JSON.stringify(book)
    const day = assessCycleDay("2026-06-02", book)
    expect(day.hint).toMatch(/forgotten bleeding day/i)
    expect(day.phase).toBe(phaseForDate("2026-06-02", book))
    expect(day.phase).toBe("follicular")
    expect(day.phase).not.toBe("menstrual")
    expect(day.basis).toBe("marked")
    expect(JSON.stringify(book)).toBe(before)
    expect(book["2026-06-02"]).toBeUndefined()
  })

  it("does not let spotting start a bleed or move the phase off phaseForDate", () => {
    const only = marks([["2026-07-01", { spotting: true }]])
    const alone = assessCycleDay("2026-07-01", only)
    expect(alone.phase).toBe("unknown")
    expect(alone.phase).toBe(phaseForDate("2026-07-01", only))
    expect(alone.basis).toBe("marked")

    const beside = marks([
      ["2026-07-10", { bleeding: true }],
      ["2026-07-11", { spotting: true }],
    ])
    const next = assessCycleDay("2026-07-11", beside)
    expect(next.phase).toBe(phaseForDate("2026-07-11", beside))
    expect(next.phase).not.toBe("menstrual")
    expect(next.hint).toMatch(/spotting next to a bleed/i)
    expect(assessCycleDay("2026-07-10", beside).phase).toBe("menstrual")

    const split = marks([
      ["2026-07-20", { bleeding: true }],
      ["2026-07-21", { spotting: true }],
      ["2026-07-22", { bleeding: true }],
    ])
    const middle = assessCycleDay("2026-07-21", split)
    expect(middle.phase).toBe(phaseForDate("2026-07-21", split))
    expect(middle.phase).not.toBe("menstrual")
    expect(middle.hint).toMatch(/spotting next to a bleed/i)

    const late = marks([
      ["2026-08-01", { bleeding: true }],
      ["2026-08-20", { spotting: true }],
    ])
    const spotted = assessCycleDay("2026-08-20", late)
    expect(spotted.phase).toBe(phaseForDate("2026-08-20", late))
    expect(spotted.phase).toBe("follicular")
    expect(spotted.basis).toBe("marked")
  })

  it("lets menstrual win over a same-day ovulation mark", () => {
    const book = marks([["2026-03-02", { bleeding: true, ovulation: true }]])
    const day = assessCycleDay("2026-03-02", book)
    expect(day.phase).toBe("menstrual")
    expect(day.basis).toBe("marked")
    expect(day.confidence).toBe(1)
    expect(day.phase).toBe(phaseForDate("2026-03-02", book))

    const next = assessCycleDay("2026-03-03", book)
    expect(next.phase).toBe("luteal")
    expect(next.basis).toBe("marked")
    expect(next.confidence).toBe(1)
    expect(next.phase).toBe(phaseForDate("2026-03-03", book))
  })

  it("keeps marked days aligned with phaseForDate across a mixed book", () => {
    const book = marks([
      ["2026-01-01", { bleeding: true }],
      ["2026-01-15", { ovulation: true }],
      ["2026-01-29", { bleeding: true }],
      ["2026-02-12", { ovulation: true }],
      ["2026-02-26", { bleeding: true }],
      ["2026-03-26", { bleeding: true }],
      ["2026-04-02", { spotting: true }],
    ])
    const before = JSON.stringify(book)
    for (const date of eachDay("2025-12-15", "2026-05-01")) {
      const day = assessCycleDay(date, book)
      expect(day.markedPhase).toBe(phaseForDate(date, book))
      expect(day.confidence).toBeGreaterThanOrEqual(0)
      expect(day.confidence).toBeLessThanOrEqual(1)
      if (day.basis === "marked") {
        expect(day.phase).toBe(day.markedPhase)
        expect(day.confidence).toBe(1)
      } else {
        expect(day.confidence).toBeLessThan(1)
      }
      if (day.phase !== day.markedPhase) expect(day.basis).toBe("estimated")
    }
    expect(JSON.stringify(book)).toBe(before)
  })

  it("returns range assessments in the requested order", () => {
    const book = regularBleeds()
    const dates = ["2026-01-20", "2026-01-01", "2026-01-08"]
    const range = assessCycleRange(dates, book)
    expect(range.map((day) => day.date)).toEqual(dates)
    expect(range).toEqual(dates.map((date) => assessCycleDay(date, book)))
  })
})

describe("summarizeCycleEstimates", () => {
  it("leaves impossible lengths out of the median", () => {
    const book = marks([
      ["2026-01-01", { bleeding: true }],
      ["2026-01-10", { bleeding: true }],
      ["2026-01-12", { bleeding: true }],
      ["2026-03-20", { bleeding: true }],
    ])
    const summary = summarizeCycleEstimates(book)
    expect(summary.medianCycleLength).toBeNull()
    expect(summary.completedCycles).toBe(0)
    expect(summary.basisNote).toMatch(/not used for the median/i)
    expect(summary.basisNote.toLowerCase()).toContain("not a diagnosis")
  })

  it("counts two marked cycles at the middle confidence", () => {
    const book = marks([
      ["2026-01-01", { bleeding: true }],
      ["2026-01-15", { ovulation: true }],
      ["2026-01-29", { bleeding: true }],
      ["2026-02-26", { bleeding: true }],
    ])
    const day = assessCycleDay("2026-02-20", book)
    expect(day.phase).toBe("luteal")
    expect(day.basis).toBe("estimated")
    expect(day.confidence).toBe(0.5)
    expect(summarizeCycleEstimates(book).completedCycles).toBe(2)
    expect(summarizeCycleEstimates(book).lutealSource).toBe("marks")
  })
})

describe("OVULATION_SIGNALS_NOTE", () => {
  it("says a watch estimate is retrospective and not a same-day test", () => {
    expect(OVULATION_SIGNALS_NOTE).toMatch(/Series 8/i)
    expect(OVULATION_SIGNALS_NOTE).toMatch(/Ultra/)
    expect(OVULATION_SIGNALS_NOTE).toMatch(/after it has passed/i)
    expect(OVULATION_SIGNALS_NOTE).toMatch(/not a urine LH test/i)
    expect(OVULATION_SIGNALS_NOTE).toMatch(/not an ultrasound/i)
    expect(OVULATION_SIGNALS_NOTE).toMatch(/not a diagnosis/i)
  })
})
