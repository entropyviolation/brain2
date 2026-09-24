import { describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  DEFAULT_GRADE_TUBE_COLOR,
  DEFAULT_OUTPUT_TUBE_COLOR,
  defaultTubeColorForGas,
  dischargePaint,
  sanitizeTubeColor,
} from "./habit-tube"
import { useHabitsStore } from "./habits-store"

describe("sanitizeTubeColor", () => {
  it("keeps a 6-digit hex and lowercases it", () => {
    expect(sanitizeTubeColor("#FF8800", DEFAULT_GRADE_TUBE_COLOR)).toBe("#ff8800")
    expect(sanitizeTubeColor("  #00B8FF  ", DEFAULT_GRADE_TUBE_COLOR)).toBe("#00b8ff")
  })

  it("falls back on junk", () => {
    expect(sanitizeTubeColor("neon", DEFAULT_GRADE_TUBE_COLOR)).toBe(DEFAULT_GRADE_TUBE_COLOR)
    expect(sanitizeTubeColor("#fff", DEFAULT_OUTPUT_TUBE_COLOR)).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
    expect(sanitizeTubeColor(null, DEFAULT_OUTPUT_TUBE_COLOR)).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
  })
})

describe("dischargePaint", () => {
  it("keeps the picked hue as the halo and darkens residual gas", () => {
    const paint = dischargePaint("#ff0000")
    expect(paint.halo).toBe("#ff0000")
    expect(paint.core).not.toBe(paint.halo)
    expect(paint.residual).not.toBe(paint.halo)
    expect(paint.residual).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("defaults argon cyan and xenon magenta", () => {
    expect(defaultTubeColorForGas("argon")).toBe(DEFAULT_GRADE_TUBE_COLOR)
    expect(defaultTubeColorForGas("xenon")).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
  })
})

describe("habits-store tube colors", () => {
  it("persists per-grade hues independently", () => {
    resetAllStores()
    useHabitsStore.getState().setGradeTubeColor("#22cc88")
    useHabitsStore.getState().setOutputGradeTubeColor("#cc2288")
    expect(useHabitsStore.getState().gradeTubeColor).toBe("#22cc88")
    expect(useHabitsStore.getState().outputGradeTubeColor).toBe("#cc2288")
    useHabitsStore.getState().setGradeTubeColor("nope")
    expect(useHabitsStore.getState().gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
  })
})
