import { describe, expect, it } from "vitest"
import { goodAccepts, type Verdict } from "./suggestion-verdicts"

const v = (over: Partial<Verdict>): Verdict => ({ suggestionId: "s", verdict: "accepted", reason: "", at: "2026-11-11T10:00:00Z", suggestion: {} as Verdict["suggestion"], ...over })

describe("goodAccepts", () => {
  it("keeps plain accepts and leaves out Neutral accepts and rejects", () => {
    const rows = [v({ suggestionId: "a" }), v({ suggestionId: "b", grade: "ok" }), v({ suggestionId: "c", verdict: "rejected" }), v({ suggestionId: "d", grade: "good" })]
    expect(goodAccepts(rows).map((r) => r.suggestionId)).toEqual(["a", "d"])
  })
})
