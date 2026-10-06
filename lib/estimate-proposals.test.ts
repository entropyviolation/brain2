import { describe, expect, it } from "vitest"
import { proposeDoneEstimates } from "./estimate-proposals"

describe("proposeDoneEstimates", () => {
  it("places a done item in the first waking gap and skips one already on the grid", () => {
    const placed = proposeDoneEstimates(
      [
        { id: "a", title: "Dishes", minutes: 30 },
        { id: "b", title: "Already", minutes: 30 },
      ],
      [{ startMin: 0, endMin: 8 * 60 }],
      new Set(["b"]),
    )
    expect(placed).toEqual([{ sourceId: "a", title: "Dishes", startMin: 8 * 60, endMin: 8 * 60 + 30 }])
  })

  it("uses a preferred start when that gap can hold the block", () => {
    const placed = proposeDoneEstimates(
      [{ id: "a", title: "Call", minutes: 20, preferredStart: 15 * 60 }],
      [],
      new Set(),
    )
    expect(placed[0]).toMatchObject({ startMin: 15 * 60, endMin: 15 * 60 + 20 })
  })
})
