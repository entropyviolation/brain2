import { beforeEach, describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { rememberWorld, undoLastAction } from "@/lib/action-history"
import {
  applyStepItemFixes,
  ensureStepItem,
  findStep,
  findStepItem,
  reconcileStepItems,
  stepCrumbs,
  stepReadout,
  updateStepField,
  withoutStepItems,
} from "@/lib/step-items"
import { clearItemLayers, itemLayers, openStepItem, popItemLayer, pushItemLayer } from "@/lib/step-item-stack"
import { tasksForLedgerKind } from "@/lib/period-ledger"
import { getAvailableTasks, getTasksForPeriod } from "@/components/Scheduler/scheduler-utils"
import { tasksInList } from "@/components/Modules/module-helpers"
import { addTaskPrereq } from "@/lib/prereqs"
import { removeNestedStep } from "@/lib/todo-steps"
import { taskSchema } from "@/lib/data/schemas"

const DAY = "2026-10-16"

function cds(): Task {
  return {
    id: "cds",
    type: "task",
    description: "Finish CDs",
    stage: "scheduled",
    createdAt: new Date("2026-10-01T09:00:00"),
    completed: false,
    lists: [],
    scheduledDate: new Date(`${DAY}T00:00:00`),
    subtasks: [
      {
        id: "insert",
        description: "insert",
        completed: false,
        estimatedDuration: 20,
        subtasks: [{ id: "disc", description: "disc", completed: false, estimatedDuration: 10, actualDuration: 4 }],
      },
      { id: "label", description: "label", completed: false },
    ],
  } as Task
}

const tasks = () => useTaskStore.getState().tasks
const get = (id: string) => tasks().find((t) => t.id === id)!

beforeEach(() => {
  resetAllStores()
  clearItemLayers()
  useTaskStore.setState({ tasks: [cds()], removedTaskIds: [] })
})

describe("step items (Phase 11)", () => {
  it("is made lazily, once, and linked both ways", () => {
    expect(tasks()).toHaveLength(1)
    const id = ensureStepItem("cds", "disc")!
    expect(id).toBeTruthy()
    expect(ensureStepItem("cds", "disc")).toBe(id)
    expect(tasks()).toHaveLength(2)
    const item = get(id)
    expect(item.stepOf).toEqual({ taskId: "cds", stepId: "disc" })
    expect(item.parentTaskId).toBe("cds")
    expect(item.description).toBe("disc")
    expect(item.lists).toEqual([])
    expect(findStep(get("cds"), "disc")?.itemId).toBe(id)
    expect(ensureStepItem("cds", "nope")).toBeNull()
  })

  it("finds the item by stepOf even when a draft dropped itemId", () => {
    const id = ensureStepItem("cds", "disc")!
    const parent = get("cds")
    useTaskStore.getState().updateTask({ ...parent, subtasks: cds().subtasks })
    expect(findStep(get("cds"), "disc")?.itemId).toBeUndefined()
    expect(findStepItem(tasks(), "cds", "disc")?.id).toBe(id)
    expect(ensureStepItem("cds", "disc")).toBe(id)
    expect(tasks()).toHaveLength(2)
  })

  it("writes shared fields to the step only, and refreshes the mirror", () => {
    const id = ensureStepItem("cds", "disc")!
    updateStepField({ taskId: "cds", stepId: "disc" }, { description: "disc art", estimatedDuration: 15, completed: true })
    const step = findStep(get("cds"), "disc")!
    expect(step).toMatchObject({ description: "disc art", estimatedDuration: 15, completed: true })
    const item = get(id)
    expect(item.description).toBe("disc art")
    expect(item.estimatedDuration).toBe(15)
    expect(item.completed).toBe(false)
  })

  it("deleting a step deletes its item; undo brings both back, linked", () => {
    const id = ensureStepItem("cds", "insert")!
    rememberWorld("Delete step")
    const parent = get("cds")
    useTaskStore.getState().updateTask({ ...parent, subtasks: removeNestedStep(parent.subtasks, "insert") })
    applyStepItemFixes()
    expect(tasks().some((t) => t.id === id)).toBe(false)
    expect(undoLastAction()).toBe(true)
    applyStepItemFixes()
    expect(get(id).stepOf?.stepId).toBe("insert")
    expect(findStep(get("cds"), "insert")?.itemId).toBe(id)
    expect(useTaskStore.getState().removedTaskIds ?? []).not.toContain(id)
  })

  it("deleting the parent deletes every step item; a moved step takes its item along", () => {
    const a = ensureStepItem("cds", "disc")!
    const b = ensureStepItem("cds", "label")!
    const other = { ...cds(), id: "other", description: "Other", subtasks: [{ id: "label", description: "label", completed: false }] }
    const parent = get("cds")
    useTaskStore.setState({
      tasks: [{ ...parent, subtasks: removeNestedStep(parent.subtasks, "label") }, other as Task, get(a), get(b)],
    })
    expect(reconcileStepItems(tasks())).toEqual({ remove: [], relink: [{ id: b, taskId: "other" }] })
    applyStepItemFixes()
    expect(get(b).stepOf).toEqual({ taskId: "other", stepId: "label" })
    expect(get(b).parentTaskId).toBe("other")
    useTaskStore.getState().deleteTask("cds")
    applyStepItemFixes()
    expect(tasks().some((t) => t.id === a)).toBe(false)
  })

  it("is never on a lens, the load rows, the Scheduler, Lists or search", () => {
    const id = ensureStepItem("cds", "disc")!
    // Even if someone schedules it or files it.
    const item = get(id)
    useTaskStore.getState().updateTask({ ...item, scheduledDate: new Date(`${DAY}T00:00:00`), lists: ["l1"] })
    const all = tasks()
    expect(tasksForLedgerKind(all, "todo", "day", DAY, [], new Date(`${DAY}T12:00:00`)).map((t) => t.id)).toEqual(["cds"])
    expect(tasksForLedgerKind(all, "undone", "day", DAY, [], new Date("2026-10-20T12:00:00")).map((t) => t.id)).not.toContain(id)
    expect(getTasksForPeriod(all, "day", DAY, new Date(`${DAY}T12:00:00`)).map((t) => t.id)).not.toContain(id)
    expect(getTasksForPeriod(all, "always", undefined, new Date()).map((t) => t.id)).not.toContain(id)
    expect(
      getAvailableTasks(all, {
        activeTab: "always",
        selectedCategories: [],
        sortBy: "priority",
        sortOrder: "desc",
        lists: [],
        scheduleableCategoryIds: new Set(),
      } as never).map((t) => t.id),
    ).not.toContain(id)
    expect(tasksInList(all, "l1")).toEqual([])
    expect(withoutStepItems(all).map((t) => t.id)).toEqual(["cds"])
  })

  it("leaves a task with no step items exactly as it was", () => {
    const before = tasks()
    applyStepItemFixes()
    expect(tasks()).toBe(before)
    expect(withoutStepItems(before)).toBe(before)
  })

  it("names the path and the readout", () => {
    const id = ensureStepItem("cds", "disc")!
    expect(stepCrumbs(tasks(), get(id)).map((c) => c.label)).toEqual(["Finish CDs", "insert", "disc"])
    expect(stepReadout(findStep(get("cds"), "insert")!)).toEqual({ est: 20, parts: "0/1", spent: 0 })
  })

  it("a task cannot wait on its own step item, nor the item on its parent", () => {
    const id = ensureStepItem("cds", "disc")!
    expect(addTaskPrereq(get("cds"), id, tasks()).ok).toBe(false)
    expect(addTaskPrereq(get(id), "cds", tasks()).ok).toBe(false)
  })

  it("old tasks parse without the new fields; new ones keep them", () => {
    const old = taskSchema.parse({ ...cds(), createdAt: "2026-10-01" })
    expect(old.stepOf).toBeUndefined()
    const id = ensureStepItem("cds", "disc")!
    const parsed = taskSchema.parse(get(id))
    expect(parsed.stepOf).toEqual({ taskId: "cds", stepId: "disc" })
    const parent = taskSchema.parse(get("cds")) as Task
    expect(findStep(parent, "disc")?.itemId).toBe(id)
  })
})

describe("item layers (R3)", () => {
  it("stacks, and Back / Esc pop only the top", () => {
    pushItemLayer("cds")
    expect(openStepItem("cds", "disc")).toBe(true)
    expect(itemLayers().map((l) => l.taskId)).toEqual(["cds", findStepItem(tasks(), "cds", "disc")!.id])
    popItemLayer()
    expect(itemLayers().map((l) => l.taskId)).toEqual(["cds"])
    expect(openStepItem("cds", "gone")).toBe(false)
    expect(itemLayers()).toHaveLength(1)
  })
})
