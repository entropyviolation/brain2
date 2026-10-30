import { beforeEach, describe, expect, it } from "vitest"
import type { List } from "@/lib/types"
import { useModulesStore } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { installReviewedPackage, reviewPackageBind } from "./module-package-install"

const FOUR = ["author", "year", "pages", "rating"]

function shelf(id: string, name: string, attrIds: string[]): List {
  return {
    id,
    name,
    color: "#64748b",
    createdAt: new Date("2026-01-01"),
    itemAttributes: attrIds.map((attrId) => ({ id: attrId, name: attrId, type: "string" })),
  }
}

function attrs() {
  return FOUR.map((id) => ({ id, name: id, type: "string" }))
}

function bindPackage(extra: Record<string, unknown> = {}) {
  return {
    id: "shelf",
    name: "Shelf",
    version: "1",
    slots: [{ role: "books", name: "Reading books", policy: "bind", attributes: attrs() }],
    views: [{ kind: "checklist", title: "Check", slot: "books" }],
    ...extra,
  }
}

function snap(list: List | undefined) {
  return {
    name: list?.name,
    createdByModuleId: list?.createdByModuleId,
    moduleSlotId: list?.moduleSlotId,
    attrs: list?.itemAttributes?.map((attr) => attr.id),
    color: list?.color,
  }
}

beforeEach(() => {
  localStorage.clear()
  useModulesStore.setState({ modules: [] })
  useWorkflowsStore.setState({ workflows: [] })
  useTaskStore.getState().clearAllData()
})

describe("reviewPackageBind", () => {
  it("skips the scorer for a create-only package", () => {
    const lists = [shelf("books", "Reading books", FOUR)]
    const text = JSON.stringify({
      ...bindPackage(),
      slots: [{ role: "books", name: "Reading books", policy: "create", attributes: attrs() }],
    })
    expect(reviewPackageBind(text, lists).action).toBe("install")
  })

  it("skips the scorer when nativeTemplate is set", () => {
    const lists = [shelf("books", "Reading books", FOUR)]
    const text = JSON.stringify({ ...bindPackage(), nativeTemplate: "blank" })
    expect(reviewPackageBind(text, lists).action).toBe("install")
  })
})

