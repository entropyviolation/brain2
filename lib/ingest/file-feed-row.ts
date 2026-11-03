/**
 * lib/ingest/file-feed-row.ts — File a Telegram text onto a Tracking log shelf
 *
 * The feed keeps every text. Classifying one also writes a tracking instant at
 * the minute it was sent, and reclassifying moves that same instant. The feed
 * row stays. A text BIM marked as an event but never painted (no entry id, and
 * no matching instant) is filed once when the Tracking log opens.
 */
import { fileTextAsShelf, type FeedLogShelf } from "@/lib/ingest/apply-discrete-event"
import { feedRowDayKey, feedRowFromIngestEvent, feedRowMinute, type TelegramFeedRow } from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import type { IngestEvent } from "@/lib/ingest/types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const AUTO_FILE = new Set(["event-log", "thought-process"])

function shelfForKind(kind: string): FeedLogShelf | null {
  if (kind === "thought-process") return "thought"
  if (kind === "event-log") return "event"
  return null
}

function liveMatch(title: string, date: string, minute: number): string | undefined {
  const want = title.trim()
  const first = want.split("\n")[0]?.trim() ?? want
  return useTimeTrackingStore.getState().entries.find((entry) => {
    if (entry.kind !== "instant" || entry.date !== date || entry.startMin !== minute) return false
    const title = (entry.title ?? "").trim()
    return title === want || title === first
  })?.id
}

function stamp(row: TelegramFeedRow, entryId: string, shelf?: FeedLogShelf): void {
  if (!row.outcome) return
  useTelegramFeedStore.getState().markOutcome(row.id, {
    ...row.outcome,
    entryId,
    ...(shelf ? { shelf } : row.outcome.shelf ? { shelf: row.outcome.shelf } : {}),
  })
}

/**
 * Put an unfiled event or thought onto the log at the minute it was sent.
 * A row that already names an entry is left alone, including one whose entry
 * was deleted. Returns how many instants were created.
 */
export function materializeMissingFeedLogs(events: readonly IngestEvent[] = []): number {
  const knownIds = new Map<string, string[]>()
  for (const event of events) {
    const row = feedRowFromIngestEvent(event, "")
    if (!row || !event.itemIds?.length) continue
    knownIds.set(row.id, event.itemIds)
  }
  let created = 0
  for (const row of useTelegramFeedStore.getState().rows) {
    const outcome = row.outcome
    if (!outcome || outcome.status !== "applied" || !AUTO_FILE.has(outcome.kind)) continue
    if (outcome.entryId) continue
    const shelf = shelfForKind(outcome.kind)
    if (!shelf) continue
    const date = feedRowDayKey(row)
    const minute = feedRowMinute(row)
    const title = row.text.trim()
    const match = liveMatch(title, date, minute)
    if (match) {
      stamp(row, match)
      continue
    }
    const prior = knownIds.get(row.id)
    if (prior?.length) {
      const live = prior.find((id) => useTimeTrackingStore.getState().entries.some((entry) => entry.id === id))
      stamp(row, live ?? prior[0]!)
      continue
    }
    const id = fileTextAsShelf({ title, at: new Date(row.at), shelf })
    if (!id) continue
    stamp(row, id)
    created += 1
  }
  return created
}

/** Classify or reclassify one feed row. The row stays in the feed. */
export function classifyTelegramRow(row: TelegramFeedRow, shelf: FeedLogShelf): string | undefined {
  const linked = row.outcome?.entryId
  const live = linked
    ? useTimeTrackingStore.getState().entries.some((entry) => entry.id === linked)
    : false
  const id = fileTextAsShelf({
    title: row.text,
    at: new Date(row.at),
    shelf,
    ...(live && linked ? { entryId: linked } : {}),
  })
  if (!id) return undefined
  const outcome = row.outcome ?? { kind: "event-log", status: "applied" as const, summary: row.text }
  useTelegramFeedStore.getState().markOutcome(row.id, { ...outcome, entryId: id, shelf })
  return id
}
