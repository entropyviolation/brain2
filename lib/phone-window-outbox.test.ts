/**
 * lib/phone-window-outbox.test.ts — Outbox send order, duplicates, double taps, and why a load missed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { enqueueOutbox, listOutbox, orderOutbox } from "@/lib/phone-window-cache"
import {
  engagePhoneWindow,
  flushPhoneOutbox,
  getPhoneWindowReport,
  getPhoneWindowSnapshot,
  loadPhoneWindow,
  phoneWindowNote,
  resetPhoneWindowForTests,
} from "@/lib/phone-window"
import { useTaskStore } from "@/lib/task-store"
import { PHONE_UA, hubFetch, outboxRow, patch } from "@/tests/phone-builders"

function asPhone() {
  vi.stubGlobal("navigator", { userAgent: PHONE_UA, language: "en-US" })
  engagePhoneWindow()
}

beforeEach(() => {
  localStorage.clear()
  resetPhoneWindowForTests()
  useTaskStore.getState().clearAllData()
  asPhone()
})

describe("outbox order", () => {
  it("lists rows in the order they were made, not by their random id", async () => {
    await enqueueOutbox(outboxRow({ id: "zz", patch: patch([{ id: "a", title: "first" }]) }))
    await enqueueOutbox(outboxRow({ id: "aa", patch: patch([{ id: "a", title: "second" }]) }))
    expect((await listOutbox()).map((r) => r.id)).toEqual(["zz", "aa"])
    // IndexedDB getAll returns key order; the sort undoes it.
    const [zz, aa] = await listOutbox()
    expect(orderOutbox([aa, zz]).map((r) => r.id)).toEqual(["zz", "aa"])
  })

  it("holds a store's later patch behind one the Mac refused, then sends both in order", async () => {
    let refuse = true
    // Only the older row misses. Before the hold, the newer one landed first and the older one undid it.
    const hub = hubFetch({ post: (body) => (refuse && body.patch.upserts[0].title === "A" ? { status: 500 } : { status: 200 }) })
    vi.stubGlobal("fetch", hub.fn)
    expect(await loadPhoneWindow()).toBe("live")

    await enqueueOutbox(outboxRow({ id: "older", patch: patch([{ id: "a", title: "A" }]) }))
    await enqueueOutbox(outboxRow({ id: "newer", patch: patch([{ id: "a", title: "B" }]) }))
    expect(await flushPhoneOutbox()).toBe(0)
    expect(hub.posts).toEqual([])
    expect((await getPhoneWindowReport()).outbox).toBe(2)

    refuse = false
    expect(await flushPhoneOutbox()).toBe(2)
    expect(hub.posts.map((p) => p.patch.upserts[0].title)).toEqual(["A", "B"])
    expect((await getPhoneWindowReport()).outbox).toBe(0)
  })

  it("does not hold another store behind a refused one", async () => {
    const hub = hubFetch({ post: (body) => (body.name === "brain2-task-storage" ? { status: 500 } : { status: 200 }) })
    vi.stubGlobal("fetch", hub.fn)
    await loadPhoneWindow()
    await enqueueOutbox(outboxRow({ id: "t" }))
    await enqueueOutbox(outboxRow({ id: "h", name: "brain2-habits-store", patch: patch([{ id: "h1", name: "Run" }]) }))
    expect(await flushPhoneOutbox()).toBe(1)
    expect(hub.posts.map((p) => p.name)).toEqual(["brain2-habits-store"])
  })

  it("keeps a row through a dropped connection and sends it once later", async () => {
    let drop = true
    const hub = hubFetch({ post: () => (drop ? "throw" : { status: 200 }) })
    vi.stubGlobal("fetch", hub.fn)
    await loadPhoneWindow()
    await enqueueOutbox(outboxRow({ id: "x" }))
    expect(await flushPhoneOutbox()).toBe(0)
    drop = false
    expect(await flushPhoneOutbox()).toBe(1)
    expect(await flushPhoneOutbox()).toBe(0)
    expect(hub.posts).toHaveLength(1)
  })

  it("two flushes at once (a double tap) send each row once", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    await loadPhoneWindow()
    await enqueueOutbox(outboxRow({ id: "one" }))
    await enqueueOutbox(outboxRow({ id: "two" }))
    await Promise.all([flushPhoneOutbox(), flushPhoneOutbox()])
    expect(hub.posts).toHaveLength(2)
  })

  it("sends nothing before the Mac has answered", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    await enqueueOutbox(outboxRow())
    expect(await flushPhoneOutbox()).toBe(0)
    expect(hub.fn).not.toHaveBeenCalled()
  })
})

describe("load", () => {
  it("a double tap on Refresh asks the Mac once", async () => {
    const hub = hubFetch()
    vi.stubGlobal("fetch", hub.fn)
    const [a, b] = await Promise.all([loadPhoneWindow(), loadPhoneWindow()])
    expect([a, b]).toEqual(["live", "live"])
    expect(hub.canonCalls).toHaveLength(1)
  })

  it("names a wrong hub token", async () => {
    vi.stubGlobal("fetch", hubFetch({ canon: () => ({ status: 401 }) }).fn)
    expect(await loadPhoneWindow()).toBe("offline")
    expect(phoneWindowNote()).toMatch(/answered 401 \(hub token\)/)
  })

  it("names a hub that sent no vault", async () => {
    vi.stubGlobal("fetch", hubFetch({ canon: () => ({ status: 200, body: { ok: true } }) }).fn)
    expect(await loadPhoneWindow()).toBe("offline")
    expect(getPhoneWindowSnapshot().detail).toMatch(/sent no vault/)
  })

  it("a Mac that went quiet after one load leaves the copy stale, not empty", async () => {
    let up = true
    vi.stubGlobal("fetch", hubFetch({ canon: () => (up ? { status: 200, body: { ok: true, items: { "brain2-task-storage": "{\"state\":{\"tasks\":[]}}" } } } : "throw") }).fn)
    expect(await loadPhoneWindow()).toBe("live")
    up = false
    expect(await loadPhoneWindow()).toBe("stale")
    expect(phoneWindowNote()).toMatch(/^Saved copy\. The Mac has not answered\./)
  })
})
