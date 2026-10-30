/**
 * lib/work-pause.test.ts — a pause reason on either Working-on-now clock
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import {
  pauseWorkingOnOperation,
  resumeWorkingOnOperation,
  sessionElapsedMs,
  startWorkingOnOperation,
  stopWorkingOnOperation,
} from "@/lib/operation-work-session"
import { useWorkSessionStore } from "@/lib/work-session-store"
import {
  pausePenColorSession,
  resumePenColorSession,
  stopPenColorSession,
} from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { startTaskClock } from "@/lib/task-clock"
import { pauseClockLabel } from "@/lib/work-pause"

const AT = new Date(2026, 8, 21, 19, 36, 0)

beforeEach(() => {
  resetAllStores()
})

function seedTask(): void {
  useTaskStore.getState().addTask({
    id: "cds",
    description: "Finish CDs",
    type: "task",
    stage: "clarified",
    createdAt: AT,
    completed: false,
    lists: [],
    links: [],
  })
}

function seedOperation(): void {
  useTaskStore.getState().addTask({
    id: "op_1",
    description: "Foxtide rebuild",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: AT,
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: "active" },
    links: [],
  })
}

describe("pause reasons", () => {
  it("does not pause when the reason is missing or blank", () => {
    seedTask()
    startTaskClock("cds", { penId: "act-exercise", now: AT })
    expect(pausePenColorSession(new Date(AT.getTime() + 60_000))).toBeTruthy()
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeUndefined()
    expect(pausePenColorSession(new Date(AT.getTime() + 60_000), "   ")).toBeTruthy()
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeUndefined()
    expect(usePenColorSessionStore.getState().session?.pauseSpans).toBeUndefined()

    seedOperation()
    startWorkingOnOperation("op_1", AT)
    pauseWorkingOnOperation(new Date(AT.getTime() + 60_000), "  ")
    expect(useWorkSessionStore.getState().session?.pausedAt).toBeUndefined()
  })

  it("stores the span, resumes it, and keeps the pause out of worked time", () => {
    seedTask()
    startTaskClock("cds", { penId: "act-exercise", now: AT })
    const pausedAt = new Date(AT.getTime() + 2 * 60_000)
    pausePenColorSession(pausedAt, "coffee")
    const paused = usePenColorSessionStore.getState().session
    expect(paused?.pausedAt).toBe(pausedAt.toISOString())
    expect(paused?.pauseSpans).toEqual([{ pausedAt: pausedAt.toISOString(), reason: "coffee" }])
    expect(sessionElapsedMs(paused!, pausedAt.getTime() + 5 * 60_000)).toBe(2 * 60_000)

    const resumedAt = new Date(pausedAt.getTime() + 5 * 60_000)
    resumePenColorSession(resumedAt)
    const resumed = usePenColorSessionStore.getState().session
    expect(resumed?.pausedAt).toBeUndefined()
    expect(resumed?.pauseSpans?.[0].resumedAt).toBe(resumedAt.toISOString())
    expect(resumed?.pausedAccumMs).toBe(5 * 60_000)

    const stoppedAt = new Date(resumedAt.getTime() + 60_000)
    stopPenColorSession(stoppedAt)
    const task = useTaskStore.getState().tasks.find((row) => row.id === "cds")!
    const log = task.timeLogs?.[0]
    expect(log?.durationMinutes).toBe(3)
    expect(log?.pauseSpans).toEqual([
      { pausedAt: pausedAt.toISOString(), reason: "coffee", resumedAt: resumedAt.toISOString() },
    ])
    expect(log?.notes).toContain("added from Working On Now")
    expect(log?.notes).toContain(
      [
        `Work session ${pauseClockLabel(AT)}–${pauseClockLabel(stoppedAt)}`,
        `Paused at ${pauseClockLabel(pausedAt)} for coffee`,
        `Restarted at ${pauseClockLabel(resumedAt)}`,
        `Stopped session at ${pauseClockLabel(stoppedAt)}`,
      ].join("\n"),
    )
    const block = useTimeTrackingStore.getState().entries.find((row) => row.taskId === "cds")
    expect(block?.pauseSpans).toEqual(log?.pauseSpans)
    expect(block?.notes).toContain("Paused at")
    expect(sessionElapsedMs(
      { startedAt: AT.toISOString(), pausedAccumMs: 5 * 60_000 },
      stoppedAt.getTime(),
    )).toBe(3 * 60_000)
  })

  it("closes an open pause at stop and leaves that gap out of the operation log", () => {
    seedOperation()
    const started = new Date(2026, 5, 20, 14, 30, 0)
    startWorkingOnOperation("op_1", started)
    const pausedAt = new Date(started.getTime() + 2 * 60_000)
    pauseWorkingOnOperation(pausedAt, "a walk")
    const stoppedAt = new Date(pausedAt.getTime() + 4 * 60_000)
    const live = useWorkSessionStore.getState().session!
    expect(sessionElapsedMs(live, stoppedAt.getTime())).toBe(2 * 60_000)

    stopWorkingOnOperation(stoppedAt)
    const operation = useTaskStore.getState().tasks.find((row) => row.id === "op_1")!
    const log = operation.timeLogs?.find((row) => row.pauseSpans?.length)
    expect(log?.durationMinutes).toBe(2)
    expect(log?.pauseSpans).toEqual([
      { pausedAt: pausedAt.toISOString(), reason: "a walk", stoppedAt: stoppedAt.toISOString() },
    ])
    expect(log?.notes?.startsWith("worked on Foxtide rebuild")).toBe(true)
    expect(log?.notes).toContain(`Paused at ${pauseClockLabel(pausedAt)} for a walk`)
    expect(log?.notes).toContain(`Stopped session at ${pauseClockLabel(stoppedAt)}`)
    expect(log?.notes).not.toContain("Restarted at")
    const block = useTimeTrackingStore.getState().entries.find((row) => row.pauseSpans?.length)
    expect(block?.pauseSpans).toEqual(log?.pauseSpans)
    expect(block?.notes).toContain("Stopped session")
  })

  it("keeps a hand-written block note and appends the timeline", () => {
    seedTask()
    startTaskClock("cds", { penId: "act-exercise", now: AT })
    const entry = useTimeTrackingStore.getState().entries.find((row) => row.taskId === "cds")!
    useTimeTrackingStore.getState().updateEntry(entry.id, { notes: "kept by hand" })
    const pausedAt = new Date(AT.getTime() + 2 * 60_000)
    pausePenColorSession(pausedAt, "stretch")
    const notes = useTimeTrackingStore.getState().entries.find((row) => row.id === entry.id)?.notes
    expect(notes?.startsWith("kept by hand")).toBe(true)
    expect(notes).toContain("Paused at")
    expect(notes).toContain("for stretch")
  })
})
