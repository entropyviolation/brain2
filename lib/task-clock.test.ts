/**
 * lib/task-clock.test.ts — a task (and step) riding the Tracking pen clock
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { undoLastAction } from "@/lib/action-history"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Subtask, Task } from "@/lib/types"
import { parseObjectiveClock } from "@/lib/now-objective"
import {
  addPenColorNowObjective,
  startPenColorSession,
  stopPenColorSession,
  tickPenColorSession,
  tiePenColorNowObjective,
  togglePenColorNowObjectiveComplete,
} from "./pen-color-session"
import { usePenColorSessionStore } from "./pen-color-session-store"
import { taskActualAccount, stepSpentMinutes } from "./tracked-time"
import { clockPenFor, isTaskOnClock, startTaskClock, stopTaskClock, stopTaskSubclock, stepPenLinks, assignTaskOnClock, completeClockStep, finishClockTask } from "./task-clock"
import { WORKING_ON_NOW_NOTE_PREFIX } from "./task-clock-log"

const AT = new Date(2026, 9, 15, 20, 24, 0)
const later = (min: number) => new Date(AT.getTime() + min * 60_000)

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

function seed(extra: Partial<Task> = {}) {
  useTaskStore.getState().setTasks([
    {
      id: "cds",
      description: "Finish CDs",
      stage: "scheduled",
      createdAt: AT,
      completed: false,
      lists: [],
      subtasks: [
        s("inside holder", { subtasks: [s("confirm wood"), s("confirm hidden message")] }),
        s("find and place good photos on the wood", { estimatedDuration: 20 }),
      ],
      ...extra,
    },
  ])
}

const task = () => useTaskStore.getState().tasks.find((t) => t.id === "cds")!
const session = () => usePenColorSessionStore.getState().session

beforeEach(() => {
  resetAllStores()
})

describe("startTaskClock", () => {
  it("asks for a pen when the task has none and nothing is running", () => {
    seed()
    expect(startTaskClock("cds", { now: AT }).kind).toBe("needs-pen")
    expect(session()).toBeNull()
  })

  it("starts the chosen pen, remembers it, and marks blocks with task and step", () => {
    seed()
    const result = startTaskClock("cds", { stepId: "confirm wood", penId: "act-exercise", rememberPen: true, now: AT })
    expect(result.kind).toBe("started")
    expect(clockPenFor(task())?.penId).toBe("act-exercise")
    expect(session()).toMatchObject({ taskId: "cds", stepId: "confirm wood", title: "Finish CDs" })
    expect(task().status).toBe("partial")
    const entry = useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")
    expect(entry).toMatchObject({ taskId: "cds", stepId: "confirm wood", title: "Finish CDs" })
    expect(session()!.nowObjectives?.[0]).toMatchObject({ text: "confirm wood", stepId: "confirm wood" })
    expect(isTaskOnClock("cds", "confirm wood")).toBe(true)
  })

  it("switching step on the same pen keeps one block and stamps the step", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { stepId: "confirm wood", now: AT })
    tickPenColorSession(later(10))
    startTaskClock("cds", { stepId: "confirm hidden message", now: later(10) })
    const blocks = useTimeTrackingStore.getState().entries.filter((e) => e.penId === "act-exercise")
    expect(blocks).toHaveLength(1)
    expect(session()!.stepId).toBe("confirm hidden message")
    expect(session()!.nowObjectives?.map((o) => o.stepId)).toEqual(["confirm wood", "confirm hidden message"])
  })

  it("Stop logs the span on the task with the step and the painted entry ids", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { stepId: "confirm wood", now: AT })
    tickPenColorSession(later(23))
    stopPenColorSession(later(23))
    const log = task().timeLogs?.[0]
    expect(log).toMatchObject({ durationMinutes: 23, stepId: "confirm wood", taskId: "cds", startTime: "20:24" })
    expect(log?.entryIds?.length).toBeGreaterThan(0)
    expect(log?.notes).toBe(
      "added from Working On Now, task: Finish CDs subtasks completed: none objectives completed: none",
    )
  })

  it("a step played while the task clock is running starts its own timer", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { now: AT })
    const started = session()!.startedAt
    startTaskClock("cds", { stepId: "confirm wood", now: later(10) })
    startTaskClock("cds", { stepId: "inside holder", now: later(8) })
    expect(session()!.startedAt).toBe(started)
    expect(session()!.stepId).toBeUndefined()
    expect(session()!.subclocks?.map((row) => row.stepId)).toEqual(["confirm wood", "inside holder"])
    expect(session()!.nowObjectives ?? []).toEqual([])
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.penId === "act-exercise")).toHaveLength(1)

    stopTaskSubclock("confirm wood", later(15))
    expect(session()?.taskId).toBe("cds")
    expect(session()?.startedAt).toBe(started)
    expect(session()?.subclocks?.map((row) => row.stepId)).toEqual(["inside holder"])
    expect(task().timeLogs).toMatchObject([{ stepId: "confirm wood", durationMinutes: 5 }])

    stopTaskClock(undefined, later(20))
    expect(session()).toBeNull()
    const logs = task().timeLogs ?? []
    expect(logs.map((row) => row.stepId)).toEqual(["confirm wood", "inside holder", undefined])
    expect(logs[1]).toMatchObject({ durationMinutes: 12 })
    expect(logs[2]).toMatchObject({ durationMinutes: 20 })
    const entries = useTimeTrackingStore.getState().entries.filter((e) => e.taskId === "cds")
    expect(taskActualAccount(task(), entries).total).toBe(20)
    expect(stepSpentMinutes(task(), "confirm wood", entries)).toBe(5)
    expect(stepSpentMinutes(task(), "inside holder", entries)).toBe(12)
  })

  it("a plain pen clock still writes nothing on any task", () => {
    seed()
    startTaskClock("cds", { penId: "act-exercise", now: AT })
    usePenColorSessionStore.getState().setSession({ ...session()!, taskId: undefined, stepId: undefined })
    stopPenColorSession(later(30))
    expect(task().timeLogs).toBeUndefined()
  })
})

describe("objectives tied to steps", () => {
  beforeEach(() => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { now: AT })
  })

  it("a typed objective that names a step is tied to it, with its clock", () => {
    addPenColorNowObjective("NOW 847 looking for photos of band", later(30))
    const row = session()!.nowObjectives!.at(-1)!
    expect(row.text).toBe("looking for photos of band")
    expect(new Date(row.addedAt).getHours()).toBe(20)
    expect(new Date(row.addedAt).getMinutes()).toBe(47)
    // "photos" alone is not a step name; nothing is tied.
    expect(row.stepId).toBeUndefined()
    addPenColorNowObjective("confirm wood", later(31))
    expect(session()!.nowObjectives!.at(-1)!.stepId).toBe("confirm wood")
  })

  it("ticking a tied objective ticks the step with its own minutes, and unticking reopens it", () => {
    addPenColorNowObjective("confirm wood", AT, undefined, "now")
    const id = session()!.nowObjectives!.at(-1)!.id
    togglePenColorNowObjectiveComplete(id, later(12))
    const wood = task().subtasks![0].subtasks![0]
    expect(wood).toMatchObject({ completed: true, actualDuration: 12 })
    togglePenColorNowObjectiveComplete(id, later(13))
    expect(task().subtasks![0].subtasks![0].completed).toBe(false)
  })

  it("a free objective can become a new step, or be tied to an existing one", () => {
    addPenColorNowObjective("sketch the spine", AT)
    const free = session()!.nowObjectives!.at(-1)!
    tiePenColorNowObjective(free.id, "new")
    const made = task().subtasks!.find((st) => st.description === "sketch the spine")
    expect(made).toBeTruthy()
    expect(session()!.nowObjectives!.at(-1)!.stepId).toBe(made!.id)

    addPenColorNowObjective("misc", AT)
    const other = session()!.nowObjectives!.at(-1)!
    tiePenColorNowObjective(other.id, "confirm hidden message")
    expect(session()!.nowObjectives!.at(-1)!.stepId).toBe("confirm hidden message")
  })
})

describe("parseObjectiveClock", () => {
  const now = new Date(2026, 9, 15, 21, 0)
  it("reads NOW 847 as the latest 8:47 before now", () => {
    const parsed = parseObjectiveClock("NOW 847 looking for photos", now)
    expect(parsed.text).toBe("looking for photos")
    expect(parsed.at?.getHours()).toBe(20)
  })
  it("reads 8:24 without now, and leaves bare numbers alone", () => {
    expect(parseObjectiveClock("8:24 doing cd inside", now).at?.getHours()).toBe(20)
    expect(parseObjectiveClock("1500 words", now)).toEqual({ text: "1500 words" })
  })
  it("honours am/pm and rolls to yesterday when the time is still ahead", () => {
    expect(parseObjectiveClock("now 9:30pm call", now).at?.getDate()).toBe(14)
  })
})

describe("stepPenLinks", () => {
  const a = { scopeId: "s", penId: "a" }
  const b = { scopeId: "s", penId: "b" }
  const t = {
    penLinks: [a],
    subtasks: [{ id: "p", description: "P", completed: false, penLinks: [b], subtasks: [{ id: "c", description: "C", completed: false }] }, { id: "q", description: "Q", completed: false, penLinks: [] }],
  }
  it("inherits from the nearest parent, then the task; [] is no pen", () => {
    expect(stepPenLinks(t, "c")).toMatchObject({ links: [b], own: false })
    expect(stepPenLinks(t, "p")).toMatchObject({ links: [b], own: true })
    expect(stepPenLinks(t, "q").links).toEqual([])
    expect(stepPenLinks({ ...t, subtasks: [] }, "x")).toMatchObject({ links: [a], from: null })
  })
})

describe("the task on a clock that is already running", () => {
  it("keeps the one block, names it in the note, and logs that note on the task", () => {
    seed()
    startPenColorSession("act-exercise", AT)
    assignTaskOnClock("cds", "confirm wood")
    const row = session()!.nowObjectives!.find((item) => item.stepId === "confirm wood")!
    togglePenColorNowObjectiveComplete(row.id, later(6))
    stopPenColorSession(later(6))

    const entry = useTimeTrackingStore.getState().entries.find((e) => e.penId === "act-exercise")!
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.penId === "act-exercise")).toHaveLength(1)
    expect(entry.notes).toContain(`${WORKING_ON_NOW_NOTE_PREFIX}, task: Finish CDs`)
    expect(entry.notes).toContain("subtasks completed: confirm wood")
    expect(entry.notes).toContain("objectives completed: confirm wood")
    expect(entry).toMatchObject({ taskId: "cds", stepId: "confirm wood" })
    const log = task().timeLogs?.[0]
    expect(log?.notes).toBe(entry.notes)
    expect(log?.stepId).toBe("confirm wood")
    expect(log?.taskId).toBe("cds")
  })

  it("finishes the current step and moves to the next open one", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { stepId: "confirm wood", now: AT })
    completeClockStep("confirm wood")
    const wood = task().subtasks![0].subtasks!.find((step) => step.id === "confirm wood")
    expect(wood?.completed).toBe(true)
    expect(session()!.stepId).toBe("confirm hidden message")
  })

  it("completes the task and stops the clock as one undo", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    startTaskClock("cds", { now: AT })
    finishClockTask(false, later(3))
    expect(session()).toBeNull()
    expect(task().completed).toBe(true)
    undoLastAction()
    expect(task().completed).toBe(false)
    expect(session()?.taskId).toBe("cds")
  })
})
