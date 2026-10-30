/**
 * lib/phone-window-cache.test.ts — Launch slices and a quota drop.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { readLaunchCache, resetPhoneWindowCacheForTests, selectLaunchSlices, writeLaunchCache } from "@/lib/phone-window-cache"
import { idbAvailable } from "@/lib/storage-keys"

afterEach(() => {
  resetPhoneWindowCacheForTests()
  vi.unstubAllGlobals()
})

describe("phone window cache", () => {
  it("keeps one alias of the launch slices and drops the archive", () => {
    const slices = selectLaunchSlices(
      new Map([
        ["brain2-task-storage", "tasks"],
        ["cogs-task-storage", "twin"],
        ["brain2-habits-store", "habits"],
        ["brain2-goals-store", "goals"],
        ["brain2-sleep-store", "sleep"],
        ["brain2-user-settings", "settings"],
        ["brain2-theme-store", "theme"],
        ["brain2-timegrid-store", "grid"],
        ["cogs-goals-store", "goals-twin"],
        ["brain2-telegram-feed", "archive"],
        ["brain2-modules-store", "modules"],
        ["brain2-doc-storage", "docs"],
        ["messages", "thread"],
      ]),
    )
    expect([...slices.keys()].sort()).toEqual([
      "brain2-goals-store",
      "brain2-habits-store",
      "brain2-sleep-store",
      "brain2-task-storage",
      "brain2-theme-store",
      "brain2-timegrid-store",
      "brain2-user-settings",
    ])
    expect(slices.get("brain2-task-storage")).toBe("tasks")
    expect(slices.get("brain2-goals-store")).toBe("goals")
  })

  it("drops the cache when IndexedDB reports a quota error and keeps the live map", async () => {
    const live = new Map([["brain2-task-storage", "live-tasks"]])
    installQuotaIndexedDb()
    expect(idbAvailable()).toBe(true)
    expect(await writeLaunchCache(live)).toBe("dropped")
    expect(await readLaunchCache()).toEqual(new Map())
    expect(live.get("brain2-task-storage")).toBe("live-tasks")
  })
})

function installQuotaIndexedDb() {
  const tables = new Map<string, Map<string, unknown>>([
    ["slices", new Map()],
    ["outbox", new Map()],
  ])
  const db = {
    objectStoreNames: { contains: (name: string) => tables.has(name) },
    createObjectStore(name: string) {
      tables.set(name, new Map())
    },
    close() {},
    transaction(name: string) {
      const table = tables.get(name) ?? new Map()
      const tx = {
        error: null as DOMException | null,
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        onabort: null as null | (() => void),
        objectStore() {
          return {
            put() {
              const error = new DOMException("The quota has been exceeded.", "QuotaExceededError")
              tx.error = error
              throw error
            },
            clear() {
              table.clear()
              return { onerror: null, onsuccess: null, error: null }
            },
            delete(id: string) {
              table.delete(id)
              return { onerror: null, onsuccess: null, error: null }
            },
            getAll() {
              const req = {
                result: [...table.values()],
                error: null,
                onsuccess: null as null | (() => void),
                onerror: null as null | (() => void),
              }
              queueMicrotask(() => req.onsuccess?.())
              return req
            },
          }
        },
      }
      queueMicrotask(() => tx.oncomplete?.())
      return tx
    },
  }
  vi.stubGlobal("indexedDB", {
    open() {
      const req = {
        result: db,
        error: null,
        onupgradeneeded: null as null | (() => void),
        onsuccess: null as null | (() => void),
        onerror: null as null | (() => void),
      }
      queueMicrotask(() => {
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  })
}
