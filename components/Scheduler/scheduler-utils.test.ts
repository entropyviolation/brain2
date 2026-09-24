import { describe, it, expect } from "vitest"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isExpiredDaySchedule } from "@/lib/scheduling"
import {
  getScheduleableCategoryIds,
  isTaskScheduleable,
  nextTaskScheduleableFlag,
  taskInheritsScheduleableFromLists,
  getAvailableTasks,
  getTasksForPeriod,
  scheduleUpdatesForPeriod,
  unscheduleUpdates,
  getCategoryColor,
  navigateDate,
  buildOverviewBoxes,
  assignTasksToOverviewBoxes,
  taskIdsForDragSchedule,
  isPastFunnelPeriod,
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

describe("nextTaskScheduleableFlag", () => {
  it("forces off, inherits when lists allow, and forces on when they do not", () => {
    expect(nextTaskScheduleableFlag({ turnOn: false, inheritsOnFromLists: true })).toBe(false)
    expect(nextTaskScheduleableFlag({ turnOn: false, inheritsOnFromLists: false })).toBe(false)
    expect(nextTaskScheduleableFlag({ turnOn: true, inheritsOnFromLists: true })).toBeUndefined()
    expect(nextTaskScheduleableFlag({ turnOn: true, inheritsOnFromLists: false })).toBe(true)
  })

  it("detects inherit-on from scheduleable lists", () => {
    const ids = getScheduleableCategoryIds([cat({ id: "a" }), cat({ id: "b", scheduleable: false })])
    expect(taskInheritsScheduleableFromLists(task({ lists: ["a"] }), ids)).toBe(true)
    expect(taskInheritsScheduleableFromLists(task({ lists: ["b"] }), ids)).toBe(false)
    expect(taskInheritsScheduleableFromLists(task({ lists: [] }), ids)).toBe(false)
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
    const tasks = [
      task({ id: "unscheduled" }),
      task({ id: "scheduled", scheduledYear: "2026" }),
      task({ id: "later", lists: ["c1", "na-eventually"] }),
    ]
    const result = getAvailableTasks(tasks, {
      activeTab: "always",
      selectedCategories: [],
      sortBy: "importance",
      sortOrder: "desc",
      lists: categories,
      scheduleableCategoryIds: ids,
      eventuallyListId: "na-eventually",
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

describe("taskIdsForDragSchedule", () => {
  it("schedules only the dragged task when nothing is selected", () => {
    expect(taskIdsForDragSchedule("a", new Set())).toEqual(["a"])
  })

  it("schedules every selected task when the dragged task is in the selection", () => {
    expect(taskIdsForDragSchedule("b", new Set(["a", "b", "c"]))).toEqual(["a", "b", "c"])
  })

  it("schedules only the dragged task when it is outside the selection", () => {
    expect(taskIdsForDragSchedule("x", new Set(["a", "b"]))).toEqual(["x"])
  })

  it("accepts an iterable selection", () => {
    expect(taskIdsForDragSchedule("a", ["a", "b"])).toEqual(["a", "b"])
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
    const now = new Date(2026, 5, 20, 12, 0, 0)
    const boxes = buildOverviewBoxes(now)
    const today = formatLocalDateKey(now)
    const tasks = [task({ id: "today", scheduledDate: new Date(2026, 5, 20, 9, 0, 0) })]
    const assignments = assignTasksToOverviewBoxes(tasks, boxes)
    expect(boxes.find((b) => b.label === "Today")?.value).toBe(today)
    expect(assignments["Today"].map((t) => t.id)).toContain("today")
    expect(assignments["This Year"]).not.toContainEqual(expect.objectContaining({ id: "today" }))
  })

  it("keeps Today and Tomorrow on the local calendar date", () => {
    const late = new Date(2026, 8, 23, 22, 42, 0)
    const boxes = buildOverviewBoxes(late)
    expect(boxes.find((b) => b.label === "Today")?.value).toBe("2026-09-23")
    expect(boxes.find((b) => b.label === "Tomorrow")?.value).toBe("2026-09-24")
    expect(boxes.find((b) => b.label === "Eventually / Later")?.kind).toBe("eventually")
  })

  it("moves yesterday's Tomorrow into Today; the day after it is expired for roll-up", () => {
    const placed = new Date(2026, 8, 23, 12, 0, 0)
    const tomorrowValue = buildOverviewBoxes(placed).find((b) => b.label === "Tomorrow")?.value
    const scheduled = task({ id: "soon", scheduledDate: new Date(2026, 8, 24, 0, 0, 0) })
    expect(tomorrowValue).toBe("2026-09-24")

    const nextDay = new Date(2026, 8, 24, 8, 0, 0)
    const onTheDay = assignTasksToOverviewBoxes([scheduled], buildOverviewBoxes(nextDay))
    expect(onTheDay["Today"].map((t) => t.id)).toEqual(["soon"])
    expect(onTheDay["Tomorrow"]).toEqual([])
    expect(isExpiredDaySchedule(scheduled, nextDay)).toBe(false)

    const dayAfter = new Date(2026, 8, 25, 8, 0, 0)
    expect(isExpiredDaySchedule(scheduled, dayAfter)).toBe(true)
    expect(isExpiredDaySchedule({ ...scheduled, scheduledDate: new Date(2026, 8, 25, 0, 0, 0) }, dayAfter)).toBe(false)
  })

  it("shows rolled history in a past day cell and live work on the week", () => {
    const tuesday = new Date(2026, 8, 22, 10, 0, 0)
    const week = "2026-09-21_2026-09-27"
    const rolled = task({
      id: "rolled",
      scheduledWeek: week,
      schedulePlacements: [{ period: "day", value: "2026-09-21" }],
    })
    const pastDay = getTasksForPeriod([rolled], "day", "2026-09-21", tuesday, tuesday)
    const weekLive = getTasksForPeriod([rolled], "week", week, tuesday, tuesday)
    expect(pastDay.map((t) => t.id)).toEqual(["rolled"])
    expect(weekLive.map((t) => t.id)).toEqual(["rolled"])
    expect(getTasksForPeriod([rolled], "day", "2026-09-22", tuesday, tuesday)).toEqual([])
  })

  it("marks past days via isPastFunnelPeriod and leaves today live", () => {
    const tuesday = new Date(2026, 8, 22, 10, 0, 0)
    expect(isPastFunnelPeriod("day", "2026-09-21", tuesday)).toBe(true)
    expect(isPastFunnelPeriod("day", "2026-09-22", tuesday)).toBe(false)
  })

  it("files an unscheduled eventually-list task only in Eventually / Later", () => {
    const now = new Date(2026, 8, 23, 12, 0, 0)
    const boxes = buildOverviewBoxes(now)
    const held = task({ id: "later", lists: ["c1", "na-eventually"] })
    const assignments = assignTasksToOverviewBoxes([held], boxes, "na-eventually")
    expect(assignments["Eventually / Later"].map((t) => t.id)).toEqual(["later"])
    expect(assignments["Today"]).toEqual([])
  })
})
