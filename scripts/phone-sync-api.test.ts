import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { handlePhoneSyncApi } from "@/scripts/phone-sync-api.mjs"

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

describe("phone-sync api", () => {
  it("refuses a phone on the LAN", async () => {
    const res = mockRes()
    const handled = await handlePhoneSyncApi(mockReq("GET", "192.168.1.20") as never, res as never, "/api/phone-sync/status")
    expect(handled).toBe(true)
    expect(res.status).toBe(403)
    expect(res.body().error).toMatch(/this Mac/)
  })

  it("returns the run log and writes a switch", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-api-"))
    const dir = path.join(dataDir, "phone-sync")
    fs.mkdirSync(dir, { mode: 0o700 })
    fs.writeFileSync(
      path.join(dir, "runs.json"),
      JSON.stringify([{ source: "messages", startedAt: 1, finishedAt: 2, read: 4, written: 1, skipped: 3 }]),
    )
    const status = mockRes()
    await handlePhoneSyncApi(mockReq("GET", "127.0.0.1") as never, status as never, "/api/phone-sync/status", { dataDir })
    expect(status.status).toBe(200)
    expect(status.body().runs).toHaveLength(1)
    expect(status.body().enabled).toEqual({})

    const saved = mockRes()
    await handlePhoneSyncApi(
      mockReq("POST", "::1", JSON.stringify({ source: "calls", on: false })) as never,
      saved as never,
      "/api/phone-sync/enabled",
      { dataDir },
    )
    expect(saved.status).toBe(200)
    expect(saved.body().enabled.calls).toBe(false)
    expect(JSON.parse(fs.readFileSync(path.join(dir, "enabled.json"), "utf8")).calls).toBe(false)
  })

  it("ignores other paths", async () => {
    const res = mockRes()
    const handled = await handlePhoneSyncApi(mockReq("GET", "127.0.0.1") as never, res as never, "/api/sync")
    expect(handled).toBe(false)
  })
})
