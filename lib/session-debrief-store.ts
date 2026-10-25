/**
 * lib/session-debrief-store.ts — Sitting reviews and notes for next time
 *
 * The review sheet is `pending` until Done or Close. Saved reviews stay for
 * analysis. A handoff is the note the next Working-on-now start shows for
 * that task, that pen, or both. A newer note for the same task or pen
 * replaces the older one.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export type SittingEnergy = "low" | "steady" | "high"

export interface SessionHandoff {
  id: string
  text: string
  at: string
  taskId?: string
  penId?: string
}

export interface SittingReview {
  id: string
  kind: "pen" | "operation"
  startedAt: string
  endedAt: string
  activeMinutes: number
  taskId?: string
  stepId?: string
  operationId?: string
  penId?: string
  scopeId?: string
  satisfaction?: number
  energy?: SittingEnergy
  blocker?: string
  handoff?: string
  note?: string
}

export interface DebriefObjective {
  text: string
  completed: boolean
  minutes: number | null
  when: string
}

export interface DebriefStep {
  stepId: string
  label: string
  depth: number
  estimated: number | null
  completed: boolean
  sittingMinutes: number | null
  when: string
}

export interface SessionDebriefDraft {
  kind: "pen" | "operation"
  title: string
  path: string
  /** The task or operation name, without the step. */
  taskTitle: string
  startedAt: string
  endedAt: string
  /** Active minutes, pauses left out. */
  activeMinutes: number
  taskId?: string
  stepId?: string
  operationId?: string
  penId?: string
  scopeId?: string
  penName?: string
  penColor?: string
  trackingEntryIds: string[]
  timeLogIds: string[]
  note: string
  taskCompleted: boolean
  taskEstimate: number | null
  steps: DebriefStep[]
  objectives: DebriefObjective[]
}

const REVIEW_CAP = 400

interface SessionDebriefState {
  pending: SessionDebriefDraft | null
  handoffs: SessionHandoff[]
  reviews: SittingReview[]
  open: (draft: SessionDebriefDraft) => void
  dismiss: () => void
  leaveHandoff: (note: Omit<SessionHandoff, "id" | "at"> & { at?: string }) => void
  dismissHandoff: (id: string) => void
  saveReview: (review: SittingReview) => void
}

export const useSessionDebriefStore = create<SessionDebriefState>()(
  persist(
    (set) => ({
      pending: null,
      handoffs: [],
      reviews: [],
      open: (draft) => set({ pending: draft }),
      dismiss: () => set({ pending: null }),
      leaveHandoff: (note) =>
        set((state) => {
          const text = note.text.trim()
          if (!text) return state
          const handoffs = state.handoffs.filter((row) => {
            if (note.taskId && row.taskId === note.taskId) return false
            if (note.penId && row.penId === note.penId) return false
            return true
          })
          handoffs.push({
            id: `hoff-${note.at ?? new Date().toISOString()}-${Math.random().toString(36).slice(2, 6)}`,
            text,
            at: note.at ?? new Date().toISOString(),
            ...(note.taskId ? { taskId: note.taskId } : {}),
            ...(note.penId ? { penId: note.penId } : {}),
          })
          return { handoffs }
        }),
      dismissHandoff: (id) => set((state) => ({ handoffs: state.handoffs.filter((row) => row.id !== id) })),
      saveReview: (review) =>
        set((state) => {
          const reviews = [...state.reviews.filter((row) => row.id !== review.id), review]
          return { reviews: reviews.length > REVIEW_CAP ? reviews.slice(reviews.length - REVIEW_CAP) : reviews }
        }),
    }),
    {
      name: persistKey("session-debrief"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ handoffs: state.handoffs, reviews: state.reviews }),
    },
  ),
)

/** Notes waiting for this task, this pen, or both. One record can match either. */
export function handoffsFor(
  rows: readonly SessionHandoff[],
  target: { taskId?: string; penId?: string },
): SessionHandoff[] {
  const seen = new Set<string>()
  const out: SessionHandoff[] = []
  for (const row of rows) {
    const task = Boolean(target.taskId && row.taskId === target.taskId)
    const pen = Boolean(target.penId && row.penId === target.penId)
    if (!task && !pen) continue
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}
