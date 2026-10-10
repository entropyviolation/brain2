import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { deliverIngestReply } from "./deliver-reply"
import { useIngestStore } from "./ingest-store"
import type { PendingClarify } from "./types"

const pending: PendingClarify = {
  kind: "ritual",
  query: "gm",
  candidates: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ritual: { flow: "morning", periodKey: "2026-01-01", step: "bed", draft: {} },
}

describe("deliverIngestReply ritual card", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("sends one bot card, then edits that message for the next step", async () => {
    const sent: string[] = []
    const edits: { id: number; text: string }[] = []
    const transport = {
      send: async (_chatId: string, text: string) => {
        sent.push(text)
        return { messageId: 70 }
      },
      edit: async (_chatId: string, messageId: number, text: string) => {
        edits.push({ id: messageId, text })
      },
    }

    await deliverIngestReply(
      "9",
      { status: "needs_clarify", reply: "Bed?", kind: "morning", pending },
      transport,
    )
    expect(sent).toEqual(["Bed?"])
    expect(edits).toEqual([])
    expect(useIngestStore.getState().getPending("telegram", "9")?.ritualCardMessageId).toBe(70)

    sent.length = 0
    await deliverIngestReply(
      "9",
      {
        status: "needs_clarify",
        reply: "Grateful?",
        kind: "morning",
        ritualCardMessageId: 70,
        pending: { ...pending, ritualCardMessageId: 70 },
      },
      transport,
    )
    expect(edits).toEqual([{ id: 70, text: "Grateful?" }])
    expect(sent).toEqual([])
    expect(useIngestStore.getState().getPending("telegram", "9")?.ritualCardMessageId).toBe(70)
  })
})
