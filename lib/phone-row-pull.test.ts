import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { openRowStore, closeRowStore, mirrorTaskVault, changesSince, rowOrder } from "@/scripts/row-store.mjs"
import { pullTaskVaultRows, readRowHead, rowBaseFrom, TASK_VAULT_KEY } from "@/lib/phone-row-pull"
import { applyRowChanges, hashIds } from "@/lib/row-vault.js"

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

type Task = { id: string; title: string }
const vault = (tasks: Task[], lists: Array<{ id: string }> = [{ id: "l1" }]) =>
  JSON.stringify({ state: { tasks, lists, folders: [], removedTaskIds: ["x"], priorityFormula: { a: 1 } }, version: 3 })

/** A hub that answers the rows endpoint from a real mirror. */
function fakeHub(file = path.join(mkdtempSync(path.join(tmpdir(), "pull-")), "r.sqlite")) {
  dirs.push(path.dirname(file))
  const store = openRowStore(file)
  const hub = {
    store,
    set(blob: string) {
      mirrorTaskVault(store, blob)
    },
    get: async (p: string) => {
      const q = new URLSearchParams(p.split("?")[1])
      const page = changesSince(store, q.get("since"), { limit: q.get("limit") })
      return { ok: true, ...page, ...(q.get("order") === "1" ? { order: rowOrder(store) } : {}) }
    },
  }
  return hub
}

async function baseOf(hub: ReturnType<typeof fakeHub>, blob: string) {
  hub.set(blob)
  const head = await readRowHead(hub.get)
  return rowBaseFrom("http://hub", head, { [TASK_VAULT_KEY]: blob })!
}

describe("row pull", () => {
  it("rebuilds the vault after an edit, an add and a delete", async () => {
    const hub = fakeHub()
    const base = await baseOf(hub, vault([{ id: "a", title: "A" }, { id: "b", title: "B" }]))
    const next = vault([{ id: "a", title: "A2" }, { id: "c", title: "C" }])
    hub.set(next)
    const pulled = await pullTaskVaultRows(hub.get, base)
    expect(pulled).not.toBeNull()
    expect(JSON.parse(pulled!.blob)).toEqual(JSON.parse(next))
    expect(pulled!.base.cursor).toBeGreaterThan(base.cursor)
    // Nothing changed: same vault, same cursor.
    const again = await pullTaskVaultRows(hub.get, pulled!.base)
    expect(JSON.parse(again!.blob)).toEqual(JSON.parse(next))
    closeRowStore(hub.store)
  })

  it("restores hub order when a row is inserted in the middle", async () => {
    const hub = fakeHub()
    const base = await baseOf(hub, vault([{ id: "a", title: "A" }, { id: "c", title: "C" }]))
    const next = vault([{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }])
    hub.set(next)
    const pulled = await pullTaskVaultRows(hub.get, base)
    expect(JSON.parse(pulled!.blob).state.tasks.map((t: Task) => t.id)).toEqual(["a", "b", "c"])
    closeRowStore(hub.store)
  })

  it("falls back (null) on a new epoch, a cursor ahead of the hub, or a missed change", async () => {
    const hub = fakeHub()
    const base = await baseOf(hub, vault([{ id: "a", title: "A" }]))
    expect(await pullTaskVaultRows(hub.get, { ...base, epoch: "other" })).toBeNull()
    expect(await pullTaskVaultRows(hub.get, { ...base, cursor: base.cursor + 100 })).toBeNull()
    // Base blob missing a row the hub has and no row change to explain it.
    const stale = { ...base, blob: vault([]) }
    expect(await pullTaskVaultRows(hub.get, stale)).toBeNull()
    expect(await pullTaskVaultRows(async () => null, base)).toBeNull()
    closeRowStore(hub.store)
  })

  it("pages through a large delta", async () => {
    const hub = fakeHub()
    const base = await baseOf(hub, vault([]))
    const tasks = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, title: "x" }))
    hub.set(vault(tasks))
    const small = (p: string) => hub.get(p + (p.includes("limit") ? "" : "&limit=7"))
    const pulled = await pullTaskVaultRows(small, base)
    expect(JSON.parse(pulled!.blob).state.tasks).toHaveLength(30)
    closeRowStore(hub.store)
  })
})

describe("row vault helpers", () => {
  it("refuses a base with an id-less row", () => {
    expect(applyRowChanges(JSON.stringify({ state: { tasks: [{ title: "no id" }] }, version: 1 }), [])).toBeNull()
  })
  it("hashes ids the same regardless of call site", () => {
    expect(hashIds(["a", "b"])).toBe(hashIds(["a", "b"]))
    expect(hashIds(["a", "b"])).not.toBe(hashIds(["b", "a"]))
  })
})
