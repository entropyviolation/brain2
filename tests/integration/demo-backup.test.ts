import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { parseBackup, previewBackup, restoreBackup } from "@/lib/data/backup"
import { writeDataProfile } from "@/lib/storage-keys"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const raw = readFileSync(join(__dirname, "../fixtures/brain2-demo-backup.json"), "utf8")

describe("anonymized demo backup (scripts/anonymize-backup.py)", () => {
  beforeEach(() => {
    resetAllStores()
    writeDataProfile("demo")
  })

  it("parses, is stamped Demo, ", () => {
    const backup = parseBackup(raw)
    expect(backup.dataProfile).toBe("demo")
    expect(Object.keys(backup.stores).length).toBeGreaterThan(30)
    expect(previewBackup(backup)).toBeTruthy()
  })

  it("restores onto Demo and fills every tracking-log kind", async () => {
    await restoreBackup(parseBackup(raw))
    const kinds = new Set(
      useTimeTrackingStore
        .getState()
        .entries.map((e) => e.eventKind?.split(".")[0])
        .filter(Boolean),
    )
    for (const kind of ["spend", "intake", "thought-process", "note", "switch"]) expect(kinds.has(kind)).toBe(true)
  }, 60_000)
})
