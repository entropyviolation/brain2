/**
 * lib/ingest/telegram-feed-store.ts — Every text BIM received, kept
 *
 * `brain2-telegram-feed`. The ingest log keeps 200 lines and the Tracking log
 * only shows what a verb painted, so a link (Inbox only) or a text from before
 * the 200 cap left no trace on the week. This store is append-only: the
 * executor writes a row the moment a paired chat's message arrives, before any
 * routing, and fills the outcome afterward. Undo, `clearEvents`, and removing
 * a tracking block never touch it. Record-guarded in `lib/vault-guard.js`
 * (shrink refused, union by id on the hub) and in the full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  feedRowFromIngestEvent,
  mergeFeedRows,
  type TelegramFeedOutcome,
  type TelegramFeedRow,
} from "./telegram-feed"
import type { IngestEvent } from "./types"

interface TelegramFeedState {
  rows: TelegramFeedRow[]
  record: (row: TelegramFeedRow) => void
  markOutcome: (id: string, outcome: TelegramFeedOutcome) => void
  /** Fold ingest-log lines in. Safe to call on every open; held rows are untouched. */
  backfillFromIngestLog: (events: IngestEvent[], unpairedSummary: string) => number
}

export const useTelegramFeedStore = create<TelegramFeedState>()(
  persist(
    (set, get) => ({
      rows: [],
      record: (row) => set((state) => ({ rows: mergeFeedRows(state.rows, [row]) })),
      markOutcome: (id, outcome) =>
        set((state) => {
          const at = state.rows.findIndex((row) => row.id === id)
          if (at < 0) return state
          const held = state.rows[at]!
          if (held.outcome && held.outcome.status === "applied" && outcome.status === "ignored") return state
          const rows = state.rows.slice()
          rows[at] = { ...held, outcome }
          return { rows }
        }),
      backfillFromIngestLog: (events, unpairedSummary) => {
        const incoming: TelegramFeedRow[] = []
        for (const event of events) {
          const row = feedRowFromIngestEvent(event, unpairedSummary)
          if (row) incoming.push(row)
        }
        const before = get().rows
        const next = mergeFeedRows(before, incoming)
        if (next === before) return 0
        set({ rows: next })
        return next.length - before.length
      },
    }),
    {
      name: persistKey("telegram-feed"),
      version: 1,
      storage: createCogsJSONStorage(),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { rows?: unknown }
        return { rows: Array.isArray(p.rows) ? (p.rows as TelegramFeedRow[]) : [] }
      },
    },
  ),
)
