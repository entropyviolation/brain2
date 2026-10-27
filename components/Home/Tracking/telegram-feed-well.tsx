/**
 * components/Home/Tracking/telegram-feed-well.tsx — Telegram feed in the Tracking log
 *
 * Every text a paired chat sent BIM, on the day it was sent, whatever BIM did
 * with it. The shelf is the short list. The heading opens the detail page,
 * where a text can be filed as food, drink, a drug, an event, or a thought
 * at the minute it was sent. Filing does not take the text off this feed.
 * Week columns stay the muted lines. Source: `lib/ingest/telegram-feed-store.ts`.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { LogShelfDialog } from "@/components/Home/Tracking/log-shelf-dialog"
import { logClockLabel } from "@/components/Home/Tracking/tracking-log-model"
import { NativeSelect } from "@/components/ui/native-select"
import { classifyTelegramRow } from "@/lib/ingest/file-feed-row"
import { UNPAIRED_SUMMARY } from "@/lib/ingest/pairing"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import {
  feedOutcomeLabel,
  feedRowMinute,
  feedRowsForDays,
  type TelegramFeedRow,
  type TelegramFeedShelf,
} from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"

const SHELVES: { id: TelegramFeedShelf; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "drink", label: "Drink" },
  { id: "drug", label: "Drug" },
  { id: "event", label: "Event" },
  { id: "thought", label: "Thought process" },
]

function shelfLabel(shelf: TelegramFeedShelf | undefined): string {
  return SHELVES.find((row) => row.id === shelf)?.label ?? ""
}

/**
 * The feed rows, with the ingest log folded in on first sight. Backfill is
 * idempotent, so every open of the Tracking log may call it.
 */
export function useTelegramFeedRows(): TelegramFeedRow[] {
  const rows = useTelegramFeedStore((s) => s.rows)
  const events = useIngestStore((s) => s.events)
  useEffect(() => {
    useTelegramFeedStore.getState().backfillFromIngestLog(events, UNPAIRED_SUMMARY)
  }, [events])
  return rows
}

export function useTelegramFeedForDays(dayKeys: ReadonlySet<string>): TelegramFeedRow[] {
  const rows = useTelegramFeedRows()
  return useMemo(() => feedRowsForDays(rows, dayKeys), [rows, dayKeys])
}

function clockOf(row: TelegramFeedRow): string {
  return logClockLabel({ startMin: feedRowMinute(row) }).time ?? ""
}

export function TelegramWeekRow({ row }: { row: TelegramFeedRow }) {
  return (
    <div className="trk-log-week-row is-telegram" data-telegram={row.id} title={row.text}>
      <span className="trk-log-week-when">{clockOf(row)}</span>
      <span className="trk-log-week-copy">{row.text}</span>
      <span className="trk-log-week-tag">Telegram</span>
      <span className="trk-log-week-badge is-outcome">{feedOutcomeLabel(row.outcome)}</span>
    </div>
  )
}

function TelegramRows({ rows, classify }: { rows: TelegramFeedRow[]; classify?: boolean }) {
  if (rows.length === 0) return <p className="trk-shelf-empty">No texts to BIM this day.</p>
  return (
    <div className="trk-log">
      {rows.map((row) => (
        <div key={row.id} className="trk-log-row is-telegram" data-telegram={row.id}>
          <span className="trk-log-when">{clockOf(row)}</span>
          <span className="trk-log-copy">{row.text}</span>
          <span className="trk-log-scope">
            {feedOutcomeLabel(row.outcome)}
            {shelfLabel(row.outcome?.shelf) ? ` · ${shelfLabel(row.outcome?.shelf)}` : ""}
          </span>
          {classify ? (
            <label className="trk-feed-file">
              Log as
              <NativeSelect
                aria-label={`Log “${row.text.slice(0, 48)}” as`}
                value={row.outcome?.shelf ?? ""}
                onChange={(event) => {
                  const shelf = event.target.value as TelegramFeedShelf
                  if (!shelf) return
                  classifyTelegramRow(row, shelf)
                }}
              >
                <option value="">Choose</option>
                {SHELVES.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function TelegramFeedWell({ dayKey }: { dayKey: string }) {
  const days = useMemo(() => new Set([dayKey]), [dayKey])
  const rows = useTelegramFeedForDays(days)
  const [open, setOpen] = useState(false)
  return (
    <section
      className="trk-aside-well"
      aria-label="Telegram"
      data-empty={rows.length === 0 ? "true" : "false"}
      data-testid="telegram-feed-well"
    >
      <h3 className="trk-logbook-heading">
        <button type="button" className="trk-logbook-heading-open" onClick={() => setOpen(true)} title="Open telegram">
          Telegram
          <span aria-hidden="true"> ›</span>
        </button>
        {rows.length > 0 ? (
          <span className="trk-logbook-count" aria-hidden="true">
            {rows.length}
          </span>
        ) : null}
      </h3>
      <p className="trk-logbook-note">Every text you sent BIM this day, kept even when it went somewhere else.</p>
      {rows.length === 0 ? (
        <p className="trk-logbook-note trk-logbook-empty">No texts to BIM this day.</p>
      ) : (
        <TelegramRows rows={rows} />
      )}
      <LogShelfDialog
        open={open}
        onOpenChange={setOpen}
        title="Telegram"
        description="Every text you sent BIM this day. Logging one files it on that shelf at the time it was sent. It stays here."
      >
        <TelegramRows rows={rows} classify />
      </LogShelfDialog>
    </section>
  )
}
