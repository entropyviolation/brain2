import { beforeEach, describe, expect, it } from "vitest"
import { TaskType, type Objective, type Task, type WeeklyTask } from "@/lib/types"
import { buildPointsFormula } from "@/lib/completion-tiers"
import { quickReviewPoints } from "@/lib/completion-review"
import { friendRewardPoints } from "@/lib/friend-reward"
import { composePointMultiplier } from "@/lib/goal-focus"
import { objectiveMultiplierFor } from "@/lib/goals-store"
import { dailyHabitDayPoints } from "@/lib/habit-points"
import { creditInboxHandling } from "@/lib/inbox-credit"
import { beatTheClockMultiplier, resolveCompletionPoints } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import {
  clampPointsRule,
  POINTS_RULE_SECTIONS,
  POINTS_RULES,
  sanitizePointsRules,
} from "@/lib/points-rules"
import {
  commitPointsRule,
  currentRitualPointSettings,
  pointsRuleValue,
  resetPointsRule,
} from "@/lib/points-rules-live"
import { dailyRegretIncrement } from "@/lib/regret-store"
import { ritualAwardPoints } from "@/lib/ritual-points"
import { creditSchedulePlacement } from "@/lib/schedule-credit"
import { useHabitsStore } from "@/lib/habits-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"

const emptyRitual = {
  period: "day" as const,
  unfinishedCount: 0,
  unfinishedTouched: 0,
  assumedPending: 0,
  assumedTouched: false,
  planShown: false,
}

function bareTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t",
    description: "Task",
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: [],
    ...overrides,
  }
}

function resetRules() {
  useUserSettingsStore.setState({
    pointsRules: {},
    ritualSectionPoints: 10,
    ritualCompletionBonus: 30,
    goalFocusMultiplier: 1.5,
  })
  useHabitsStore.setState({
    accomplishmentThreshold: 80,
    accomplishmentBonus: 50,
    dayGradeLiftBonus: 25,
    weeklyGradeLiftBonus: 25,
    weeklyAverageBeatBonus: 5,
    monthlyAverageBeatBonus: 5,
    morningRitualPointMultiplier: 5,
    defaultHabitPoints: { daily: 10, weekly: 10, monthly: 10, seasonal: 10 },
  })
  usePointsStore.setState({ pointsHistory: [] })
}

describe("points-rules catalog", () => {
  beforeEach(resetRules)

  it("keeps today's defaults and a real explanation on every row", () => {
    expect(POINTS_RULES.map((rule) => [rule.id, rule.defaultValue])).toEqual([
      ["inbox.handlePoints", 1],
      ["inbox.clearBonus", 50],
      ["schedule.placementPoints", 1],
      ["habit.dailyFullMark", 50],
      ["habit.defaultPoints.daily", 10],
      ["habit.defaultPoints.weekly", 10],
      ["habit.defaultPoints.monthly", 10],
      ["habit.defaultPoints.seasonal", 10],
      ["habit.gradeBonusEither", 100],
      ["habit.gradeBonusBoth", 300],
      ["habit.gradeBonusThreshold", 75],
      ["habit.accomplishmentThreshold", 80],
      ["habit.accomplishmentBonus", 50],
      ["habit.dayLiftBonus", 25],
      ["habit.weeklyLiftBonus", 25],
      ["habit.weeklyAvgBeatBonus", 5],
      ["habit.monthlyAvgBeatBonus", 5],
      ["habit.morningRitualDisplayMult", 5],
      ["list.defaultCompletionPoints", 1],
      ["list.beatTheClockMaxBonus", 0.2],
      ["tiers.bareMinPoints", 1],
      ["tiers.goalPoints", 10],
      ["tiers.exceptionalPoints", 50],
      ["tiers.bonusPerUnit", 1],
      ["objective.defaultMultiplier", 1.5],
      ["objective.prioritySeedMultiplier", 2],
      ["goalFocus.multiplier", 1.5],
      ["goal.defaultPoints", 20],
      ["goal.actionBasePoints", 1],
      ["ritual.sectionPoints", 10],
      ["ritual.completionBonus", 30],
      ["review.quickBase", 3],
      ["review.pointsPerWord", 0.1],
      ["friend.rewardBase", 2],
      ["friend.rewardScaleDivisor", 12],
      ["regret.minDailyWeight", 1],
    ])
    for (const section of POINTS_RULE_SECTIONS) {
      expect(POINTS_RULES.some((rule) => rule.section === section)).toBe(true)
    }
    for (const rule of POINTS_RULES) {
      expect(rule.explanation.length).toBeGreaterThan(80)
      expect(rule.explanation.toLowerCase()).toMatch(/rewrite|never wrote/)
    }
    expect(POINTS_RULES.find((rule) => rule.id === "habit.dailyFullMark")?.explanation).toMatch(/own points field/)
    expect(POINTS_RULES.find((rule) => rule.id === "habit.morningRitualDisplayMult")?.explanation).toMatch(
      /does not multiply/,
    )
  })

  it("clamps and ignores keys that are not map rules", () => {
    expect(clampPointsRule("inbox.handlePoints", -5)).toBe(0)
    expect(clampPointsRule("objective.defaultMultiplier", 0)).toBe(1.5)
    expect(clampPointsRule("habit.gradeBonusThreshold", 140)).toBe(100)
    expect(clampPointsRule("habit.morningRitualDisplayMult", 200)).toBe(99)
    expect(clampPointsRule("habit.morningRitualDisplayMult", 0)).toBe(0)
    expect(clampPointsRule("list.beatTheClockMaxBonus", 2)).toBe(1)
    expect(clampPointsRule("habit.accomplishmentThreshold", 0)).toBe(1)
    expect(clampPointsRule("goalFocus.multiplier", 0.2)).toBe(1)
    expect(clampPointsRule("friend.rewardScaleDivisor", 0)).toBe(12)
    expect(sanitizePointsRules({ nope: 3, "inbox.handlePoints": 4, "ritual.sectionPoints": 9 })).toEqual({
      "inbox.handlePoints": 4,
    })
    expect(sanitizePointsRules({ "inbox.handlePoints": 1 })).toEqual({})
    expect(pointsRuleValue("inbox.clearBonus")).toBe(50)
  })

  it("stores a map override and writes habit and ritual rows through their setters", () => {
    commitPointsRule("inbox.handlePoints", 7)
    expect(useUserSettingsStore.getState().pointsRules["inbox.handlePoints"]).toBe(7)
    expect(pointsRuleValue("inbox.handlePoints")).toBe(7)
    resetPointsRule("inbox.handlePoints")
    expect(useUserSettingsStore.getState().pointsRules["inbox.handlePoints"]).toBeUndefined()
    expect(pointsRuleValue("inbox.handlePoints")).toBe(1)

    commitPointsRule("ritual.sectionPoints", 4)
    expect(useUserSettingsStore.getState().ritualSectionPoints).toBe(4)
    expect(pointsRuleValue("ritual.sectionPoints")).toBe(4)
    expect(useUserSettingsStore.getState().pointsRules["ritual.sectionPoints"]).toBeUndefined()

    commitPointsRule("habit.defaultPoints.weekly", 18)
    expect(useHabitsStore.getState().defaultHabitPoints.weekly).toBe(18)
    expect(pointsRuleValue("habit.defaultPoints.weekly")).toBe(18)
    resetPointsRule("habit.defaultPoints.weekly")
    expect(useHabitsStore.getState().defaultHabitPoints.weekly).toBe(10)
  })
})

