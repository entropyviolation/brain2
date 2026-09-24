/**
 * Item/list merge must stamp tombstones so vault union cannot resurrect
 * discarded originals alongside the survivor.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { applyItemMerge, defaultItemMergePlan } from "@/lib/item-merge"
import { applyListMerge, defaultMergePlan } from "@/lib/list-merge"
import { appendTombstoneIds, useTaskStore } from "@/lib/task-store"
import { mergePersistSnapshots } from "@/lib/vault-guard.js"
import type { List, Task } from "@/lib/types"

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["a"],
  ...partial,
})

const list = (partial: Partial<List> & Pick<List, "id" | "name">): List => ({
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  ...partial,
})

describe("appendTombstoneIds", () => {
  it("appends unique ids and caps length", () => {
    expect(appendTombstoneIds(["a"], ["a", "b"])).toEqual(["a", "b"])
    expect(appendTombstoneIds(["x"], ["y"], 1)).toEqual(["y"])
  })
})

describe("merge tombstones via setTasks / setLists", () => {
  beforeEach(() => {
    useTaskStore.getState().clearAllData()
  })

  it("stamps discarded item ids so a hub union cannot resurrect them", () => {
    const a = task({ id: "a", description: "Alpha", lists: ["home"], tags: ["x"] })
    const b = task({ id: "b", description: "Beta", lists: ["work"], tags: ["y"] })
    useTaskStore.getState().setLists([list({ id: "home", name: "Home" }), list({ id: "work", name: "Work" })])
    useTaskStore.getState().setTasks([a, b])

    const plan = defaultItemMergePlan([a, b], useTaskStore.getState().lists)
    const merged = applyItemMerge(useTaskStore.getState().tasks, plan)
    useTaskStore.getState().setTasks(merged, { tombstoneIds: plan.discardedIds })

    const state = useTaskStore.getState()
    expect(state.tasks.map((t) => t.id)).toEqual(["a"])
    expect(state.tasks[0]?.lists).toEqual(expect.arrayContaining(["home", "work"]))
    expect(state.tasks[0]?.tags).toEqual(expect.arrayContaining(["x", "y"]))
    expect(state.removedTaskIds).toContain("b")

    const live = JSON.stringify({
      state: {
        tasks: state.tasks,
        lists: state.lists,
        removedTaskIds: state.removedTaskIds,
      },
    })
    const staleHub = JSON.stringify({
      state: {
        tasks: [a, b],
        lists: state.lists,
      },
    })
    const united = JSON.parse(mergePersistSnapshots(staleHub, live, "cogs-task-storage") ?? "{}") as {
      state: { tasks: { id: string }[] }
    }
    expect(united.state.tasks.map((t) => t.id)).toEqual(["a"])
  })

  it("stamps discarded list ids so a hub union cannot resurrect them", () => {
    const lists = [list({ id: "keep", name: "Keep", order: 0 }), list({ id: "drop", name: "Drop", order: 1 })]
    const folders = [{ id: "f1", name: "Folder", createdAt: new Date(), listIds: ["keep", "drop"] }]
    const tasks = [
      task({ id: "t1", description: "On keep", lists: ["keep"] }),
      task({ id: "t2", description: "On drop", lists: ["drop"] }),
    ]
    useTaskStore.getState().setLists(lists)
    useTaskStore.getState().setFolders(folders)
    useTaskStore.getState().setTasks(tasks)

    const plan = defaultMergePlan(lists, folders)
    const next = applyListMerge({ lists, folders, tasks }, plan)
    useTaskStore.getState().setLists(next.lists, { tombstoneIds: plan.discardedIds })
    useTaskStore.getState().setFolders(next.folders)
    useTaskStore.getState().setTasks(next.tasks)

    const state = useTaskStore.getState()
    expect(state.lists.map((l) => l.id)).toEqual(["keep"])
    expect(state.removedListIds).toContain("drop")
    expect(state.tasks.every((t) => (t.lists ?? []).includes("keep"))).toBe(true)
    expect(state.tasks.some((t) => (t.lists ?? []).includes("drop"))).toBe(false)

    const live = JSON.stringify({
      state: {
        tasks: state.tasks,
        lists: state.lists,
        removedListIds: state.removedListIds,
      },
    })
    const staleHub = JSON.stringify({
      state: {
        tasks,
        lists,
      },
    })
    const united = JSON.parse(mergePersistSnapshots(staleHub, live, "cogs-task-storage") ?? "{}") as {
      state: { lists: { id: string }[] }
    }
    expect(united.state.lists.map((l) => l.id)).toEqual(["keep"])
  })
})
