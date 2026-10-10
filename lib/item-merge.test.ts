import { describe, expect, it } from "vitest"
import type { List, Task } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
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

  it("keeps the earliest createdAt when two ideas merge", () => {
    const early = new Date("2026-09-24T09:29:00.000Z")
    const late = new Date("2026-10-09T05:00:00.000Z")
    const items = [
      task("a", "Alpha", { createdAt: late }),
      task("b", "Beta", { createdAt: early }),
    ]
    const plan = defaultItemMergePlan(items, [list("work", "Work")])!
    const next = applyItemMerge(items, plan)
    expect(next[0].id).toBe("a")
    expect(next[0].createdAt).toEqual(early)
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

  it("unions every custom attribute and does not let empty overwrite held", () => {
    const items = [
      task("a", "Alpha", {
        attributes: { author: "Ada", tags_custom: ["x"], empty: "" },
        importance: 2,
        urgency: 5,
        body: "from A",
        notes: "note A",
        context: "@work",
        type: "book",
      }),
      task("b", "Beta", {
        attributes: { pages: 10, tags_custom: ["y"], author: "" },
        importance: 4,
        urgency: 1,
        body: "from B",
        notes: "note B",
        context: undefined,
        type: "item",
        actualDuration: 15,
      }),
    ]
    const plan = {
      ...defaultItemMergePlan(items, [list("work", "Work")])!,
      notes: "note A",
    }
    const merged = buildMergedItem(items, plan)!
    expect(merged.attributes).toEqual({ author: "Ada", pages: 10, tags_custom: ["x", "y"] })
    expect(merged.importance).toBe(4)
    expect(merged.urgency).toBe(5)
    expect(merged.actualDuration).toBe(15)
    expect(merged.body).toContain("from A")
    expect(merged.body).toContain("from B")
    expect(merged.notes).toContain("note A")
    expect(merged.notes).toContain("note B")
    expect(merged.context).toBe("@work")
    expect(merged.type).toBe("book")
  })

  it("keeps both non-empty scalar custom attributes on a clash (does not drop discarded)", () => {
    const items = [
      task("a", "Alpha", { attributes: { author: "Ada", rating: 5, flag: true } }),
      task("b", "Beta", { attributes: { author: "Grace", rating: 3, flag: false } }),
    ]
    const plan = defaultItemMergePlan(items, [list("work", "Work")])!
    const merged = buildMergedItem(items, plan)!
    expect(merged.attributes?.author).toEqual(expect.stringContaining("Ada"))
    expect(merged.attributes?.author).toEqual(expect.stringContaining("Grace"))
    expect(merged.attributes?.rating).toBe(5)
    expect(merged.attributes?.flag).toBe(true)
  })
})

describe("buildMergedItem schedule and links", () => {
  it("keeps one live period and parks the other as history", () => {
    const items = [
      task("a", "Alpha", { scheduledDate: new Date(2026, 8, 24, 15, 0, 0), scheduledTime: "15:00" }),
      task("b", "Beta", { scheduledWeek: "2026-09-14_2026-09-20" }),
    ]
    const merged = buildMergedItem(items, defaultItemMergePlan(items, [list("work", "Work")])!)!
    expect(formatLocalDateKey(merged.scheduledDate!)).toBe("2026-09-24")
    expect(merged.scheduledTime).toBe("15:00")
    expect(merged.scheduledWeek).toBeUndefined()
    expect(merged.scheduledMonth).toBeUndefined()
    expect(merged.scheduledYear).toBeUndefined()
    expect(merged.schedulePlacements).toEqual([{ period: "week", value: "2026-09-14_2026-09-20" }])
  })

  it("keeps an undone resolution on a merged placement", () => {
    const items = [
      task("a", "Alpha", {
        scheduledDate: new Date(2026, 8, 24, 15, 0, 0),
        schedulePlacements: [{ period: "day", value: "2026-09-21", resolved: "assimilated" }],
      }),
      task("b", "Beta", {
        schedulePlacements: [{ period: "day", value: "2026-09-21" }],
      }),
    ]
    const merged = buildMergedItem(items, defaultItemMergePlan(items, [list("work", "Work")])!)!
    expect(merged.schedulePlacements).toEqual([
      { period: "day", value: "2026-09-21", resolved: "assimilated" },
    ])
  })

  it("drops a dependency that only pointed at the merged sibling", () => {
    const items = [
      task("a", "Alpha", { dependencies: ["b"], links: [{ id: "l", relation: "related", targetId: "b" }] }),
      task("b", "Beta", { dependencies: ["a"] }),
    ]
    const merged = buildMergedItem(items, defaultItemMergePlan(items, [list("work", "Work")])!)!
    expect(merged.dependencies ?? []).toEqual([])
    expect(merged.links ?? []).toEqual([])
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
