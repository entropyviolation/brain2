/**
 * lib/graph/graph-usage-store.ts — Small usage counters for the graph
 * (`brain2-graph-usage`): visits per node and accept / dismiss actions per
 * suggestion source and relation. `lib/graph/feedback.ts` reads them
 * (`usageWeight`, `sourceAcceptance`). Capped; full backup carries the key.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { registerPhoneWindowStore } from "@/lib/phone-window"
import type { FeedbackDecision, FeedbackOutcome } from "@/lib/graph/feedback"

/** Visits kept per node (newest). */
export const VISITS_PER_NODE = 50
/** Actions kept in all (newest). */
export const ACTIONS_CAP = 2000

interface GraphUsageState {
  /** Node address → visit times, epoch ms, oldest first. */
  visits: Record<string, number[]>
  actions: FeedbackDecision[]
  recordVisit: (nodeId: string, now?: number) => void
  recordAction: (kind: FeedbackOutcome, source: string, relation?: string, now?: Date) => void
}

export const useGraphUsageStore = create<GraphUsageState>()(
  persist(
    (set, get) => ({
      visits: {},
      actions: [],
      recordVisit: (nodeId, now = Date.now()) => {
        const prev = get().visits[nodeId] ?? []
        set({ visits: { ...get().visits, [nodeId]: [...prev, now].slice(-VISITS_PER_NODE) } })
      },
      recordAction: (kind, source, relation, now = new Date()) => {
        const row: FeedbackDecision = { source, outcome: kind, at: now.toISOString(), ...(relation ? { relation } : {}) }
        set({ actions: [...get().actions, row].slice(-ACTIONS_CAP) })
      },
    }),
    { name: persistKey("graph-usage"), version: 1, storage: createCogsJSONStorage() },
  ),
)

registerPhoneWindowStore(useGraphUsageStore)
