import { describe, it, expect } from "vitest"
import type { Task, TodoItem } from "@/lib/types"
import {
  inheritedDue,
  normalizeUnlockValue,
  ownValue,
  unlockBreakdown,
  unlockValue,
  waitingOn,
} from "./unlock-value"
import { computePriorityScore, DEFAULT_PRIORITY_WEIGHTS } from "./priority"
import { isTaskBlocked } from "./prereqs"
import { blockersFirst, sortTodosByPriority } from "@/components/Home/ToDo/todo-utils"

const task = (id: string, o: Partial<Task> = {}): Task => ({
  id,
  description: id,
  stage: "clarified",
  createdAt: new Date(2026, 9, 1),
  completed: false,
  lists: [],
  urgency: 5,
  importance: 5,
  ...o,
})

const row = (t: Task): TodoItem => ({ id: t.id, taskId: t.id, description: t.description }) as unknown as TodoItem

describe("waitingOn / unlockValue", () => {
  it("A → B → C fades by distance", () => {
    // C waits on B, B waits on A.
    const tasks = [task("A"), task("B", { dependencies: ["A"] }), task("C", { dependencies: ["B"] })]
    expect(waitingOn("A", tasks).map((w) => [w.task.id, w.distance])).toEqual([
      ["B", 1],
      ["C", 2],
    ])
    expect(unlockValue("A", tasks)).toBeCloseTo(1 + 0.7)
    expect(unlockBreakdown({ id: "A" }, tasks).label).toBe("unlocks 2 · B (1), C (1 × 0.7)")
  })

  it("counts each waiting task once and ignores done ones", () => {
    const tasks = [
      task("A"),
      task("B", { dependencies: ["A"] }),
      task("C", { dependencies: ["A", "B"] }),
      task("D", { dependencies: ["A"], completed: true }),
    ]
    expect(waitingOn("A", tasks).map((w) => w.task.id)).toEqual(["B", "C"])
  })

  it("a Required or Prioritized mark counts as 1; missing fields read as defaults", () => {
    const low = task("L", { urgency: 1, importance: 1 })
    expect(ownValue(low)).toBe(0)
    expect(ownValue(low, { markedIds: new Set(["L"]) })).toBe(1)
    expect(ownValue(task("X", { urgency: undefined, importance: undefined }))).toBe(0.5)
  })

  it("normalizes 1 − 1/(1 + value)", () => {
    expect(normalizeUnlockValue(0)).toBe(0)
    expect(normalizeUnlockValue(1)).toBe(0.5)
    expect(normalizeUnlockValue(4)).toBeCloseTo(0.8)
  })
})

describe("priority with unlocks", () => {
  it("a task waited on by three outranks an equal task waited on by none", () => {
    const tasks = [
      task("hub", { urgency: 3, importance: 3 }),
      task("solo", { urgency: 3, importance: 3 }),
      task("w1", { dependencies: ["hub"] }),
      task("w2", { dependencies: ["hub"] }),
      task("w3", { dependencies: ["hub"] }),
    ]
    const sorted = sortTodosByPriority([row(tasks[1]), row(tasks[0])], tasks, DEFAULT_PRIORITY_WEIGHTS)
    expect(sorted.map((t) => t.id)).toEqual(["hub", "solo"])
  })

  it("nothing waiting means an unchanged score", () => {
    const t = task("t", { urgency: 4, importance: 2, cognitiveLoad: 1, entropy: 0.3 })
    const fourSignal = computePriorityScore(t, { urgency: 1, importance: 1, cognitiveLoad: 1, entropy: 1 })
    expect(computePriorityScore(t, DEFAULT_PRIORITY_WEIGHTS)).toBe(fourSignal)
    expect(computePriorityScore(t, DEFAULT_PRIORITY_WEIGHTS, { unlocks: 0 })).toBe(fourSignal)
  })

  it("a weights blob without unlocks loads and reads unlocks as 1", () => {
    const old = JSON.parse('{"urgency":1,"importance":1,"cognitiveLoad":1,"entropy":1}')
    const t = task("t")
    expect(computePriorityScore(t, old, { unlocks: 1 })).toBeCloseTo(computePriorityScore(t, old) + 0.5)
  })
})

describe("blocker goes first", () => {
  it("an open prerequisite sorts above the locked row that waits on it", () => {
    const tasks = [task("locked", { dependencies: ["blocker"] }), task("blocker", { urgency: 1, importance: 1 })]
    const sorted = sortTodosByPriority(tasks.map(row), tasks, DEFAULT_PRIORITY_WEIGHTS)
    expect(sorted.map((t) => t.id)).toEqual(["blocker", "locked"])
  })

  it("leaves rows with no prerequisite on the list in order", () => {
    const tasks = [task("a"), task("b", { dependencies: ["gone"] }), task("c")]
    expect(blockersFirst(tasks.map(row), tasks).map((t) => t.id)).toEqual(["a", "b", "c"])
  })
})

describe("inherited due date", () => {
  it("takes the earliest deadline less the estimates along the longest chain", () => {
    const deadline = new Date(2026, 9, 20, 12, 0)
    const tasks = [
      task("rec"),
      task("mix", { dependencies: ["rec"], estimatedDuration: 60 }),
      task("short", { dependencies: ["rec"], estimatedDuration: 30 }),
      task("cd", { dependencies: ["mix", "short"], estimatedDuration: 120, deadline }),
    ]
    const due = inheritedDue("rec", tasks, new Date(2026, 9, 16))
    expect(due?.forTask.id).toBe("cd")
    expect(due?.due.getTime()).toBe(deadline.getTime() - 180 * 60_000)
    expect(due?.overdue).toBe(false)
    expect(tasks[0].deadline).toBeUndefined()
  })

  it("is overdue when passed, and raises urgency only", () => {
    const tasks = [task("rec", { urgency: 1 }), task("cd", { dependencies: ["rec"], deadline: new Date(2026, 9, 10) })]
    expect(inheritedDue("rec", tasks, new Date(2026, 9, 16))?.overdue).toBe(true)
    const plain = computePriorityScore(tasks[0])
    expect(computePriorityScore(tasks[0], DEFAULT_PRIORITY_WEIGHTS, { urgencyFloor: 5 })).toBeGreaterThan(plain)
    const urgent = task("u", { urgency: 5 })
    expect(computePriorityScore(urgent, DEFAULT_PRIORITY_WEIGHTS, { urgencyFloor: 3 })).toBe(computePriorityScore(urgent))
  })

  it("is null when nothing waiting has a deadline", () => {
    expect(inheritedDue("a", [task("a"), task("b", { dependencies: ["a"] })])).toBeNull()
  })
})

describe("locked vs incomplete", () => {
  it("an open parent is never locked", () => {
    const parent = task("p", {
      subtasks: [{ id: "s1", description: "s1", completed: false }] as Task["subtasks"],
    })
    expect(isTaskBlocked(parent, [parent])).toBe(false)
  })
})
