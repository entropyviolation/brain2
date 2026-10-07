import { describe, expect, it } from "vitest"
import type { CycleDayMark } from "./cycle-marks"
import { phaseForDate } from "./cycle-phase"

function marks(rows: Array<[string, Partial<Omit<CycleDayMark, "date">>]>): Record<string, CycleDayMark> {
  const out: Record<string, CycleDayMark> = {}
  for (const [date, flags] of rows) out[date] = { date, ...flags }
  return out
}

describe("phaseForDate", () => {
  it("is unknown when there are no marks", () => {
    expect(phaseForDate("2026-03-01", {})).toBe("unknown")
  })

  it("labels a bleed run menstrual and the day after follicular", () => {
    const book = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-02", { bleeding: true }],
      ["2026-03-03", { bleeding: true }],
    ])
    expect(phaseForDate("2026-02-28", book)).toBe("unknown")
    expect(phaseForDate("2026-03-01", book)).toBe("menstrual")
    expect(phaseForDate("2026-03-03", book)).toBe("menstrual")
    expect(phaseForDate("2026-03-04", book)).toBe("follicular")
  })

  it("keeps the gap between bleeds follicular when nobody marked ovulation", () => {
    const book = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-02", { bleeding: true }],
      ["2026-03-10", { bleeding: true }],
    ])
    expect(phaseForDate("2026-03-05", book)).toBe("follicular")
    expect(phaseForDate("2026-03-09", book)).toBe("follicular")
    expect(phaseForDate("2026-03-10", book)).toBe("menstrual")
  })

  it("marks ovulation then luteal, and cuts luteal off at the next bleed", () => {
    const book = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-03", { bleeding: true }],
      ["2026-03-07", { ovulation: true }],
      ["2026-03-14", { bleeding: true }],
      ["2026-03-15", { bleeding: true }],
    ])
    expect(phaseForDate("2026-03-04", book)).toBe("follicular")
    expect(phaseForDate("2026-03-07", book)).toBe("ovulatory")
    expect(phaseForDate("2026-03-08", book)).toBe("luteal")
    expect(phaseForDate("2026-03-13", book)).toBe("luteal")
    expect(phaseForDate("2026-03-14", book)).toBe("menstrual")
    expect(phaseForDate("2026-03-16", book)).toBe("follicular")
  })

  it("keeps later days luteal when no next bleed exists", () => {
    const book = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-07", { ovulation: true }],
    ])
    expect(phaseForDate("2026-04-02", book)).toBe("luteal")
  })

  it("ignores spotting", () => {
    const onlySpotting = marks([["2026-03-05", { spotting: true }]])
    expect(phaseForDate("2026-03-05", onlySpotting)).toBe("unknown")

    const split = marks([
      ["2026-03-01", { bleeding: true }],
      ["2026-03-02", { spotting: true }],
      ["2026-03-03", { bleeding: true }],
    ])
    expect(phaseForDate("2026-03-01", split)).toBe("menstrual")
    expect(phaseForDate("2026-03-02", split)).toBe("follicular")
    expect(phaseForDate("2026-03-03", split)).toBe("menstrual")

    const duringLuteal = marks([
      ["2026-03-07", { ovulation: true }],
      ["2026-03-09", { spotting: true }],
    ])
    expect(phaseForDate("2026-03-09", duringLuteal)).toBe("luteal")
  })

  it("lets menstrual win over ovulation on the same day", () => {
    const book = marks([["2026-03-02", { bleeding: true, ovulation: true }]])
    expect(phaseForDate("2026-03-02", book)).toBe("menstrual")
    expect(phaseForDate("2026-03-03", book)).toBe("luteal")
  })

  it("treats a bleed that crosses a month boundary as one run", () => {
    const book = marks([
      ["2026-01-31", { bleeding: true }],
      ["2026-02-01", { bleeding: true }],
    ])
    expect(phaseForDate("2026-01-31", book)).toBe("menstrual")
    expect(phaseForDate("2026-02-01", book)).toBe("menstrual")
    expect(phaseForDate("2026-02-02", book)).toBe("follicular")
  })
})
