import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { buildTodoItems } from "../todo-utils"
import { ritualBoardFor, lockedHiddenByPeriodFor, openRitualBoardFor, sessionPickList, sunHiddenCountFor } from "./phone-lists"

const day = new Date(2026, 9, 27, 12, 0, 0)
const sunset = 18 * 60

function task(overrides: Partial<Task>): Task {
  return {
    id: "mail-masters",
    title: "Mail the masters",
    description: "Mail the masters",
    type: "task",
    stage: "scheduled",
    createdAt: day,
    completed: false,
    lists: [],
    tags: [],
    links: [],
    subtasks: [],
    rewardValue: 1,
    estimatedDuration: 45,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 4,
    context: "@errand",
    entropy: 0.4,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...overrides,
  }
}

function titles(board: { tasks: { title?: string }[] }) {
  return board.tasks.map((row) => row.title)
}

describe("openRitualBoardFor", () => {
  it("hides Night until sunset and Morning after sunset while it is not done", () => {
    const board = ritualBoardFor(day, [], [], null)
    const afternoon = new Date(2026, 9, 27, 15, 0, 0)
    const evening = new Date(2026, 9, 27, 19, 0, 0)

    const before = openRitualBoardFor(board, true, false, afternoon, sunset)
    expect(titles(before)).toContain("Morning ritual")
    expect(titles(before)).not.toContain("Night ritual")
    expect(sunHiddenCountFor(board, true, afternoon, sunset)).toBe(1)

    const after = openRitualBoardFor(board, true, false, evening, sunset)
    expect(titles(after)).toContain("Night ritual")
    expect(titles(after)).not.toContain("Morning ritual")
    expect(sunHiddenCountFor(board, true, evening, sunset)).toBe(1)

    const started = {
      ...board,
      tasks: board.tasks.map((row) =>
        row.title === "Morning ritual" ? { ...row, status: "partial" as const } : row,
      ),
    }
    expect(titles(openRitualBoardFor(started, true, false, evening, sunset))).toEqual(
      expect.arrayContaining(["Morning ritual", "Night ritual"]),
    )

    expect(titles(openRitualBoardFor(board, false, false, evening, sunset))).toEqual(
      expect.arrayContaining(["Morning ritual", "Night ritual"]),
    )
    expect(titles(openRitualBoardFor(board, true, true, evening, sunset))).toEqual(
      expect.arrayContaining(["Morning ritual", "Night ritual"]),
    )
    expect(sunHiddenCountFor(board, false, evening, sunset)).toBe(0)
  })
})

describe("sessionPickList", () => {
  const tasks = [
    task({ id: "today", title: "Mail the masters", description: "Mail the masters", scheduledDate: day }),
    task({
      id: "tomorrow",
      title: "Call the plant",
      description: "Call the plant",
      scheduledDate: new Date(2026, 9, 28, 12, 0, 0),
    }),
    task({
      id: "done",
      title: "Printed the sleeves",
      description: "Printed the sleeves",
      completed: true,
      status: "done",
      scheduledDate: day,
    }),
    task({
      id: "late",
      title: "Missed the courier",
      description: "Missed the courier",
      status: "missed",
      scheduledDate: day,
    }),
  ]

  it("keeps completed and cleared work off the session list, and a season is every open task", () => {
    expect(sessionPickList({ sessionOpen: false, tasks, periodTab: "day", focusedDate: day })).toEqual({
      label: "",
      tasks: [],
    })
    const today = sessionPickList({ sessionOpen: "list", tasks, periodTab: "day", focusedDate: day })
    expect(today.label).toBe("This day")
    expect(today.tasks.map((row) => row.id)).toEqual(["today"])
    const season = sessionPickList({ sessionOpen: "session", tasks, periodTab: "quarter", focusedDate: day })
    expect(season.label).toBe("All open tasks")
    expect(season.tasks.map((row) => row.id)).toEqual(["today", "tomorrow"])
  })
})

describe("lockedHiddenByPeriodFor", () => {
  it("counts rows Hide locked holds back only when Available now is off", () => {
    const tasks = [
      task({ id: "ready", title: "Mail the masters", description: "Mail the masters", scheduledDate: day }),
      task({
        id: "blocked",
        title: "Ship the test press",
        description: "Ship the test press",
        scheduledDate: day,
        dependencies: ["open-dep"],
      }),
      task({ id: "open-dep", title: "Cut the lacquers", description: "Cut the lacquers", completed: false }),
    ]
    const withItems = {
      todoItems: buildTodoItems(tasks, false, day),
      showAllTasks: false,
      focusedDate: day,
      tasks,
      statusFilter: "open" as const,
    }

    expect(lockedHiddenByPeriodFor({ ...withItems, hideLocked: true, availableNow: false }).day).toBe(1)
    expect(lockedHiddenByPeriodFor({ ...withItems, hideLocked: true, availableNow: true }).day).toBe(0)
    expect(lockedHiddenByPeriodFor({ ...withItems, hideLocked: false, availableNow: false }).day).toBe(0)
  })
})
