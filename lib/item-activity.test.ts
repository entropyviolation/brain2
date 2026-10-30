import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { commitItemEdit } from "@/lib/commit-item-edit"
import {
  appendItemActivity,
  diffItemActivity,
  formatHistoryLine,
  listItemActivity,
  MAX_ACTIVITY_PER_ITEM,
  recordItemWrite,
  resetItemActivity,
} from "@/lib/item-activity"
import { useItemTypeStore } from "@/lib/item-type-store"
import { setItemWriteClientForTests } from "@/lib/item-write-source"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { pausePenColorSession, resumePenColorSession, stopPenColorSession } from "@/lib/pen-color-session"
import { startWorkingOnOperation, stopWorkingOnOperation } from "@/lib/operation-work-session"
import { startTaskClock } from "@/lib/task-clock"
import { useTaskStore } from "@/lib/task-store"
import type { Subtask, Task } from "@/lib/types"

function task(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "list",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("item-activity ledger", () => {
  beforeEach(() => {
    resetItemActivity()
  })

  it("diffs name, schedule, duration, and completion", () => {
    const before = task({
      id: "a",
      description: "Draft",
      estimatedDuration: 30,
      scheduledDate: new Date("2026-09-21"),
    })
    const after = task({
      id: "a",
      description: "Ship",
      estimatedDuration: 45,
      scheduledDate: new Date("2026-09-22"),
      completed: true,
      actualDuration: 50,
    })
    const changes = diffItemActivity(before, after)
    const fields = changes.map((c) => c.field)
    expect(fields).toContain("title")
    expect(fields).toContain("estimatedDuration")
    expect(fields).toContain("scheduledDate")
    expect(fields).toContain("completed")
    expect(fields).toContain("actualDuration")
  })

  it("does not emit a row when nothing changed", () => {
    const t = task({ id: "a", description: "Same", title: "Same" })
    expect(recordItemWrite(t, { ...t, notes: t.notes })).toBeNull()
    expect(listItemActivity("a")).toEqual([])
  })

  it("records a notes edit as its own line", () => {
    const t = task({ id: "a", description: "Same", title: "Same" })
    recordItemWrite(t, { ...t, notes: "private scribble" }, undefined, new Date("2026-09-21T10:00:00.000Z"))
    const [row] = listItemActivity("a")
    expect(formatHistoryLine(row)).toContain("Notes — (empty) → private scribble")
  })

  it("appends newest-first and never rewrites older rows", () => {
    const before = task({ id: "a", description: "One", title: "One", estimatedDuration: 10 })
    const mid = task({ id: "a", description: "Two", title: "Two", estimatedDuration: 10 })
    const after = task({ id: "a", description: "Three", title: "Three", estimatedDuration: 20 })
    recordItemWrite(before, mid, undefined, new Date("2026-09-21T10:00:00.000Z"))
    recordItemWrite(mid, after, undefined, new Date("2026-09-21T11:00:00.000Z"))
    const rows = listItemActivity("a")
    expect(rows).toHaveLength(3)
    expect(rows[0].changes).toEqual([expect.objectContaining({ field: "title", from: "Two", to: "Three" })])
    expect(rows[1].changes).toEqual([expect.objectContaining({ field: "estimatedDuration", to: "20m" })])
    expect(rows[2].changes).toEqual([expect.objectContaining({ field: "title", from: "One", to: "Two" })])
    expect(rows[2].id).not.toBe(rows[0].id)
  })

  it("labels dependencies with item titles when a lookup is provided", () => {
    const a = task({ id: "a", description: "Write", dependencies: [] })
    const b = task({ id: "b", description: "Review" })
    const changes = diffItemActivity(a, { ...a, dependencies: ["b"] }, { tasks: [a, b] })
    expect(changes).toEqual([
      expect.objectContaining({ field: "dependencies", from: "(none)", to: "Review" }),
    ])
  })

  it("drops the oldest entries once the per-item cap is hit", () => {
    for (let i = 0; i < MAX_ACTIVITY_PER_ITEM + 3; i++) {
      appendItemActivity({
        itemId: "a",
        at: new Date(2026, 0, 1, 0, i).toISOString(),
        summary: `row ${i}`,
        changes: [{ field: "title", label: "Name", from: String(i), to: String(i + 1) }],
      })
    }
    const rows = listItemActivity("a")
    expect(rows).toHaveLength(MAX_ACTIVITY_PER_ITEM)
    expect(rows[rows.length - 1].summary).toBe("row 3")
  })
})

function workedOnLines(itemId: string): string[] {
  return listItemActivity(itemId)
    .map(formatHistoryLine)
    .filter((line) => line.startsWith("Worked on"))
}

describe("item history through the task writer", () => {
  beforeEach(() => {
    resetAllStores()
    resetItemActivity()
  })

  function seed(extra: Partial<Task> = {}): Task {
    const row: Task = {
      id: "wash",
      description: "Wash",
      title: "Wash",
      stage: "list",
      createdAt: new Date("2026-10-27T12:00:00.000Z"),
      completed: false,
      lists: [],
      estimatedDuration: 25,
      subtasks: [],
      ...extra,
    }
    useTaskStore.getState().addTask(row)
    resetItemActivity()
    return useTaskStore.getState().tasks.find((task) => task.id === "wash")!
  }

  it("a field change writes one accurate line", () => {
    const before = seed()
    useTaskStore.getState().updateTask({ ...before, estimatedDuration: 40 })
    const rows = listItemActivity("wash")
    expect(rows).toHaveLength(1)
    expect(formatHistoryLine(rows[0])).toContain("Estimate — 25m → 40m")
    expect(rows[0].changes[0]).toMatchObject({ field: "estimatedDuration", from: "25m", to: "40m" })
  })

  it("a no-op save writes nothing", () => {
    const before = seed({ notes: "kept" })
    useTaskStore.getState().updateTask({ ...before })
    expect(listItemActivity("wash")).toEqual([])
  })

  it("names a substep when it is added, renamed, completed, reopened, or deleted", () => {
    const before = seed()
    const rinse: Subtask = { id: "rinse", description: "Rinse", completed: false }
    useTaskStore.getState().updateTask({ ...before, subtasks: [rinse] })
    expect(formatHistoryLine(listItemActivity("wash")[0])).toContain("Substep added — “Rinse”")

    const added = useTaskStore.getState().tasks.find((task) => task.id === "wash")!
    useTaskStore.getState().updateTask({
      ...added,
      subtasks: [{ ...rinse, description: "Rinse well" }],
    })
    expect(listItemActivity("wash").map(formatHistoryLine).some((line) => line.includes("Substep renamed — “Rinse” → “Rinse well”"))).toBe(
      true,
    )

    const renamed = useTaskStore.getState().tasks.find((task) => task.id === "wash")!
    useTaskStore.getState().updateTask({
      ...renamed,
      subtasks: [{ ...rinse, description: "Rinse well", completed: true }],
    })
    expect(listItemActivity("wash").map(formatHistoryLine).some((line) => line.includes("Substep completed — “Rinse well”"))).toBe(true)

    const done = useTaskStore.getState().tasks.find((task) => task.id === "wash")!
    useTaskStore.getState().updateTask({
      ...done,
      subtasks: [{ ...rinse, description: "Rinse well", completed: false }],
    })
    expect(listItemActivity("wash").map(formatHistoryLine).some((line) => line.includes("Substep reopened — “Rinse well”"))).toBe(true)

    const open = useTaskStore.getState().tasks.find((task) => task.id === "wash")!
    useTaskStore.getState().updateTask({ ...open, subtasks: [] })
    expect(listItemActivity("wash").map(formatHistoryLine).some((line) => line.includes("Substep deleted — “Rinse well”"))).toBe(true)
  })

  it("opening the ledger twice does not duplicate a line", () => {
    const before = seed()
    useTaskStore.getState().updateTask({ ...before, notes: "once" })
    const once = listItemActivity("wash")
    expect(listItemActivity("wash")).toEqual(once)
    expect(listItemActivity("wash")).toHaveLength(1)
  })
})

describe("working-on-now sittings in item history", () => {
  const at = new Date(2026, 9, 15, 20, 24, 0)
  const later = (min: number) => new Date(at.getTime() + min * 60_000)

  beforeEach(() => {
    resetAllStores()
    resetItemActivity()
  })

  function seedTask(extra: Partial<Task> = {}) {
    useTaskStore.getState().setTasks([
      {
        id: "cds",
        description: "Finish CDs",
        title: "Finish CDs",
        stage: "scheduled",
        createdAt: at,
        completed: false,
        lists: [],
        penLinks: [{ scopeId: "activity", penId: "act-exercise" }],
        subtasks: [
          { id: "confirm wood", description: "confirm wood", completed: false },
        ],
        ...extra,
      },
    ])
    resetItemActivity()
  }

  it("stopping a pen sitting with a task writes Worked on, and a second read does not", () => {
    seedTask()
    startTaskClock("cds", { now: at })
    pausePenColorSession(later(2), "phone")
    resumePenColorSession(later(9))
    stopPenColorSession(later(12))
    const lines = workedOnLines("cds")
    expect(lines.some((line) => line.startsWith("Worked on — 5m —"))).toBe(true)
    expect(lines.filter((line) => line.startsWith("Worked on —"))).toHaveLength(1)
    expect(workedOnLines("cds")).toEqual(lines)
    stopPenColorSession(later(20))
    expect(workedOnLines("cds")).toEqual(lines)
  })

  it("stopping with a step also writes the substep line", () => {
    seedTask()
    startTaskClock("cds", { stepId: "confirm wood", now: at })
    stopPenColorSession(later(4))
    const lines = workedOnLines("cds")
    expect(lines.some((line) => line.startsWith("Worked on — 4m —"))).toBe(true)
    expect(lines.some((line) => line.startsWith("Worked on substep — confirm wood — 4m —"))).toBe(true)
    expect(workedOnLines("cds")).toEqual(lines)
  })

  it("a sitting under a minute still records, once", () => {
    seedTask()
    startTaskClock("cds", { now: at })
    stopPenColorSession(new Date(at.getTime() + 10_000))
    const lines = workedOnLines("cds")
    expect(lines).toEqual([expect.stringMatching(/^Worked on — 10s —/)])
    expect(useTaskStore.getState().tasks.find((task) => task.id === "cds")?.timeLogs).toBeUndefined()
    expect(workedOnLines("cds")).toEqual(lines)
  })

  it("an operations sitting logs on that item, and a missing item does not", () => {
    useTaskStore.getState().addTask({
      id: "op_1",
      description: "Foxtide rebuild",
      title: "Foxtide rebuild",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: at,
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "active" },
      links: [],
    })
    resetItemActivity()
    startWorkingOnOperation("op_1", at)
    stopWorkingOnOperation(later(3))
    expect(workedOnLines("op_1").some((line) => line.startsWith("Worked on —"))).toBe(true)
    const once = workedOnLines("op_1")
    expect(workedOnLines("op_1")).toEqual(once)

    resetItemActivity()
    startWorkingOnOperation("op_1", later(10))
    useTaskStore.getState().deleteTask("op_1")
    stopWorkingOnOperation(later(12))
    expect(workedOnLines("op_1")).toEqual([])
  })
})

