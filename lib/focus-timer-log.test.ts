/**
 * lib/focus-timer-log.test.ts — Module focus timer timeLogs (store mocks only)
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Task, TimeLogEntry } from "@/lib/types"
import { taskRepository } from "@/lib/data/task-repository"
import { useWorkSessionStore } from "@/lib/work-session-store"
import {
  FOCUS_TIMER_ACTIVITY,
  appendFocusTimerTimeLogs,
  completeFocusTimer,
  focusTimerLogId,
  focusTimerPickOptions,
  resolveFocusTimerTaskId,
} from "./focus-timer-log"

vi.mock("@/lib/data/task-repository", () => ({
  taskRepository: {
    getById: vi.fn(),
    update: vi.fn((item: Task) => item),
    getAll: vi.fn(() => []),
  },
}))

vi.mock("@/lib/work-session-store", () => ({
  useWorkSessionStore: {
    getState: vi.fn(() => ({ session: null })),
  },
}))

vi.mock("@/lib/action-history", () => ({
  runAsAction: (_label: string, fn: () => unknown) => fn(),
}))

function operation(id = "op_1"): Task {
  return {
    id,
    description: "Foxtide rebuild",
    title: "Foxtide rebuild",
    type: "operation",
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    links: [],
    timeLogs: [],
  }
}

function openTask(id = "t_open"): Task {
  return {
    id,
    description: "Write intro",
    title: "Write intro",
    type: "task",
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    links: [],
    timeLogs: [],
  }
}

describe("focus timer log", () => {
  const getById = vi.mocked(taskRepository.getById)
  const update = vi.mocked(taskRepository.update)
  const getState = vi.mocked(useWorkSessionStore.getState)

  beforeEach(() => {
    getById.mockReset()
    update.mockReset()
    update.mockImplementation((item) => item)
    getState.mockReturnValue({ session: null } as ReturnType<typeof useWorkSessionStore.getState>)
  })

  it("builds a stable id per item, start, and day", () => {
    expect(focusTimerLogId("op_1", "2026-06-20T21:05:00.000Z", "2026-06-20")).toBe(
      "focus-log-op_1-2026-06-20T21:05:00.000Z-2026-06-20",
    )
  })

  it("asks which item when Working Now is idle", () => {
    expect(resolveFocusTimerTaskId()).toBeNull()
    expect(completeFocusTimer(25).needsPick).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it("appends a timeLogs slice to Working Now's task on complete", () => {
    const op = operation()
    getState.mockReturnValue({ session: { operationId: "op_1" } } as ReturnType<typeof useWorkSessionStore.getState>)
    getById.mockReturnValue(op)

    const result = completeFocusTimer(25, new Date(2026, 5, 20, 14, 30, 0))
    expect(result.needsPick).toBe(false)
    expect(result.taskId).toBe("op_1")
    expect(result.logs).toHaveLength(1)
    expect(result.logs?.[0]).toMatchObject({
      date: "2026-06-20",
      startTime: "14:05",
      endTime: "14:30",
      durationMinutes: 25,
      notes: FOCUS_TIMER_ACTIVITY,
      activityLabel: FOCUS_TIMER_ACTIVITY,
      taskId: "op_1",
    })
    expect(update).toHaveBeenCalledTimes(1)
    const written = update.mock.calls[0][0]
    expect(written.timeLogs).toHaveLength(1)
    expect(written.actualDuration).toBe(25)
  })

  it("does not stop Working Now", () => {
    const op = operation()
    getState.mockReturnValue({ session: { operationId: "op_1" } } as ReturnType<typeof useWorkSessionStore.getState>)
    getById.mockReturnValue(op)
    completeFocusTimer(10, new Date(2026, 5, 20, 14, 30, 0))
    expect(getState).toHaveBeenCalled()
    expect(getState()).toMatchObject({ session: { operationId: "op_1" } })
  })

  it("splits a midnight-crossing focus block onto both days", () => {
    const op = operation()
    getById.mockReturnValue(op)
    const logs = appendFocusTimerTimeLogs({
      taskId: "op_1",
      durationMinutes: 25,
      endedAt: new Date(2026, 5, 21, 0, 10, 0),
    })
    expect(logs?.map((l: TimeLogEntry) => ({ date: l.date, durationMinutes: l.durationMinutes }))).toEqual([
      { date: "2026-06-20", durationMinutes: 15 },
      { date: "2026-06-21", durationMinutes: 10 },
    ])
  })

  it("lists open operations first, then other open items, skipping Done and logged actions", () => {
    const options = focusTimerPickOptions([
      operation(),
      openTask(),
      { ...openTask("t_done"), completed: true, title: "Already shipped", description: "Already shipped" },
      { ...openTask("t_log"), loggedAction: true, completed: true, title: "worked on something", description: "worked on something" },
    ])
    expect(options.map((o) => o.id)).toEqual(["op_1", "t_open"])
  })

  it("writes onto a picked item when there is no live session", () => {
    const task = openTask()
    getById.mockImplementation((id) => (id === "t_open" ? task : undefined))
    const logs = appendFocusTimerTimeLogs({
      taskId: "t_open",
      durationMinutes: 5,
      endedAt: new Date(2026, 5, 20, 14, 30, 0),
    })
    expect(logs).toHaveLength(1)
    expect(update.mock.calls[0][0].id).toBe("t_open")
    expect(update.mock.calls[0][0].timeLogs?.[0]?.durationMinutes).toBe(5)
  })
})