describe("points-rules award paths", () => {
  beforeEach(resetRules)

  it("pays the inbox, schedule, daily-habit, and ritual overrides", () => {
    useUserSettingsStore.getState().setPointsRule("inbox.handlePoints", 7)
    useUserSettingsStore.getState().setPointsRule("inbox.clearBonus", 60)
    creditInboxHandling({ taskId: "idea", title: "Hello", openBefore: 1, openAfter: 0 })
    const inbox = usePointsStore.getState().pointsHistory
    expect(inbox.some((row) => row.points === 7)).toBe(true)
    expect(inbox.some((row) => row.points === 60)).toBe(true)

    usePointsStore.setState({ pointsHistory: [] })
    useUserSettingsStore.getState().setPointsRule("schedule.placementPoints", 4)
    creditSchedulePlacement("task-1", "Write")
    expect(usePointsStore.getState().pointsHistory[0]?.points).toBe(4)

    useUserSettingsStore.getState().setPointsRule("habit.dailyFullMark", 80)
    const habit: WeeklyTask = { id: "a", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
    expect(dailyHabitDayPoints(habit, { completed: true }, {}, new Date(2026, 8, 17))).toBe(80)

    useUserSettingsStore.getState().setRitualSectionPoints(4)
    useUserSettingsStore.getState().setRitualCompletionBonus(7)
    expect(ritualAwardPoints(emptyRitual, currentRitualPointSettings(), true)).toBe(15)
  })

  it("pays review, friend, regret, completion, tier, objective, and focus overrides", () => {
    useUserSettingsStore.getState().setPointsRule("review.quickBase", 5)
    useUserSettingsStore.getState().setPointsRule("review.pointsPerWord", 1)
    expect(quickReviewPoints(0)).toBe(5)
    expect(quickReviewPoints(2)).toBe(7)

    useUserSettingsStore.getState().setPointsRule("friend.rewardBase", 10)
    expect(friendRewardPoints(0)).toBe(10)

    useUserSettingsStore.getState().setPointsRule("regret.minDailyWeight", 4)
    expect(dailyRegretIncrement(bareTask({}))).toBe(4)
    expect(dailyRegretIncrement(bareTask({ importance: 2 }))).toBe(2)

    useUserSettingsStore.getState().setPointsRule("list.defaultCompletionPoints", 3)
    expect(resolveCompletionPoints(bareTask(), [], [])).toBe(3)
    useUserSettingsStore.getState().setPointsRule("list.beatTheClockMaxBonus", 0.5)
    expect(beatTheClockMultiplier(60, 0)).toBeCloseTo(1.5)

    useUserSettingsStore.getState().setPointsRule("tiers.bareMinPoints", 2)
    useUserSettingsStore.getState().setPointsRule("tiers.goalPoints", 20)
    useUserSettingsStore.getState().setPointsRule("tiers.exceptionalPoints", 80)
    useUserSettingsStore.getState().setPointsRule("tiers.bonusPerUnit", 3)
    const formula = buildPointsFormula()
    expect(formula).toContain("80")
    expect(formula).toContain(", 20,")
    expect(formula).toContain(", 2,")
    expect(formula).toContain("* 3")

    useUserSettingsStore.getState().setPointsRule("objective.defaultMultiplier", 3)
    const objective: Objective = { id: "o", title: "Read", priorities: [], createdAt: new Date() }
    expect(objectiveMultiplierFor(objective)).toBe(3)

    useUserSettingsStore.getState().setGoalFocusMultiplier(2.5)
    const focus = pointsRuleValue("goalFocus.multiplier")
    expect(composePointMultiplier(2, focus, true)).toBe(2.5)
    expect(composePointMultiplier(3, focus, true)).toBe(3)
  })
})
