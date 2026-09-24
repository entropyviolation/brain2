import { describe, expect, it } from "vitest"
import {
  HABITS_CONTROL_PANEL_BASE_WIDTH,
  HABITS_CONTROL_PANEL_DEFAULT_WIDTH,
  HABITS_CONTROL_PANEL_MAX_WIDTH,
  HABITS_CONTROL_PANEL_MIN_WIDTH,
  clampHabitsControlPanelWidth,
  willpowerGemsScale,
} from "./habits-control-panel"

describe("habits control panel width", () => {
  it("defaults to the compact column and clamps leftover widths", () => {
    expect(clampHabitsControlPanelWidth(undefined)).toBe(HABITS_CONTROL_PANEL_DEFAULT_WIDTH)
    expect(clampHabitsControlPanelWidth(HABITS_CONTROL_PANEL_DEFAULT_WIDTH)).toBe(196)
    expect(clampHabitsControlPanelWidth(12)).toBe(HABITS_CONTROL_PANEL_MIN_WIDTH)
    expect(clampHabitsControlPanelWidth(900)).toBe(HABITS_CONTROL_PANEL_MAX_WIDTH)
  })

  it("keeps a scale helper even though the panel no longer resizes", () => {
    expect(willpowerGemsScale(HABITS_CONTROL_PANEL_BASE_WIDTH)).toBe(1)
    expect(willpowerGemsScale(HABITS_CONTROL_PANEL_BASE_WIDTH * 1.5)).toBeCloseTo(1.5)
    expect(willpowerGemsScale(900)).toBeCloseTo(HABITS_CONTROL_PANEL_MAX_WIDTH / HABITS_CONTROL_PANEL_BASE_WIDTH)
  })
})
