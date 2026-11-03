/**
 * lib/ingest/scan-door.test.ts — POST /api/scan without booting Telegram
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { resetIngestDedupeForTests } from "./dedupe"
import { ingestIncoming } from "./executor"
import { useIngestStore } from "./ingest-store"
import { applyScanDoor, parseScanDoorRequest } from "./scan-door"

const NOW = new Date(2026, 9, 26, 17, 42, 0)

function nfcInstants() {
  return useTimeTrackingStore.getState().entries.filter((entry) => entry.generatedBy?.id?.startsWith("nfc:") && entry.kind === "instant")
}

describe("scan door", () => {
  beforeEach(() => {
    resetAllStores()
    resetIngestDedupeForTests()
    useIngestStore.setState({ nfcTags: [], enabled: true, seenIngestKeys: [] })
    useIngestStore.getState().upsertNfcTag({
      id: "adderall",
      name: "Adderall",
      kind: "instant",
      title: "10 mg adderall",
      intakeClass: "drug",
      quantity: 1,
      habitCredit: "done",
    })
  })

  it("refuses a line that is not one nfc: command", () => {
    expect(parseScanDoorRequest({ text: "log: coffee", id: "a1" })).toEqual({ ok: false, error: "nfc: line required" })
    expect(parseScanDoorRequest({ text: "nfc:adderall 2\nlog: coffee", id: "a1" }).ok).toBe(false)
    expect(parseScanDoorRequest({ text: "nfc:adderall 2" }).ok).toBe(false)
    expect(parseScanDoorRequest({ text: "nfc:adderall 2", id: "" }).ok).toBe(false)
  })

  it("writes the tracking instant the same way a bot line does", async () => {
    const result = await applyScanDoor({ text: "nfc:adderall 2", id: "scan-1" }, NOW)
    expect(result.status).toBe("ok")
    expect(result.reply).toContain("Logged 2 10 mg adderall")
    expect(nfcInstants()).toHaveLength(1)
    expect(nfcInstants()[0]).toMatchObject({ title: "2 10 mg adderall", intakeClass: "drug" })
  })

  it("ignores a retry with the same id and does not need Telegram pairing", async () => {
    const first = await applyScanDoor({ text: "nfc:adderall 2", id: "scan-same" }, NOW)
    expect(first.status).toBe("ok")
    const again = await applyScanDoor({ text: "nfc:adderall 2", id: "scan-same" }, new Date(NOW.getTime() + 60_000))
    expect(again).toMatchObject({ status: "ignored", summary: "Duplicate scan" })
    expect(nfcInstants()).toHaveLength(1)

    const unpaired = ingestIncoming(
      {
        source: { channel: "telegram", chatId: "stranger" },
        text: "nfc:adderall 2",
        receivedAt: NOW.toISOString(),
        telegramMessageId: 9,
        telegramUpdateId: 9,
      },
      NOW,
    )
    expect(unpaired.status).toBe("ignored")
    expect(nfcInstants()).toHaveLength(1)
  })

  it("writes nothing when ingest is disabled", async () => {
    useIngestStore.setState({ enabled: false })
    const result = await applyScanDoor({ text: "nfc:adderall", id: "scan-off" }, NOW)
    expect(result.status).toBe("ignored")
    expect(nfcInstants()).toHaveLength(0)
  })
})
