import { describe, it, expect } from "vitest"
import {
  getScheduleableCategoryIds,
  isTaskScheduleable,
  getAvailableTasks,
  getTasksForPeriod,
  scheduleUpdatesForPeriod,
  unscheduleUpdates,
  getCategoryColor,
  navigateDate,
  buildOverviewBoxes,
  assignTasksToOverviewBoxes,
} from "./scheduler-utils"
import type { Task, List } from "@/lib/types"

const cat = (overrides: Partial<List>): List => ({
  id: "c1",
  name: "List",
  color: "#fff",
  createdAt: new Date(),
  ...overrides,
})

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: ["c1"],
  ...overrides,
})

describe("getScheduleableCategoryIds / isTaskScheduleable", () => {
  it("treats lists as scheduleable unless explicitly disabled", () => {
    const ids = getScheduleableCategoryIds([cat({ id: "a" }), cat({ id: "b", scheduleable: false })])
    expect(ids.has("a")).toBe(true)
    expect(ids.has("b")).toBe(false)
    expect(isTaskScheduleable(task({ lists: ["a"] }), ids)).toBe(true)
    expect(isTaskScheduleable(task({ lists: ["b"] }), ids)).toBe(false)
  })

  it("honors the task-level scheduleable override above its lists", () => {
    const ids = getScheduleableCategoryIds([cat({ id: "a" }), cat({ id: "b", scheduleable: false })])
    expect(isTaskScheduleable(task({ lists: ["a"], scheduleable: false }), ids)).toBe(false)
    expect(isTaskScheduleable(task({ lists: ["b"], scheduleable: true }), ids)).toBe(true)
  })
})

describe("getAvailableTasks", () => {
  const categories = [cat({ id: "c1" })]
  const ids = getScheduleableCategoryIds(categories)

  it("excludes completed, non-scheduleable, and dependency-blocked tasks", () => {
    const tasks = [
      task({ id: "ok" }),
      task({ id: "done", completed: true }),
      task({ id: "nolist", lists: [] }),
      task({ id: "blocked", dependencies: ["dep"] }),
      task({ id: "dep", completed: false }),
    ]
    const result = getAvailableTasks(tasks, {
      activeTab: "year",
      selectedCategories: [],
      sortBy: "importance",
      sortOrder: "desc",
      lists: categories,
      scheduleableCategoryIds: ids,
    })
    const resultIds = result.map((t) => t.id)
    expect(resultIds).toContain("ok")
    expect(resultIds).not.toContain("done")
    expect(resultIds).not.toContain("nolist")
    expect(resultIds).not.toContain("blocked")
  })

  it("on the always tab only shows fully-unscheduled tasks", () => {
    const tasks = [task({ id: "unscheduled" }), task({ id: "scheduled", scheduledYear: "2026" })]
    const result = getAvailableTasks(tasks, {
      activeTab: "always",
      selectedCategories: [],
      sortBy: "importance",
      sortOrder: "desc",
      lists: categories,
      scheduleableCategoryIds: ids,
    })
    expect(result.map((t) => t.id)).toEqual(["unscheduled"])
  })

  it("sorts by importance descending by default", () => {
    const tasks = [task({ id: "lo", importance: 1 }), task({ id: "hi", importance: 5 })]
    const result = getAvailableTasks(tasks, {
      activeTab: "year",
      selectedCategories: [],
      sortBy: "importance",
      sortOrder: "desc",
      lists: categories,
      scheduleableCategoryIds: ids,
    })
    expect(result[0].id).toBe("hi")
  })
})

describe("getTasksForPeriod", () => {
  const now = new Date("2026-06-20T12:00:00")
  it("matches by scheduled field per period", () => {
    const tasks = [
      task({ id: "y", scheduledYear: "2026" }),
      task({ id: "m", scheduledMonth: "2026-06" }),
    ]
    expect(getTasksForPeriod(tasks, "year", "2026", now).map((t) => t.id)).toEqual(["y"])
    expect(getTasksForPeriod(tasks, "month", "2026-06", now).map((t) => t.id)).toEqual(["m"])
  })
})

describe("scheduleUpdatesForPeriod / unscheduleUpdates", () => {
  it("sets one field and clears the rest", () => {
    const u = scheduleUpdatesForPeriod("month", "2026-06")
    expect(u.scheduledMonth).toBe("2026-06")
    expect(u.scheduledYear).toBeUndefined()
    expect(u.scheduledWeek).toBeUndefined()
    expect(u.scheduledDate).toBeUndefined()
  })

  it("unschedule clears all scheduling fields", () => {
    const u = unscheduleUpdates()
    expect(u).toEqual({
      scheduledYear: undefined,
      scheduledMonth: undefined,
      scheduledWeek: undefined,
      scheduledDate: undefined,
      scheduledTime: undefined,
    })
  })
})

describe("getCategoryColor", () => {
  it("returns the matching category color or a default", () => {
    const categories = [cat({ id: "c1", color: "#abc" })]
    expect(getCategoryColor(categories, ["c1"])).toBe("#abc")
    expect(getCategoryColor(categories, [])).toBe("#6B7280")
    expect(getCategoryColor(categories, ["nope"])).toBe("#6B7280")
  })
})

describe("navigateDate", () => {
  it("moves by the active period", () => {
    const d = new Date("2026-06-20T12:00:00")
    expect(navigateDate(d, "year", 1).getFullYear()).toBe(2027)
    expect(navigateDate(d, "day", -1).getDate()).toBe(19)
  })
})

describe("overview boxes", () => {
  it("assigns a day-scheduled task to its most specific box", () => {
    const now = new Date("2026-06-20T12:00:00")
    const boxes = buildOverviewBoxes(now)
    const today = now.toISOString().slice(0, 10)
    const tasks = [task({ id: "today", scheduledDate: new Date(today + "T09:00:00") })]
    const assignments = assignTasksToOverviewBoxes(tasks, boxes)
    expect(assignments["Today"].map((t) => t.id)).toContain("today")
    expect(assignments["This Year"]).not.toContainEqual(expect.objectContaining({ id: "today" }))
  })
})
