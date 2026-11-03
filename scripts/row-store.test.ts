import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { EventEmitter } from "node:events"
import { afterEach, describe, expect, it } from "vitest"
import { openRowStore, closeRowStore, mirrorTaskVault, changesSince, splitTaskVault, patchApplied, recordPatch, rowSeqs } from "@/scripts/row-store.mjs"
import { _resetSharedPersistForTests, handlePersistApi, flushSharedPersistSync, upsertSharedPersistItem, readSharedPersist } from "@/scripts/persist-api.mjs"

const dirs: string[] = []
function tmp() {
  const d = mkdtempSync(path.join(tmpdir(), "rows-"))
  dirs.push(d)
  return d
}
afterEach(() => {
  _resetSharedPersistForTests(path.join(tmpdir(), "unused-persist.json"))
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function vault(tasks: Array<Record<string, unknown>>, lists: Array<Record<string, unknown>> = []) {
  return JSON.stringify({ state: { tasks, lists, folders: [], removedTaskIds: ["gone"], priorityFormula: { a: 1 } }, version: 3 })
}

describe("row store", () => {
  it("mirrors rows, bumps seq only for changed rows, tombstones deletes", () => {
    const store = openRowStore(path.join(tmp(), "r.sqlite"))
    const first = mirrorTaskVault(store, vault([{ id: "a", title: "A" }, { id: "b", title: "B" }], [{ id: "l1" }]))
    expect(first).toMatchObject({ changed: 4, deleted: 0, ok: true }) // 2 tasks, 1 list, state
    const all = changesSince(store, 0)
    expect(all.rows.map((r: { id: string }) => r.id).sort()).toEqual(["a", "b", "l1", "state"])
    const cursor = all.cursor

    expect(mirrorTaskVault(store, vault([{ id: "a", title: "A" }, { id: "b", title: "B" }], [{ id: "l1" }]))).toMatchObject({ changed: 0 })
    expect(changesSince(store, cursor).rows).toEqual([])

    mirrorTaskVault(store, vault([{ id: "a", title: "A2" }], [{ id: "l1" }]))
    const delta = changesSince(store, cursor)
    expect(delta.rows.map((r: { id: string; deleted: boolean }) => [r.id, r.deleted]).sort()).toEqual([["a", false], ["b", true]])
    expect(delta.rows.find((r: { id: string }) => r.id === "a").row.title).toBe("A2")

    mirrorTaskVault(store, vault([{ id: "a", title: "A2" }, { id: "b", title: "B" }], [{ id: "l1" }]))
    expect(changesSince(store, delta.cursor).rows).toMatchObject([{ id: "b", deleted: false }])
    closeRowStore(store)
  })

  it("survives a reopen and pages with limit", () => {
    const file = path.join(tmp(), "r.sqlite")
    let store = openRowStore(file)
    mirrorTaskVault(store, vault(Array.from({ length: 5 }, (_, i) => ({ id: `t${i}` }))))
    closeRowStore(store)
    store = openRowStore(file)
    expect(mirrorTaskVault(store, vault(Array.from({ length: 5 }, (_, i) => ({ id: `t${i}` }))))).toMatchObject({ changed: 0 })
    const page = changesSince(store, 0, { limit: 3 })
    expect(page.rows).toHaveLength(3)
    expect(page.more).toBe(true)
    expect(changesSince(store, page.cursor, { limit: 3 }).more).toBe(false)
    closeRowStore(store)
  })

  it("ignores a blob that is not a task vault and keeps state out of rows", () => {
    const store = openRowStore(path.join(tmp(), "r.sqlite"))
    expect(mirrorTaskVault(store, "not json")).toMatchObject({ ok: false })
    expect(mirrorTaskVault(store, JSON.stringify({ state: { x: 1 } }))).toMatchObject({ ok: false })
    expect(changesSince(store, 0).rows).toEqual([])
    const split = splitTaskVault(vault([{ id: "a" }, { nope: true }]))!
    expect(split.skipped).toBe(1)
    closeRowStore(store)
  })

  it("hub serves /api/persist/rows from the same vault it writes to JSON", async () => {
    const dir = tmp()
    const file = path.join(dir, "shared-persist.json")
    writeFileSync(file, JSON.stringify({ items: {} }))
    _resetSharedPersistForTests(file, { rowMirror: true })
    upsertSharedPersistItem("brain2-task-storage", vault([{ id: "a", title: "A" }]), "test")
    flushSharedPersistSync()

    const res = Object.assign(new EventEmitter(), {
      statusCode: 0, body: "",
      writeHead(s: number) { this.statusCode = s },
      setHeader() {},
      end(b?: string) { this.body += b ?? "" },
    })
    const req = Object.assign(new EventEmitter(), { method: "GET", url: "/api/persist/rows?since=0", headers: {} })
    await handlePersistApi(req as never, res as never, "/api/persist/rows")
    const out = JSON.parse(res.body)
    expect(res.statusCode).toBe(200)
    expect(out.rows.map((r: { id: string }) => r.id).sort()).toEqual(["a", "state"])
  })
})

describe("row writes", () => {
  it("remembers applied patch ids and reports the newest seq per id", () => {
    const store = openRowStore(path.join(tmp(), "w.sqlite"))
    expect(patchApplied(store, "p1")).toBe(false)
    recordPatch(store, "p1")
    recordPatch(store, "p1")
    expect(patchApplied(store, "p1")).toBe(true)
    expect(patchApplied(store, "p2")).toBe(false)
    mirrorTaskVault(store, vault([{ id: "a", title: "A" }, { id: "b", title: "B" }]))
    const first = rowSeqs(store, ["a", "b", "nope"])
    expect([...first.keys()].sort()).toEqual(["a", "b"])
    mirrorTaskVault(store, vault([{ id: "a", title: "A2" }, { id: "b", title: "B" }]))
    expect(rowSeqs(store, ["a"]).get("a")!).toBeGreaterThan(first.get("a")!)
    expect(rowSeqs(store, ["b"]).get("b")).toBe(first.get("b"))
    closeRowStore(store)
  })
})

describe("phone patch with a patch id", () => {
  function call(body: unknown) {
    const res = Object.assign(new EventEmitter(), {
      statusCode: 0, body: "",
      writeHead(s: number) { this.statusCode = s },
      setHeader() {},
      end(b?: string) { this.body += b ?? "" },
    })
    const req = Object.assign(new EventEmitter(), { method: "POST", url: "/api/persist", headers: {} })
    const done = handlePersistApi(req as never, res as never, "/api/persist")
    setImmediate(() => { req.emit("data", Buffer.from(JSON.stringify(body))); req.emit("end") })
    return done.then(() => ({ status: res.statusCode, json: JSON.parse(res.body) }))
  }
  const task = (id: string, title: string) => ({ id, title, description: "", completed: false, subtasks: [], dependencies: [], tags: [], links: [], createdAt: "2026-01-01T00:00:00.000Z", type: "task" })
  const blob = (titles: Record<string, string>) =>
    JSON.stringify({ state: { tasks: Object.entries(titles).map(([id, t]) => task(id, t)), lists: [], folders: [], removedTaskIds: [] }, version: 0 })

  function seedHub() {
    const file = path.join(tmp(), "shared-persist.json")
    writeFileSync(file, JSON.stringify({ items: {} }))
    _resetSharedPersistForTests(file, { rowMirror: true })
    upsertSharedPersistItem("brain2-task-storage", blob({ a: "Milk", b: "Eggs" }), "test")
    flushSharedPersistSync()
    return file
  }
  const titles = () =>
    Object.fromEntries(JSON.parse((readSharedPersist().items as Record<string, string>)["brain2-task-storage"]).state.tasks.map((t: { id: string; title: string }) => [t.id, t.title]))

  it("applies once for a patch id and ignores the retry", async () => {
    seedHub()
    const body = { name: "brain2-task-storage", source: "phone", patchId: "p-1", patch: { upserts: [{ id: "a", title: "Oat milk" }], removedIds: [] } }
    const first = await call(body)
    expect(first.json).toMatchObject({ ok: true })
    expect(first.json.duplicate).toBeUndefined()
    expect(titles().a).toBe("Oat milk")
    const again = await call({ ...body, patch: { upserts: [{ id: "a", title: "SHOULD NOT LAND" }], removedIds: [] } })
    expect(again.json).toMatchObject({ ok: true, duplicate: true })
    expect(titles().a).toBe("Oat milk")
  })

  it("names rows that moved after the writer's cursor, and strict refuses only those", async () => {
    seedHub()
    const pull = await handlePull()
    // Another device edits "a" after the writer's cursor.
    upsertSharedPersistItem("brain2-task-storage", blob({ a: "Whole milk", b: "Eggs" }), "desk")
    const loose = await call({ name: "brain2-task-storage", source: "phone", patchId: "p-2", baseCursor: pull, patch: { upserts: [{ id: "a", title: "mine" }, { id: "b", title: "Eggs x12" }], removedIds: [] } })
    expect(loose.json.stale).toEqual(["a"])
    expect(loose.json.refused).toBe(false)
    expect(titles()).toMatchObject({ a: "mine", b: "Eggs x12" }) // field merge still lands

    const pull2 = await handlePull()
    upsertSharedPersistItem("brain2-task-storage", blob({ a: "desk edit", b: "Eggs x12" }), "desk")
    const strict = await call({ name: "brain2-task-storage", source: "phone", patchId: "p-3", baseCursor: pull2, strict: true, patch: { upserts: [{ id: "a", title: "phone edit" }, { id: "b", title: "Eggs x6" }], removedIds: [] } })
    expect(strict.json).toMatchObject({ ok: true, stale: ["a"], refused: true })
    expect(titles()).toMatchObject({ a: "desk edit", b: "Eggs x6" })
  })

  async function handlePull(): Promise<number> {
    const res = Object.assign(new EventEmitter(), { statusCode: 0, body: "", writeHead(s: number) { this.statusCode = s }, setHeader() {}, end(b?: string) { this.body += b ?? "" } })
    const req = Object.assign(new EventEmitter(), { method: "GET", url: "/api/persist/rows?since=0", headers: {} })
    await handlePersistApi(req as never, res as never, "/api/persist/rows")
    return JSON.parse(res.body).head
  }
})
