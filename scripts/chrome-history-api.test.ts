import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { acceptHistoryEnvelope, handleChromeHistoryApi, safeHistoryId } from "./chrome-history-api.mjs"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

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
    end(data?: string | Buffer) {
      if (data) chunks.push(Buffer.from(data))
    },
  }
}

function mockReq(method: string, remoteAddress: string, body = "", origin = "") {
  return {
    method,
    headers: origin ? { origin } : {},
    socket: { remoteAddress },
    on(event: string, cb: (arg?: Buffer) => void) {
      if (event === "data" && body) cb(Buffer.from(body))
      if (event === "end") cb()
    },
  }
}

const day = {
  brain2: "chrome-history",
  profile: "Work",
  day: "2026-10-26",
  visits: [{ url: "https://example.com/a", title: "A", visitTime: 1_700_000_000_000, transition: "link" }],
}

describe("chrome history inbox", () => {
  it("names a file from the day and the profile", () => {
    expect(safeHistoryId("2026-10-26", "Work/laptop")).toBe("2026-10-26__Worklaptop.json")
    expect(acceptHistoryEnvelope({ brain2: "other" })).toBeNull()
    expect(acceptHistoryEnvelope(day)?.visits).toHaveLength(1)
  })

  it("keeps a day from the extension and gives it back to the app", async () => {
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "brain2-chrome-"))
    dirs.push(inboxDir)
    const posted = mockRes()
    const ok = await handleChromeHistoryApi(
      mockReq("POST", "127.0.0.1", JSON.stringify(day), "chrome-extension://abcdefghijklmnop") as never,
      posted as never,
      "/api/chrome-history",
      { inboxDir },
    )
    expect(ok).toBe(true)
    expect(posted.status).toBe(200)
    expect(posted.body().id).toBe("2026-10-26__Work.json")

    const listed = mockRes()
    await handleChromeHistoryApi(mockReq("GET", "::1") as never, listed as never, "/api/chrome-history", { inboxDir })
    expect(listed.body().files).toHaveLength(1)
    expect(listed.body().files[0].profile).toBe("Work")

    const acked = mockRes()
    await handleChromeHistoryApi(
      mockReq("POST", "127.0.0.1", JSON.stringify({ ids: [posted.body().id, "../nope.json"] })) as never,
      acked as never,
      "/api/chrome-history/ack",
      { inboxDir },
    )
    expect(acked.body().removed).toBe(1)
    const again = mockRes()
    await handleChromeHistoryApi(mockReq("GET", "127.0.0.1") as never, again as never, "/api/chrome-history", { inboxDir })
    expect(again.body().files).toEqual([])
  })

  it("refuses a phone and a public website", async () => {
    const phone = mockRes()
    await handleChromeHistoryApi(mockReq("POST", "192.168.1.20", JSON.stringify(day)) as never, phone as never, "/api/chrome-history")
    expect(phone.status).toBe(403)

    const site = mockRes()
    await handleChromeHistoryApi(
      mockReq("GET", "127.0.0.1", "", "https://example.com") as never,
      site as never,
      "/api/chrome-history",
    )
    expect(site.status).toBe(403)
  })
})
