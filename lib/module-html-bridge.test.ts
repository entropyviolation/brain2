import { describe, expect, it, vi } from "vitest"
import type { List, Task } from "@/lib/types"
import {
  BridgeError,
  bridgeSnapshot,
  buildSrcDoc,
  handleBridgeCall,
  type BridgeHost,
} from "./module-html-bridge"

const list = (id: string): List =>
  ({ id, name: `List ${id}`, color: "#000", createdAt: new Date(), itemAttributes: [{ id: "n", name: "N", type: "number" }] }) as List
const task = (id: string, lists: string[]): Task =>
  ({ id, title: `T${id}`, description: `T${id}`, completed: false, lists, attributes: { n: 3 } }) as unknown as Task

const lists = [list("a"), list("b")]
const tasks = [task("1", ["a"]), task("2", ["b"])]

function host(over: Partial<BridgeHost> = {}): BridgeHost {
  return { lists, tasks, createItem: vi.fn(() => "new"), updateItem: vi.fn(), openItem: vi.fn(), setKv: vi.fn(), ...over }
}

describe("bridgeSnapshot", () => {
  it("shows only attached lists and their items", () => {
    const s = bridgeSnapshot(lists, tasks, { listIds: ["a"], canWrite: false })
    expect(s.lists.map((l) => l.id)).toEqual(["a"])
    expect(s.items.map((i) => i.id)).toEqual(["1"])
    expect(s.lists[0].attributes[0]).toMatchObject({ id: "n", type: "number" })
  })
  it("shows nothing when no list is attached", () => {
    expect(bridgeSnapshot(lists, tasks, { listIds: [], canWrite: true })).toEqual({ lists: [], items: [] })
  })
})

describe("handleBridgeCall", () => {
  const ro = { listIds: ["a"], canWrite: false }
  const rw = { listIds: ["a"], canWrite: true }

  it("refuses writes without the grant", () => {
    const h = host()
    expect(() => handleBridgeCall({ method: "createItem", listId: "a", item: { title: "x" } }, h, ro)).toThrow(BridgeError)
    expect(() => handleBridgeCall({ method: "updateItem", id: "1", patch: { completed: true } }, h, ro)).toThrow(BridgeError)
    expect(h.createItem).not.toHaveBeenCalled()
  })
  it("refuses lists and items that are not attached", () => {
    const h = host()
    expect(() => handleBridgeCall({ method: "createItem", listId: "b", item: {} }, h, rw)).toThrow(/not attached/)
    expect(() => handleBridgeCall({ method: "updateItem", id: "2", patch: {} }, h, rw)).toThrow(/not on an attached/)
    expect(() => handleBridgeCall({ method: "openItem", id: "2" }, h, rw)).toThrow(BridgeError)
  })
  it("writes on an attached list when allowed", () => {
    const h = host()
    expect(handleBridgeCall({ method: "createItem", listId: "a", item: { title: "x" } }, h, rw)).toBe("new")
    handleBridgeCall({ method: "updateItem", id: "1", patch: { completed: true } }, h, rw)
    expect(h.updateItem).toHaveBeenCalledWith(tasks[0], { completed: true })
  })
  it("stores kv without any list grant", () => {
    const h = host()
    handleBridgeCall({ method: "setKv", key: "k", value: "v" }, h, { listIds: [], canWrite: false })
    expect(h.setKv).toHaveBeenCalledWith("k", "v")
  })
})

describe("buildSrcDoc", () => {
  const cfg = { kv: { k: "</script>" }, grants: { listIds: ["a"], canWrite: true } }
  it("injects the bridge first in an existing head", () => {
    const out = buildSrcDoc("<!doctype html><html><head><title>T</title></head><body>hi</body></html>", cfg)
    expect(out.indexOf("__BRAIN2_CFG__")).toBeLessThan(out.indexOf("<title>"))
    expect(out).toContain("window.brain2")
  })
  it("escapes values that would close the script early", () => {
    const out = buildSrcDoc("<html><body>x</body></html>", cfg)
    expect(out).not.toContain('"</script>"')
    expect(out).toContain("\\u003c/script>")
  })
  it("wraps a bare fragment", () => {
    const out = buildSrcDoc("<!DOCTYPE html><p>hello</p>", cfg)
    expect(out.match(/<!doctype/gi)).toHaveLength(1)
    expect(out).toContain("<p>hello</p>")
  })
})