describe("installReviewedPackage", () => {
  it("installs a create-only package without stamping an existing list", () => {
    const existing = shelf("already", "Already", FOUR)
    useTaskStore.getState().addList(existing)
    const before = snap(useTaskStore.getState().lists.find((list) => list.id === "already"))
    const text = JSON.stringify({
      ...bindPackage(),
      slots: [{ role: "books", name: "Grocery list", policy: "create", attributes: attrs() }],
    })
    const id = installReviewedPackage(text, useTaskStore.getState().lists)
    expect(typeof id).toBe("string")
    expect(snap(useTaskStore.getState().lists.find((list) => list.id === "already"))).toEqual(before)
    const mod = useModulesStore.getState().modules.find((module) => module.id === id)
    const createdId = mod?.config.package?.slots.books
    expect(createdId).toBeTruthy()
    expect(createdId).not.toBe("already")
    expect(useTaskStore.getState().lists.find((list) => list.id === createdId)?.createdByModuleId).toBe(id)
  })

  it("installs a nativeTemplate file through the template builder", () => {
    const existing = shelf("books", "Reading books", FOUR)
    useTaskStore.getState().addList(existing)
    const before = snap(existing)
    const id = installReviewedPackage(
      JSON.stringify({ ...bindPackage(), nativeTemplate: "blank" }),
      useTaskStore.getState().lists,
    )
    expect(typeof id).toBe("string")
    const mod = useModulesStore.getState().modules.find((module) => module.id === id)
    expect(mod?.templateId).toBe("blank")
    expect(mod?.config.package).toBeUndefined()
    expect(snap(useTaskStore.getState().lists.find((list) => list.id === "books"))).toEqual(before)
  })

  it("does not install when a bind is ask, and leaves lists alone", () => {
    useTaskStore.getState().addList(shelf("a", "Shelf A", FOUR))
    useTaskStore.getState().addList(shelf("b", "Shelf B", FOUR))
    const before = useTaskStore.getState().lists.map(snap)
    const result = installReviewedPackage(JSON.stringify(bindPackage()), useTaskStore.getState().lists)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return
    expect(result[0]?.decision).toBe("ask")
    expect(result[0]?.candidates.map((candidate) => candidate.name).sort()).toEqual(["Shelf A", "Shelf B"])
    expect(useModulesStore.getState().modules).toEqual([])
    expect(useTaskStore.getState().lists.map(snap)).toEqual(before)
  })

  it("does not install when a bind is none", () => {
    useTaskStore.getState().addList(shelf("zebra", "Zebra", ["zzz"]))
    const result = installReviewedPackage(JSON.stringify(bindPackage()), useTaskStore.getState().lists)
    expect(Array.isArray(result)).toBe(true)
    if (!Array.isArray(result)) return
    expect(result[0]?.decision).toBe("none")
    expect(result[0]?.candidates).toEqual([])
    expect(useModulesStore.getState().modules).toEqual([])
    expect(useTaskStore.getState().lists.find((list) => list.id === "zebra")?.moduleSlotId).toBeUndefined()
  })

  it("binds one clear list without rewriting it", () => {
    useTaskStore.getState().addList(shelf("books", "Reading books", FOUR))
    useTaskStore.getState().addList(shelf("other", "Zebra", ["zzz"]))
    const before = snap(useTaskStore.getState().lists.find((list) => list.id === "books"))
    const foldersBefore = useTaskStore.getState().folders.map((folder) => folder.listIds)
    const id = installReviewedPackage(
      JSON.stringify({
        ...bindPackage(),
        workflows: [{ name: "Flag", trigger: { kind: "manual" }, actions: [{ kind: "throw", message: "nope" }], scope: { listIds: ["books"] } }],
      }),
      useTaskStore.getState().lists,
    )
    expect(typeof id).toBe("string")
    const mod = useModulesStore.getState().modules.find((module) => module.id === id)
    expect(mod?.config.package?.slots.books).toBe("books")
    expect(mod?.views?.[0]?.config.categoryId).toBe("books")
    expect(snap(useTaskStore.getState().lists.find((list) => list.id === "books"))).toEqual(before)
    expect(useTaskStore.getState().folders.map((folder) => folder.listIds)).toEqual(foldersBefore)
    const wf = useWorkflowsStore.getState().workflows.find((workflow) => workflow.moduleId === id)
    expect(wf?.scope?.listIds).toEqual(["books"])
  })

  it("mints a create slot and leaves the bound list unchanged", () => {
    useTaskStore.getState().addList(shelf("books", "Reading books", FOUR))
    const before = snap(useTaskStore.getState().lists.find((list) => list.id === "books"))
    const text = JSON.stringify({
      ...bindPackage(),
      slots: [
        { role: "books", name: "Reading books", policy: "bind", attributes: attrs() },
        { role: "notes", name: "Notes", policy: "create" },
      ],
      views: [
        { kind: "checklist", title: "Books", slot: "books" },
        { kind: "notes", title: "Notes", slot: "notes" },
      ],
    })
    const id = installReviewedPackage(text, useTaskStore.getState().lists)
    expect(typeof id).toBe("string")
    expect(snap(useTaskStore.getState().lists.find((list) => list.id === "books"))).toEqual(before)
    const mod = useModulesStore.getState().modules.find((module) => module.id === id)
    const notesId = mod?.config.package?.slots.notes
    expect(notesId).toBeTruthy()
    expect(notesId).not.toBe("books")
    const notes = useTaskStore.getState().lists.find((list) => list.id === notesId)
    expect(notes?.createdByModuleId).toBe(id)
    expect(notes?.moduleSlotId).toBe("notes")
    expect(notes?.name).toBe("Notes")
  })
})
