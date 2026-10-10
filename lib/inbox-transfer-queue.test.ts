/**
 * Transfer to log leaves the inbox on the click and writes the notes in one pass.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { undoLastAction, redoLastAction } from "@/lib/action-history"
import { usePointsStore } from "@/lib/points-store"
import { persistKey } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"
import { prepareInboxLogTransfers } from "./inbox-transfer-log"
import {
  flushInboxLogTransfers,
  handOffInboxLogTransfers,
  resetInboxLogTransferQueue,
} from "./inbox-transfer-queue"

const SEP24_229 = new Date(2026, 8, 24, 2, 29, 41)
const SEP24_724 = new Date(2026, 8, 24, 19, 24, 0)

function persistedTaskState(): { tasks: { id: string }[]; removedTaskIds?: string[]; restoredTaskIds?: string[] } {
  const raw = localStorage.getItem(persistKey("task-storage"))
  const parsed = JSON.parse(raw ?? "{}") as {
    state?: { tasks: { id: string }[]; removedTaskIds?: string[]; restoredTaskIds?: string[] }
  }
  return parsed.state ?? { tasks: [] }
}

function idea(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "inbox",
    createdAt: SEP24_229,
    completed: false,
    lists: [],
    estimatedDuration: 1,
    ...extra,
  }
}

beforeEach(() => {
  resetAllStores()
  resetInboxLogTransferQueue()
})

describe("inbox log transfer queue", () => {
  it("drops the rows before the write and keeps two original times in one pass", () => {
    const tasks = [
      idea("early", "total exercise", { estimatedDuration: 60 }),
      idea("late", "log need candy", { createdAt: SEP24_724 }),
      idea("stay", "leave me"),
    ]
    useTaskStore.setState({ tasks })
    const prepared = prepareInboxLogTransfers(tasks, ["early", "late"])
    let writes = 0
    const setState = useTimeTrackingStore.setState
    useTimeTrackingStore.setState = ((...args: Parameters<typeof setState>) => {
      const partial = args[0]
      const next = typeof partial === "function" ? partial(useTimeTrackingStore.getState()) : partial
      if (next && typeof next === "object" && "entries" in next) writes += 1
      return setState(...args)
    }) as typeof setState
    try {
      expect(handOffInboxLogTransfers(prepared)).toEqual(["early", "late"])
      expect(useTaskStore.getState().tasks.map((task) => task.id)).toEqual(["stay"])
      expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
      writes = 0
      flushInboxLogTransfers()
      expect(writes).toBe(1)
    } finally {
      useTimeTrackingStore.setState = setState
    }
    const entries = useTimeTrackingStore.getState().entries
    expect(entries.find((entry) => entry.title === "total exercise 60m")).toMatchObject({
      date: "2026-09-24",
      startMin: 2 * 60 + 29,
      kind: "instant",
      generatedBy: { kind: "text", id: "2026-09-24" },
    })
    expect(entries.find((entry) => entry.title === "need candy")).toMatchObject({
      date: "2026-09-24",
      startMin: 19 * 60 + 24,
      kind: "instant",
    })
    expect(entries.filter((entry) => entry.kind === "instant")).toHaveLength(2)
  })

  it("joins a second selection into the same write", () => {
    useTaskStore.setState({
      tasks: [
        idea("early", "total exercise", { estimatedDuration: 60 }),
        idea("late", "need candy", { createdAt: SEP24_724 }),
      ],
    })
    const first = prepareInboxLogTransfers(useTaskStore.getState().tasks, ["early"])
    handOffInboxLogTransfers(first)
    const second = prepareInboxLogTransfers(useTaskStore.getState().tasks, ["late"])
    expect(handOffInboxLogTransfers(second)).toEqual(["late"])
    expect(handOffInboxLogTransfers(second)).toEqual([])
    let writes = 0
    const setState = useTimeTrackingStore.setState
    useTimeTrackingStore.setState = ((...args: Parameters<typeof setState>) => {
      const partial = args[0]
      const next = typeof partial === "function" ? partial(useTimeTrackingStore.getState()) : partial
      if (next && typeof next === "object" && "entries" in next) writes += 1
      return setState(...args)
    }) as typeof setState
    try {
      flushInboxLogTransfers()
    } finally {
      useTimeTrackingStore.setState = setState
    }
    expect(writes).toBe(1)
    expect(useTimeTrackingStore.getState().entries.map((entry) => entry.title).sort()).toEqual([
      "need candy",
      "total exercise 60m",
    ])
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })

  it("undo before the write restores the ideas and leaves no note", () => {
    useTaskStore.setState({ tasks: [idea("early", "need candy")] })
    handOffInboxLogTransfers(prepareInboxLogTransfers(useTaskStore.getState().tasks, ["early"]))
    expect(undoLastAction()).toBe(true)
    flushInboxLogTransfers()
    expect(useTaskStore.getState().tasks.map((task) => task.id)).toEqual(["early"])
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    const disk = persistedTaskState()
    expect(disk.tasks.map((task) => task.id)).toContain("early")
    expect(disk.removedTaskIds ?? []).not.toContain("early")
    expect(disk.restoredTaskIds).toBeUndefined()
  })

  it("undo after the write drops the note, and redo does not duplicate it", () => {
    useTaskStore.setState({ tasks: [idea("early", "need candy")] })
    handOffInboxLogTransfers(prepareInboxLogTransfers(useTaskStore.getState().tasks, ["early"]))
    flushInboxLogTransfers()
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(undoLastAction()).toBe(true)
    expect(useTaskStore.getState().tasks.map((task) => task.id)).toEqual(["early"])
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(redoLastAction()).toBe(true)
    flushInboxLogTransfers()
    const notes = useTimeTrackingStore.getState().entries.filter((entry) => entry.title === "need candy")
    expect(notes).toHaveLength(1)
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })

  it("puts the row back when the log write throws", () => {
    useTaskStore.setState({ tasks: [idea("early", "need candy"), idea("stay", "leave me")] })
    usePointsStore.setState({ pointsHistory: [] })
    const prepared = prepareInboxLogTransfers(useTaskStore.getState().tasks, ["early"])
    const failures: string[][] = []
    handOffInboxLogTransfers(prepared, {
      onFailure: ({ tasks }) => failures.push(tasks.map((task) => task.id)),
    })
    const setState = useTimeTrackingStore.setState
    useTimeTrackingStore.setState = ((...args: Parameters<typeof setState>) => {
      const partial = args[0]
      const next = typeof partial === "function" ? partial(useTimeTrackingStore.getState()) : partial
      if (next && typeof next === "object" && "entries" in next) throw new Error("disk")
      return setState(...args)
    }) as typeof setState
    try {
      flushInboxLogTransfers()
    } finally {
      useTimeTrackingStore.setState = setState
    }
    expect(failures).toEqual([["early"]])
    expect(useTaskStore.getState().tasks.map((task) => task.id).sort()).toEqual(["early", "stay"])
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(useTaskStore.getState().removedTaskIds ?? []).not.toContain("early")
    const disk = persistedTaskState()
    expect(disk.tasks.map((task) => task.id)).toContain("early")
    expect(disk.removedTaskIds ?? []).not.toContain("early")
  })
})
