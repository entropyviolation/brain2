/**
 * lib/link-bimby/store.ts — Readings and reviews, kept by link task id
 *
 * A reading is advice, not data: it is never written onto the task. Using a guess
 * (`apply.ts`) is what changes the task. The person's ✓ / ✗ and comment live on the
 * reading (`review`). When **Again** replaces a reviewed reading, the old one moves to
 * `past`, so its lesson still reaches the prompt (`feedback.ts`). Persisted.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { isReviewed, withComment, withVerdict } from "./feedback"
import type { GuessVerdict, LinkReading } from "./types"

interface LinkBimbyState {
  readings: Record<string, LinkReading>
  /** Reviewed readings that a newer reading replaced, newest first. */
  past: LinkReading[]
  put: (reading: LinkReading) => void
  drop: (taskId: string) => void
  setVerdict: (taskId: string, key: string, verdict: GuessVerdict | null) => void
  setComment: (taskId: string, comment: string) => void
}

const KEEP = 400
const KEEP_PAST = 300

export const useLinkBimbyStore = create<LinkBimbyState>()(
  persist(
    (set) => ({
      readings: {},
      past: [],
      put: (reading) =>
        set((s) => {
          const old = s.readings[reading.taskId]
          const past = old && isReviewed(old) ? [old, ...s.past].slice(0, KEEP_PAST) : s.past
          const next = { ...s.readings, [reading.taskId]: reading }
          const ids = Object.keys(next)
          if (ids.length > KEEP) {
            ids
              .sort((a, b) => next[a]!.at.localeCompare(next[b]!.at))
              .slice(0, ids.length - KEEP)
              .forEach((id) => delete next[id])
          }
          return { readings: next, past }
        }),
      drop: (taskId) =>
        set((s) => {
          const { [taskId]: old, ...rest } = s.readings
          const past = old && isReviewed(old) ? [old, ...s.past].slice(0, KEEP_PAST) : s.past
          return { readings: rest, past }
        }),
      setVerdict: (taskId, key, verdict) =>
        set((s) => {
          const r = s.readings[taskId]
          if (!r) return s
          return { readings: { ...s.readings, [taskId]: { ...r, review: withVerdict(r.review, key, verdict, new Date().toISOString()) } } }
        }),
      setComment: (taskId, comment) =>
        set((s) => {
          const r = s.readings[taskId]
          if (!r) return s
          return { readings: { ...s.readings, [taskId]: { ...r, review: withComment(r.review, comment, new Date().toISOString()) } } }
        }),
    }),
    {
      name: persistKey("link-bimby"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ readings: state.readings, past: state.past }),
      version: 2,
      migrate: (persisted) => ({ past: [], ...(persisted as object) }) as unknown as LinkBimbyState,
    },
  ),
)

/** Every reviewed reading, current and replaced, for the prompt. */
export function reviewedReadings(): LinkReading[] {
  const { readings, past } = useLinkBimbyStore.getState()
  return [...Object.values(readings).filter(isReviewed), ...past]
}

registerPersistRehydrator(persistKey("link-bimby"), () => useLinkBimbyStore.persist.rehydrate())
