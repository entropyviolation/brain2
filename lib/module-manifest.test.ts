import { describe, expect, it } from "vitest"
import { ModulePackageError } from "@/lib/module-package"
import {
  looksLikeModuleManifest,
  manifestBridge,
  manifestDebt,
  parseModuleManifest,
  writableListIds,
} from "@/lib/module-manifest"
import { handleBridgeCall, type BridgeHost } from "@/lib/module-html-bridge"
import { packageAppGrants } from "@/lib/module-package-app"
import type { List, Task } from "@/lib/types"

function recipe(over: Record<string, unknown> = {}) {
  return {
    manifest: 1,
    id: "plants",
    name: "Plants",
    version: "1",
    slots: [
      { role: "plants", name: "Plants", policy: "create" },
      { role: "species", name: "Species", policy: "create" },
    ],
    views: [{ title: "Sheet", kind: "spreadsheet", slot: "plants" }],
    capabilities: { lists: { plants: "write", species: "read" }, bridges: [] },
    ...over,
  }
}

describe("parseModuleManifest", () => {
  it("reads a recipe and keeps its capabilities", () => {
    const m = parseModuleManifest(JSON.stringify(recipe()))
    expect(m.capabilities.lists).toEqual({ plants: "write", species: "read" })
    expect(m.slots.map((s) => s.role)).toEqual(["plants", "species"])
    expect(m.nativeTemplate).toBeUndefined()
  })

  it("needs manifest: 1", () => {
    expect(() => parseModuleManifest(recipe({ manifest: 2 }))).toThrow(ModulePackageError)
  })

  it("refuses a slot with no access", () => {
    expect(() => parseModuleManifest(recipe({ capabilities: { lists: { plants: "write" }, bridges: [] } }))).toThrow(
      /no entry for slot "species"/,
    )
  })

  it("refuses access for a slot that does not exist", () => {
    const capabilities = { lists: { plants: "write", species: "read", pots: "read" }, bridges: [] }
    expect(() => parseModuleManifest(recipe({ capabilities }))).toThrow(/unknown slot "pots"/)
  })

  it("refuses a workflow that writes a read-only slot", () => {
    const workflows = [
      {
        name: "Add",
        trigger: { kind: "manual" },
        actions: [{ kind: "createItem", categoryId: "species" }],
      },
    ]
    expect(() => parseModuleManifest(recipe({ workflows }))).toThrow(/read-only/)
  })

  it("lets a quiet workflow watch a read-only slot", () => {
    const workflows = [
      {
        name: "Flag",
        scope: { listIds: ["species"] },
        trigger: { kind: "item", event: "create" },
        actions: [{ kind: "throw", message: "check it" }],
      },
    ]
    expect(parseModuleManifest(recipe({ workflows })).workflows).toHaveLength(1)
  })

  it("refuses a view that names an unknown slot", () => {
    const views = [{ title: "Sheet", kind: "spreadsheet", slot: "pots" }]
    expect(() => parseModuleManifest(recipe({ views }))).toThrow(/unknown slot "pots"/)
  })

  it("reads each bridge and refuses unknown ones", () => {
    const bridges = [
      { bridge: "habits", measures: ["pages"] },
      { bridge: "network", hosts: ["api.example.org", "*.tile.openstreetmap.org"] },
      { bridge: "ingest", phrases: ["plant"] },
    ]
    const m = parseModuleManifest(recipe({ capabilities: { lists: { plants: "write", species: "read" }, bridges } }))
    expect(manifestBridge(m, "habits")?.measures).toEqual(["pages"])
    expect(manifestBridge(m, "points")).toBeUndefined()
    const bad = { lists: { plants: "write", species: "read" }, bridges: [{ bridge: "root" }] }
    expect(() => parseModuleManifest(recipe({ capabilities: bad }))).toThrow(/not a bridge/)
  })

  it("refuses a network grant that is not a host name", () => {
    const capabilities = { lists: { plants: "write", species: "read" }, bridges: [{ bridge: "network", hosts: ["https://x.org/a"] }] }
    expect(() => parseModuleManifest(recipe({ capabilities }))).toThrow(/not a host name/)
  })

  it("keeps private stores and desktop doors for compiled templates", () => {
    const bridges = [{ bridge: "private-store", where: "localStorage", keys: ["mine"] }]
    const capabilities = { lists: { plants: "write", species: "read" }, bridges }
    expect(() => parseModuleManifest(recipe({ capabilities }))).toThrow(/only for a compiled template/)
    const native = parseModuleManifest({
      manifest: 1,
      id: "gradsearch",
      name: "GradSearch",
      version: "1",
      nativeTemplate: "gradsearch",
      views: [{ title: "Explorer", kind: "grad-search" }],
      capabilities: { lists: {}, bridges },
    })
    expect(manifestDebt(native)).toEqual([{ bridge: "private-store", where: "localStorage", keys: ["mine"] }])
  })

  it("tells a manifest from a plain package", () => {
    expect(looksLikeModuleManifest(JSON.stringify(recipe()))).toBe(true)
    expect(looksLikeModuleManifest(JSON.stringify({ id: "x", slots: [] }))).toBe(false)
    expect(looksLikeModuleManifest("not json")).toBe(false)
  })
})

describe("list access reaches the sandbox", () => {
  const pkg = { id: "plants", version: "1", slots: { plants: "L1", species: "L2" }, access: { plants: "write", species: "read" } as const }

  it("lists only the write slots", () => {
    expect(writableListIds(pkg)).toEqual(["L1"])
    expect(writableListIds({ slots: { plants: "L1" } })).toBeUndefined()
  })

  it("lets a package-app frame read both lists and write one", () => {
    const grants = packageAppGrants({ categoryId: "L1", htmlListIds: ["L2"] }, writableListIds(pkg))
    expect(grants).toEqual({ listIds: ["L1", "L2"], canWrite: true, writeListIds: ["L1"] })

    const list = (id: string) => ({ id, name: id, color: "#000", createdAt: new Date() }) as List
    const task = (id: string, listId: string) => ({ id, title: id, completed: false, lists: [listId] }) as unknown as Task
    const host: BridgeHost = {
      lists: [list("L1"), list("L2")],
      tasks: [task("a", "L1"), task("b", "L2")],
      createItem: () => "new",
      updateItem: () => {},
      setKv: () => {},
    }
    expect(handleBridgeCall({ method: "createItem", listId: "L1", item: {} }, host, grants)).toBe("new")
    expect(() => handleBridgeCall({ method: "createItem", listId: "L2", item: {} }, host, grants)).toThrow(/only read/)
    expect(() => handleBridgeCall({ method: "updateItem", id: "b", patch: {} }, host, grants)).toThrow(/only read/)
    expect(handleBridgeCall({ method: "updateItem", id: "a", patch: {} }, host, grants)).toBe(true)
  })

  it("keeps the old rule when no manifest recorded access", () => {
    expect(packageAppGrants({ categoryId: "L1" })).toEqual({ listIds: ["L1"], canWrite: true })
  })
})
