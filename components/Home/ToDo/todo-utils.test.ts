import { describe, it, expect } from "vitest"
import {
  getTierFromTask,
  tierToUrgencyImportance,
  buildTodoItems,
  buildDoneTodoItems,
  filterAndSortTodos,
  sortTodosByPriority,
  sortTodos,
  getTodoAddedAt,
  getTodoSortOptionLabel,
  getTaskCompletionDate,
  taskCompletedOnDay,
  getTodoOpenTitle,
  getTodoDoneTitle,
  defaultCompletionReview,
  createScheduledTodoTask,
  getMonthKey,
} from "./todo-utils"
import { getWeekString } from "@/lib/date-utils"
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

  it("can sort ascending so lower scores come first", () => {
    const tasks = [
      task({ id: "low", urgency: 1, importance: 1, cognitiveLoad: 3, entropy: 0, scheduledDate: now }),
      task({ id: "high", urgency: 5, importance: 5, cognitiveLoad: 1, entropy: 0.5, scheduledDate: now }),
    ]
    const items = buildTodoItems(tasks, true, now)
    const sorted = sortTodosByPriority(items, tasks, DEFAULT_PRIORITY_WEIGHTS, "asc")
    expect(sorted[0].taskId).toBe("low")
  })
})

describe("sortTodos", () => {
  const weights = DEFAULT_PRIORITY_WEIGHTS

  it("sorts by name ascending and descending, case-insensitively", () => {
    const tasks = [
      task({ id: "b", description: "Beta", scheduledDate: now }),
      task({ id: "c", description: "gamma", scheduledDate: now }),
      task({ id: "a", description: "Alpha", scheduledDate: now }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "name", order: "asc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ])
    expect(sortTodos(items, { mode: "name", order: "desc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "c",
      "b",
      "a",
    ])
  })

  it("sorts by date created ascending and descending", () => {
    const tasks = [
      task({ id: "mid", createdAt: new Date("2026-06-10T12:00:00"), scheduledDate: now }),
      task({ id: "new", createdAt: new Date("2026-06-18T12:00:00"), scheduledDate: now }),
      task({ id: "old", createdAt: new Date("2026-06-01T12:00:00"), scheduledDate: now }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "created", order: "asc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "old",
      "mid",
      "new",
    ])
    expect(sortTodos(items, { mode: "created", order: "desc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "new",
      "mid",
      "old",
    ])
  })

  it("sorts by date added to the day list using scheduledDate, not createdAt", () => {
    const tasks = [
      task({
        id: "created-early-added-late",
        createdAt: new Date("2026-06-01T12:00:00"),
        scheduledDate: new Date("2026-06-20T12:00:00"),
      }),
      task({
        id: "created-late-added-early",
        createdAt: new Date("2026-06-10T12:00:00"),
        scheduledDate: new Date("2026-06-18T12:00:00"),
      }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "added", order: "asc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "created-late-added-early",
      "created-early-added-late",
    ])
    expect(sortTodos(items, { mode: "added", order: "desc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "created-early-added-late",
      "created-late-added-early",
    ])
  })

  it("sorts by days pushed ascending and descending", () => {
    const tasks = [
      task({ id: "few", scheduledDate: now, daysPushed: 1 }),
      task({ id: "none", scheduledDate: now, daysPushed: 0 }),
      task({ id: "many", scheduledDate: now, daysPushed: 5 }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "pushed", order: "asc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "none",
      "few",
      "many",
    ])
    expect(sortTodos(items, { mode: "pushed", order: "desc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "many",
      "few",
      "none",
    ])
  })

  it("sorts week lists by weeks pushed", () => {
    const tasks = [
      task({ id: "few", scheduledDate: now, weeksPushed: 1 }),
      task({ id: "many", scheduledDate: now, weeksPushed: 4 }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "pushed", order: "desc", period: "week", tasks, weights }).map((i) => i.id)).toEqual([
      "many",
      "few",
    ])
  })

  it("tier descending puts lower tiers first", () => {
    const tasks = [
      task({ id: "high", scheduledDate: now, urgency: 5, importance: 5 }),
      task({ id: "low", scheduledDate: now, urgency: 1, importance: 1 }),
    ]
    const items = buildTodoItems(tasks, true, now)
    expect(sortTodos(items, { mode: "tier", order: "asc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "high",
      "low",
    ])
    expect(sortTodos(items, { mode: "tier", order: "desc", period: "day", tasks, weights }).map((i) => i.id)).toEqual([
      "low",
      "high",
    ])
  })
})

describe("getTodoAddedAt", () => {
  it("uses scheduledDate for the day list", () => {
    const [item] = buildTodoItems(
      [task({ id: "a", createdAt: new Date("2026-06-01"), scheduledDate: new Date("2026-06-20T12:00:00") })],
      true,
      now,
    )
    expect(getTodoAddedAt(item, "day")).toBe(new Date("2026-06-20T12:00:00").getTime())
  })
})

describe("getTodoSortOptionLabel", () => {
  it("names the push sort after the active period", () => {
    expect(getTodoSortOptionLabel("pushed", "day")).toBe("Days pushed")
    expect(getTodoSortOptionLabel("pushed", "week")).toBe("Weeks pushed")
    expect(getTodoSortOptionLabel("pushed", "month")).toBe("Months pushed")
    expect(getTodoSortOptionLabel("created", "day")).toBe("Date created")
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

describe("createScheduledTodoTask", () => {
  it("creates a day-scheduled Home/To-Do record", () => {
    const created = createScheduledTodoTask({ description: "  text linda  ", period: "day", date: now })
    expect(created.description).toBe("text linda")
    expect(created.stage).toBe("clarified")
    expect(created.scheduleable).toBe(true)
    expect(created.context).toBe("@general")
    expect(created.estimatedDuration).toBe(30)
    expect(created.urgency).toBe(4)
    expect(created.importance).toBe(4)
    expect(created.scheduledDate).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    expect(created.scheduledWeek).toBeUndefined()
    expect(created.scheduledMonth).toBeUndefined()
    expect(created.scheduledTime).toBeUndefined()

    const items = buildTodoItems([created], false, now)
    expect(filterAndSortTodos(items, "day", false, now).map((i) => i.description)).toEqual(["text linda"])
  })

  it("assigns week/month without pinning a day", () => {
    const weekTask = createScheduledTodoTask({ description: "week item", period: "week", date: now, tier: "B" })
    expect(weekTask.scheduledWeek).toBe(getWeekString(now))
    expect(weekTask.scheduledDate).toBeUndefined()
    expect(weekTask.urgency).toBe(2)

    const monthTask = createScheduledTodoTask({ description: "month item", period: "month", date: now })
    expect(monthTask.scheduledMonth).toBe(getMonthKey(now))
    expect(monthTask.scheduledDate).toBeUndefined()
  })
})
