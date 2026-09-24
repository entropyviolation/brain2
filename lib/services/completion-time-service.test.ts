import { beforeEach, describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { resetLocalStorage } from "@/tests/test-utils"
import { isConfirmed, isEstimated, makeEstimate } from "@/lib/estimated-values"
import {
  applyConfirmedTimes,
  confirmAllTaskTimes,
  confirmTaskTimes,
} from "@/lib/services/completion-time-service"

const NOW = new Date(2026, 8, 17, 20, 30)

function estimatedTask(id = "row"): Task {
  return {
    id,
    description: "Write at least 3 pages per day",
    type: "action",
    loggedAction: true,
    stage: "completed",
    status: "done",
    createdAt: NOW,
    completed: true,
    completedDate: NOW,
    startedAt: new Date(2026, 8, 17, 19, 50),
    actualDuration: 40,
    estimatedDuration: 40,
    lists: [],
    estimates: [
      makeEstimate("completedDate", "now", "assumed finished just now", NOW),
      makeEstimate("startedAt", "now", "assumed finished just now", NOW),
      makeEstimate("actualDuration", "rate", "4 pages × 10 min each", NOW),
    ],
  } as Task
}

describe("completion time confirmation", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("confirms the derived times as-is without changing them", () => {
    const task = estimatedTask()
    const confirmed = applyConfirmedTimes(task)
    expect(confirmed.completedDate).toEqual(task.completedDate)
    expect(confirmed.actualDuration).toBe(40)
    expect(isEstimated(confirmed.estimates, "actualDuration")).toBe(false)
    expect(isConfirmed(confirmed.estimates, "completedDate")).toBe(true)
  })

  it("stamps a correction as confirmed and slides the start to match", () => {
    const confirmed = applyConfirmedTimes(estimatedTask(), {
      completedAt: new Date(2026, 8, 17, 18, 0),
      durationMinutes: 55,
    })
    expect(confirmed.completedDate).toEqual(new Date(2026, 8, 17, 18, 0))
    expect(confirmed.actualDuration).toBe(55)
    expect(confirmed.estimatedDuration).toBe(55)
    expect(confirmed.startedAt).toEqual(new Date(2026, 8, 17, 17, 5))
    expect(isConfirmed(confirmed.estimates, "actualDuration")).toBe(true)
  })

  it("honors an explicit start instead of deriving one", () => {
    const confirmed = applyConfirmedTimes(estimatedTask(), {
      startedAt: new Date(2026, 8, 17, 17, 0),
      durationMinutes: 30,
    })
    expect(confirmed.startedAt).toEqual(new Date(2026, 8, 17, 17, 0))
  })

  it("clearing the duration drops its flag but keeps the confirmed finish time", () => {
    const confirmed = applyConfirmedTimes(estimatedTask(), { durationMinutes: 0 })
    expect(confirmed.actualDuration).toBeUndefined()
    expect(confirmed.estimates?.some((e) => e.field === "actualDuration")).toBe(false)
    expect(isConfirmed(confirmed.estimates, "completedDate")).toBe(true)
  })

  it("persists through the task store", () => {
    useTaskStore.getState().addTask(estimatedTask())
    confirmTaskTimes("row", { durationMinutes: 25 })
    const stored = useTaskStore.getState().tasks.find((t) => t.id === "row")
    expect(stored?.actualDuration).toBe(25)
    expect(isEstimated(stored?.estimates, "actualDuration")).toBe(false)
  })

  it("confirms a batch and reports how many landed", () => {
    useTaskStore.getState().addTask(estimatedTask("a"))
    useTaskStore.getState().addTask(estimatedTask("b"))
    expect(confirmAllTaskTimes(["a", "b", "missing"])).toBe(2)
    const stored = useTaskStore.getState().tasks
    expect(stored.every((t) => !isEstimated(t.estimates, "completedDate"))).toBe(true)
  })
})
