import { describe, it, expect } from "vitest"
import type { Goal, Objective, ItemLink } from "@/lib/types"
import {
  type ActionRecord,
  servedTargetIds,
  actionServesTarget,
  actionsForTarget,
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  goalProgressFraction,
  goalProgressPercent,
  directionTargetIds,
  goalLastActionDate,
  goalsNeedingAttention,
  dayCoverage,
  daysWithoutDirection,
  directionReport,
} from "@/lib/objectives"

function makeObjective(partial: Partial<Objective> & { id: string }): Objective {
  return {
    title: partial.id,
    priorities: [],
    reviews: [],
    createdAt: new Date(2026, 0, 1),
    ...partial,
  }
}

function makeGoal(partial: Partial<Goal> & { id: string }): Goal {
  return {
    title: partial.id,
    type: "count",
    target: 5,
    current: 0,
    periodKind: "month",
    objectiveIds: [],
    points: 10,
    completed: false,
    createdAt: new Date(2026, 0, 1),
    ...partial,
  }
}

function link(relation: string, targetId: string): ItemLink {
  return { id: `lnk-${relation}-${targetId}`, relation, targetId }
}

describe("serving links", () => {
  it("collects served target ids from serving relations only", () => {
    const action: ActionRecord = {
      id: "t1",
      completed: true,
      links: [link("action-of", "goal-a"), link("blocks", "t2"), link("objective-of", "obj-b")],
    }
    expect(servedTargetIds(action)).toEqual(new Set(["goal-a", "obj-b"]))
    expect(actionServesTarget(action, "goal-a")).toBe(true)
    expect(actionServesTarget(action, "t2")).toBe(false)
  })

  it("filters actions for a given target", () => {
    const actions: ActionRecord[] = [
      { id: "t1", completed: true, links: [link("action-of", "goal-a")] },
      { id: "t2", completed: true, links: [link("action-of", "goal-b")] },
      { id: "t3", completed: false, links: [] },
    ]
    expect(actionsForTarget(actions, "goal-a").map((a) => a.id)).toEqual(["t1"])
  })
})

describe("period keys + prioritization", () => {
  const date = new Date(2026, 5, 24) // Jun 24 2026

  it("derives canonical period keys", () => {
    expect(periodKeyFor("day", date)).toBe("2026-06-24")
    expect(periodKeyFor("month", date)).toBe("2026-06")
    expect(periodKeyFor("year", date)).toBe("2026")
  })

  it("detects whether an objective is prioritized for the period", () => {
    const obj = makeObjective({
      id: "o",
      priorities: [{ period: "month", periodKey: "2026-06", multiplier: 2 }],
    })
    expect(isObjectivePrioritized(obj, "month", date)).toBe(true)
    expect(isObjectivePrioritized(obj, "year", date)).toBe(false)
    const objs = [obj, makeObjective({ id: "o2" })]
    expect(prioritizedObjectives(objs, "month", date).map((o) => o.id)).toEqual(["o"])
  })
})

describe("goal progress", () => {
  it("computes count progress fraction and percent", () => {
    const g = makeGoal({ id: "g", type: "count", current: 13, target: 36 })
    expect(goalProgressFraction(g)).toBeCloseTo(13 / 36)
    expect(goalProgressPercent(g)).toBe(36)
  })

  it("handles boolean goals and over-delivery", () => {
    expect(goalProgressFraction(makeGoal({ id: "g", type: "boolean", current: 0, target: 1 }))).toBe(0)
    expect(goalProgressFraction(makeGoal({ id: "g", type: "boolean", current: 1, target: 1 }))).toBe(1)
    expect(goalProgressPercent(makeGoal({ id: "g", current: 20, target: 10 }))).toBe(100)
  })
})

