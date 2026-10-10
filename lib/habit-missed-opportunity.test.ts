import { describe, expect, it } from "vitest"
import { rawDayCompletionPercent } from "./habit-accomplishment"
import { dailyHabitCompletionRatio } from "./habit-points"
import { isHabitGoalMet } from "./habit-utils"
import { habitCompletionDetail } from "./habit-completion-detail"
import {
  completionCellShowsHatch,
  isMissedOpportunity,
  missedOpportunityEligible,
  printedGoalAmounts,
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

describe("printed goal amounts", () => {
  const occupancy: WeeklyTask = {
    id: "log",
    name: "Log 70% of the week",
    type: TaskType.GOAL,
    goal: 70,
    frequency: "weekly",
    coverageLink: { threshold: 70, enabled: true },
  }

  it("prints a sourced amount above the target as 90/70", () => {
    const completion = { value: 90, goal: 70, coverageCompleted: true }
    expect(printedGoalAmounts(occupancy, completion)).toEqual({ shown: 90, goal: 70 })
    expect(habitCompletionDetail({ task: occupancy, completion }).amount).toBe("90 / 70")
  })

  it("prints an over-target sourced amount as 98.2/70", () => {
    const completion = { value: 98.2, goal: 70, coverageCompleted: true }
    expect(printedGoalAmounts(occupancy, completion)).toEqual({ shown: 98.2, goal: 70 })
    expect(habitCompletionDetail({ task: occupancy, completion }).amount).toBe("98.2 / 70")
  })

  it("leaves a logged page total on the cell", () => {
    const pages: WeeklyTask = {
      id: "pages",
      name: "Pages",
      type: TaskType.GOAL,
      goal: 70,
      frequency: "weekly",
      completionPipelines: [
        {
          id: "pages-pipe",
          kind: "habitsStats",
          sources: ["dailyCompletionAverage"],
          statBinding: {
            mode: "simple",
            pipelineId: "pages",
            pipelines: [
              {
                id: "pages",
                name: "Pages",
                outputName: "weeklyPages",
                sourceId: "daily",
                periodId: "thisWeek",
                outputId: "specificHabit",
                habitId: "read",
                valueId: "loggedAmount",
              },
            ],
          },
        },
      ],
    }
    expect(printedGoalAmounts(pages, { value: 98.2, goal: 70, habitSumValue: 98.2 })).toEqual({
      shown: 98.2,
      goal: 70,
    })
  })

  it("prints a sourced amount under the target", () => {
    const completion = { value: 40, goal: 70, coverageCompleted: false }
    expect(printedGoalAmounts(occupancy, completion)).toEqual({ shown: 40, goal: 70 })
    expect(habitCompletionDetail({ task: occupancy, completion }).amount).toBe("40 / 70")
  })

  it("keeps a hand-typed number", () => {
    expect(printedGoalAmounts(occupancy, { value: 12, manualValue: 12, goal: 70 })).toEqual({
      shown: 12,
      goal: 70,
    })
  })

  it("leaves a list-length habit on the live list length", () => {
    const now = new Date(2026, 9, 9, 12, 0, 0)
    const items = [
      { title: "Ruggles", lists: ["texts"], sentAtByList: { texts: now.toISOString() } },
      { title: "Rebecca", lists: ["texts"] },
      { title: "Cammy", lists: ["texts"] },
      { title: "An", lists: ["texts"] },
      { title: "Fifth", lists: ["texts"] },
    ]
    const habit: WeeklyTask = {
      id: "texts",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 100,
      frequency: "weekly",
      completionSources: ["manual", "listSent"],
      listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
    }
    expect(printedGoalAmounts(habit, { value: 90, goal: 100 }, items, now)).toEqual({ shown: 1, goal: 5 })
  })

  it("prints a finished list week as sent over the frozen length", () => {
    const clock = new Date(2026, 9, 9, 15, 0, 0)
    const finishedWeek = new Date(2026, 8, 30, 12, 0, 0)
    const earlierWeek = new Date(2026, 8, 23, 12, 0, 0)
    const early = new Date(2026, 8, 1, 12, 0, 0).toISOString()
    const items = [
      { title: "a", lists: ["texts"], createdAt: early },
      { title: "b", lists: ["texts"], createdAt: early },
      { title: "c", lists: ["texts"], createdAt: early },
      {
        title: "sent",
        lists: ["texts"],
        createdAt: early,
        sentAtByList: { texts: finishedWeek.toISOString() },
      },
      { title: "joined-that-week", lists: ["texts"], createdAt: new Date(2026, 8, 29, 12).toISOString() },
      { title: "joined-later", lists: ["texts"], createdAt: new Date(2026, 9, 6, 12).toISOString() },
    ]
    const habit: WeeklyTask = {
      id: "texts",
      name: "respond to all missing texts",
      type: TaskType.GOAL,
      goal: 5,
      frequency: "weekly",
      completionSources: ["manual", "listSent"],
      listSentLink: { listId: "texts", grace: 100, measure: "sent", target: "listLength" },
    }
    expect(printedGoalAmounts(habit, undefined, items, finishedWeek, clock)).toEqual({ shown: 1, goal: 5 })
    expect(habitCompletionDetail({ task: habit, items, now: finishedWeek, clock }).amount).toBe("1 / 5")
    const earlier = printedGoalAmounts(habit, undefined, items, earlierWeek, clock)
    expect(earlier).not.toEqual({ shown: 1, goal: 5 })
    expect(earlier.shown).toBe(0)
    expect(printedGoalAmounts(habit, { value: 3, manualValue: 3 }, items, finishedWeek, clock)).toEqual({
      shown: 3,
      goal: 5,
    })
  })
})
