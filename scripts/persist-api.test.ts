import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  shouldRejectVaultShrink,
  vaultRecordCount,
  listRecoveryBackupsFromDir,
  safeRecoveryBackupPath,
  journalVaultSnapshot,
  vaultDropReason,
} from "@/scripts/persist-api.mjs"

function timegrid(n: number) {
  return JSON.stringify({
    state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) },
    version: 7,
  })
}

function sleep(n: number) {
  const nights: Record<string, { date: string }> = {}
  for (let i = 0; i < n; i++) nights[`2026-09-${String(i + 1).padStart(2, "0")}`] = { date: `d${i}` }
  return JSON.stringify({ state: { nights }, version: 1 })
}

function habits(tasks: number, days: number) {
  const weeklyData: Record<string, object> = {}
  for (let i = 0; i < days; i++) weeklyData[`2026-09-${String(i + 1).padStart(2, "0")}`] = {}
  return JSON.stringify({
    state: { tasks: Array.from({ length: tasks }, (_, i) => ({ id: `h${i}` })), weeklyData },
    version: 14,
  })
}

function lists(n: number) {
  return JSON.stringify({
    state: { tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) },
    version: 12,
  })
}

describe("persist hub vault shrink guard", () => {
  it("counts entries and nights", () => {
    expect(vaultRecordCount("cogs-timegrid-store", timegrid(12))).toBe(12)
    expect(vaultRecordCount("cogs-sleep-store", sleep(3))).toBe(3)
    expect(vaultRecordCount("cogs-task-storage", lists(12))).toBe(12)
    expect(vaultRecordCount("cogs-habits-store", habits(30, 47))).toBe(77)
  })

  it("lets ordinary edits through and rejects a much thinner vault", () => {
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(168), timegrid(169))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(63), timegrid(169))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-sleep-store", sleep(1), sleep(5))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(10), undefined)).toBe(false)
    expect(shouldRejectVaultShrink("cogs-ingest-store", timegrid(1), timegrid(100))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-task-storage", lists(15), lists(2455))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(15, 6), habits(30, 47))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(29, 47), habits(30, 47))).toBe(false)
  })
})

describe("auto recovery journal (isolated tmp dir)", () => {
  it("keeps the copy a shrinking or refused write would have cost", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cogs-journal-"))
    try {
      // 3% fewer entries slips under the shrink guard — that is how a day of
      // tracking went missing. Journal it so the old copy is still restorable.
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(173), false)).toBe("shrunk")
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(178), false)).toBeNull()
      // A curated vault loses rows on purpose; only a real bite is journaled.
      expect(vaultDropReason("cogs-task-storage", lists(100), lists(99), false)).toBeNull()
      expect(vaultDropReason("cogs-task-storage", lists(100), lists(80), false)).toBe("shrunk")
      expect(vaultDropReason("cogs-timegrid-store", timegrid(178), timegrid(2), true)).toBe("refused")
      expect(vaultDropReason("cogs-theme-store", '{"state":{}}', '{"state":{}}', true)).toBeNull()

      const file = journalVaultSnapshot("brain2-timegrid-store", timegrid(178), "shrunk", dir)
      expect(file).toBeTruthy()
      const listing = listRecoveryBackupsFromDir(dir)
      expect(listing.exists).toBe(true)
      expect(listing.backups[0].storeKeys).toEqual(["brain2-timegrid-store"])
      // One file per vault per hour: the first copy of the hour is pre-damage.
      const again = journalVaultSnapshot("brain2-timegrid-store", timegrid(2), "shrunk", dir)
      expect(again).toBe(file)
      expect(listRecoveryBackupsFromDir(dir).backups).toHaveLength(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("recovery-backups listing (isolated tmp dir)", () => {
  it("does not invent a folder and rejects path-like names", () => {
    const missing = path.join(tmpdir(), `cogs-recovery-missing-${Date.now()}`)
    expect(listRecoveryBackupsFromDir(missing)).toEqual({ exists: false, backups: [] })
    expect(safeRecoveryBackupPath("../x.json", "/tmp/safe")).toBeNull()
    expect(safeRecoveryBackupPath("nested/path.json", "/tmp/safe")).toBeNull()
  })

  it("lists valid snapshots from a temp folder, not the live vault", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cogs-recovery-"))
    try {
      writeFileSync(
        path.join(dir, "ok-file.json"),
        JSON.stringify({
          app: "brain2",
          version: 1,
          exportedAt: "2026-09-21T00:00:00.000Z",
          stores: { "cogs-task-storage": { state: {} } },
          planText: { "dayPlan-2026-09-21": "x" },
        }),
      )
      writeFileSync(path.join(dir, "not-a-backup.json"), JSON.stringify({ nope: true }))
      const listing = listRecoveryBackupsFromDir(dir)
      expect(listing.exists).toBe(true)
      expect(listing.backups).toHaveLength(1)
      expect(listing.backups[0]?.name).toBe("ok-file.json")
      expect(listing.backups[0]?.storeKeys).toEqual(["cogs-task-storage"])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
