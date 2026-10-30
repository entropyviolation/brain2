/**
 * lib/phone-window.test.ts — Phone memory window, cache paint, and one patch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { slimStoredVault } from "@/lib/phone-hub-view.mjs"
import { cogsStateStorage } from "@/lib/persist-storage"
import { writeLaunchCache } from "@/lib/phone-window-cache"
import {
  engagePhoneWindow,
  flushPhoneOutbox,
  loadPhoneWindow,
  phoneOutboxSettled,
  phoneWindowNote,
  readPhoneWindowItem,
  resetPhoneWindowForTests,
} from "@/lib/phone-window"
import { getPlanEntries } from "@/lib/plan-text"
import { TASK_STORE_PERSIST_VERSION, useTaskStore } from "@/lib/task-store"

const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"

function asPhone() {
  vi.stubGlobal("navigator", { userAgent: PHONE_UA, language: "en-US" })
  engagePhoneWindow()
}

const notedTask = {
  state: {
    tasks: [
      {
        id: "noted",
        title: "Milk",
        description: "Milk",
        notes: "the long note",
        attributes: { note: "kept" },
        completed: false,
        lists: [],
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ],
    lists: [],
    folders: [],
    removedTaskIds: [],
    removedListIds: [],
  },
  version: TASK_STORE_PERSIST_VERSION,
}

beforeEach(() => {
  localStorage.clear()
  resetPhoneWindowForTests()
  useTaskStore.getState().clearAllData()
})

describe("phone window", () => {
  it("a phone setItem of the task store does not call localStorage", () => {
    asPhone()
    localStorage.clear()
    const spy = vi.spyOn(localStorage, "setItem")
    const value = JSON.stringify({
      state: { tasks: [{ id: "a", title: "Milk", notes: "full" }], lists: [], removedTaskIds: [] },
      version: 1,
    })
    cogsStateStorage().setItem("brain2-task-storage", value)
    expect(spy).not.toHaveBeenCalled()
    expect(localStorage.getItem("brain2-task-storage")).toBeNull()
    expect(localStorage.getItem("cogs-task-storage")).toBeNull()
    expect(readPhoneWindowItem("brain2-task-storage")).toBe(value)
    spy.mockRestore()
  })

  it("plan text reads the window and leaves a leftover local copy unread", () => {
    asPhone()
    const local = JSON.stringify({ v: 1, entries: [{ id: "old", createdAt: null, text: "local leftover" }] })
    localStorage.setItem("dayPlan-2026-10-29", local)
    localStorage.setItem("brain2-dayPlan-2026-10-29", local)
    const live = JSON.stringify({ v: 1, entries: [{ id: "live", createdAt: null, text: "from the mac" }] })
    cogsStateStorage().setItem("dayPlan-2026-10-29", live)
    expect(getPlanEntries("day", "2026-10-29").map((entry) => entry.text)).toEqual(["from the mac"])
  })

  it("hydrates a note the slim phone view would have dropped", async () => {
    const slim = slimStoredVault("brain2-task-storage", notedTask) as {
      state: { tasks: Array<{ notes?: string; attributes?: unknown }> }
    }
    expect(slim.state.tasks[0].notes).toBeUndefined()
    expect(slim.state.tasks[0].attributes).toBeUndefined()

    asPhone()
    const setItem = vi.spyOn(localStorage, "setItem")
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/persist")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            items: {
              "brain2-task-storage": JSON.stringify(notedTask),
              "cogs-task-storage": JSON.stringify({
                state: { tasks: [{ id: "noted", title: "Slim", description: "Slim" }] },
              }),
            },
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }))

    expect(await loadPhoneWindow()).toBe("live")
    const task = useTaskStore.getState().tasks.find((row) => row.id === "noted")
    expect(task?.notes).toBe("the long note")
    expect(task?.attributes).toEqual({ note: "kept" })
    expect(readPhoneWindowItem("cogs-task-storage")).toContain("the long note")
    const vaultWrites = setItem.mock.calls.filter((call) => String(call[0]).includes("task-storage") || String(call[0]).includes("timegrid-store"))
    expect(vaultWrites).toEqual([])
    expect(localStorage.getItem("brain2-task-storage") ?? "").not.toContain("the long note")
    setItem.mockRestore()
  })

  it("a failed fetch paints the cache and does not write localStorage", async () => {
    const blob = JSON.stringify(notedTask)
    await writeLaunchCache(new Map([["brain2-task-storage", blob], ["cogs-task-storage", "{\"state\":{\"tasks\":[]}}"]]))
    asPhone()
    localStorage.setItem("brain2-task-storage", JSON.stringify({ state: { tasks: [{ id: "slim", title: "Slim" }] } }))
    const setItem = vi.spyOn(localStorage, "setItem")
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline")
    }))

    expect(await loadPhoneWindow()).toBe("stale")
    expect(useTaskStore.getState().tasks.find((row) => row.id === "noted")?.notes).toBe("the long note")
    expect(useTaskStore.getState().tasks.some((row) => row.id === "slim")).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem("brain2-task-storage")).not.toContain("the long note")
    setItem.mockRestore()
  })

  it("names why the Mac missed when there is no saved copy", async () => {
    asPhone()
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Load failed")
    }))

    expect(await loadPhoneWindow()).toBe("offline")
    expect(phoneWindowNote()).toMatch(/^Can't reach the Mac\. .+: TypeError: Load failed$/)
  })

  it("names the HTTP status a refusing Mac sent", async () => {
    asPhone()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })))

    expect(await loadPhoneWindow()).toBe("offline")
    expect(phoneWindowNote()).toContain("answered 401 (hub token).")
  })

  it("enqueues one patch of the changed field and does not send it again after success", async () => {
    const previous = JSON.stringify({
      state: {
        tasks: [{ id: "a", title: "Milk", notes: "keep", attributes: { n: 1 }, completed: false, lists: [] }],
        lists: [],
        removedTaskIds: [],
      },
      version: 1,
    })
    const posts: unknown[] = []
    asPhone()
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)))
        return { ok: true, status: 200, json: async () => ({ ok: true }) }
      }
      if (String(input).includes("/api/persist")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, items: { "brain2-task-storage": previous } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }))

    expect(await loadPhoneWindow()).toBe("live")
    const held = JSON.parse(readPhoneWindowItem("brain2-task-storage") ?? "{}") as {
      state: { tasks: Array<{ id: string; title: string }> }
    }
    held.state.tasks[0].title = "Renamed"
    cogsStateStorage().setItem("brain2-task-storage", JSON.stringify(held))
    await phoneOutboxSettled()
    expect(posts).toEqual([
      {
        name: "brain2-task-storage",
        source: "phone",
        patch: { upserts: [{ id: "a", title: "Renamed" }], removedIds: [] },
      },
    ])
    expect(localStorage.getItem("brain2-task-storage")).toBeNull()

    await flushPhoneOutbox()
    await phoneOutboxSettled()
    expect(posts).toHaveLength(1)
  })

  it("a phone setItem of the habits store enqueues one patch and does not call localStorage", async () => {
    const previous = JSON.stringify({
      state: {
        tasks: [
          { id: "h1", name: "Water", frequency: "daily", notes: "keep" },
          { id: "h2", name: "Walk" },
        ],
        weeklyData: {},
        contentRev: 10,
      },
      version: 1,
    })
    const posts: unknown[] = []
    asPhone()
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)))
        return { ok: true, status: 200, json: async () => ({ ok: true }) }
      }
      if (String(input).includes("/api/persist")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, items: { "brain2-habits-store": previous } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }))

    expect(await loadPhoneWindow()).toBe("live")
    const held = JSON.parse(readPhoneWindowItem("brain2-habits-store") ?? "{}") as {
      state: { tasks: Array<{ id: string; name: string }> }
    }
    held.state.tasks[0].name = "Tea"
    const setItem = vi.spyOn(localStorage, "setItem")
    cogsStateStorage().setItem("brain2-habits-store", JSON.stringify(held))
    await phoneOutboxSettled()
    expect(setItem).not.toHaveBeenCalled()
    expect(posts).toEqual([
      {
        name: "brain2-habits-store",
        source: "phone",
        patch: { upserts: [{ id: "h1", name: "Tea" }], removedIds: [] },
      },
    ])
    expect(localStorage.getItem("brain2-habits-store")).toBeNull()
    setItem.mockRestore()
  })
})
