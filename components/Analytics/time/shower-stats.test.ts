import { describe, expect, it } from "vitest"
import { showerGapStats } from "./shower-stats"

describe("shower gap stats", () => {
  const range = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]

  it("counts days since today, including a shower today as 0", () => {
    expect(
      showerGapStats([{ id: "a", date: "2026-10-28", startMin: 400 }], range, "2026-10-28").daysSince,
    ).toBe(0)
    expect(showerGapStats([], range, "2026-10-28").daysSince).toBeNull()
  })

  it("averages gaps whose later tick is in the range, and leaves the open stretch out", () => {
    const stats = showerGapStats(
      [
        { id: "a", date: "2026-09-28", startMin: 8 * 60 },
        { id: "b", date: "2026-10-01", startMin: 8 * 60 },
        { id: "c", date: "2026-10-01", startMin: 20 * 60 },
        { id: "d", date: "2026-10-04", startMin: 9 * 60, clockCertainty: "unknown" },
      ],
      range,
      "2026-10-28",
    )
    expect(stats.showersInWindow).toBe(3)
    expect(stats.daysSince).toBe(24)
    expect(stats.gapCount).toBe(3)
    expect(stats.averageGapDays).toBe(2)
    expect(stats.longestGapDays).toBe(3)
    expect(stats.hourGapCount).toBe(2)
    expect(stats.averageGapHours).toBe(42)
  })
})
