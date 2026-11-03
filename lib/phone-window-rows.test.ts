/**
 * lib/phone-window-rows.test.ts — A second load pulls the task vault as rows; any doubt downloads it whole.
 */
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { enqueueOutbox } from "@/lib/phone-window-cache"
import { engagePhoneWindow, flushPhoneOutbox, loadPhoneWindow, resetPhoneWindowForTests } from "@/lib/phone-window"
import { useTaskStore } from "@/lib/task-store"
import { PHONE_UA, hubFetch, outboxRow, patch } from "@/tests/phone-builders"
import { openRowStore, closeRowStore, mirrorTaskVault, changesSince, rowOrder } from "@/scripts/row-store.mjs"

const dir = mkdtempSync(path.join(tmpdir(), "pw-rows-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const blob = (titles: Record<string, string>) =>
  JSON.stringify({
    state: {
      tasks: Object.entries(titles).map(([id, title]) => ({ id, title, description: "", completed: false, subtasks: [], dependencies: [], tags: [], links: [], createdAt: "2026-01-01T00:00:00.000Z", type: "task" })),
      lists: [],
      folders: [],
      removedTaskIds: [],
    },
    version: 0,
  })

beforeEach(() => {
  localStorage.clear()
  resetPhoneWindowForTests()
  useTaskStore.getState().clearAllData()
  vi.stubGlobal("navigator", { userAgent: PHONE_UA, language: "en-US" })
  engagePhoneWindow()
})

describe("phone window row pull", () => {
  it("reloads the task vault from rows and still lands the hub's edit", async () => {
    const store = openRowStore(path.join(dir, "r.sqlite"))
    const v1 = blob({ a: "Milk" })
    mirrorTaskVault(store, v1)
    const hub = hubFetch({
      items: { "brain2-task-storage": v1 },
      rows: (url) => {
        const q = new URLSearchParams(url.split("?")[1])
        const page = changesSince(store, q.get("since"), { limit: q.get("limit") })
        return { status: 200, body: { ok: true, ...page, ...(q.get("order") === "1" ? { order: rowOrder(store) } : {}) } }
      },
    })
    vi.stubGlobal("fetch", hub.fn)
    expect(await loadPhoneWindow()).toBe("live")
    expect(hub.canonCalls.every((u) => !u.includes("skip="))).toBe(true)

    // The hub's file moves on. Its canon still holds the old blob: a row pull must not read it.
    mirrorTaskVault(store, blob({ a: "Oat milk", b: "Eggs" }))
    expect(await loadPhoneWindow()).toBe("live")
    expect(hub.canonCalls.at(-1)).toContain("skip=brain2-task-storage")
    const titles = useTaskStore.getState().tasks.map((t) => t.title).sort()
    expect(titles).toEqual(["Eggs", "Oat milk"])
    closeRowStore(store)
  })

  it("downloads the whole vault when the hub has no row endpoint", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    expect(await loadPhoneWindow()).toBe("live")
    expect(await loadPhoneWindow()).toBe("live")
    expect(hub.canonCalls.every((u) => !u.includes("skip="))).toBe(true)
  })
})

describe("phone patch row fields", () => {
  it("sends the outbox row id as patchId and the row cursor as baseCursor", async () => {
    const store = openRowStore(path.join(dir, "w.sqlite"))
    const v1 = blob({ a: "Milk" })
    mirrorTaskVault(store, v1)
    const hub = hubFetch({
      items: { "brain2-task-storage": v1 },
      rows: (url) => {
        const q = new URLSearchParams(url.split("?")[1])
        const page = changesSince(store, q.get("since"), { limit: q.get("limit") })
        return { status: 200, body: { ok: true, ...page } }
      },
    })
    vi.stubGlobal("fetch", hub.fn)
    expect(await loadPhoneWindow()).toBe("live")
    await enqueueOutbox(outboxRow({ id: "row-x", patch: patch([{ id: "a", title: "Oat milk" }]) }))
    expect(await flushPhoneOutbox({ force: true })).toBe(1)
    expect(hub.extras).toEqual([{ patchId: "row-x", baseCursor: changesSince(store, 0).head }])
    closeRowStore(store)
  })

  it("sends no baseCursor for another vault or a hub without rows", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    expect(await loadPhoneWindow()).toBe("live")
    await enqueueOutbox(outboxRow({ id: "row-y", patch: patch([{ id: "a", title: "x" }]) }))
    await flushPhoneOutbox({ force: true })
    expect(hub.extras).toEqual([{ patchId: "row-y", baseCursor: undefined }])
  })
})
