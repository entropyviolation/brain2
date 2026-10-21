import { describe, expect, it } from "vitest"
import { createDrainHeartbeat, createPingThrottle, heartbeatUrl } from "./drain-heartbeat"

describe("drain-heartbeat", () => {
  it("throttles to one a minute", () => {
    const t = createPingThrottle()
    expect(t.due(0)).toBe(true)
    t.mark(0)
    expect(t.due(59_999)).toBe(false)
    expect(t.due(60_000)).toBe(true)
  })
  it("builds urls", () => {
    expect(heartbeatUrl("https://hc/x/", false)).toBe("https://hc/x")
    expect(heartbeatUrl("https://hc/x/", true)).toBe("https://hc/x/fail")
  })
  it("pings ok once per minute and fail every time", async () => {
    let clock = 0
    const seen: string[] = []
    const hb = createDrainHeartbeat("https://hc/x", { now: () => clock, ping: async (u) => void seen.push(u) })
    await hb.ok()
    clock = 10_000
    await hb.ok()
    clock = 61_000
    await hb.ok()
    await hb.fail()
    expect(seen).toEqual(["https://hc/x", "https://hc/x", "https://hc/x/fail"])
  })
  it("never throws and does nothing without a url", async () => {
    const bad = createDrainHeartbeat("https://hc/x", { ping: async () => { throw new Error("down") } })
    await expect(bad.ok()).resolves.toBeUndefined()
    await expect(bad.fail()).resolves.toBeUndefined()
    const none = createDrainHeartbeat("", { ping: async () => { throw new Error("no") } })
    await expect(none.ok()).resolves.toBeUndefined()
  })
})
