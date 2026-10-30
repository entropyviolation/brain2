import { beforeEach, describe, expect, it } from "vitest"
import type { List } from "@/lib/types"
import { useModulesStore } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import {
  installModulePackage,
  parseModulePackage,
  RENDERED_MODULE_VIEW_KINDS,
} from "@/lib/module-package"

const checklistPackage = {
  id: "groceries",
  name: "Groceries",
  version: "1.0.0",
  description: "A shopping list",
  slots: [
    {
      role: "items",
      name: "Grocery list",
      policy: "create",
      itemType: "task",
      attributes: [{ id: "qty", name: "Qty", type: "number" }],
    },
  ],
  views: [{ kind: "checklist", title: "Check", slot: "items" }],
  workflows: [
    {
      name: "Flag empty",
      trigger: { kind: "manual" },
      actions: [{ kind: "throw", message: "nope" }],
      scope: { listIds: ["items"] },
    },
  ],
}

function existingList(): List {
  return {
    id: "already-here",
    name: "Already here",
    color: "#111111",
    createdAt: new Date("2026-01-01"),
    scheduleable: false,
  }
}

beforeEach(() => {
  localStorage.clear()
  useModulesStore.setState({ modules: [] })
  useWorkflowsStore.setState({ workflows: [] })
  useTaskStore.getState().clearAllData()
})

describe("parseModulePackage", () => {
  it("reads a create-only package", () => {
    const pkg = parseModulePackage(JSON.stringify(checklistPackage))
    expect(pkg.id).toBe("groceries")
    expect(pkg.slots[0].role).toBe("items")
    expect(pkg.views[0].kind).toBe("checklist")
    expect(pkg.nativeTemplate).toBeUndefined()
  })

  it("rejects a function", () => {
    const raw = {
      ...checklistPackage,
      slots: [
        {
          ...checklistPackage.slots[0],
          attributes: [{ id: "qty", name: "Qty", type: "number", formula: () => "nope" }],
        },
      ],
    }
    expect(() => parseModulePackage(raw)).toThrow(/function/)
  })

  it("rejects a slot with no role", () => {
    const raw = {
      ...checklistPackage,
      slots: [{ name: "Grocery list", policy: "create" }],
    }
    expect(() => parseModulePackage(raw)).toThrow(/role/)
  })

  it("rejects an unknown view kind", () => {
    const raw = {
      ...checklistPackage,
      views: [{ kind: "not-a-view", title: "App", slot: "items" }],
    }
    expect(() => parseModulePackage(raw)).toThrow(/not rendered/)
  })

  it("rejects a nativeTemplate that is not a template", () => {
    expect(() =>
      parseModulePackage({ id: "x", name: "X", version: "1", nativeTemplate: "not-a-template" }),
    ).toThrow(/not a module template/)
  })

  it("rejects a bind policy", () => {
    const raw = {
      ...checklistPackage,
      slots: [{ ...checklistPackage.slots[0], policy: "bind" }],
    }
    expect(() => parseModulePackage(raw)).toThrow(/create/)
  })

  it("drops the recipe when nativeTemplate is set", () => {
    const pkg = parseModulePackage({
      id: "facade-blank",
      name: "Blank",
      version: "1",
      nativeTemplate: "blank",
      slots: [{ name: "no role" }],
      views: [{ kind: "not-a-view" }],
    })
    expect(pkg.nativeTemplate).toBe("blank")
    expect(pkg.slots).toEqual([])
    expect(pkg.views).toEqual([])
  })

  it("still rejects a function inside an ignored native recipe", () => {
    expect(() =>
      parseModulePackage({
        id: "facade-blank",
        name: "Blank",
        version: "1",
        nativeTemplate: "blank",
        slots: [{ role: "items", name: "X", policy: "create", sneak: () => 1 }],
      }),
    ).toThrow(/function/)
  })

  it("names only view kinds the switch already renders", () => {
    expect(RENDERED_MODULE_VIEW_KINDS).toContain("checklist")
    expect(RENDERED_MODULE_VIEW_KINDS).toContain("package-app")
    expect(RENDERED_MODULE_VIEW_KINDS).toContain("house-cleaning")
    expect(RENDERED_MODULE_VIEW_KINDS).not.toContain("not-a-view")
  })

  it("accepts a package-app view and keeps its folder id", () => {
    const pkg = parseModulePackage({
      ...checklistPackage,
      views: [
        {
          kind: "package-app",
          title: "App",
          slot: "items",
          config: { packageAppId: "folder-1", htmlCanWrite: false },
        },
      ],
    })
    expect(pkg.views[0]).toMatchObject({
      kind: "package-app",
      slot: "items",
      config: { packageAppId: "folder-1", htmlCanWrite: false },
    })
  })
})

