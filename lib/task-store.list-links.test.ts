/**
 * task-store connected-list membership: addListLink, auto-join, exclusions, unlink.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { createListItem } from "@/lib/item-utils"
import { linksForList } from "@/lib/list-links"
import { useTaskStore } from "@/lib/task-store"
import type { List } from "@/lib/types"

const cat = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
})

describe("task-store list links", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([cat("a", "Alpha"), cat("b", "Beta"), cat("c", "Gamma")])
  })

  it("creates A→B and copies existing source items onto B", () => {
    useTaskStore.getState().addTask(createListItem("On A", ["a"]))
    const itemId = useTaskStore.getState().tasks.find((t) => t.description === "On A")!.id
    useTaskStore.getState().addListLink("a", "b")
    const item = useTaskStore.getState().tasks.find((t) => t.id === itemId)!
    expect(item.lists).toEqual(["a", "b"])
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.linkedTargetListIds).toEqual(["b"])
  })

  it("adds a later source item onto the target", () => {
    useTaskStore.getState().addListLink("a", "b")
    useTaskStore.getState().addTask(createListItem("New on A", ["a"]))
    const item = useTaskStore.getState().tasks.find((t) => t.description === "New on A")!
    expect(item.lists).toContain("a")
    expect(item.lists).toContain("b")
  })

  it("keeps a manual remove off B on resync, and persists the exclusion", () => {
    useTaskStore.getState().addListLink("a", "b")
    useTaskStore.getState().addTask(createListItem("Shared", ["a"]))
    const item = useTaskStore.getState().tasks.find((t) => t.description === "Shared")!
    expect(item.lists).toEqual(["a", "b"])
    useTaskStore.getState().updateTask({ ...item, lists: ["a"] })
    const removed = useTaskStore.getState().tasks.find((t) => t.id === item.id)!
    expect(removed.lists).toEqual(["a"])
    expect(removed.listMembershipExclusions).toEqual(["b"])
    useTaskStore.getState().addListLink("a", "b")
    const resync = useTaskStore.getState().tasks.find((t) => t.id === item.id)!
    expect(resync.lists).toEqual(["a"])
    expect(resync.listMembershipExclusions).toEqual(["b"])
  })

  it("shows the same A→B link from B's settings as a receive", () => {
    useTaskStore.getState().addListLink("a", "b")
    const { lists } = useTaskStore.getState()
    expect(linksForList(lists, "b")).toEqual([{ sourceListId: "a", targetListId: "b", role: "receive" }])
    expect(linksForList(lists, "a")).toEqual([{ sourceListId: "a", targetListId: "b", role: "push" }])
  })

  it("unlink stops future auto-adds without mass-deleting existing membership", () => {
    useTaskStore.getState().addListLink("a", "b")
    useTaskStore.getState().addTask(createListItem("Kept", ["a"]))
    const keptId = useTaskStore.getState().tasks.find((t) => t.description === "Kept")!.id
    useTaskStore.getState().removeListLink("a", "b")
    expect(useTaskStore.getState().tasks.find((t) => t.id === keptId)?.lists).toEqual(["a", "b"])
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.linkedTargetListIds).toBeUndefined()
    useTaskStore.getState().addTask(createListItem("After unlink", ["a"]))
    expect(useTaskStore.getState().tasks.find((t) => t.description === "After unlink")?.lists).toEqual(["a"])
  })

  it("unions A↔B both directions and still honors per-list exclusions", () => {
    useTaskStore.getState().addListLink("a", "b")
    useTaskStore.getState().addListLink("b", "a")
    useTaskStore.getState().addTask(createListItem("From A", ["a"]))
    useTaskStore.getState().addTask(createListItem("From B", ["b"]))
    const fromA = useTaskStore.getState().tasks.find((t) => t.description === "From A")!
    const fromB = useTaskStore.getState().tasks.find((t) => t.description === "From B")!
    expect(fromA.lists.sort()).toEqual(["a", "b"])
    expect(fromB.lists.sort()).toEqual(["a", "b"])
    useTaskStore.getState().updateTask({ ...fromA, lists: ["a"] })
    const excluded = useTaskStore.getState().tasks.find((t) => t.id === fromA.id)!
    expect(excluded.lists).toEqual(["a"])
    expect(excluded.listMembershipExclusions).toEqual(["b"])
    useTaskStore.getState().updateTask({ ...excluded, description: "From A still" })
    expect(useTaskStore.getState().tasks.find((t) => t.id === fromA.id)?.lists).toEqual(["a"])
  })

  it("does not let updateList clobber outbound links", () => {
    useTaskStore.getState().addListLink("a", "b")
    const a = useTaskStore.getState().lists.find((l) => l.id === "a")!
    useTaskStore.getState().updateList({ ...a, name: "Alpha renamed", linkedTargetListIds: undefined })
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.linkedTargetListIds).toEqual(["b"])
    expect(useTaskStore.getState().lists.find((l) => l.id === "a")?.name).toBe("Alpha renamed")
  })

  it("clears an exclusion when the item is explicitly added back", () => {
    useTaskStore.getState().addListLink("a", "b")
    useTaskStore.getState().addTask(createListItem("Round trip", ["a"]))
    const item = useTaskStore.getState().tasks.find((t) => t.description === "Round trip")!
    useTaskStore.getState().updateTask({ ...item, lists: ["a"] })
    const excluded = useTaskStore.getState().tasks.find((t) => t.id === item.id)!
    expect(excluded.listMembershipExclusions).toEqual(["b"])
    useTaskStore.getState().updateTask({ ...excluded, lists: ["a", "b"] })
    const restored = useTaskStore.getState().tasks.find((t) => t.id === item.id)!
    expect(restored.lists).toEqual(["a", "b"])
    expect(restored.listMembershipExclusions).toBeUndefined()
  })
})
