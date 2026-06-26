import { describe, it, expect, beforeEach } from "vitest"
import {
  useRegretStore,
  dueDateOf,
  daysOverdue,
  dailyRegretIncrement,
  regretCost,
  projectedRegret,
} from "@/lib/regret-store"
import type { Task } from "@/lib/types"

function makeTask(partial: Partial<Task>): Task {
  return {
    id: "t",
    description: "Task",
    category: "scheduled",
    createdAt: new Date(),
    completed: false,
    categories: [],
    ...partial,
  } as Task
}

const ASOF = new Date(2026, 5, 23) // Jun 23 2026 (local)

describe("regret pure helpers", () => {
  it("resolves due date by deadline > mustBeDoneBefore > scheduledDate", () => {
    const deadline = new Date(2026, 5, 10)
    const before = new Date(2026, 5, 11)
    const scheduled = new Date(2026, 5, 12)
    expect(dueDateOf(makeTask({ deadline, schedulingConstraints: { mustBeDoneBefore: before }, scheduledDate: scheduled }))).toEqual(deadline)
    expect(dueDateOf(makeTask({ schedulingConstraints: { mustBeDoneBefore: before }, scheduledDate: scheduled }))).toEqual(before)
    expect(dueDateOf(makeTask({ scheduledDate: scheduled }))).toEqual(scheduled)
    expect(dueDateOf(makeTask({}))).toBeNull()
  })

  it("counts whole days overdue and never goes negative", () => {
    expect(daysOverdue(makeTask({ deadline: new Date(2026, 5, 20) }), ASOF)).toBe(3)
    expect(daysOverdue(makeTask({ deadline: new Date(2026, 5, 23) }), ASOF)).toBe(0)
    expect(daysOverdue(makeTask({ deadline: new Date(2026, 5, 30) }), ASOF)).toBe(0)
    expect(daysOverdue(makeTask({}), ASOF)).toBe(0)
  })

  it("weights the daily increment by importance + urgency + reward, min 1", () => {
    expect(dailyRegretIncrement(makeTask({ importance: 4, urgency: 2 }))).toBe(6)
    expect(dailyRegretIncrement(makeTask({ rewardValue: 5 }))).toBe(5)
    expect(dailyRegretIncrement(makeTask({}))).toBe(1)
  })

  it("regretCost = daysOverdue × increment, 0 when completed or not overdue", () => {
    const t = makeTask({ deadline: new Date(2026, 5, 20), importance: 3 })
    expect(regretCost(t, ASOF)).toBe(3 * 3) // 3 days × weight 3
    expect(regretCost(makeTask({ deadline: new Date(2026, 5, 20), importance: 3, completed: true }), ASOF)).toBe(0)
    expect(regretCost(makeTask({ deadline: new Date(2026, 5, 30), importance: 3 }), ASOF)).toBe(0)
  })

  it("projectedRegret sums outstanding regret across the snapshot", () => {
    const tasks = [
      makeTask({ id: "a", deadline: new Date(2026, 5, 22), importance: 2 }), // 1 day × 2
      makeTask({ id: "b", deadline: new Date(2026, 5, 21), importance: 1 }), // 2 days × 1
      makeTask({ id: "c", deadline: new Date(2026, 5, 22), importance: 5, completed: true }), // 0
    ]
    expect(projectedRegret(tasks, ASOF)).toBe(2 + 2)
  })
})

describe("useRegretStore", () => {
  beforeEach(() => {
    useRegretStore.getState().clearRegret()
  })

  it("adds an explicit regret entry with an optional reason", () => {
    useRegretStore.getState().addRegret("x", 7, "Skipped task", ASOF, "procrastination")
    const { regretHistory } = useRegretStore.getState()
    expect(regretHistory).toHaveLength(1)
    expect(regretHistory[0]).toMatchObject({ taskId: "x", regret: 7, reason: "procrastination", date: "2026-06-23" })
  })

  it("accrues one day's increment for overdue incomplete items", () => {
    const tasks = [
      makeTask({ id: "a", deadline: new Date(2026, 5, 20), importance: 3 }),
      makeTask({ id: "b", deadline: new Date(2026, 5, 30), importance: 3 }), // not overdue
      makeTask({ id: "c", deadline: new Date(2026, 5, 20), importance: 3, completed: true }), // done
    ]
    const accrued = useRegretStore.getState().accrueOverdue(tasks, ASOF)
    expect(accrued).toEqual(["a"])
    expect(useRegretStore.getState().getDayRegret(ASOF)).toBe(3)
  })

  it("is idempotent per task per day", () => {
    const tasks = [makeTask({ id: "a", deadline: new Date(2026, 5, 20), importance: 3 })]
    useRegretStore.getState().accrueOverdue(tasks, ASOF)
    const second = useRegretStore.getState().accrueOverdue(tasks, ASOF)
    expect(second).toEqual([])
    expect(useRegretStore.getState().getTotalRegret()).toBe(3)
  })

  it("cumulative daily accrual equals regretCost over the overdue span", () => {
    const task = makeTask({ id: "a", deadline: new Date(2026, 5, 20), importance: 2 })
    // Accrue once per day for Jun 21, 22, 23 → 3 increments of weight 2.
    for (const day of [21, 22, 23]) {
      useRegretStore.getState().accrueOverdue([task], new Date(2026, 5, day))
    }
    expect(useRegretStore.getState().getTotalRegret()).toBe(regretCost(task, ASOF))
    expect(useRegretStore.getState().getTotalRegret()).toBe(6)
  })

  it("totals by day, week, and month", () => {
    useRegretStore.getState().addRegret("a", 5, "A", new Date(2026, 5, 23)) // Tue
    useRegretStore.getState().addRegret("b", 3, "B", new Date(2026, 5, 22)) // Mon (same week)
    useRegretStore.getState().addRegret("c", 9, "C", new Date(2026, 4, 10)) // May (other month)
    const s = useRegretStore.getState()
    expect(s.getDayRegret(new Date(2026, 5, 23))).toBe(5)
    expect(s.getWeekRegret(new Date(2026, 5, 23))).toBe(8)
    expect(s.getMonthRegret(new Date(2026, 5, 23))).toBe(8)
    expect(s.getTotalRegret()).toBe(17)
  })

  it("ranks top regret tasks and groups by reason", () => {
    useRegretStore.getState().addRegret("a", 2, "A", ASOF, "no-energy")
    useRegretStore.getState().addRegret("a", 3, "A", ASOF, "no-energy")
    useRegretStore.getState().addRegret("b", 10, "B", ASOF, "procrastination")
    useRegretStore.getState().addRegret("c", 1, "C", ASOF)
    const top = useRegretStore.getState().getTopRegretTasks(2)
    expect(top).toEqual([
      { taskId: "b", taskDescription: "B", regret: 10 },
      { taskId: "a", taskDescription: "A", regret: 5 },
    ])
    expect(useRegretStore.getState().getRegretByReason()).toEqual({
      "no-energy": 5,
      procrastination: 10,
      unspecified: 1,
    })
  })

  it("removes all entries for a task", () => {
    useRegretStore.getState().addRegret("a", 5, "A", ASOF)
    useRegretStore.getState().addRegret("b", 3, "B", ASOF)
    useRegretStore.getState().removeTaskRegret("a")
    expect(useRegretStore.getState().getTotalRegret()).toBe(3)
  })
})
