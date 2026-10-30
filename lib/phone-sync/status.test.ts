import { describe, expect, it } from "vitest"
import { PHONE_SYNC_ROWS, latestRun, phoneSyncRow } from "./status"
import type { PhoneSyncRun } from "./types"

const run = (source: PhoneSyncRun["source"], finishedAt: number): PhoneSyncRun => ({
  source,
  startedAt: finishedAt,
  finishedAt,
  read: 1,
  written: 1,
  skipped: 0,
})

describe("phone sync status rows", () => {
  it("names every source once, and only the live ones switch", () => {
    expect(PHONE_SYNC_ROWS.map((row) => row.id)).toEqual([
      "messages",
      "calls",
      "location",
      "health",
      "screen",
      "email",
      "dms",
    ])
    expect(PHONE_SYNC_ROWS.filter((row) => row.switchable).map((row) => row.id)).toEqual([
      "messages",
      "calls",
      "location",
    ])
    expect(phoneSyncRow("health")?.needs).toMatch(/iPhone app/)
    expect(phoneSyncRow("health")?.switchable).toBe(false)
  })

  it("keeps the newest run for a source", () => {
    const runs = [run("messages", 1), run("calls", 2), run("messages", 3)]
    expect(latestRun(runs, "messages")?.finishedAt).toBe(3)
    expect(latestRun(runs, "location")).toBeNull()
  })
})
