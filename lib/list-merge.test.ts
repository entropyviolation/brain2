import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import { applyListMerge, defaultMergePlan, retargetTasksForMerge } from "@/lib/list-merge"

const list = (id: string, name: string, extra: Partial<List> = {}): List => ({
  id,
  name,
  color: extra.color ?? "#111",
  description: extra.description,
  createdAt: new Date(),
  itemAttributes: extra.itemAttributes,
  rules: extra.rules,
  ...extra,
})

const folder = (id: string, name: string, listIds: string[]): Folder => ({
  id,
  name,
  createdAt: new Date(),
  listIds,
})

const task = (id: string, description: string, lists: string[]): Task => ({
  id,
  description,
  lists,
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
})

describe("applyListMerge", () => {
  const lists = [
    list("a", "Books", { color: "#f00", itemAttributes: [{ id: "author", name: "Author", type: "string" }] }),
    list("b", "Reading", { color: "#00f", itemAttributes: [{ id: "pages", name: "Pages", type: "number" }] }),
  ]
  const folders = [folder("f1", "Home", ["a"]), folder("f2", "Work", ["b"])]
  const tasks = [task("t1", "Dune", ["a"]), task("t2", "Neuromancer", ["b"]), task("t3", "Both", ["a", "b"])]

  it("keeps all items on the surviving list and unions folders by default", () => {
    const plan = defaultMergePlan(lists, folders)!
    const next = applyListMerge({ lists, folders, tasks }, plan)
    expect(next.lists.map((l) => l.id)).toEqual(["a"])
    expect(next.lists[0].name).toBe("Books")
    expect(next.lists[0].itemAttributes?.map((d) => d.id)).toEqual(["author", "pages"])
    expect(next.folders.find((f) => f.id === "f1")?.listIds).toContain("a")
    expect(next.folders.find((f) => f.id === "f2")?.listIds).toContain("a")
    expect(next.folders.find((f) => f.id === "f2")?.listIds).not.toContain("b")
    expect(next.tasks.find((t) => t.id === "t2")?.lists).toContain("a")
    expect(next.tasks.every((t) => !(t.lists ?? []).includes("b"))).toBe(true)
  })

  it("does not add discarded-only items to the survivor when keepAllItems is false", () => {
    const plan = { ...defaultMergePlan(lists, folders)!, keepAllItems: false }
    const next = applyListMerge({ lists, folders, tasks }, plan)
    expect(next.tasks.find((t) => t.id === "t2")?.lists).toEqual([])
    expect(next.tasks.find((t) => t.id === "t1")?.lists).toEqual(["a"])
  })
})

describe("retargetTasksForMerge", () => {
  it("does not duplicate the survivor id", () => {
    const plan = defaultMergePlan(
      [list("a", "A"), list("b", "B")],
      [],
    )!
    const next = retargetTasksForMerge([task("t", "x", ["a", "b"])], plan)
    expect(next[0].lists).toEqual(["a"])
  })
})
