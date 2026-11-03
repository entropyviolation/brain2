import { describe, expect, it } from "vitest"
import { fitToUnknown } from "./blocks"
import { buildDayContext, confirmedSpans, dayContextText } from "./day-context"
import type { VaultHistory } from "./vault-search"

const e = (scope: string, pen: string, startMin: number, endMin: number, extra: object = {}) => ({ date: "2020-03-02", scope, pen, startMin, endMin, text: "", ...extra })
const history: VaultHistory = {
  entries: [
    e("activity", "Sleep", 0, 480),
    e("activity", "Dishes", 600, 630, { confirmed: false }),
    e("location", "Home", 400, 1440),
    e("screentime", "Code", 500, 560),
  ],
  feed: [], logs: [], dayNotes: [], scopeNames: {},
  health: { "2020-03-02": { steps: 4200, heartAvg: 71 } },
}

describe("day context", () => {
  const ctx = buildDayContext(history, new Date(2020, 2, 2, 12, 0))
  it("keeps confirmed blocks apart from the unknown gap and its tracking", () => {
    expect(ctx.confirmed.map((c) => c.pen)).toEqual(["Sleep"])
    expect(ctx.gaps).toHaveLength(1)
    const text = dayContextText(ctx)
    expect(text).toContain("00:00–08:00 Sleep")
    expect(text).toContain("08:00–24:00")
    expect(text).toContain("screen time: Code 60m")
    expect(text).toContain("guessed, not confirmed: Dishes")
    expect(text).toContain("4200 steps")
  })
  it("trims built blocks around confirmed time", () => {
    const b = { activity: "x", start: new Date(2020, 2, 2, 7, 0).toISOString(), end: new Date(2020, 2, 2, 9, 0).toISOString(), estimated: false, why: "", evidence: [] }
    const out = fitToUnknown([b], confirmedSpans(history))
    expect(out).toHaveLength(1)
    expect(new Date(out[0].start).getHours()).toBe(8)
  })
})
