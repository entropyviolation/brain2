/**
 * lib/affirmation-log-store.ts — Affirmation recitations
 *
 * Every time a line is said aloud it gets a row: its `affirmationKey`, the
 * text as said, the day it belongs to, the clock time, and where it was logged
 * (the Home widget, a tap on the morning ritual list, or a confident delivery
 * in Speak them). Rows only accumulate; **Undo** drops the newest row for that
 * line on that day. Also holds the lens the widget last showed. Storage:
 * `brain2-affirmation-log`, record-guarded in `lib/vault-guard.js`, in the full
 * backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { affirmationKey, isAffirmationLens, type AffirmationLens } from "@/lib/affirmation-lenses"
import { registerPhoneWindowStore } from "@/lib/phone-window"

export type RecitationSource = "widget" | "ritual" | "speak"

export type Recitation = {
  key: string
  text: string
  /** Local day key (YYYY-MM-DD) the recitation counts toward. */
  date: string
  /** ISO time it was logged. */
  at: string
  source: RecitationSource
}

export type RecitationStats = {
  total: number
  today: number
  days: number
  /** Consecutive days through `dateKey` (or the day before) with a recitation. */
  streak: number
  last?: Recitation
  first?: Recitation
}

interface AffirmationLogState {
  recitations: Recitation[]
  lens: AffirmationLens
  recite: (text: string, dateKey: string, source: RecitationSource) => void
  undoRecite: (text: string, dateKey: string) => void
  setLens: (lens: AffirmationLens) => void
}

function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y!, m! - 1, d! - 1)
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${mm}-${dd}`
}

export function recitationStats(rows: Recitation[], text: string, dateKey: string): RecitationStats {
  const key = affirmationKey(text)
  const mine = rows.filter((r) => r.key === key)
  const dates = new Set(mine.map((r) => r.date))
  let streak = 0
  let cursor = dates.has(dateKey) ? dateKey : previousDay(dateKey)
  while (dates.has(cursor)) {
    streak++
    cursor = previousDay(cursor)
  }
  return {
    total: mine.length,
    today: mine.filter((r) => r.date === dateKey).length,
    days: dates.size,
    streak,
    last: mine.reduce<Recitation | undefined>((best, r) => (!best || r.at > best.at ? r : best), undefined),
    first: mine.reduce<Recitation | undefined>((best, r) => (!best || r.at < best.at ? r : best), undefined),
  }
}

/** Recitations per day for one line (or every line when `text` is omitted). */
export function recitationsByDay(rows: Recitation[], text?: string): Map<string, number> {
  const key = text ? affirmationKey(text) : null
  const out = new Map<string, number>()
  for (const r of rows) if (!key || r.key === key) out.set(r.date, (out.get(r.date) ?? 0) + 1)
  return out
}

function sanitize(raw: unknown): Pick<AffirmationLogState, "recitations" | "lens"> {
  const value = (raw ?? {}) as { recitations?: unknown; lens?: unknown }
  const recitations = Array.isArray(value.recitations)
    ? value.recitations.filter(
        (r): r is Recitation =>
          !!r && typeof r === "object" && typeof (r as Recitation).key === "string" &&
          typeof (r as Recitation).date === "string" && typeof (r as Recitation).at === "string",
      )
    : []
  return { recitations, lens: isAffirmationLens(value.lens) ? value.lens : "original" }
}

export const useAffirmationLogStore = create<AffirmationLogState>()(
  persist(
    (set) => ({
      recitations: [],
      lens: "original",
      recite: (text, dateKey, source) =>
        set((state) => ({
          recitations: [
            ...state.recitations,
            { key: affirmationKey(text), text: text.trim(), date: dateKey, at: new Date().toISOString(), source },
          ],
        })),
      undoRecite: (text, dateKey) =>
        set((state) => {
          const key = affirmationKey(text)
          for (let i = state.recitations.length - 1; i >= 0; i--) {
            const r = state.recitations[i]!
            if (r.key === key && r.date === dateKey) {
              return { recitations: [...state.recitations.slice(0, i), ...state.recitations.slice(i + 1)] }
            }
          }
          return state
        }),
      setLens: (lens) => set({ lens }),
    }),
    {
      name: persistKey("affirmation-log"),
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ recitations: state.recitations, lens: state.lens }),
      migrate: (persisted) => persisted as AffirmationLogState,
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)

registerPhoneWindowStore(useAffirmationLogStore)
