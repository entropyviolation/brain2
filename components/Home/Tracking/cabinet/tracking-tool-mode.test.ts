import { afterEach, describe, expect, it } from "vitest"
import {
  ERASE,
  SCISSORS,
  lastRememberedDrawPenId,
  nextPaintPenId,
  rememberDrawPenId,
  resetTrackingPaintToolMemory,
  showPenTray,
  trackingPaintTool,
} from "./tracking-tool-mode"

describe("tracking paint tools", () => {
  afterEach(() => {
    resetTrackingPaintToolMemory()
  })

  it("treats a real pen or none as Draw, and the sentinels as exclusive radios", () => {
    expect(trackingPaintTool("act-work")).toBe("draw")
    expect(trackingPaintTool(null)).toBe("draw")
    expect(trackingPaintTool(ERASE)).toBe("erase")
    expect(trackingPaintTool(SCISSORS)).toBe("scissors")
    expect(showPenTray("draw")).toBe(true)
    expect(showPenTray("erase")).toBe(false)
    expect(showPenTray("scissors")).toBe(false)
  })

  it("switches Draw / Erase / Scissors one at a time and restores the last pen", () => {
    expect(nextPaintPenId("erase", "act-work", "act-rest")).toBe(ERASE)
    expect(lastRememberedDrawPenId()).toBe("act-work")
    expect(trackingPaintTool(ERASE)).toBe("erase")
    expect(trackingPaintTool(ERASE)).not.toBe("scissors")

    expect(nextPaintPenId("scissors", ERASE, "act-rest")).toBe(SCISSORS)
    expect(lastRememberedDrawPenId()).toBe("act-work")

    expect(nextPaintPenId("draw", SCISSORS, "act-rest")).toBe("act-work")
    expect(nextPaintPenId("draw", "act-chores", "act-rest")).toBe("act-chores")
  })

  it("falls back to the scope's first pen when Draw has no memory", () => {
    expect(nextPaintPenId("draw", ERASE, "act-work")).toBe("act-work")
    rememberDrawPenId(ERASE)
    expect(lastRememberedDrawPenId()).toBeNull()
  })
})
