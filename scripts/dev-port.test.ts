import { describe, expect, it, vi } from "vitest"
import { findRunningCogsPort, isCogsServer, parseLsofFpc, reclaimablePids } from "@/scripts/dev-port.mjs"

describe("parseLsofFpc", () => {
  it("reads pid/command pairs from lsof -Fpc", () => {
    expect(parseLsofFpc("p7801\ncnode\n")).toEqual([{ pid: 7801, command: "node" }])
  })
})

describe("reclaimablePids", () => {
  it("returns leftover Next/node pids", () => {
    expect(reclaimablePids([{ pid: 7801, command: "node" }])).toEqual([7801])
  })

  it("refuses a mixed or foreign listener", () => {
    expect(
      reclaimablePids([
        { pid: 1, command: "node" },
        { pid: 2, command: "Python" },
      ]),
    ).toBeNull()
    expect(reclaimablePids([{ pid: 9, command: "nginx" }])).toBeNull()
  })

  it("is a no-op when nothing is listening", () => {
    expect(reclaimablePids([])).toEqual([])
  })
})

describe("isCogsServer", () => {
  it("accepts our /api/health ok", async () => {
    const f = vi.fn().mockResolvedValue(new Response("ok"))
    expect(await isCogsServer(3000, f)).toBe(true)
    expect(f.mock.calls[0][0]).toBe("http://127.0.0.1:3000/api/health")
  })

  it("rejects a foreign body, an error status and a dead port", async () => {
    expect(await isCogsServer(3000, vi.fn().mockResolvedValue(new Response("hi")))).toBe(false)
    expect(await isCogsServer(3000, vi.fn().mockResolvedValue(new Response("ok", { status: 500 })))).toBe(false)
    expect(await isCogsServer(3000, vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))).toBe(false)
  })
})

describe("findRunningCogsPort", () => {
  it("returns the first port with a server, else null", async () => {
    expect(await findRunningCogsPort([3000, 3001, 3002], async (p) => p === 3001)).toBe(3001)
    expect(await findRunningCogsPort([3000, 3001], async () => false)).toBeNull()
  })
})
