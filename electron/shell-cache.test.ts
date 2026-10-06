import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createSharedPersistCache, hubRevArgument } from "./persist-hub-cache.js"
import { createStaticFileResolver } from "./static-file.js"

function fakeHubFs(initial: { text: string; mtimeMs: number }) {
  const state = {
    text: initial.text,
    mtimeMs: initial.mtimeMs,
    syncReads: 0,
    asyncReads: 0,
    stats: 0,
    missing: false,
  }
  const fsImpl = {
    statSync() {
      state.stats += 1
      if (state.missing) {
        const err = new Error("ENOENT") as NodeJS.ErrnoException
        err.code = "ENOENT"
        throw err
      }
      return { mtimeMs: state.mtimeMs, size: state.text.length }
    },
    readFileSync() {
      state.syncReads += 1
      return state.text
    },
    promises: {
      async stat() {
        state.stats += 1
        if (state.missing) {
          const err = new Error("ENOENT") as NodeJS.ErrnoException
          err.code = "ENOENT"
          throw err
        }
        return { mtimeMs: state.mtimeMs, size: state.text.length }
      },
      async readFile() {
        state.asyncReads += 1
        return state.text
      },
    },
  }
  return { fsImpl, state }
}

describe("shared persist cache", () => {
  it("parses once and serves the same snapshot until mtime or size changes", () => {
    const payload = JSON.stringify({
      items: { "brain2-task-storage": "{\"state\":{}}" },
      source: "chrome",
      updatedAt: "2026-10-06T00:00:00.000Z",
    })
    const { fsImpl, state } = fakeHubFs({ text: payload, mtimeMs: 10 })
    const cache = createSharedPersistCache(fsImpl, "/data/shared-persist.json")
    const first = cache.readSnapshot()
    const second = cache.readSnapshot()
    expect(second).toBe(first)
    expect(first.items["brain2-task-storage"]).toContain("state")
    expect(first.source).toBe("chrome")
    expect(first.updatedAt).toBe("2026-10-06T00:00:00.000Z")
    expect(state.syncReads).toBe(1)
    expect(cache.revToken()).toBe("2026-10-06T00:00:00.000Z@10:" + payload.length)

    state.text = JSON.stringify({
      items: { "brain2-task-storage": "next" },
      source: "hub",
      updatedAt: "2026-10-06T01:00:00.000Z",
    })
    state.mtimeMs = 11
    const third = cache.readSnapshot()
    expect(third).not.toBe(first)
    expect(third.items["brain2-task-storage"]).toBe("next")
    expect(state.syncReads).toBe(2)
    expect(cache.revToken()).not.toBe("2026-10-06T00:00:00.000Z@10:" + payload.length)
  })

  it("warms from the async read so the sync path does not parse again", async () => {
    const payload = JSON.stringify({ items: { "monthPlan-2026-09": "notes" }, updatedAt: "t", source: null })
    const { fsImpl, state } = fakeHubFs({ text: payload, mtimeMs: 3 })
    const cache = createSharedPersistCache(fsImpl, "/data/shared-persist.json")
    await cache.warm()
    expect(state.asyncReads).toBe(1)
    expect(state.syncReads).toBe(0)
    expect(cache.readSnapshot().items["monthPlan-2026-09"]).toBe("notes")
    expect(state.syncReads).toBe(0)
  })

  it("returns an empty snapshot when the file is missing and retries after it appears", () => {
    const { fsImpl, state } = fakeHubFs({ text: "", mtimeMs: 1 })
    state.missing = true
    const cache = createSharedPersistCache(fsImpl, "/data/shared-persist.json")
    expect(cache.readSnapshot()).toEqual({ items: {}, source: null, updatedAt: null })
    expect(cache.revToken()).toBe("")
    expect(state.syncReads).toBe(0)

    state.missing = false
    state.text = JSON.stringify({ items: { "brain2-app-tab": "habits" }, updatedAt: null, source: null })
    state.mtimeMs = 4
    expect(cache.readSnapshot().items["brain2-app-tab"]).toBe("habits")
    expect(state.syncReads).toBe(1)
  })

  it("does not cache a corrupt file", () => {
    const { fsImpl, state } = fakeHubFs({ text: "{", mtimeMs: 8 })
    const cache = createSharedPersistCache(fsImpl, "/data/shared-persist.json")
    expect(cache.readSnapshot()).toEqual({ items: {}, source: null, updatedAt: null })
    expect(cache.revToken()).toBe("")
    expect(state.syncReads).toBe(2)
  })

  it("round-trips the revision argument", () => {
    const token = "2026-10-06T00:00:00.000Z@10:42"
    const arg = hubRevArgument(token)
    expect(arg.startsWith("--brain2-hub-rev=")).toBe(true)
    expect(decodeURIComponent(arg.slice("--brain2-hub-rev=".length))).toBe(token)
    expect(hubRevArgument("")).toBe("--brain2-hub-rev=")
  })
})

describe("app:// static resolver", () => {
  it("memoizes a pathname so the second request does not stat", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-static-"))
    fs.mkdirSync(path.join(dir, "popout"), { recursive: true })
    fs.writeFileSync(path.join(dir, "index.html"), "home")
    fs.writeFileSync(path.join(dir, "asset.js"), "js")
    fs.writeFileSync(path.join(dir, "popout.html"), "page")
    fs.writeFileSync(path.join(dir, "popout", "index.html"), "dir")

    let exists = 0
    let stats = 0
    const fsImpl = {
      existsSync(candidate: string) {
        exists += 1
        return fs.existsSync(candidate)
      },
      statSync(candidate: string) {
        stats += 1
        return fs.statSync(candidate)
      },
    }
    const resolve = createStaticFileResolver(fsImpl, dir)

    expect(resolve("/")).toBe(path.join(dir, "index.html"))
    expect(resolve("/")).toBe(path.join(dir, "index.html"))
    expect(exists).toBe(0)

    expect(resolve("/asset.js")).toBe(path.join(dir, "asset.js"))
    const afterFile = exists
    expect(afterFile).toBeGreaterThan(0)
    expect(resolve("/asset.js")).toBe(path.join(dir, "asset.js"))
    expect(exists).toBe(afterFile)
    expect(stats).toBeGreaterThan(0)
    const afterStats = stats
    expect(resolve("/asset.js")).toBe(path.join(dir, "asset.js"))
    expect(stats).toBe(afterStats)

    expect(resolve("/popout.html")).toBe(path.join(dir, "popout.html"))
    expect(resolve("/popout")).toBe(path.join(dir, "popout.html"))
    expect(resolve("/missing")).toBe(path.join(dir, "index.html"))
    const afterMissing = exists
    expect(resolve("/missing")).toBe(path.join(dir, "index.html"))
    expect(exists).toBe(afterMissing)

    expect(() => resolve("%")).toThrow()
    expect(() => resolve("%")).toThrow()
  })
})
