import { describe, expect, it } from "vitest"
import {
  blockedReasonLabel,
  blockedReasonNote,
  missReasonAsText,
  packBlockedReason,
  packReasonKeepingNote,
  presetIdForText,
  storedReasonText,
} from "./blocked-reason"

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

  it("keeps a note beside a preset for the optional prompt", () => {
    expect(packReasonKeepingNote("no-time", " the rain ")).toEqual({ reason: "no-time", note: "the rain" })
    expect(packReasonKeepingNote("", "the rain")).toEqual({ reason: "other", note: "the rain" })
    expect(packReasonKeepingNote("no-time", "  ")).toBe("no-time")
    expect(packReasonKeepingNote("", "  ")).toBeUndefined()
    expect(storedReasonText({ reason: "no-time", note: "the rain" })).toBe("No time — the rain")
    expect(missReasonAsText({ reason: "no-time", note: "the rain" })).toBe("the rain")
    expect(missReasonAsText("no-time")).toBe("No time")
    expect(presetIdForText("No time")).toBe("no-time")
    expect(presetIdForText("the rain")).toBe("")
  })
})
