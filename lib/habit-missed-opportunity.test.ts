import { describe, expect, it } from "vitest"
import { rawDayCompletionPercent } from "./habit-accomplishment"
import { dailyHabitCompletionRatio } from "./habit-points"
import { isHabitGoalMet } from "./habit-utils"
import {
  completionCellShowsHatch,
  isMissedOpportunity,
  missedOpportunityEligible,
} from "./habit-missed-opportunity"
import { TaskType, type WeeklyTask } from "./types"

const water: WeeklyTask = {
  id: "a",
  name: "Water",
  type: TaskType.BOOLEAN,
  rewardValue: 10,
  frequency: "daily",
}

const pages: WeeklyTask = {
  id: "p",
  name: "Pages",
  type: TaskType.GOAL,
  goal: 3,
  rewardValue: 10,
  frequency: "daily",
}

describe("missed opportunity", () => {
  it("treats a flagged cell with completed false as not done", () => {
    const cell = { completed: false, missedOpportunity: true }
    expect(isMissedOpportunity(cell)).toBe(true)
    expect(isHabitGoalMet(water, cell)).toBe(false)
    expect(dailyHabitCompletionRatio(water, cell, {}, new Date(2026, 5, 16))).toBe(0)
    const day = new Date(2026, 5, 16)
    expect(rawDayCompletionPercent([water], { "2026-06-16": { a: cell } }, day)).toBe(0)
  })

  it("does not let the flag turn a real completion into a miss", () => {
    const cell = { completed: true, missedOpportunity: true }
    expect(isHabitGoalMet(water, cell)).toBe(true)
    expect(dailyHabitCompletionRatio(water, cell, {}, new Date(2026, 5, 16))).toBe(1)
    expect(
      rawDayCompletionPercent([water], { "2026-06-16": { a: cell } }, new Date(2026, 5, 16)),
    ).toBe(100)
  })

  it("refuses exempt and completed cells as missed-op targets", () => {
    expect(missedOpportunityEligible(true, false)).toBe(false)
    expect(missedOpportunityEligible(false, true)).toBe(false)
    expect(missedOpportunityEligible(true, true)).toBe(false)
    expect(missedOpportunityEligible(false, isHabitGoalMet(water, { completed: true }))).toBe(false)
    expect(missedOpportunityEligible(false, isHabitGoalMet(pages, { value: 3, goal: 3 }))).toBe(false)
    expect(
      missedOpportunityEligible(false, isHabitGoalMet(water, { completed: false, missedOpportunity: true })),
    ).toBe(true)
    expect(missedOpportunityEligible(false, isHabitGoalMet(pages, { value: 1, goal: 3 }))).toBe(true)
  })

  it("hatches completed and missed cells only while the rocker is on", () => {
    const base = {
      exempt: false,
      met: false,
      missed: true,
      exemptionWand: false,
      missedOpWand: false,
      hideCompletedAndMissed: false,
    }
    expect(completionCellShowsHatch(base)).toBe(false)
    expect(completionCellShowsHatch({ ...base, hideCompletedAndMissed: true })).toBe(true)
    expect(completionCellShowsHatch({ ...base, missed: false, met: true, hideCompletedAndMissed: true })).toBe(true)
    expect(completionCellShowsHatch({ ...base, missed: false, exempt: true })).toBe(true)
    expect(completionCellShowsHatch({ ...base, missedOpWand: true, met: true })).toBe(true)
    expect(completionCellShowsHatch({ ...base, missedOpWand: true, met: false })).toBe(false)
  })

  it("hatches a printed 30/30 goal while the rocker is on", () => {
    const base = {
      exempt: false,
      met: false,
      missed: false,
      exemptionWand: false,
      missedOpWand: false,
      hideCompletedAndMissed: true,
    }
    expect(completionCellShowsHatch({ ...base, shown: 30, goal: 30 })).toBe(true)
    expect(completionCellShowsHatch({ ...base, shown: 30, goal: 30, hideCompletedAndMissed: false })).toBe(false)
    expect(completionCellShowsHatch({ ...base, shown: 15, goal: 30 })).toBe(false)
    expect(completionCellShowsHatch({ ...base, shown: 30, goal: 30, missedOpWand: true })).toBe(false)
  })
})
