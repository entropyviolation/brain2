import { describe, expect, it, vi } from "vitest"
import { handleScreenTimeApi, isLoopbackRemoteAddress } from "@/scripts/screentime-api.mjs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { isLoopbackUrl } = require("../electron/activitywatch.js")

function mockRes() {
  const chunks: Buffer[] = []
  let status = 0
  return {
    get status() {
      return status
    },
    body() {
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")
    },
    writeHead(code: number) {
      status = code
    },
    end(data: string | Buffer) {
      chunks.push(Buffer.from(data))
    },
  }
}

function mockReq(method: string, remoteAddress: string, body = "") {
  return {
    method,
    socket: { remoteAddress },
    on(event: string, cb: (arg?: Buffer) => void) {
      if (event === "data" && body) cb(Buffer.from(body))
      if (event === "end") cb()
    },
  }
}

describe("screentime-api loopback", () => {
  it("accepts localhost sockets and rejects LAN", () => {
    expect(isLoopbackRemoteAddress("127.0.0.1")).toBe(true)
    expect(isLoopbackRemoteAddress("::1")).toBe(true)
    expect(isLoopbackRemoteAddress("::ffff:127.0.0.1")).toBe(true)
    expect(isLoopbackRemoteAddress("192.168.1.20")).toBe(false)
  })

  it("refuses a phone hitting the LAN address", async () => {
    const res = mockRes()
    const handled = await handleScreenTimeApi(
      mockReq("GET", "192.168.1.20") as never,
      res as never,
      "/api/screentime/health",
    )
    expect(handled).toBe(true)
    expect(res.status).toBe(403)
    expect(res.body().ok).toBe(false)
    expect(res.body().code).toBe("forbidden")
  })

  it("accepts 127.0.0.1 health with a mock", async () => {
    const res = mockRes()
    const fetchScreenTime = vi.fn().mockResolvedValue({
      ok: true,
      mode: "health",
      reachable: true,
      hostname: "mac",
      version: "0.13",
    })
    const handled = await handleScreenTimeApi(
      mockReq("GET", "127.0.0.1") as never,
      res as never,
      "/api/screentime/health",
      { fetchScreenTime },
    )
    expect(handled).toBe(true)
    expect(fetchScreenTime).toHaveBeenCalledWith({ mode: "health" })
    expect(res.status).toBe(200)
    expect(res.body().reachable).toBe(true)
  })

  it("accepts ::1 health with a mock", async () => {
    const res = mockRes()
    const fetchScreenTime = vi.fn().mockResolvedValue({ ok: true, mode: "health", reachable: true })
    const handled = await handleScreenTimeApi(
      mockReq("GET", "::1") as never,
      res as never,
      "/api/screentime/health",
      { fetchScreenTime },
    )
    expect(handled).toBe(true)
    expect(res.status).toBe(200)
  })

  it("posts through to fetchScreenTime", async () => {
    const res = mockRes()
    const fetchScreenTime = vi.fn().mockResolvedValue({
      ok: true,
      mode: "events",
      windowEvents: [{ timestamp: "t", duration: 1, data: { app: "Code" } }],
      afkEvents: [],
      webEvents: [],
    })
    const handled = await handleScreenTimeApi(
      mockReq(
        "POST",
        "127.0.0.1",
        JSON.stringify({ startISO: "a", endISO: "b", mode: "events" }),
      ) as never,
      res as never,
      "/api/screentime",
      { fetchScreenTime },
    )
    expect(handled).toBe(true)
    expect(fetchScreenTime).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    expect(res.body().windowEvents[0].data.app).toBe("Code")
  })

  it("rejects non-loopback ActivityWatch URLs", () => {
    expect(isLoopbackUrl("http://127.0.0.1:5600")).toBe(true)
    expect(isLoopbackUrl("http://localhost:5600")).toBe(true)
    expect(isLoopbackUrl("http://192.168.1.20:5600")).toBe(false)
    expect(isLoopbackUrl("https://example.com")).toBe(false)
  })
})
