import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetGpsPlacesForTests } from "@/lib/ingest/gps-places"
import { generateKeyPair, open, seal } from "@/scripts/sealed-box.mjs"
import { drainLocationOnce, startLocationDrain } from "./location-drain"
import type { PhoneSyncRun } from "./types"

beforeEach(() => {
  resetAllStores()
  resetGpsPlacesForTests()
})

const keys = generateKeyPair()
const at = (h: number) => new Date(2026, 9, 21, h).getTime()

function memoryArchive() {
  const cursors: Record<string, string> = {}
  const runs: PhoneSyncRun[] = []
  return {
    cursors,
    runs,
    getCursor: (s: string) => cursors[s],
    setCursor: (s: string, c: string) => {
      cursors[s] = c
    },
    logRun: (r: PhoneSyncRun) => {
      runs.push(r)
    },
  }
}

/** A fake box: the queue, plus a record of acks. */
function fakeBox(rows: { seq: number; kind: string; sealed: string }[]) {
  const acks: number[] = []
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/uploads/ack")) {
      const upto = JSON.parse(String(init?.body)).upto
      acks.push(upto)
      rows = rows.filter((r) => r.seq > upto)
      return new Response(JSON.stringify({ ok: true }))
    }
    const after = Number(new URL(url).searchParams.get("after"))
    return new Response(JSON.stringify({ ok: true, items: rows.filter((r) => r.seq > after) }))
  })
  return { fetch: fetchFn as unknown as typeof fetch, acks }
}

const batch = (events: unknown[]) => seal(keys.publicKey, JSON.stringify({ v: 1, kind: "location", events }))
const visit = { type: "visit", arriveAt: at(8), departAt: at(9), lat: 45.5231, lon: -122.6765 }

describe("drainLocationOnce", () => {
  it("opens, writes, flushes, then acks", async () => {
    const order: string[] = []
    const box = fakeBox([{ seq: 1, kind: "location", sealed: batch([visit]) }])
    const archive = memoryArchive()
    const run = await drainLocationOnce({
      boxUrl: "http://box",
      token: "t",
      privateKey: keys.privateKey,
      open,
      archive,
      fetch: box.fetch,
      beforeApply: () => order.push("rehydrate"),
      onWrote: () => order.push("flush"),
    })
    expect(run).toMatchObject({ source: "location", read: 1, written: 1 })
    expect(order).toEqual(["rehydrate", "flush"])
    expect(archive.cursors.location).toBe("1")
    expect(box.acks).toEqual([1])
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "location")).toHaveLength(1)
  })

  it("writes nothing new when the phone re-sent a batch", async () => {
    const box = fakeBox([
      { seq: 1, kind: "location", sealed: batch([visit]) },
      { seq: 2, kind: "location", sealed: batch([visit]) },
    ])
    const run = await drainLocationOnce({ boxUrl: "http://box", token: "t", privateKey: keys.privateKey, open, archive: memoryArchive(), fetch: box.fetch })
    expect(run).toMatchObject({ read: 2, written: 1, skipped: 1 })
  })

  it("stops and keeps the queue when a batch will not open", async () => {
    const other = generateKeyPair()
    const box = fakeBox([{ seq: 1, kind: "location", sealed: seal(other.publicKey, "{}") }])
    const archive = memoryArchive()
    await expect(
      drainLocationOnce({ boxUrl: "http://box", token: "t", privateKey: keys.privateKey, open, archive, fetch: box.fetch }),
    ).rejects.toThrow()
    expect(box.acks).toEqual([])
    expect(archive.cursors.location).toBeUndefined()
  })

  it("skips a batch that opens but is not location, and moves on", async () => {
    const box = fakeBox([
      { seq: 1, kind: "location", sealed: seal(keys.publicKey, "not json") },
      { seq: 2, kind: "location", sealed: batch([visit]) },
    ])
    const run = await drainLocationOnce({ boxUrl: "http://box", token: "t", privateKey: keys.privateKey, open, archive: memoryArchive(), fetch: box.fetch })
    expect(run).toMatchObject({ written: 1, skipped: 1 })
    expect(run?.error).toMatch(/not location/)
    expect(box.acks).toEqual([2])
  })

  it("returns null on an empty box", async () => {
    const box = fakeBox([])
    const run = await drainLocationOnce({ boxUrl: "http://box", token: "t", privateKey: keys.privateKey, open, archive: memoryArchive(), fetch: box.fetch })
    expect(run).toBeNull()
  })

  it("does not pull while location is off", async () => {
    const fetchFn = vi.fn()
    const stop = startLocationDrain({
      boxUrl: "http://box",
      token: "t",
      privateKey: keys.privateKey,
      open,
      archive: memoryArchive(),
      fetch: fetchFn,
      paused: () => true,
      intervalMs: 60_000,
      log: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    stop()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
