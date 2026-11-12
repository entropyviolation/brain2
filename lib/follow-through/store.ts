/**
 * lib/follow-through/store.ts — The ledger of intentions, actions and feelings, kept across reloads
 *
 * One store for the four linked records. A reading is saved when a stream is read, as `proposed`:
 * it is what was said, not a change to any list. A link or a feeling becomes `confirmed` on the
 * card or by a one-tap answer, and only those are counted by the findings (`learn.ts`).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { merge, proposeLinks, type LinkChange } from "./link"
import type { Displacement, Reading } from "./read"
import { emptyLedger, type Action, type Feeling, type Ledger, type Scale, type Step, type Verdict } from "./types"

const MAX = { intentions: 2000, actions: 8000, feelings: 4000 }

interface FollowState extends Ledger {
  /** Add a reading and propose links. Returns what the linker changed. */
  take: (reading: Pick<Reading, "intentions" | "actions" | "feelings"> & { displacements?: Displacement[] }, now?: Date) => LinkChange[]
  setStep: (stepId: string, patch: Partial<Step>) => void
  setAction: (actionId: string, patch: Partial<Action>) => void
  setFeeling: (feelingId: string, patch: Partial<Feeling>) => void
  /** A one-tap answer: one scale on the feeling for a step or an action, created when there is none. */
  answer: (target: { stepId?: string; actionId?: string }, phase: "before" | "after", key: "excitement" | "resistance" | "satisfaction", value: Scale, now?: Date) => void
  confirmStep: (stepId: string, verdict: Verdict, displacedBy?: string) => void
}

const pick = (s: FollowState): Ledger => ({ intentions: s.intentions, actions: s.actions, feelings: s.feelings })

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      ...emptyLedger(),
      take: (reading, now = new Date()) => {
        const merged = merge(pick(get()), reading)
        const { ledger, changes } = proposeLinks(merged, now, reading.displacements ?? [])
        set({ intentions: ledger.intentions.slice(-MAX.intentions), actions: ledger.actions.slice(-MAX.actions), feelings: ledger.feelings.slice(-MAX.feelings) })
        return changes
      },
      setStep: (stepId, patch) => set((s) => ({ intentions: s.intentions.map((i) => (i.steps.some((x) => x.id === stepId) ? { ...i, steps: i.steps.map((x) => (x.id === stepId ? { ...x, ...patch } : x)) } : i)) })),
      setAction: (actionId, patch) => set((s) => ({ actions: s.actions.map((a) => (a.id === actionId ? { ...a, ...patch } : a)) })),
      setFeeling: (feelingId, patch) => set((s) => ({ feelings: s.feelings.map((f) => (f.id === feelingId ? { ...f, ...patch } : f)) })),
      answer: (target, phase, key, value, now = new Date()) =>
        set((s) => {
          const hit = s.feelings.find((f) => f.phase === phase && f.standing !== "rejected" && ((target.stepId && f.stepId === target.stepId) || (target.actionId && f.actionId === target.actionId && phase === "after")))
          if (hit) return { feelings: s.feelings.map((f) => (f === hit ? { ...f, [key]: value, standing: "confirmed" as const } : f)) }
          const at = now.toISOString()
          const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
          const feeling: Feeling = { id: `f${phase[0]}_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, at, day, phase, ...target, [key]: value, words: "", by: "asked", standing: "confirmed" }
          return { feelings: [...s.feelings, feeling] }
        }),
      confirmStep: (stepId, verdict, displacedBy) => get().setStep(stepId, { verdict, standing: "confirmed", ...(displacedBy ? { displacedBy } : {}) }),
    }),
    { name: persistKey("follow-through"), storage: createCogsJSONStorage(), partialize: (s) => pick(s as FollowState), version: 1 },
  ),
)

registerPersistRehydrator(persistKey("follow-through"), () => useFollowStore.persist.rehydrate())

export const followLedger = (): Ledger => pick(useFollowStore.getState())
