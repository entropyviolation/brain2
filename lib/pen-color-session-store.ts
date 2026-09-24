/**
 * lib/pen-color-session-store.ts — Persisted pen-color "working on right now"
 *
 * Holds at most one live pen-color session so a refresh does not forget that
 * you started. Start/stop/tick live in `lib/pen-color-session.ts`; this store
 * is only the blob those functions read and write. Independent of the
 * Operations session in `work-session-store.ts`.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export interface PenColorSession {
  penId: string
  scopeId: string
  /** Pen name at start (the Tracking block title). */
  title: string
  /** ISO timestamp of the second the user pressed "Working on right now". */
  startedAt: string
  trackingEntryIds: string[]
  /**
   * ISO timestamp of the open pause, if any. While set, elapsed and Tracking
   * paint freeze; resume clears it and folds the gap into `pausedAccumMs`.
   */
  pausedAt?: string
  /** Completed pause milliseconds from earlier pause/resume cycles. */
  pausedAccumMs?: number
}

interface PenColorSessionState {
  session: PenColorSession | null
  setSession: (session: PenColorSession | null) => void
  clearSession: () => void
}

export const usePenColorSessionStore = create<PenColorSessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: persistKey("pen-color-session"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ session: state.session }),
    },
  ),
)
