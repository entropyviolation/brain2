import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import {
  applyItemMerge,
  buildMergedItem,
  defaultItemMergePlan,
  retargetLinks,
  retargetTasksForItemMerge,
} from "./item-merge"

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#111",
  description: "",
  createdAt: new Date(),
})

const task = (id: string, description: string, extra: Partial<Task> = {}): Task => ({
  id,
  description,
  lists: extra.lists ?? ["work"],
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
  ...extra,
})

describe("defaultItemMergePlan", () => {
  it("uses the first item as survivor and unions real lists", () => {
    const items = [
      task("a", "Alpha", { lists: ["work"] }),
      task("b", "Beta", { lists: ["home", "__all-items__f1"] }),
    ]
    const plan = defaultItemMergePlan(items, [list("work", "Work"), list("home", "Home"), list("__all-items__f1", "All")])
    expect(plan?.survivorId).toBe("a")
    expect(plan?.discardedIds).toEqual(["b"])
    expect(plan?.listIds.sort()).toEqual(["home", "work"])
    expect(plan?.keepAllDetails).toBe(true)
  })
})

describe("applyItemMerge", () => {
  it("keeps the survivor, unions details, and removes discarded items", () => {
    const items = [
      task("a", "Alpha", { lists: ["work"], tags: ["one"], attributes: { cost: 1 }, subtasks: [{ id: "s1", description: "step", completed: false }] }),
      task("b", "Beta", { lists: ["home"], tags: ["two"], attributes: { pages: 10 }, subtasks: [{ id: "s2", description: "other", completed: true }] }),
    ]
    const plan = defaultItemMergePlan(items, [list("work", "Work"), list("home", "Home")])!
    const next = applyItemMerge(items, plan)
    expect(next.map((t) => t.id)).toEqual(["a"])
    expect(next[0].description).toBe("Alpha")
    expect(next[0].lists.sort()).toEqual(["home", "work"])
    expect(next[0].tags).toEqual(["one", "two"])
    expect(next[0].attributes).toEqual({ cost: 1, pages: 10 })
    expect(next[0].subtasks?.map((s) => s.id)).toEqual(["s1", "s2"])
  })

  it("does not copy discarded subtasks when keepAllDetails is false", () => {
    const items = [
      task("a", "Alpha", { subtasks: [{ id: "s1", description: "keep", completed: false }] }),
      task("b", "Beta", { subtasks: [{ id: "s2", description: "drop", completed: false }] }),
    ]
    const plan = { ...defaultItemMergePlan(items, [list("work", "Work")])!, keepAllDetails: false }
    const next = applyItemMerge(items, plan)
    expect(next[0].subtasks?.map((s) => s.id)).toEqual(["s1"])
  })

  it("retargets dependencies and links on other items", () => {
    const items = [
      task("a", "Alpha"),
      task("b", "Beta"),
      task("c", "Other", { dependencies: ["b"], links: [{ id: "l1", relation: "blocks", targetId: "b" }] }),
    ]
    const plan = defaultItemMergePlan(items.slice(0, 2), [list("work", "Work")])!
    const next = applyItemMerge(items, plan)
    const other = next.find((t) => t.id === "c")
    expect(other?.dependencies).toEqual(["a"])
    expect(other?.links).toEqual([expect.objectContaining({ relation: "blocks", targetId: "a" })])
    expect(next.find((t) => t.id === "b")).toBeUndefined()
  })
})

describe("buildMergedItem", () => {
  it("uses the chosen description and list membership", () => {
    const items = [task("a", "Alpha", { lists: ["work"] }), task("b", "Beta", { lists: ["home"] })]
    const plan = { ...defaultItemMergePlan(items, [list("work", "Work"), list("home", "Home")])!, description: "Beta", listIds: ["home"] }
    const merged = buildMergedItem(items, plan)
    expect(merged?.description).toBe("Beta")
    expect(merged?.lists).toEqual(["home"])
  })
})

describe("retargetLinks", () => {
  it("drops self-links after retargeting", () => {
    expect(retargetLinks([{ id: "l", relation: "related", targetId: "b" }], new Set(["b"]), "a")).toEqual([])
  })
})

describe("retargetTasksForItemMerge", () => {
  it("points parentTaskId at the survivor", () => {
    const plan = defaultItemMergePlan([task("a", "A"), task("b", "B")], [list("work", "Work")])!
    const next = retargetTasksForItemMerge([task("a", "A"), task("b", "B"), task("c", "child", { parentTaskId: "b" })], plan)
    expect(next.find((t) => t.id === "c")?.parentTaskId).toBe("a")
  })
})
