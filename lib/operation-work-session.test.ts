/**
 * lib/operation-work-session.test.ts — live "working on this now" sessions
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { countsInDone } from "@/lib/item-utils"
import { buildDoneTodoItems } from "@/components/Home/ToDo/todo-utils"
import {
  formatElapsedClock,
  pauseWorkingOnOperation,
  resumeWorkingOnOperation,
  sessionElapsedMs,
  splitIntoDaySlices,
  startWorkingOnOperation,
  stopWorkingOnOperation,
  tickWorkSession,
  toggleWorkingOnOperation,
  workedOnTitle,
  workDoneLogId,
} from "./operation-work-session"
import { useWorkSessionStore } from "./work-session-store"

function seedOperation(id = "op_1", name = "Foxtide rebuild"): void {
  useTaskStore.getState().addTask({
    id,
    description: name,
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: "active" },
    links: [],
  })
}

describe("operation work session (pure)", () => {
  it("titles the Done row as worked on {name}", () => {
    expect(workedOnTitle("Foxtide rebuild")).toBe("worked on Foxtide rebuild")
    expect(workedOnTitle("  ")).toBe("worked on operation")
  })

  it("formats a live elapsed clock", () => {
    expect(formatElapsedClock(5_000)).toBe("0:05")
    expect(formatElapsedClock(75_000)).toBe("1:15")
    expect(formatElapsedClock(3_662_000)).toBe("1:01:02")
  })

  it("subtracts pause gaps from sessionElapsedMs", () => {
    const startedAt = new Date(2026, 5, 20, 14, 30, 0).toISOString()
    const t0 = new Date(2026, 5, 20, 14, 30, 0).getTime()
    expect(sessionElapsedMs({ startedAt }, t0 + 60_000)).toBe(60_000)
    expect(
      sessionElapsedMs(
        { startedAt, pausedAt: new Date(t0 + 60_000).toISOString() },
        t0 + 120_000,
      ),
    ).toBe(60_000)
    expect(
      sessionElapsedMs(
        { startedAt, pausedAccumMs: 30_000 },
        t0 + 90_000,
      ),
    ).toBe(60_000)
  })

  it("splits a same-day span into one minute-accurate slice", () => {
    const slices = splitIntoDaySlices(
      new Date(2026, 5, 20, 14, 30, 0),
      new Date(2026, 5, 20, 16, 0, 0),
    )
    expect(slices).toEqual([
      { date: "2026-06-20", startMin: 14 * 60 + 30, endMin: 16 * 60, durationMinutes: 90 },
    ])
  })

  it("splits a span that crosses midnight onto both days", () => {
    const slices = splitIntoDaySlices(
      new Date(2026, 5, 20, 23, 30, 0),
      new Date(2026, 5, 21, 0, 45, 0),
    )
    expect(slices).toEqual([
      { date: "2026-06-20", startMin: 23 * 60 + 30, endMin: 1440, durationMinutes: 30 },
      { date: "2026-06-21", startMin: 0, endMin: 45, durationMinutes: 45 },
    ])
  })

  it("bumps a zero-length span to one minute", () => {
    const start = new Date(2026, 5, 20, 9, 0, 0)
    expect(splitIntoDaySlices(start, start)[0]?.durationMinutes).toBe(1)
  })
})

describe("operation work session (stores)", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 20, 14, 30, 0))
    seedOperation()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts a session, paints Tracking, and stops into Done + timeLogs", () => {
    expect(startWorkingOnOperation("op_1")).toMatchObject({ operationId: "op_1" })
    expect(useWorkSessionStore.getState().session?.operationId).toBe("op_1")

    const live = useTimeTrackingStore.getState().entries
    expect(live).toHaveLength(1)
    expect(live[0]?.startMin).toBe(14 * 60 + 30)
    expect(live[0]?.endMin).toBe(14 * 60 + 31)
    expect(live[0]?.title).toBe("Foxtide rebuild")

    vi.setSystemTime(new Date(2026, 5, 20, 15, 10, 0))
    stopWorkingOnOperation()

    expect(useWorkSessionStore.getState().session).toBeNull()

    const painted = useTimeTrackingStore.getState().entries
    expect(painted).toHaveLength(1)
    expect(painted[0]?.startMin).toBe(14 * 60 + 30)
    expect(painted[0]?.endMin).toBe(15 * 60 + 10)
    expect(painted[0]?.endMin - painted[0]!.startMin).toBe(40)

    const done = useTaskStore.getState().tasks.find((t) => t.loggedAction)
    expect(done?.description).toBe("worked on Foxtide rebuild")
    expect(done?.completed).toBe(true)
    expect(done?.actualDuration).toBe(40)
    expect(countsInDone(done!, [])).toBe(true)

    const dayDone = buildDoneTodoItems(useTaskStore.getState().tasks, "day", new Date(2026, 5, 20), [])
    expect(dayDone.some((row) => row.description === "worked on Foxtide rebuild")).toBe(true)
    const weekDone = buildDoneTodoItems(useTaskStore.getState().tasks, "week", new Date(2026, 5, 20), [])
    const monthDone = buildDoneTodoItems(useTaskStore.getState().tasks, "month", new Date(2026, 5, 20), [])
    expect(weekDone.some((row) => row.description === "worked on Foxtide rebuild")).toBe(true)
    expect(monthDone.some((row) => row.description === "worked on Foxtide rebuild")).toBe(true)

    const op = useTaskStore.getState().tasks.find((t) => t.id === "op_1")
    expect(op?.timeLogs).toHaveLength(1)
    expect(op?.timeLogs?.[0]?.durationMinutes).toBe(40)
    expect(op?.timeLogs?.[0]?.startTime).toBe("14:30")
    expect(op?.timeLogs?.[0]?.endTime).toBe("15:10")
    expect(op?.timeLogs?.[0]?.notes).toBe("worked on Foxtide rebuild")
  })

  it("toggles stop on the same operation", () => {
    toggleWorkingOnOperation("op_1")
    expect(useWorkSessionStore.getState().session?.operationId).toBe("op_1")
    vi.setSystemTime(new Date(2026, 5, 20, 14, 45, 0))
    toggleWorkingOnOperation("op_1")
    expect(useWorkSessionStore.getState().session).toBeNull()
    expect(useTaskStore.getState().tasks.some((t) => t.loggedAction)).toBe(true)
  })

  it("grows the Tracking block on tick without writing Done yet", () => {
    startWorkingOnOperation("op_1")
    vi.setSystemTime(new Date(2026, 5, 20, 14, 50, 0))
    tickWorkSession()
    const live = useTimeTrackingStore.getState().entries[0]
    expect(live?.endMin).toBe(14 * 60 + 50)
    expect(useTaskStore.getState().tasks.some((t) => t.loggedAction)).toBe(false)
  })

  it("pauses elapsed and does not paint while paused; resume continues", () => {
    startWorkingOnOperation("op_1")
    vi.setSystemTime(new Date(2026, 5, 20, 14, 40, 0))
    tickWorkSession()
    expect(useTimeTrackingStore.getState().entries[0]?.endMin).toBe(14 * 60 + 40)

    pauseWorkingOnOperation()
    expect(useWorkSessionStore.getState().session?.pausedAt).toBeTruthy()

    vi.setSystemTime(new Date(2026, 5, 20, 14, 55, 0))
    tickWorkSession()
    expect(useTimeTrackingStore.getState().entries[0]?.endMin).toBe(14 * 60 + 40)
    expect(sessionElapsedMs(useWorkSessionStore.getState().session!, Date.now())).toBe(10 * 60_000)

    resumeWorkingOnOperation()
    expect(useWorkSessionStore.getState().session?.pausedAt).toBeUndefined()
    expect(useWorkSessionStore.getState().session?.pausedAccumMs).toBe(15 * 60_000)

    vi.setSystemTime(new Date(2026, 5, 20, 15, 0, 0))
    tickWorkSession()
    // 10 min before pause + 5 min after resume = 15 active minutes from 14:30 → 14:45
    expect(useTimeTrackingStore.getState().entries[0]?.endMin).toBe(14 * 60 + 45)
    expect(sessionElapsedMs(useWorkSessionStore.getState().session!, Date.now())).toBe(15 * 60_000)

    stopWorkingOnOperation()
    expect(useWorkSessionStore.getState().session).toBeNull()
    expect(useTimeTrackingStore.getState().entries[0]?.endMin).toBe(14 * 60 + 45)
  })

  it("keeps the Tracking block editable after stop", () => {
    startWorkingOnOperation("op_1")
    vi.setSystemTime(new Date(2026, 5, 20, 15, 0, 0))
    stopWorkingOnOperation()
    const id = useTimeTrackingStore.getState().entries[0]!.id
    useTimeTrackingStore.getState().updateEntry(id, { notes: "rewrote the brief", startMin: 14 * 60 + 20 })
    const edited = useTimeTrackingStore.getState().entries.find((e) => e.id === id)
    expect(edited?.notes).toBe("rewrote the brief")
    expect(edited?.startMin).toBe(14 * 60 + 20)
  })

  it("paints with the operation's tracking tags so a linked habit can see the minutes", () => {
    useTaskStore.getState().updateTask({
      ...useTaskStore.getState().tasks.find((t) => t.id === "op_1")!,
      attributes: {
        [OPERATION_ATTR.stage]: "active",
        [OPERATION_ATTR.trackingTagIds]: ["tag-work"],
      },
    })
    useHabitsStore.setState({
      tasks: [
        {
          id: "habit-work",
          name: "Deep work",
          type: TaskType.GOAL,
          goal: 30,
          unit: "minutes",
          frequency: "daily",
          trackingLink: { tagIds: ["tag-work"] },
        },
      ],
    })

    startWorkingOnOperation("op_1")
    vi.setSystemTime(new Date(2026, 5, 20, 15, 0, 0))
    stopWorkingOnOperation()

    const penId = useTimeTrackingStore.getState().entries[0]?.penId
    const pen = useTimeTrackingStore
      .getState()
      .scopes.flatMap((s) => s.pens)
      .find((p) => p.id === penId)
    expect(pen?.tags).toContain("tag-work")

    const completion = useHabitsStore.getState().weeklyData["2026-06-20"]?.["habit-work"]
    expect(completion?.trackedValue).toBe(30)
  })

  it("uses a stable Done id so a second stop of the same session does not duplicate", () => {
    startWorkingOnOperation("op_1")
    const startedAt = useWorkSessionStore.getState().session!.startedAt
    vi.setSystemTime(new Date(2026, 5, 20, 15, 0, 0))
    stopWorkingOnOperation()
    const id = workDoneLogId("op_1", startedAt, "2026-06-20")
    expect(useTaskStore.getState().tasks.filter((t) => t.id === id)).toHaveLength(1)
  })
})
