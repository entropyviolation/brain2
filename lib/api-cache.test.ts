import { afterEach, describe, expect, it, vi } from "vitest"
import { cacheClear, cacheGet, cacheHas, cacheSet, cached, mapPool, TTL } from "@/lib/api-cache"

afterEach(() => {
  cacheClear()
  vi.useRealTimers()
})

describe("api-cache", () => {
  it("stores and returns values until TTL expires", () => {
    vi.useFakeTimers()
    cacheSet("k", 42, 1_000)
    expect(cacheGet<number>("k")).toBe(42)
    expect(cacheHas("k")).toBe(true)
    vi.advanceTimersByTime(1_001)
    expect(cacheGet<number>("k")).toBeUndefined()
    expect(cacheHas("k")).toBe(false)
  })

  it("coalesces in-flight work for the same key", async () => {
    let runs = 0
    const fn = () => {
      runs += 1
      return Promise.resolve("ok")
    }
    const [a, b] = await Promise.all([cached("same", TTL.CITY, fn), cached("same", TTL.CITY, fn)])
    expect(a).toBe("ok")
    expect(b).toBe("ok")
    expect(runs).toBe(1)
    expect(await cached("same", TTL.CITY, fn)).toBe("ok")
    expect(runs).toBe(1)
  })

  it("uses a short TTL for empty/null misses so a blip does not stick", () => {
    vi.useFakeTimers()
    cacheSet("empty", [] as string[], 30_000)
    expect(cacheHas("empty")).toBe(true)
    vi.advanceTimersByTime(30_001)
    expect(cacheHas("empty")).toBe(false)
  })

  it("clears by prefix", () => {
    cacheSet("cities:lisbon", 1, TTL.CITY)
    cacheSet("places:x", 2, TTL.PLACE)
    cacheClear("cities:")
    expect(cacheHas("cities:lisbon")).toBe(false)
    expect(cacheHas("places:x")).toBe(true)
  })
})

describe("mapPool", () => {
  it("preserves order with a concurrency cap", async () => {
    const seen: number[] = []
    const out = await mapPool([1, 2, 3, 4], 2, async (n) => {
      seen.push(n)
      await Promise.resolve()
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40])
    expect(seen.sort()).toEqual([1, 2, 3, 4])
  })

  it("returns [] for empty input", async () => {
    expect(await mapPool([], 3, async (n: number) => n)).toEqual([])
  })
})
