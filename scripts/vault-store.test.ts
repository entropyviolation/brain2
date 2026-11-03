import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  openVaultStore, closeVaultStore, writeKeys, loadAll, compareItems, replaceAll, storeRev, storeIsEmpty,
} from "@/scripts/vault-store.mjs"
import {
  _resetSharedPersistForTests, readSharedPersist, upsertSharedPersistItem, flushSharedPersist, flushSharedPersistSync,
  exportJsonSync, handlePersistApi,
} from "@/scripts/persist-api.mjs"
import { run as cli } from "@/scripts/vault-store-cli.mjs"
import { EventEmitter } from "node:events"

const dirs: string[] = []
function tmp() {
  const d = mkdtempSync(path.join(tmpdir(), "vault-"))
  dirs.push(d)
  return d
}
afterEach(() => {
  _resetSharedPersistForTests(path.join(tmpdir(), "unused-persist.json"))
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const item = (n: number) => JSON.stringify({ state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) }, version: 1 })
const diskItems = (file: string) => JSON.parse(readFileSync(file, "utf8")).items as Record<string, string>

describe("vault store", () => {
  it("commits changed keys, bumps rev only on change, deletes, and compares by hash", () => {
    const store = openVaultStore(path.join(tmp(), "v.sqlite"))
    expect(storeIsEmpty(store)).toBe(true)
    const items: Record<string, string> = { "brain2-a": "1", "brain2-b": "2" }
    expect(writeKeys(store, items, ["brain2-a", "brain2-b"], { updatedAt: "t1", source: "x" })).toBe(2)
    const rev = storeRev(store)
    expect(writeKeys(store, items, ["brain2-a"])).toBe(0)
    expect(storeRev(store)).toBe(rev)
    items["brain2-a"] = "1b"
    delete items["brain2-b"]
    expect(writeKeys(store, items, ["brain2-a", "brain2-b"])).toBe(2)
    expect(storeRev(store)).toBeGreaterThan(rev)
    const all = loadAll(store) as { items: Record<string, string>; updatedAt: string | null }
    expect(all.items).toEqual({ "brain2-a": "1b" })
    expect(all.updatedAt).toBe("t1")
    expect(compareItems(store, { "brain2-a": "1b", "brain2-c": "3" })).toEqual({ missing: ["brain2-c"], differing: [], extra: [] })
    expect(compareItems(store, { "brain2-a": "zz" }).differing).toEqual(["brain2-a"])
    replaceAll(store, { "brain2-c": "3" })
    expect(loadAll(store).items).toEqual({ "brain2-c": "3" })
    closeVaultStore(store)
  })
})

describe("hub in sqlite mode", () => {
  function seededFile(items: Record<string, string>) {
    const file = path.join(tmp(), "shared-persist.json")
    writeFileSync(file, JSON.stringify({ updatedAt: "2026-01-01T00:00:00.000Z", source: "seed", items }))
    return file
  }

  it("seeds an empty store from the JSON file once, never deleting the file", () => {
    const file = seededFile({ "brain2-notes": item(3), "cogs-notes": item(3) })
    _resetSharedPersistForTests(file, { store: "sqlite" })
    expect(Object.keys(readSharedPersist().items).sort()).toEqual(["brain2-notes", "cogs-notes"])
    expect(existsSync(file)).toBe(true)
    expect(existsSync(`${file}.vaults.sqlite`)).toBe(true)
  })

  it("keeps a write across a restart without the JSON file, and exports the file on demand", async () => {
    const file = seededFile({ "brain2-notes": item(3) })
    _resetSharedPersistForTests(file, { store: "sqlite" })
    upsertSharedPersistItem("brain2-notes", item(5), "test")
    await flushSharedPersist()
    // The export is write-behind: the file still has the old copy until it runs.
    expect(JSON.parse(diskItems(file)["brain2-notes"]).state.entries).toHaveLength(3)
    expect(exportJsonSync()).toBe(true)
    expect(JSON.parse(diskItems(file)["brain2-notes"]).state.entries).toHaveLength(5)
    expect(diskItems(file)["cogs-notes"]).toBe(diskItems(file)["brain2-notes"])

    // Restart with the file gone: the store is the truth.
    rmSync(file)
    _resetSharedPersistForTests(file, { store: "sqlite" })
    const items = readSharedPersist().items as Record<string, string>
    expect(JSON.parse(items["brain2-notes"]).state.entries).toHaveLength(5)
  })

  it("async flush commits too, and the exit export writes the file", async () => {
    const file = seededFile({ "brain2-notes": item(2) })
    _resetSharedPersistForTests(file, { store: "sqlite" })
    upsertSharedPersistItem("brain2-notes", item(4), "test")
    await flushSharedPersist()
    const store = openVaultStore(`${file}.vaults.sqlite`)
    expect(JSON.parse((loadAll(store).items as Record<string, string>)["brain2-notes"]).state.entries).toHaveLength(4)
    closeVaultStore(store)
    flushSharedPersistSync()
    exportJsonSync()
    expect(JSON.parse(diskItems(file)["brain2-notes"]).state.entries).toHaveLength(4)
    expect(readdirSync(path.dirname(file)).filter((f) => f.endsWith(".tmp"))).toEqual([])
  })

  it("sees another process's write through the store revision", () => {
    const file = seededFile({ "brain2-notes": item(2) })
    _resetSharedPersistForTests(file, { store: "sqlite" })
    readSharedPersist()
    const other = openVaultStore(`${file}.vaults.sqlite`)
    writeKeys(other, { "brain2-notes": item(9) }, ["brain2-notes"])
    closeVaultStore(other)
    const items = readSharedPersist().items as Record<string, string>
    expect(JSON.parse(items["brain2-notes"]).state.entries).toHaveLength(9)
  })

  it("answers health with the mode", async () => {
    const file = seededFile({ "brain2-notes": item(2) })
    _resetSharedPersistForTests(file, { store: "sqlite" })
    const res = Object.assign(new EventEmitter(), { statusCode: 0, body: "", writeHead(s: number) { this.statusCode = s }, setHeader() {}, end(b?: string) { this.body += b ?? "" } })
    const req = Object.assign(new EventEmitter(), { method: "GET", url: "/api/persist/health", headers: {} })
    await handlePersistApi(req as never, res as never, "/api/persist/health")
    expect(JSON.parse(res.body).store.mode).toBe("sqlite")
  })
})

