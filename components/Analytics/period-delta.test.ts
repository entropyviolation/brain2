import { describe, expect, it } from "vitest"
import { dateKeysInclusive, previousAnalyticsWindow } from "./analytics-range"
import {
  comparePenMinutes,
  formatDeltaPercent,
  formatSignedDuration,
  previousWindowHint,
} from "./period-delta"

describe("period-delta", () => {
  it("uses previousAnalyticsWindow for the comparison calendar", () => {
    const prev = previousAnalyticsWindow("2026-09-01", "2026-09-30", "month")
    expect(prev).toEqual({ from: "2026-08-01", to: "2026-08-31" })
    const keys = dateKeysInclusive(prev!.from, prev!.to)
    expect(keys[0]).toBe("2026-08-01")
    expect(keys[keys.length - 1]).toBe("2026-08-31")
    expect(keys).toHaveLength(31)
  })

  it("steps a raw day window by its own length when unit is omitted", () => {
    const prev = previousAnalyticsWindow("2026-09-14", "2026-09-20")
    expect(prev).toEqual({ from: "2026-09-07", to: "2026-09-13" })
  })

  it("sorts by absolute delta and marks new / same", () => {
    const rows = comparePenMinutes(
      [
        { id: "work", name: "Work", color: "#2563eb", minutes: 120 },
        { id: "sleep", name: "Sleep", color: "#64748b", minutes: 480 },
        { id: "new", name: "Gym", color: "#10b981", minutes: 30 },
      ],
      [
        { id: "work", name: "Work", color: "#2563eb", minutes: 60 },
        { id: "sleep", name: "Sleep", color: "#64748b", minutes: 480 },
        { id: "gone", name: "TV", color: "#ef4444", minutes: 90 },
      ],
    )
    expect(rows.map((r) => r.id)).toEqual(["gone", "work", "new", "sleep"])
    expect(rows[0].deltaMinutes).toBe(-90)
    expect(rows[1].deltaMinutes).toBe(60)
    expect(rows[1].deltaPercent).toBe(100)
    expect(rows[2].isNew).toBe(true)
    expect(formatDeltaPercent(rows[2])).toBe("new")
    expect(rows[3].isSame).toBe(true)
    expect(formatSignedDuration(0)).toBe("same")
    expect(formatSignedDuration(130)).toBe("+2h 10m")
    expect(formatSignedDuration(-40)).toBe("−40m")
  })

  it("hints with previous dates", () => {
    expect(previousWindowHint(["2026-08-01", "2026-08-30"])).toBe(
      "Against the previous 2 days (2026-08-01 – 2026-08-30)",
    )
  })
})
