import { describe, expect, it } from "vitest"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { dayPlanKey } from "@/lib/plan-text"
import type { Task } from "@/lib/types"
import { coverCurrentWeek } from "./cover-week"
import { deepenBaseTasks, extraLists, extraTasks, weekCommitments } from "./world"

describe("cover current week", () => {
  const now = new Date(2026, 8, 23, 9, 0, 0)

  it("puts one or two planned, tracked, and completed rows on every empty day", () => {
    const filled = coverCurrentWeek({
      now,
      tasks: [],
      entries: [],
      actions: [],
      planDayKeys: new Set(),
    })
    const today = formatLocalDateKey(now)
    for (const day of getWeekDates(getWeekStartDate(now))) {
      const key = formatLocalDateKey(day)
      expect(filled.plans[dayPlanKey(key)]).toBeTruthy()
      const agenda = filled.actions.filter((action) => action.date === key)
      const scheduled = filled.tasks.filter((task) => task.id.startsWith(`demo-cov-sched-${key}`))
      expect(agenda.length).toBeGreaterThanOrEqual(1)
      expect(agenda.length).toBeLessThanOrEqual(2)
      expect(scheduled.length).toBe(agenda.length)
      const tracked = filled.entries.filter((entry) => entry.date === key)
      expect(tracked.length).toBeGreaterThanOrEqual(1)
      expect(tracked.length).toBeLessThanOrEqual(2)
      const done = filled.tasks.filter((task) => task.id.startsWith(`demo-cov-done-${key}`))
      if (key <= today) {
        expect(done.length).toBeGreaterThanOrEqual(1)
        expect(done.length).toBeLessThanOrEqual(2)
      } else {
        expect(done).toHaveLength(0)
        expect(tracked.every((entry) => entry.precision === "estimated")).toBe(true)
      }
    }
  })

  it("does not add a second layer when the day already has each channel", () => {
    const once = coverCurrentWeek({
      now,
      tasks: [],
      entries: [],
      actions: [],
      planDayKeys: new Set(),
    })
    const twice = coverCurrentWeek({
      now,
      tasks: once.tasks,
      entries: once.entries,
      actions: once.actions,
      planDayKeys: new Set(
        Object.keys(once.plans)
          .filter((key) => key.startsWith("dayPlan-"))
          .map((key) => key.slice("dayPlan-".length)),
      ),
    })
    expect(twice.tasks).toHaveLength(0)
    expect(twice.entries).toHaveLength(0)
    expect(twice.actions).toHaveLength(0)
    expect(Object.keys(twice.plans)).toHaveLength(0)
  })

  it("gives week-fill tasks the next-action field set", () => {
    const filled = coverCurrentWeek({
      now,
      tasks: [],
      entries: [],
      actions: [],
      planDayKeys: new Set(),
    })
    expect(filled.tasks.length).toBeGreaterThan(0)
    for (const task of filled.tasks) expectNextActionTask(task)
  })
})

describe("demo corpus vault fields", () => {
  const now = new Date(2026, 8, 23, 9, 0, 0)

  it("fills next-action tasks and plain list items on the rows the corpus already builds", () => {
    const tasks = [...extraTasks(now), ...weekCommitments(now)]
    const nextActions = tasks.filter((task) => task.type === "task")
    const listItems = tasks.filter((task) => task.type === "item")
    expect(nextActions.length).toBeGreaterThan(0)
    expect(listItems.length).toBeGreaterThan(0)
    for (const task of nextActions) expectNextActionTask(task)
    for (const item of listItems) expectListItem(item)
    expect(tasks.find((task) => task.id === "demo-film-tide")?.estimatedDuration).toBeUndefined()
    expect(tasks.find((task) => task.id === "demo-missed-bird")?.estimatedDuration).toBe(45)

    const proof = tasks.find((task) => task.id === "demo-op-press-ink")
    expect(proof?.type).toBe("task")
    expect(proof?.attributes && Object.keys(proof.attributes).length).toBeGreaterThan(0)
    expect(proof?.attributes?.proofSheets).toBe(3)
    const definition = proof?.itemAttributeDefinitions?.find((item) => item.id === "proofSheets")
    expect(definition).toMatchObject({ name: "Proof sheets", type: "number" })
    expect(definition?.type === "list" && definition.name === "Objectives").toBe(false)

    const lists = extraLists(now)
    expect(lists.some((list) => list.name === "Objectives")).toBe(false)
    const seededTypes = new Set(tasks.map((task) => task.type).filter(Boolean))
    const typed = lists.find((list) => list.itemTypeId && seededTypes.has(list.itemTypeId))
    expect(typed?.itemTypeId).toBe("shopping")
    expect(typed?.id).toBe("list-shopping")
    for (const list of lists) {
      expect(list.id).toBeTruthy()
      expect(list.name).toBeTruthy()
      expect(list.color).toBeTruthy()
      expect(list.createdAt).toBeInstanceOf(Date)
      expect(typeof list.scheduleable).toBe("boolean")
    }
  })

  it("fills the same fields when a base row arrives without them", () => {
    const [task] = deepenBaseTasks(
      [
        {
          id: "bare-task",
          description: "Label the hold shelf",
          type: "task",
          createdAt: now,
          completed: false,
          lists: ["list-work"],
        } as Task,
      ],
      now,
    )
    expectNextActionTask(task)

    const [item] = deepenBaseTasks(
      [
        {
          id: "bare-item",
          description: "Cedar stamp",
          type: "item",
          createdAt: now,
          completed: false,
          lists: ["list-studio"],
          rewardValue: 20,
        } as Task,
      ],
      now,
    )
    expectListItem(item)
  })
})

function expectNextActionTask(task: Task) {
  expect(task.type).toBe("task")
  expect(task.stage).toBeTruthy()
  expect(typeof task.rewardValue).toBe("number")
  expect(typeof task.estimatedDuration).toBe("number")
  expect(typeof task.cognitiveLoad).toBe("number")
  expect(typeof task.urgency).toBe("number")
  expect(typeof task.importance).toBe("number")
  expect(typeof task.context).toBe("string")
  expect(task.context!.length).toBeGreaterThan(0)
  expect(typeof task.entropy).toBe("number")
  expect(typeof task.allowPartialCompletion).toBe("boolean")
  expect(typeof task.minimumChunkSize).toBe("number")
  expect(Array.isArray(task.dependencies)).toBe(true)
  expect(Array.isArray(task.lists)).toBe(true)
  expect(Array.isArray(task.tags)).toBe(true)
  expect(Array.isArray(task.links)).toBe(true)
  expect(Array.isArray(task.subtasks)).toBe(true)
  expect(task.title).toBe(task.description)
}

function expectListItem(task: Task) {
  expect(task.type).toBe("item")
  expect(task.stage).toBeTruthy()
  expect(task.rewardValue).toBe(1)
  expect(Array.isArray(task.tags)).toBe(true)
  expect(Array.isArray(task.links)).toBe(true)
  expect(Array.isArray(task.subtasks)).toBe(true)
  expect(Array.isArray(task.lists)).toBe(true)
  expect(task.title).toBe(task.description)
  expect(typeof task.completed).toBe("boolean")
  expect(task.createdAt).toBeInstanceOf(Date)
}
