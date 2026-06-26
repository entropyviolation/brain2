import { beforeEach, describe, expect, it } from "vitest"
import type { ModuleDefinition } from "@/lib/types"
import {
  createEmptyDefinition,
  definitionToInstance,
  instantiateDefinition,
  parseModuleDefinition,
  serializeModuleDefinition,
  useModuleDefinitionsStore,
} from "./module-definitions"
import { useModulesStore } from "./modules-store"
import { useWorkflowsStore } from "./workflows-store"
import { useTaskStore } from "./task-store"

const sampleDef = (overrides: Partial<ModuleDefinition> = {}): ModuleDefinition => ({
  id: "def-1",
  name: "Reading Tracker",
  description: "Track books",
  lists: [{ role: "items", categoryId: "cat-books" }],
  views: [{ id: "v1", title: "Books", kind: "spreadsheet", config: { categoryId: "cat-books" } }],
  workflows: [
    {
      id: "wf-seed",
      name: "Tag new",
      trigger: { kind: "item", event: "create" },
      actions: [{ kind: "addTag", tag: "new" }],
    },
  ],
  enablePrint: true,
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
  useModuleDefinitionsStore.setState({ definitions: [] })
  useWorkflowsStore.setState({ workflows: [] })
  useModulesStore.setState({ modules: [] })
  useTaskStore.getState().clearAllData()
})

describe("module-definitions store — CRUD", () => {
  it("adds a definition and returns its id", () => {
    const store = useModuleDefinitionsStore.getState()
    const id = store.addDefinition({ name: "Trip", lists: [], views: [], workflows: [] })
    expect(id).toBeTruthy()
    expect(useModuleDefinitionsStore.getState().getDefinition(id)?.name).toBe("Trip")
  })

  it("addModuleDefinition is idempotent on id", () => {
    const def = sampleDef()
    useModuleDefinitionsStore.getState().addModuleDefinition(def)
    useModuleDefinitionsStore.getState().addModuleDefinition(def)
    expect(useModuleDefinitionsStore.getState().definitions).toHaveLength(1)
  })

  it("updates and removes a definition", () => {
    useModuleDefinitionsStore.getState().addModuleDefinition(sampleDef())
    useModuleDefinitionsStore.getState().updateDefinition("def-1", { name: "Renamed" })
    expect(useModuleDefinitionsStore.getState().getDefinition("def-1")?.name).toBe("Renamed")
    // id is protected from accidental overwrite via patch.
    useModuleDefinitionsStore.getState().updateDefinition("def-1", { id: "hacked" } as Partial<ModuleDefinition>)
    expect(useModuleDefinitionsStore.getState().getDefinition("def-1")).toBeDefined()

    useModuleDefinitionsStore.getState().removeDefinition("def-1")
    expect(useModuleDefinitionsStore.getState().getDefinition("def-1")).toBeUndefined()
  })

  it("createEmptyDefinition yields a usable blank", () => {
    const blank = createEmptyDefinition("Fresh")
    expect(blank.name).toBe("Fresh")
    expect(blank.lists).toEqual([])
    expect(blank.views).toEqual([])
    expect(blank.workflows).toEqual([])
    expect(blank.id).toBeTruthy()
  })
})

describe("module-definitions — export / import round-trip", () => {
  it("serializes and parses back an identical definition", () => {
    const def = sampleDef()
    const json = serializeModuleDefinition(def)
    const parsed = parseModuleDefinition(json)
    expect(parsed).toEqual(def)
  })

  it("accepts an { definition } envelope and fills array defaults", () => {
    const def = sampleDef()
    const enveloped = JSON.stringify({ kind: "module-definition", definition: def })
    expect(parseModuleDefinition(enveloped)).toEqual(def)

    const partial = parseModuleDefinition(JSON.stringify({ id: "x", name: "Min" }))
    expect(partial.lists).toEqual([])
    expect(partial.views).toEqual([])
    expect(partial.workflows).toEqual([])
  })

  it("rejects invalid JSON shapes", () => {
    expect(() => parseModuleDefinition(JSON.stringify({ name: "no id" }))).toThrow()
  })

  it("contains no functions (portable JSON)", () => {
    const json = serializeModuleDefinition(sampleDef())
    expect(json).not.toContain("function")
  })
})

describe("module-definitions — instantiate", () => {
  it("definitionToInstance maps a definition onto a workspace instance", () => {
    const def = sampleDef()
    const inst = definitionToInstance(def, "mod-fixed")
    expect(inst.id).toBe("mod-fixed")
    expect(inst.kind).toBe("workspace")
    expect(inst.title).toBe("Reading Tracker")
    expect(inst.views).toHaveLength(1)
    expect(inst.enablePrint).toBe(true)
    expect(inst.templateId).toBe(def.id)
  })

  it("instantiateDefinition creates an instance and registers scoped workflows", () => {
    useModuleDefinitionsStore.getState().addModuleDefinition(sampleDef())
    const instanceId = instantiateDefinition("def-1")
    expect(instanceId).toBeTruthy()

    const instance = useModulesStore.getState().modules.find((m) => m.id === instanceId)
    expect(instance?.kind).toBe("workspace")
    expect(instance?.views).toHaveLength(1)

    const wfs = useWorkflowsStore.getState().getForModule(instanceId!)
    expect(wfs).toHaveLength(1)
    expect(wfs[0].moduleId).toBe(instanceId)
    expect(wfs[0].id).not.toBe("wf-seed") // fresh id avoids collisions
    expect(wfs[0].actions[0]).toEqual({ kind: "addTag", tag: "new" })
  })

  it("instantiate twice yields distinct instances + workflow ids", () => {
    useModuleDefinitionsStore.getState().addModuleDefinition(sampleDef())
    const a = instantiateDefinition("def-1")
    const b = instantiateDefinition("def-1")
    expect(a).not.toBe(b)
    const wfA = useWorkflowsStore.getState().getForModule(a!)[0]
    const wfB = useWorkflowsStore.getState().getForModule(b!)[0]
    expect(wfA.id).not.toBe(wfB.id)
  })

  it("instantiate layers attribute extensions onto the bound list", () => {
    useTaskStore.getState().addList({
      id: "cat-books",
      name: "Books",
      color: "#fff",
      createdAt: new Date(),
      itemAttributes: [{ id: "title", name: "Title", type: "string" }],
    })
    useModuleDefinitionsStore.getState().addModuleDefinition(
      sampleDef({
        lists: [
          {
            role: "items",
            categoryId: "cat-books",
            attributeExtensions: [{ id: "rating", name: "Rating", type: "number" }],
          },
        ],
      }),
    )
    instantiateDefinition("def-1")
    const cat = useTaskStore.getState().lists.find((c) => c.id === "cat-books")
    expect(cat?.itemAttributes?.map((a) => a.id)).toEqual(["title", "rating"])
  })

  it("returns undefined for an unknown definition", () => {
    expect(instantiateDefinition("nope")).toBeUndefined()
  })
})