describe("direction-in-life coverage", () => {
  const now = new Date(2026, 5, 23) // Jun 23 2026
  const goals = [
    makeGoal({ id: "goal-a" }),
    makeGoal({ id: "goal-b" }),
    makeGoal({ id: "goal-done", completed: true }),
  ]
  const objectives = [makeObjective({ id: "obj-a" })]

  function dayAgo(n: number): Date {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d
  }

  it("builds the universe of direction targets", () => {
    expect(directionTargetIds(goals, objectives)).toEqual(new Set(["goal-a", "goal-b", "goal-done", "obj-a"]))
  })

  it("finds a goal's last action date", () => {
    const actions: ActionRecord[] = [
      { id: "t1", completed: true, completedDate: dayAgo(10), links: [link("action-of", "goal-a")] },
      { id: "t2", completed: true, completedDate: dayAgo(2), links: [link("action-of", "goal-a")] },
      { id: "t3", completed: false, completedDate: dayAgo(1), links: [link("action-of", "goal-a")] },
    ]
    expect(goalLastActionDate("goal-a", actions)).toEqual(dayAgo(2))
    expect(goalLastActionDate("goal-b", actions)).toBeNull()
  })

  it("flags goals with no recent linked action (and skips completed goals)", () => {
    const actions: ActionRecord[] = [
      { id: "t1", completed: true, completedDate: dayAgo(3), links: [link("action-of", "goal-a")] },
      { id: "t2", completed: true, completedDate: dayAgo(40), links: [link("action-of", "goal-b")] },
    ]
    const stale = goalsNeedingAttention(goals, actions, { now, staleDays: 14 })
    const ids = stale.map((s) => s.goal.id)
    expect(ids).toContain("goal-b")
    expect(ids).not.toContain("goal-a")
    expect(ids).not.toContain("goal-done")
    const b = stale.find((s) => s.goal.id === "goal-b")!
    expect(b.hasAnyAction).toBe(true)
    expect(b.daysSinceLastAction).toBe(40)
  })

  it("treats goals with zero linked actions as stale with null days", () => {
    const stale = goalsNeedingAttention(goals, [], { now, staleDays: 14 })
    const a = stale.find((s) => s.goal.id === "goal-a")!
    expect(a.hasAnyAction).toBe(false)
    expect(a.daysSinceLastAction).toBeNull()
    expect(stale[0].hasAnyAction).toBe(false)
  })

  it("computes per-day coverage and drift days", () => {
    const actions: ActionRecord[] = [
      { id: "t1", completed: true, completedDate: dayAgo(1), links: [link("action-of", "goal-a")] },
      { id: "t2", completed: true, completedDate: dayAgo(1), links: [] },
      { id: "t3", completed: true, completedDate: dayAgo(2), links: [] },
    ]
    const days = dayCoverage(actions, { now, days: 7, targetIds: directionTargetIds(goals, objectives) })
    expect(days).toHaveLength(7)
    const d1 = days.find((d) => d.date.getDate() === dayAgo(1).getDate())!
    expect(d1.completedCount).toBe(2)
    expect(d1.servedCount).toBe(1)
    const d2 = days.find((d) => d.date.getDate() === dayAgo(2).getDate())!
    expect(d2.completedCount).toBe(1)
    expect(d2.servedCount).toBe(0)

    const drift = daysWithoutDirection(actions, { now, days: 7, targetIds: directionTargetIds(goals, objectives) })
    expect(drift).toContain(d2.key)
    expect(drift).not.toContain(d1.key)
  })

  it("excludes completions outside the window", () => {
    const actions: ActionRecord[] = [
      { id: "old", completed: true, completedDate: dayAgo(40), links: [link("action-of", "goal-a")] },
    ]
    const days = dayCoverage(actions, { now, days: 7 })
    expect(days.every((d) => d.completedCount === 0)).toBe(true)
  })

  it("rolls everything into a direction report with a coverage score", () => {
    const actions: ActionRecord[] = [
      { id: "t1", completed: true, completedDate: dayAgo(1), links: [link("action-of", "goal-a")] },
      { id: "t2", completed: true, completedDate: dayAgo(2), links: [] },
      { id: "t3", completed: true, completedDate: dayAgo(3), links: [link("objective-of", "obj-a")] },
    ]
    const report = directionReport(goals, objectives, actions, { now, days: 14, staleDays: 14 })
    expect(report.activeDays).toBe(3)
    expect(report.directedDays).toBe(2)
    expect(report.coverageScore).toBe(Math.round((2 / 3) * 100))
    expect(report.driftDays).toHaveLength(1)
    expect(report.totalGoals).toBe(3)
  })

  it("returns a null coverage score when there is no activity", () => {
    const report = directionReport(goals, objectives, [], { now, days: 14 })
    expect(report.coverageScore).toBeNull()
    expect(report.activeDays).toBe(0)
  })
})
