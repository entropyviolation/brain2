import { describe, expect, it } from "vitest"
import { awardKindOf, explainPointAward, type AwardContext } from "./points-award-explain"
import type { Objective, Task, WeeklyTask } from "./types"

const task = {
  id: "t1",
  title: "Write report",
  description: "Write report",
  lists: ["l1"],
  rewardValue: 4,
  contributesToObjectiveIds: ["o1"],
} as unknown as Task

const objective = {
  id: "o1",
  title: "Career",
  priorities: [{ period: "year", periodKey: "2026", multiplier: 2 }],
} as unknown as Objective

const habit = { id: "h1", name: "Read", frequency: "weekly", rewardValue: 30 } as unknown as WeeklyTask

function ctx(history: AwardContext["history"]): AwardContext {
  return {
    tasks: [task],
    lists: [{ id: "l1", name: "Work" } as never],
    folders: [],
    habits: [habit],
    goals: [],
    objectives: [objective],
    history,
  }
}

describe("awardKindOf", () => {
  it("reads the kind from the id and description", () => {
    expect(awardKindOf({ taskId: "habit-day:h1:2026-10-14", taskDescription: "Completed Read" })).toBe("habit-day")
    expect(awardKindOf({ taskId: "habit-grade-bonus:2026-10-14", taskDescription: "Grade bonus" })).toBe("habit-bonus")
    expect(awardKindOf({ taskId: "t1", taskDescription: "Objective bonus: Write report" })).toBe("objective-bonus")
    expect(awardKindOf({ taskId: "t1", taskDescription: "Write report scheduled" })).toBe("schedule")
    expect(awardKindOf({ taskId: "inbox-clear:1", taskDescription: "Inbox cleared" })).toBe("inbox")
    expect(awardKindOf({ taskId: "review:t1", taskDescription: "Quick review: x" })).toBe("review")
    expect(awardKindOf({ taskId: "h1", taskDescription: "Completed Read" }, { habits: [habit], goals: [] })).toBe("habit-period")
    expect(awardKindOf({ taskId: "t1", taskDescription: "Write report" })).toBe("task")
  })
})

describe("explainPointAward", () => {
  it("names the item, its lists, its reward, and the objective multiplier", () => {
    const entry = { date: "2026-10-14", taskId: "t1", points: 4, taskDescription: "Write report" }
    const bonus = { date: "2026-10-14", taskId: "t1", points: 4, taskDescription: "Objective bonus: Write report" }
    const info = explainPointAward(entry, ctx([entry, bonus]))
    expect(info.kind).toBe("task")
    expect(info.item).toEqual({ id: "t1", title: "Write report", lists: ["Work"] })
    expect(info.lines).toContainEqual({ label: "Item reward", value: "4 pts" })
    expect(info.multipliers[0]).toMatchObject({ label: "Objective · Career", value: 2 })
    expect(info.related).toEqual([bonus])
  })

  it("an objective bonus shows the completion row and the combined multiplier", () => {
    const entry = { date: "2026-10-14", taskId: "t1", points: 4, taskDescription: "Write report" }
    const bonus = { date: "2026-10-14", taskId: "t1", points: 4, taskDescription: "Objective bonus: Write report" }
    const info = explainPointAward(bonus, ctx([entry, bonus]))
    expect(info.lines).toContainEqual({ label: "Combined multiplier", value: "×2" })
    expect(info.rules.map((r) => r.id)).toContain("objective.defaultMultiplier")
  })

  it("a daily habit row shows the full mark rule and that day's completion", () => {
    const entry = { date: "2026-10-14", taskId: "habit-day:h1:2026-10-14", points: 25, taskDescription: "Completed Read" }
    const info = explainPointAward(entry, ctx([entry]))
    expect(info.habit).toEqual({ id: "h1", name: "Read" })
    expect(info.rules[0]!.id).toBe("habit.dailyFullMark")
    expect(info.lines).toContainEqual({ label: "Completion that day", value: "50%" })
  })
})
