/**
 * components/Home/Tracking/telegram-feed-well.tsx — Telegram feed in the Tracking log
 *
 * Every text a paired chat sent BIM, on the day it was sent, whatever BIM did
 * with it. Read-only: a row never opens a block or edits anything. Sits beside
 * the Spent / Food / Events shelves and as muted lines in the week columns.
 * Source: `lib/ingest/telegram-feed-store.ts`.
 */
"use client"

import { useEffect, useMemo } from "react"
import { logClockLabel } from "@/components/Home/Tracking/tracking-log-model"
import { UNPAIRED_SUMMARY } from "@/lib/ingest/pairing"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import {
  feedOutcomeLabel,
  feedRowMinute,
  feedRowsForDays,
  type TelegramFeedRow,
} from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"

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

export function TelegramFeedWell({ dayKey }: { dayKey: string }) {
  const days = useMemo(() => new Set([dayKey]), [dayKey])
  const rows = useTelegramFeedForDays(days)
  return (
    <section
      className="trk-aside-well"
      aria-label="Telegram"
      data-empty={rows.length === 0 ? "true" : "false"}
      data-testid="telegram-feed-well"
    >
      <h3 className="trk-logbook-heading">
        Telegram
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
        <div className="trk-log">
          {rows.map((row) => (
            <div key={row.id} className="trk-log-row is-telegram" data-telegram={row.id}>
              <span className="trk-log-when">{clockOf(row)}</span>
              <span className="trk-log-copy">{row.text}</span>
              <span className="trk-log-scope">{feedOutcomeLabel(row.outcome)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
