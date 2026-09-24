import { afterEach, describe, expect, it, vi } from "vitest"
import { handleNotesApi, isLoopbackRemoteAddress } from "@/scripts/notes-api.mjs"

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

describe("notes-api loopback", () => {
  it("accepts localhost sockets and rejects LAN", () => {
    expect(isLoopbackRemoteAddress("127.0.0.1")).toBe(true)
    expect(isLoopbackRemoteAddress("::1")).toBe(true)
    expect(isLoopbackRemoteAddress("::ffff:127.0.0.1")).toBe(true)
    expect(isLoopbackRemoteAddress("192.168.1.20")).toBe(false)
  })

  it("refuses a phone hitting the LAN address", async () => {
    const res = mockRes()
    const handled = await handleNotesApi(
      mockReq("GET", "192.168.1.20") as never,
      res as never,
      "/api/notes/health",
    )
    expect(handled).toBe(true)
    expect(res.status).toBe(403)
    expect(res.body().ok).toBe(false)
  })

  it("posts through to the Notes reader", async () => {
    const res = mockRes()
    const fetchAppleNotes = vi.fn().mockResolvedValue({
      ok: true,
      notes: [{ id: "n1", title: "Milk", body: "2%", folder: "Notes" }],
    })
    const handled = await handleNotesApi(
      mockReq("POST", "127.0.0.1", JSON.stringify({ sinceISO: "a", untilISO: "b", mode: "preview" })) as never,
      res as never,
      "/api/notes",
      { fetchAppleNotes },
    )
    expect(handled).toBe(true)
    expect(fetchAppleNotes).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    expect(res.body().notes[0].title).toBe("Milk")
  })
})