describe("hub in shadow mode", () => {
  it("keeps the file as the truth, follows it in the store, and repairs drift", () => {
    const file = path.join(tmp(), "shared-persist.json")
    writeFileSync(file, JSON.stringify({ items: { "brain2-notes": item(2) } }))
    _resetSharedPersistForTests(file, { store: "shadow" })
    readSharedPersist()
    upsertSharedPersistItem("brain2-notes", item(6), "test")
    flushSharedPersistSync()
    expect(JSON.parse(diskItems(file)["brain2-notes"]).state.entries).toHaveLength(6)
    let store = openVaultStore(`${file}.vaults.sqlite`)
    expect(compareItems(store, { "brain2-notes": item(6) })).toEqual({ missing: [], differing: [], extra: [] })
    // Drift: the store is corrupted behind the hub's back; the next reload from the file repairs it.
    writeKeys(store, { "brain2-notes": item(1) }, ["brain2-notes"])
    closeVaultStore(store)
    _resetSharedPersistForTests(file, { store: "shadow" })
    readSharedPersist()
    store = openVaultStore(`${file}.vaults.sqlite`)
    expect(compareItems(store, { "brain2-notes": item(6) }).differing).toEqual([])
    closeVaultStore(store)
  })

  it("json mode makes no store file", () => {
    const file = path.join(tmp(), "shared-persist.json")
    writeFileSync(file, JSON.stringify({ items: { "brain2-notes": item(2) } }))
    _resetSharedPersistForTests(file)
    upsertSharedPersistItem("brain2-notes", item(3), "test")
    flushSharedPersistSync()
    expect(existsSync(`${file}.vaults.sqlite`)).toBe(false)
  })
})

describe("store cli", () => {
  it("checks, imports, refuses to clobber, and exports with the old file kept aside", () => {
    const file = path.join(tmp(), "shared-persist.json")
    writeFileSync(file, JSON.stringify({ updatedAt: "u", source: "s", items: { "brain2-notes": item(2), "cogs-notes": item(2) } }))
    const out: string[] = []
    const log = (m: string) => out.push(m)
    expect(cli(["check", "--file", file], log)).toBe(1)
    expect(cli(["import", "--file", file], log)).toBe(0)
    expect(cli(["check", "--file", file], log)).toBe(0)
    // The file moves on; a plain import must not overwrite a store that differs.
    writeFileSync(file, JSON.stringify({ items: { "brain2-notes": item(7), "cogs-notes": item(7) } }))
    expect(cli(["import", "--file", file], log)).toBe(1)
    expect(cli(["export", "--file", file], log)).toBe(0)
    expect(JSON.parse(diskItems(file)["brain2-notes"]).state.entries).toHaveLength(2)
    expect(readdirSync(path.dirname(file)).some((f) => f.includes("before-export"))).toBe(true)
    expect(cli(["check", "--file", file], log)).toBe(0)
  })
})
