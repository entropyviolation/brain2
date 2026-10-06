import { describe, expect, it } from "vitest"
import { blockedReasonLabel, blockedReasonNote, packBlockedReason } from "./blocked-reason"

describe("blocked reasons", () => {
  it("keeps a preset as a token and ignores stray text", () => {
    expect(packBlockedReason("no-time", "leftover")).toBe("no-time")
  })

  it("stores Other with the typed words", () => {
    expect(packBlockedReason("other", "  the rain  ")).toEqual({ reason: "other", note: "the rain" })
    expect(blockedReasonLabel({ reason: "other", note: "the rain" })).toBe("the rain")
    expect(blockedReasonNote({ reason: "other", note: "the rain" })).toBe("the rain")
  })

  it("does not invent a custom reason when Other is left blank", () => {
    expect(packBlockedReason("other", "   ")).toBe("other")
    expect(blockedReasonLabel("other")).toBe("Other")
    expect(blockedReasonNote("other")).toBe("")
  })
})
