import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { classifyTelegramRow, materializeMissingFeedLogs } from "./file-feed-row"
import { useTelegramFeedStore } from "./telegram-feed-store"
import type { TelegramFeedRow } from "./telegram-feed"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const row: TelegramFeedRow = {
  id: "tg:1:1",
  at: new Date(2026, 9, 26, 5, 20).toISOString(),
  chatId: "1",
  text: "Woke in night",
  recordedAt: "2026-10-26T12:20:44.000Z",
  origin: "live",
  outcome: { kind: "event-log", status: "applied", summary: "Event → Woke in night" },
}

describe("file a telegram text onto the tracking log", () => {
  beforeEach(() => {
    resetAllStores()
    useTelegramFeedStore.setState({ rows: [{ ...row, outcome: { ...row.outcome! } }] })
  })

  it("writes an event BIM marked but never painted, once", () => {
    expect(materializeMissingFeedLogs()).toBe(1)
    const entry = useTimeTrackingStore.getState().entries.find((item) => item.title === "Woke in night")
    expect(entry).toMatchObject({ kind: "instant", date: "2026-10-26", startMin: 5 * 60 + 20 })
    expect(useTelegramFeedStore.getState().rows[0]?.outcome?.entryId).toBe(entry?.id)
    expect(useTelegramFeedStore.getState().rows[0]?.text).toBe("Woke in night")
    expect(materializeMissingFeedLogs()).toBe(0)
    expect(useTimeTrackingStore.getState().entries.filter((item) => item.title === "Woke in night")).toHaveLength(1)
  })

  it("reclassifies that text as food without leaving the feed or adding a second row", () => {
    materializeMissingFeedLogs()
    const filed = useTelegramFeedStore.getState().rows[0]!
    expect(classifyTelegramRow(filed, "food")).toBeTruthy()
    const entries = useTimeTrackingStore.getState().entries.filter((item) => item.title === "Woke in night")
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ intakeClass: "food", eventKind: "intake.food" })
    expect(useTelegramFeedStore.getState().rows).toHaveLength(1)
    expect(useTelegramFeedStore.getState().rows[0]?.outcome?.shelf).toBe("food")
  })

  it("does not recreate a text whose entry was deleted", () => {
    materializeMissingFeedLogs()
    const id = useTelegramFeedStore.getState().rows[0]?.outcome?.entryId
    expect(id).toBeTruthy()
    useTimeTrackingStore.getState().removeEntry(id!)
    expect(materializeMissingFeedLogs()).toBe(0)
    expect(useTimeTrackingStore.getState().entries.find((item) => item.title === "Woke in night")).toBeUndefined()
  })
})
