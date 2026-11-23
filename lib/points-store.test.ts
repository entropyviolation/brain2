import { beforeEach, describe, expect, it } from "vitest"
import { usePointsStore } from "@/lib/points-store"

const day = new Date(2026, 10, 22)

describe("upsertPoints", () => {
  beforeEach(() => usePointsStore.setState({ pointsHistory: [] }))

  it("leaves the history untouched when the row is already there", () => {
    const { upsertPoints } = usePointsStore.getState()
    upsertPoints("a", 5, "A", day)
    upsertPoints("b", 25, "B", day)
    const before = usePointsStore.getState().pointsHistory
    upsertPoints("a", 5, "A", day)
    expect(usePointsStore.getState().pointsHistory).toBe(before)
  })

  it("changes a row in place, so the order stays", () => {
    const { upsertPoints } = usePointsStore.getState()
    upsertPoints("a", 5, "A", day)
    upsertPoints("b", 25, "B", day)
    upsertPoints("a", 10, "A", day)
    expect(usePointsStore.getState().pointsHistory.map((e) => [e.taskId, e.points])).toEqual([
      ["a", 10],
      ["b", 25],
    ])
  })

  it("removes on zero, and zero with no row is a no-op", () => {
    const { upsertPoints } = usePointsStore.getState()
    upsertPoints("a", 5, "A", day)
    upsertPoints("a", 0, "A", day)
    expect(usePointsStore.getState().pointsHistory).toEqual([])
    const before = usePointsStore.getState().pointsHistory
    upsertPoints("z", 0, "Z", day)
    expect(usePointsStore.getState().pointsHistory).toBe(before)
  })
})
