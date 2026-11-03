/** The pen clock and a painting session pause, resume and stop together (2026-10-22). */
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { addLine, emptySession, parkSession, pauseSession, resumeParked, startSession } from "./session-plan"
import { useSessionPlanStore } from "./session-plan-store"
import { usePenColorSessionStore } from "./pen-color-session-store"
import { pausePenColorSession, resumePenColorSession } from "./pen-color-session"
import { linkSessionAndPen } from "./session-pen"
import { startTaskClock } from "./task-clock"
import { useTaskStore } from "./task-store"

const T0 = new Date(2026, 9, 22, 9, 0, 0)
const tasks: Task[] = [{ id: "inbox", description: "inbox", stage: "scheduled", createdAt: T0, completed: false, lists: [], estimatedDuration: 20 }]
const unlink = linkSessionAndPen()
afterAll(() => unlink())

const plan = () => useSessionPlanStore.getState().open[0]
const pen = () => usePenColorSessionStore.getState().session

beforeEach(() => {
  resetAllStores()
  const running = startSession({ ...addLine(emptySession(T0, 60), "min", { taskId: "inbox" }, tasks), paint: true }, tasks, T0)
  useSessionPlanStore.getState().put(running, T0)
  useTaskStore.getState().setTasks(tasks)
  expect(startTaskClock("inbox", { penId: "act-exercise", now: new Date() }).kind).toBe("started")
})

describe("linkSessionAndPen", () => {
  it("pausing and resuming the pen does the same to the session", () => {
    pausePenColorSession(new Date(), "coffee")
    expect(plan().clock?.running).toBe(false)
    resumePenColorSession()
    expect(plan().clock?.running).toBe(true)
  })

  it("pausing the session pauses the pen, parking keeps it (paused), resuming runs both", () => {
    useSessionPlanStore.getState().put(pauseSession(plan(), new Date()), new Date())
    expect(pen()?.pausedAt).toBeTruthy()
    resumePenColorSession()
    expect(plan().clock?.running).toBe(true)
    useSessionPlanStore.getState().put(parkSession(plan(), new Date()), new Date())
    expect(pen()?.taskId).toBe("inbox")
    expect(pen()?.pausedAt).toBeTruthy()
    useSessionPlanStore.getState().put(resumeParked(plan(), tasks, new Date()), new Date())
    expect(pen()?.pausedAt).toBeUndefined()
  })

  it("stopping the pen lets go of the session's line", () => {
    expect(plan().activeLineId).toBeTruthy()
    usePenColorSessionStore.getState().setSession(null)
    expect(plan().activeLineId).toBeUndefined()
    expect(plan().clock?.running).toBe(true)
  })
})
