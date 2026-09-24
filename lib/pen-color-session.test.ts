/**
 * lib/pen-color-session.test.ts — live pen-color "working on right now"
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { undoLastAction } from "@/lib/action-history"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { sessionElapsedMs, startWorkingOnOperation } from "@/lib/operation-work-session"
import {
  pausePenColorSession,
  resumePenColorSession,
  startPenColorSession,
  stopPenColorSession,
  tickPenColorSession,
} from "./pen-color-session"
import { usePenColorSessionStore } from "./pen-color-session-store"

const AT = new Date(2026, 8, 21, 19, 36, 47)

beforeEach(() => {
  resetAllStores()
})

describe("pen color session", () => {
  it("starts at the current second and paints that pen's minute", () => {
    const session = startPenColorSession("act-exercise", AT)
    expect(session?.startedAt).toBe(AT.toISOString())
    expect(session?.scopeId).toBe("activity")
    expect(session?.title).toBe("Exercise")

    const entry = useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")
    expect(entry).toMatchObject({
      date: formatLocalDateKey(AT),
      scopeId: "activity",
      startMin: 19 * 60 + 36,
      title: "Exercise",
    })
    expect(entry!.endMin).toBeGreaterThan(entry!.startMin)
    expect(useTaskStore.getState().tasks.some((t) => /worked on/i.test(t.description))).toBe(false)
  })

  it("grows the block while the timer runs and keeps it after stop", () => {
    startPenColorSession("act-exercise", AT)
    const later = new Date(2026, 8, 21, 19, 41, 3)
    tickPenColorSession(later)
    const grown = useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")
    expect(grown).toMatchObject({ startMin: 19 * 60 + 36, endMin: 19 * 60 + 42 })

    stopPenColorSession(later)
    expect(usePenColorSessionStore.getState().session).toBeNull()
    expect(useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")).toMatchObject({
      startMin: 19 * 60 + 36,
      endMin: 19 * 60 + 42,
    })
  })

  it("pauses elapsed and does not paint while paused; resume continues", () => {
    vi.useFakeTimers()
    vi.setSystemTime(AT)
    startPenColorSession("act-exercise", AT)

    const afterWork = new Date(2026, 8, 21, 19, 41, 47)
    vi.setSystemTime(afterWork)
    tickPenColorSession(afterWork)
    expect(useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")?.endMin).toBe(
      19 * 60 + 42,
    )

    pausePenColorSession(afterWork)
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeTruthy()

    const duringPause = new Date(2026, 8, 21, 19, 50, 47)
    vi.setSystemTime(duringPause)
    tickPenColorSession(duringPause)
    expect(useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")?.endMin).toBe(
      19 * 60 + 42,
    )
    expect(sessionElapsedMs(usePenColorSessionStore.getState().session!, duringPause.getTime())).toBe(5 * 60_000)

    resumePenColorSession(duringPause)
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeUndefined()
    expect(usePenColorSessionStore.getState().session?.pausedAccumMs).toBe(9 * 60_000)

    const afterResume = new Date(2026, 8, 21, 19, 52, 47)
    vi.setSystemTime(afterResume)
    tickPenColorSession(afterResume)
    // 5 min before pause + 2 min after = 7 active → activeEnd 19:43:47 → ceil endMin 19:44
    expect(useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")?.endMin).toBe(
      19 * 60 + 44,
    )

    vi.useRealTimers()
  })

  it("keeps one span when the timer crosses midnight", () => {
    const start = new Date(2026, 8, 21, 23, 59, 30)
    startPenColorSession("loc-home", start)
    tickPenColorSession(new Date(2026, 8, 22, 0, 2, 10))
    const blocks = useTimeTrackingStore.getState().entries.filter((e) => e.penId === "loc-home")
    expect(blocks.map((e) => e.date).sort()).toEqual(["2026-09-21", "2026-09-22"])
    expect(new Set(blocks.map((e) => e.spanId)).size).toBe(1)
    expect(blocks.every((e) => e.scopeId === "location")).toBe(true)
  })

  it("does not stop an Operations working-now session", () => {
    useTaskStore.getState().addTask({
      id: "op_1",
      description: "Foxtide rebuild",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: new Date("2026-01-01"),
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "active" },
      links: [],
    })
    startWorkingOnOperation("op_1", AT)
    startPenColorSession("loc-home", AT)
    expect(useWorkSessionStore.getState().session?.operationId).toBe("op_1")
    expect(usePenColorSessionStore.getState().session?.penId).toBe("loc-home")
    expect(useTimeTrackingStore.getState().entries.some((e) => e.scopeId === "location" && e.penId === "loc-home")).toBe(
      true,
    )
  })

  it("undoes a start, and a tick is not its own undo step", () => {
    startPenColorSession("act-rest", AT)
    tickPenColorSession(new Date(2026, 8, 21, 19, 50, 0))
    expect(undoLastAction()).toBe(true)
    expect(usePenColorSessionStore.getState().session).toBeNull()
    expect(useTimeTrackingStore.getState().entries.some((e) => e.penId === "act-rest")).toBe(false)
  })

  it("clears a session whose pen was deleted", () => {
    startPenColorSession("act-rest", AT)
    useTimeTrackingStore.getState().removePen("activity", "act-rest")
    expect(tickPenColorSession(new Date(2026, 8, 21, 19, 40, 0))).toBeNull()
    expect(usePenColorSessionStore.getState().session).toBeNull()
  })
})
