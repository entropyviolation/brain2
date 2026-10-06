import { describe, expect, it } from "vitest"
import {
  monthKeysInQuarter,
  quarterKey,
  quarterLabel,
  quarterOf,
  seasonOfDate,
  taskTouchesQuarter,
} from "./seasons"

describe("seasons", () => {
  const sep26 = new Date(2026, 8, 26)

  it("names 26 Sep 2026 as Quarter 2026 Q3 (Fall)", () => {
    expect(quarterOf(sep26)).toBe(3)
    expect(seasonOfDate(sep26)).toBe("Fall")
    expect(quarterKey(sep26)).toBe("2026-Q3")
    expect(quarterLabel("2026-Q3")).toBe("Quarter 2026 Q3 (Fall)")
  })

  it("maps the four calendar quarters", () => {
    expect(quarterLabel("2026-Q1")).toBe("Quarter 2026 Q1 (Spring)")
    expect(quarterLabel("2026-Q2")).toBe("Quarter 2026 Q2 (Summer)")
    expect(quarterLabel("2026-Q4")).toBe("Quarter 2026 Q4 (Winter)")
    expect(monthKeysInQuarter("2026-Q3")).toEqual(["2026-07", "2026-08", "2026-09"])
  })

  it("includes a month scheduled inside the quarter", () => {
    expect(taskTouchesQuarter({ scheduledMonth: "2026-08" }, "2026-Q3")).toBe(true)
    expect(taskTouchesQuarter({ scheduledMonth: "2026-10" }, "2026-Q3")).toBe(false)
    expect(taskTouchesQuarter({ scheduledYear: "2026" }, "2026-Q3")).toBe(false)
  })
})
