import { describe, expect, it } from "vitest"
import { dayPieces } from "./accept"

describe("dayPieces", () => {
  it("keeps a same-day block whole", () => {
    expect(dayPieces(new Date(2026, 9, 29, 10).toISOString(), new Date(2026, 9, 29, 11, 30).toISOString())).toEqual([{ date: "2026-10-29", startMin: 600, endMin: 690 }])
  })
  it("splits a block over midnight", () => {
    expect(dayPieces(new Date(2026, 9, 29, 23).toISOString(), new Date(2026, 9, 30, 1).toISOString())).toEqual([
      { date: "2026-10-29", startMin: 1380, endMin: 1440 },
      { date: "2026-10-30", startMin: 0, endMin: 60 },
    ])
  })
})
