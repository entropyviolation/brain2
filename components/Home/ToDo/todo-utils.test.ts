import { describe, it, expect } from "vitest"
import {
  getTierFromTask,
  tierToUrgencyImportance,
  buildTodoItems,
  buildDoneTodoItems,
  filterAndSortTodos,
  sortTodosByPriority,
  getTaskCompletionDate,
  taskCompletedOnDay,
  getTodoOpenTitle,
  getTodoDoneTitle,
  defaultCompletionReview,
} from "./todo-utils"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/priority"
import type { Task } from "@/lib/types"

const now = new Date("2026-06-20T12:00:00")

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "scheduled",
  createdAt: now,
  completed: false,
  lists: [],
  ...overrides,
})

describe("getTierFromTask", () => {
  it("maps urgency+importance to a tier", () => {
    expect(getTierFromTask({ urgency: 5, importance: 5 })).toBe("A+")
    expect(getTierFromTask({ urgency: 4, importance: 4 })).toBe("A")
    expect(getTierFromTask({ urgency: 3, importance: 3 })).toBe("A/B")
    expect(getTierFromTask({ urgency: 1, importance: 1 })).toBe("C")
  })
})

describe("tierToUrgencyImportance", () => {
  it("round-trips with getTierFromTask for A+ … C", () => {
    for (const tier of ["A+", "A", "A/B", "B", "C"] as const) {
      expect(getTierFromTask(tierToUrgencyImportance(tier))).toBe(tier)
    }
  })
})

describe("buildTodoItems", () => {
  it("excludes completed and hidden tasks", () => {
    const items = buildTodoItems(
      [
        task({ id: "a", scheduledDate: now }),
        task({ id: "b", completed: true, scheduledDate: now }),
        task({ id: "c", hiddenFromTodo: true, scheduledDate: now }),
      ],
      true,
      now,
    )
    expect(items.map((i) => i.id)).toEqual(["a"])
  })

  it("computes overdue days from the scheduled date", () => {
    const past = new Date("2026-06-15T12:00:00")
    const [item] = buildTodoItems([task({ id: "a", scheduledDate: past })], true, now)
    expect(item.daysOverdue).toBe(5)
  })
})

describe("filterAndSortTodos", () => {
  it("sorts by tier then push count and filters by period", () => {
    const items = buildTodoItems(
      [
        task({ id: "low", scheduledDate: now, urgency: 1, importance: 1 }),
        task({ id: "high", scheduledDate: now, urgency: 5, importance: 5 }),
      ],
      true,
      now,
    )
    const day = filterAndSortTodos(items, "day", true, now)
    expect(day[0].id).toBe("high")
  })

  it("hides unscheduled tasks unless showAll is on", () => {
    const items = buildTodoItems([task({ id: "noplan" })], true, now)
    expect(filterAndSortTodos(items, "day", false, now)).toHaveLength(0)
    expect(filterAndSortTodos(items, "day", true, now)).toHaveLength(1)
  })
})

describe("sortTodosByPriority", () => {
  it("reorders todos by the priority formula via their underlying tasks", () => {
    const tasks = [
      task({ id: "low", urgency: 1, importance: 1, cognitiveLoad: 3, entropy: 0, scheduledDate: now }),
      task({ id: "high", urgency: 5, importance: 5, cognitiveLoad: 1, entropy: 0.5, scheduledDate: now }),
    ]
    const items = buildTodoItems(tasks, true, now)
    const sorted = sortTodosByPriority(items, tasks, DEFAULT_PRIORITY_WEIGHTS)
    expect(sorted[0].taskId).toBe("high")
  })
})

describe("getTaskCompletionDate", () => {
  it("prefers the canonical completedDate", () => {
    const at = new Date("2026-06-18T15:00:00")
    const d = getTaskCompletionDate(task({ completed: true, completedDate: at }))
    expect(d?.getTime()).toBe(at.getTime())
  })

  it("falls back to completionReview, then scheduledDate", () => {
    const at = new Date("2026-06-18T15:00:00")
    expect(
      getTaskCompletionDate(task({ completed: true, completionReview: defaultCompletionReview("t1", at) }))?.getTime(),
    ).toBe(at.getTime())
    const sched = new Date("2026-06-15T12:00:00")
    expect(getTaskCompletionDate(task({ completed: true, scheduledDate: sched }))?.toDateString()).toBe(
      sched.toDateString(),
    )
  })
})

describe("buildDoneTodoItems", () => {
  it("includes only tasks completed on the focused day", () => {
    const items = buildDoneTodoItems(
      [
        task({ id: "done-today", completed: true, completedDate: new Date("2026-06-20T10:00:00") }),
        task({ id: "done-yesterday", completed: true, completedDate: new Date("2026-06-19T10:00:00") }),
      ],
      "day",
      now,
    )
    expect(items.map((i) => i.id)).toEqual(["done-today"])
  })

  it("buckets by completion date, not schedule", () => {
    expect(
      taskCompletedOnDay(
        task({
          completed: true,
          scheduledDate: new Date("2026-06-19T12:00:00"),
          completedDate: new Date("2026-06-20T09:00:00"),
        }),
        now,
      ),
    ).toBe(true)
  })
})

describe("period titles", () => {
  it("uses current-period labels for today", () => {
    expect(getTodoOpenTitle("day", now, now)).toBe("Today's Tasks")
    expect(getTodoDoneTitle("day", now, now)).toBe("Done Today")
  })

  it("uses dated labels when browsing another day", () => {
    const other = new Date("2026-06-15T12:00:00")
    expect(getTodoOpenTitle("day", other, now)).toBe("Jun 15's Tasks")
    expect(getTodoDoneTitle("day", other, now)).toBe("Done Jun 15")
  })
})
