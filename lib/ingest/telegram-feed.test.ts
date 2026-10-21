import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ingestIncoming, ingestIncomingAsync } from "./executor"
import { resetIngestDedupeForTests } from "./dedupe"
import { useIngestStore } from "./ingest-store"
import { UNPAIRED_SUMMARY } from "./pairing"
import {
  feedOutcomeLabel,
  feedRowDayKey,
  feedRowFromIncoming,
  feedRowFromIngestEvent,
  feedRowsForDays,
  mergeFeedRows,
} from "./telegram-feed"
import { useTelegramFeedStore } from "./telegram-feed-store"
import type { IncomingMessage, IngestEvent } from "./types"

const NOW = new Date(2026, 9, 19, 23, 57, 0)
let seq = 500

function tg(text: string, over: Partial<IncomingMessage> = {}): IncomingMessage {
  seq += 1
  return {
    source: { channel: "telegram", chatId: "99", userId: "99" },
    text,
    receivedAt: NOW.toISOString(),
    telegramMessageId: seq,
    telegramUpdateId: seq,
    ...over,
  }
}

describe("telegram feed model", () => {
  it("keys a row by chat and message id, and skips Live Location and simulate", () => {
    const row = feedRowFromIncoming(tg("hello", { telegramMessageId: 7 }), NOW)
    expect(row?.id).toBe("tg:99:7")
    expect(feedRowFromIncoming(tg("x", { locationUpdate: true }), NOW)).toBeNull()
    expect(feedRowFromIncoming({ ...tg("x"), source: { channel: "simulate", chatId: "s" } }, NOW)).toBeNull()
    expect(feedRowFromIncoming(tg("   "), NOW)).toBeNull()
  })

  it("holds an attachment-only message as (1 scan)", () => {
    const row = feedRowFromIncoming(
      tg("", { attachments: [{ kind: "photo", fileId: "f" } as never] }),
      NOW,
    )
    expect(row?.text).toBe("(1 scan)")
  })

  it("merging the same message twice keeps one row and learns a later outcome", () => {
    const live = feedRowFromIncoming(tg("hi", { telegramMessageId: 9 }), NOW)!
    const once = mergeFeedRows([], [live])
    expect(mergeFeedRows(once, [live])).toBe(once)
    const withOutcome = mergeFeedRows(once, [{ ...live, outcome: { kind: "event-log", status: "applied", summary: "x" } }])
    expect(withOutcome).toHaveLength(1)
    expect(feedOutcomeLabel(withOutcome[0]!.outcome)).toBe("→ Event")
  })

  it("backfills a live row and its ingest line into one row", () => {
    const live = feedRowFromIncoming(tg("same", { telegramMessageId: 12 }), NOW)!
    const event: IngestEvent = {
      id: "ing-1",
      at: live.at,
      channel: "telegram",
      chatId: "99",
      raw: "same",
      kind: "link",
      status: "applied",
      summary: "Saved link",
      telegramMessageId: 12,
    }
    const row = feedRowFromIngestEvent(event, UNPAIRED_SUMMARY)!
    expect(row.id).toBe(live.id)
    expect(mergeFeedRows([live], [row])[0]?.outcome?.kind).toBe("link")
    expect(feedRowFromIngestEvent({ ...event, status: "ignored", summary: UNPAIRED_SUMMARY }, UNPAIRED_SUMMARY)).toBeNull()
  })

  it("selects rows by local send day", () => {
    const row = feedRowFromIncoming(tg("late"), NOW)!
    expect(feedRowDayKey(row)).toBe("2026-10-19")
    expect(feedRowsForDays([row], new Set(["2026-10-19"]))).toHaveLength(1)
    expect(feedRowsForDays([row], new Set(["2026-10-20"]))).toHaveLength(0)
  })
})

describe("the executor feeds every paired text", () => {
  beforeEach(() => {
    resetAllStores()
    resetIngestDedupeForTests()
    useTelegramFeedStore.setState({ rows: [] })
    useIngestStore.setState({ events: [], allowedChats: [], seenIngestKeys: [], pendingByChat: {} })
    useIngestStore.getState().allowChat({ chatId: "99", userId: "99", pairedAt: NOW.toISOString() })
  })

  it("records a link text that only goes to Inbox → Links", () => {
    const link = tg("https://www.instagram.com/reel/Dc4KccLs5hR/?mdxt=abc")
    const result = ingestIncoming(link, NOW)
    expect(result.status).toBe("ok")
    const rows = useTelegramFeedStore.getState().rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text).toBe(link.text)
    expect(rows[0]?.outcome?.kind).toBe("link")
    expect(rows[0]?.outcome?.status).toBe("applied")
  })

  it("records a plain event text beside the tracking row it paints", () => {
    ingestIncoming(tg("Birth of tragedy"), NOW)
    const rows = useTelegramFeedStore.getState().rows
    expect(rows.map((r) => r.text)).toEqual(["Birth of tragedy"])
    expect(rows[0]?.outcome?.kind).toBe("event-log")
  })

  it("records a text that needs clarifying, and the async path too", async () => {
    await ingestIncomingAsync(tg("Feeling strong resistance to shower"), NOW)
    expect(useTelegramFeedStore.getState().rows).toHaveLength(1)
  })

  it("keeps one row when Telegram redelivers the same message", () => {
    const msg = tg("redelivered")
    ingestIncoming(msg, NOW)
    ingestIncoming({ ...msg, telegramUpdateId: 9999 }, NOW)
    expect(useTelegramFeedStore.getState().rows).toHaveLength(1)
  })

  it("keeps the row when the ingest log is cleared", () => {
    ingestIncoming(tg("survives"), NOW)
    useIngestStore.getState().clearEvents()
    expect(useTelegramFeedStore.getState().rows).toHaveLength(1)
  })

  it("does not keep texts from a chat that is not paired", () => {
    ingestIncoming(tg("stranger", { source: { channel: "telegram", chatId: "5", userId: "5" } }), NOW)
    expect(useTelegramFeedStore.getState().rows).toHaveLength(0)
  })

  it("never lets a failing feed stop the message from applying", () => {
    const original = useTelegramFeedStore.getState().record
    useTelegramFeedStore.setState({
      record: () => {
        throw new Error("disk full")
      },
    })
    try {
      const result = ingestIncoming(tg("still applied"), NOW)
      expect(result.status).toBe("ok")
    } finally {
      useTelegramFeedStore.setState({ record: original })
    }
  })
})
