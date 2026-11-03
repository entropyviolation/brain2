/**
 * lib/work-session-store.ts — Persisted "working on this now" pointer
 *
 * Holds at most one live Operations work session so a refresh does not forget
 * that you started. Start/stop/tick live in `lib/operation-work-session.ts`;
 * this store is only the blob those functions read and write.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { NowObjective } from "@/lib/now-objective"
import type { WorkPauseSpan } from "@/lib/work-pause"
import { registerPhoneWindowStore } from "@/lib/phone-window"

export interface WorkSession {
  operationId: string
  /** ISO timestamp of when the user pressed "Working on this now". */
  startedAt: string
  /** Operation name at start (used as the Tracking block title). */
  title: string
  scopeId: string
  penId: string
  trackingEntryIds: string[]
  /**
   * Objectives for right now on this operation's live activity block. Not Home
   * Goals, not the Tracking Objective pen. Mirrored onto linked TimeEntry rows.
   */
  nowObjectives?: NowObjective[]
  /**
   * ISO timestamp of the open pause, if any. While set, elapsed and Tracking
   * paint freeze; resume clears it and folds the gap into `pausedAccumMs`.
   */
  pausedAt?: string
  /** Completed pause milliseconds from earlier pause/resume cycles. */
  pausedAccumMs?: number
  /**
   * Reasons for pausing this sitting. Copied onto the operation time log and
   * the painted block when the sitting ends, and refreshed while it is open.
   */
  pauseSpans?: WorkPauseSpan[]
}

interface WorkSessionState {
  session: WorkSession | null
  setSession: (session: WorkSession | null) => void
  clearSession: () => void
}

export const useWorkSessionStore = create<WorkSessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: persistKey("work-session"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ session: state.session }),
    },
  ),
)

registerPhoneWindowStore(useWorkSessionStore)
