import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { openPhoneArchive } from "./archive"
import { runPhoneSync, type PhoneReader } from "./runner"
import type { MessageRecord } from "./types"

const msg = (id: string): MessageRecord => ({
  type: "message",
  source: "messages",
  sourceId: id,
  at: 1,
  direction: "in",
  party: { handle: "x" },
  threadId: "t",
  body: id,
})

describe("runPhoneSync", () => {
  it("archives, applies, then moves the cursor", async () => {
    const archive = openPhoneArchive(fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-")))
    const seen: (string | undefined)[] = []
    const reader: PhoneReader = {
      source: "messages",
      async read(cursor) {
        seen.push(cursor)
        return cursor ? { records: [], cursor } : { records: [msg("a")], cursor: "1" }
      },
    }
    const apply = vi.fn((records) => ({ read: records.length, written: records.length, skipped: 0 }))
    const onWrote = vi.fn()
    const [run] = await runPhoneSync({ archive, apply, onWrote }, [reader])
    expect(run).toMatchObject({ source: "messages", read: 1, written: 1 })
    expect(onWrote).toHaveBeenCalledTimes(1)
    expect(archive.readMessages()).toHaveLength(1)
    await runPhoneSync({ archive, apply, onWrote }, [reader])
    expect(seen).toEqual([undefined, "1"])
    expect(onWrote).toHaveBeenCalledTimes(1)
  })

  it("logs a reader error and leaves the cursor where it was", async () => {
    const archive = openPhoneArchive(fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-")))
    archive.setCursor("calls", "5")
    const reader: PhoneReader = {
      source: "calls",
      async read() {
        throw new Error("Full Disk Access is off")
      },
    }
    const [run] = await runPhoneSync({ archive, apply: () => ({ read: 0, written: 0, skipped: 0 }) }, [reader])
    expect(run.error).toBe("Full Disk Access is off")
    expect(archive.getCursor("calls")).toBe("5")
    expect(archive.runs()).toHaveLength(1)
  })

  it("skips a source that is turned off", async () => {
    const archive = openPhoneArchive(fs.mkdtempSync(path.join(os.tmpdir(), "b2-ps-")))
    const read = vi.fn(async () => ({ records: [] }))
    const runs = await runPhoneSync({ archive, apply: () => ({ read: 0, written: 0, skipped: 0 }), enabled: () => false }, [
      { source: "messages", read },
    ])
    expect(runs).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })
})