describe("item write source", () => {
  beforeEach(() => {
    resetAllStores()
    resetItemActivity()
    setItemWriteClientForTests(() => undefined)
  })

  afterEach(() => {
    setItemWriteClientForTests(null)
  })

  it("addTask with quick add on electron persists one created line", () => {
    useTaskStore.getState().addTask(task({ id: "q", description: "Milk", title: "Milk" }), {
      surface: "quick-add",
      client: "electron",
    })
    const created = listItemActivity("q").filter((row) => row.create)
    expect(created).toHaveLength(1)
    expect(formatHistoryLine(created[0])).toContain("source quick add, electron")
    expect(formatHistoryLine(created[0]).startsWith("created ")).toBe(true)
  })

  it("updateTask and commitItemEdit with item detail on iOS name that source", () => {
    const row = task({ id: "a", description: "Same", title: "Same" })
    useTaskStore.getState().addTask(row)
    resetItemActivity()
    useTaskStore.getState().updateTask({ ...row, notes: "from the desk" }, undefined, {
      attribution: { surface: "item-detail", client: "ios" },
    })
    const updated = formatHistoryLine(listItemActivity("a")[0])
    expect(updated).toContain("Notes")
    expect(updated).toContain("source item detail, iOS")

    resetItemActivity()
    commitItemEdit("a", { notes: "from the phone" }, { surface: "item-detail", client: "ios" })
    const edited = formatHistoryLine(listItemActivity("a")[0])
    expect(edited).toContain("source item detail, iOS")
    expect(listItemActivity("a")[0].attribution).toEqual({ surface: "item-detail", client: "ios" })
  })

  it("addTask and updateTask with no attribution persist source unknown", () => {
    useTaskStore.getState().addTask(task({ id: "u", description: "Bare", title: "Bare" }))
    const created = listItemActivity("u").find((row) => row.create)
    expect(created?.attribution).toEqual({ surface: "unknown" })
    expect(formatHistoryLine(created!)).toContain("source unknown")

    const stored = useTaskStore.getState().tasks.find((item) => item.id === "u")!
    useTaskStore.getState().updateTask({ ...stored, notes: "later" })
    const edit = listItemActivity("u").find((row) => row.changes.some((change) => change.field === "notes"))
    expect(edit?.attribution).toEqual({ surface: "unknown" })
    expect(formatHistoryLine(edit!)).toContain("source unknown")
  })

  it("splits an item-type rule's field from the caller's field", () => {
    useItemTypeStore.getState().addType({
      id: "widget",
      name: "Widget",
      rules: [
        {
          id: "own",
          name: "Mark owned",
          trigger: "update",
          when: { field: "purchased", operator: "eq", value: true },
          action: { kind: "setAttribute", field: "owned", value: true },
        },
      ],
    })
    useTaskStore.getState().addTask(
      task({ id: "w", description: "Widget", title: "Widget", type: "widget", attributes: {} }),
    )
    resetItemActivity()
    const before = useTaskStore.getState().tasks.find((item) => item.id === "w")!
    useTaskStore.getState().updateTask(
      { ...before, notes: "bought", attributes: { ...(before.attributes ?? {}), purchased: true } },
      undefined,
      { attribution: { surface: "item-detail", client: "electron" } },
    )
    const lines = listItemActivity("w").map(formatHistoryLine)
    expect(lines.some((line) => line.includes("Notes") && line.includes("source item detail, electron"))).toBe(true)
    expect(lines.some((line) => /purchased/i.test(line) && line.includes("source item detail, electron"))).toBe(true)
    expect(lines.some((line) => line.includes("source autoapplied rule Mark owned"))).toBe(true)
    const ruleLine = lines.find((line) => line.includes("source autoapplied rule Mark owned"))
    expect(ruleLine).toBeTruthy()
    expect(ruleLine).not.toContain("source item detail")
  })

  it("prints a legacy row's old source, and recorded-before-sources when it has none", () => {
    const base = {
      id: "act-old",
      itemId: "old",
      at: "2020-01-01T00:00:00.000Z",
      summary: "Notes — a → b",
      changes: [{ field: "notes", label: "Notes", from: "a", to: "b" }],
    }
    expect(formatHistoryLine(base)).toContain("source recorded before sources")
    expect(formatHistoryLine({ ...base, source: "item-detail" })).toContain("item-detail")
    expect(formatHistoryLine({ ...base, source: "item-detail" })).not.toContain("recorded before sources")
  })
})
