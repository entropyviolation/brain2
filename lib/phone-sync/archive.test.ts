import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { openPhoneArchive } from "./archive"
import type { MessageRecord } from "./types"

const msg = (id: string, threadId = "t1"): MessageRecord => ({
  type: "message",
  source: "messages",
  sourceId: id,
  at: 1000 + Number(id.replace(/\D/g, "") || 0),
  direction: "in",
  party: { handle: "+15551234567" },
  threadId,
  body: `body ${id}`,
})

describe("openPhoneArchive", () => {
  it("appends each message once, across reopenings", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-"))
    const a = openPhoneArchive(dir)
    expect(a.appendMessages([msg("m1"), msg("m2"), msg("m1")])).toBe(2)
    const b = openPhoneArchive(dir)
    expect(b.appendMessages([msg("m2"), msg("m3", "t2")])).toBe(1)
    expect(b.readMessages().map((m) => m.sourceId)).toEqual(["m1", "m2", "m3"])
    expect(b.readMessages({ threadId: "t2" }).map((m) => m.body)).toEqual(["body m3"])
  })

  it("survives a torn last line", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-"))
    const a = openPhoneArchive(dir)
    a.appendMessages([msg("m1")])
    fs.appendFileSync(path.join(a.dir, "messages.jsonl"), '{"type":"mess')
    expect(openPhoneArchive(dir).readMessages()).toHaveLength(1)
  })

  it("keeps cursors per source and a capped run log", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-"))
    const a = openPhoneArchive(dir)
    a.setCursor("messages", "120")
    a.setCursor("calls", "9")
    expect(openPhoneArchive(dir).getCursor("messages")).toBe("120")
    expect(a.getCursor("location")).toBeUndefined()
    for (let i = 0; i < 205; i++) a.logRun({ source: "messages", startedAt: i, finishedAt: i, read: 0, written: 0, skipped: 0 })
    expect(a.runs()).toHaveLength(200)
  })
})