describe("installModulePackage", () => {
  it("creates a module and a new checklist list", () => {
    useTaskStore.getState().addList(existingList())
    useModulesStore.setState({
      modules: [
        {
          id: "keep",
          type: "workspace",
          kind: "workspace",
          title: "Keep",
          config: { houseCleaning: { areas: [], tasks: [] } as never },
        },
      ],
    })

    const id = installModulePackage(checklistPackage)
    const modules = useModulesStore.getState().modules
    const mod = modules.find((m) => m.id === id)
    expect(mod?.title).toBe("Groceries")
    expect(mod?.config.package).toEqual({
      id: "groceries",
      version: "1.0.0",
      slots: { items: mod?.config.package?.slots.items },
    })
    expect(mod?.config.houseCleaning).toBeUndefined()
    expect(mod?.config.tripItinerary).toBeUndefined()

    const listId = mod?.config.package?.slots.items
    expect(listId).toBeTruthy()
    const list = useTaskStore.getState().lists.find((l) => l.id === listId)
    expect(list?.name).toBe("Grocery list")
    expect(list?.createdByModuleId).toBe(id)
    expect(list?.moduleSlotId).toBe("items")
    expect(list?.itemTypeId).toBe("task")
    expect(list?.itemAttributes?.map((a) => a.id)).toEqual(["qty"])
    expect(list?.scheduleable).toBe(false)
    expect(mod?.views?.[0]).toMatchObject({ kind: "checklist", title: "Check", config: { categoryId: listId } })

    const wf = useWorkflowsStore.getState().workflows.find((w) => w.moduleId === id)
    expect(wf?.scope?.listIds).toEqual([listId])

    const keptList = useTaskStore.getState().lists.find((l) => l.id === "already-here")
    expect(keptList).toMatchObject({ name: "Already here", color: "#111111" })
    expect(keptList?.createdByModuleId).toBeUndefined()
    expect(keptList?.moduleSlotId).toBeUndefined()

    const kept = modules.find((m) => m.id === "keep")
    expect(kept?.config.houseCleaning).toEqual({ areas: [], tasks: [] })
    expect(kept?.config.package).toBeUndefined()
    expect(kept?.config.tripItinerary).toBeUndefined()
  })

  it("does not write when a view names an unknown slot", () => {
    useTaskStore.getState().addList(existingList())
    const raw = {
      ...checklistPackage,
      views: [{ kind: "checklist", title: "Check", slot: "missing" }],
      workflows: undefined,
    }
    expect(() => installModulePackage(raw)).toThrow(/unknown slot/)
    expect(useModulesStore.getState().modules).toEqual([])
    expect(useTaskStore.getState().lists.map((l) => l.id)).toEqual(["already-here"])
    expect(useTaskStore.getState().lists[0].moduleSlotId).toBeUndefined()
  })

  it("nativeTemplate commits buildModuleTemplate and ignores the rest", () => {
    useTaskStore.getState().addList(existingList())
    const id = installModulePackage({
      id: "facade-blank",
      name: "Ignored name",
      version: "9",
      nativeTemplate: "blank",
      slots: [{ name: "Should not be created" }],
      views: [{ kind: "checklist", title: "Ignored", slot: "nope" }],
    })
    const mod = useModulesStore.getState().modules.find((m) => m.id === id)
    expect(mod?.templateId).toBe("blank")
    expect(mod?.title).toBe("New Workspace")
    expect(mod?.config.package).toBeUndefined()
    expect(mod?.config.houseCleaning).toBeUndefined()
    expect(mod?.config.tripItinerary).toBeUndefined()
    expect(mod?.views?.map((v) => v.kind)).toEqual(["spreadsheet"])

    const created = useTaskStore.getState().lists.filter((l) => l.createdByModuleId === id)
    expect(created.map((l) => l.name)).toEqual(["New List"])
    expect(created[0].moduleSlotId).toBeUndefined()
    expect(useTaskStore.getState().lists.some((l) => l.name === "Should not be created")).toBe(false)

    const kept = useTaskStore.getState().lists.find((l) => l.id === "already-here")
    expect(kept?.createdByModuleId).toBeUndefined()
    expect(kept?.moduleSlotId).toBeUndefined()
    expect(kept?.name).toBe("Already here")
  })
})
