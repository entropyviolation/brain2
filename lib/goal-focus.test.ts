import { describe, expect, it } from "vitest"
import { composePointMultiplier, DEFAULT_GOAL_FOCUS_MULTIPLIER, focusSelectionWeight, taskServesFocusGoals } from "./goal-focus"

const goals = [
  { id: "goal-read", objectiveIds: ["obj-read"] },
  { id: "goal-surf", objectiveIds: ["obj-outside"] },
]

describe("goal focus multipliers", () => {
  it("defaults to 1.5×", () => {
    expect(DEFAULT_GOAL_FOCUS_MULTIPLIER).toBe(1.5)
  })

  it("matches a task by goal or by the goal's objective", () => {
    expect(taskServesFocusGoals({ contributesToGoalIds: ["goal-read"] }, goals, ["goal-read"])).toBe(true)
    expect(
      taskServesFocusGoals({ contributesToObjectiveIds: ["obj-outside"] }, goals, ["goal-surf"]),
    ).toBe(true)
    expect(taskServesFocusGoals({ contributesToGoalIds: ["goal-read"] }, goals, ["goal-surf"])).toBe(false)
  })

  it("keeps the larger boost instead of multiplying them", () => {
    expect(composePointMultiplier(1, 1.5, true)).toBe(1.5)
    expect(composePointMultiplier(1.5, 1.5, true)).toBe(1.5)
    expect(composePointMultiplier(2, 1.5, true)).toBe(2)
    expect(composePointMultiplier(1.5, 2, true)).toBe(2)
    expect(composePointMultiplier(2, 1.5, false)).toBe(2)
  })

  it("weights selection only for a focused task", () => {
    expect(focusSelectionWeight(false, 1.5)).toBe(1)
    expect(focusSelectionWeight(true, 1.5)).toBe(1.5)
  })
})
