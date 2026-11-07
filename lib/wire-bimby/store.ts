/**
 * lib/wire-bimby/store.ts — Wiring plans BIM has proposed, kept on this device
 *
 * A chat line points at a plan by id (`BimLine.wireId`). Fields, statuses, and rebuilds update the
 * plan here so the card changes without rewriting the transcript. Per device in `localStorage`
 * (`bimchat-wires`), last 30. Same pattern as `lib/report-bimby/store.ts`.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { WirePlan, WireStatus } from "./types"

const KEEP = 30

type State = {
  plans: Record<string, WirePlan>
  order: string[]
  put: (plan: WirePlan) => void
  setField: (planId: string, stepId: string, key: string, value: string) => void
  setStatus: (planId: string, stepId: string, status: WireStatus, result?: string) => void
}

const mapStep = (plan: WirePlan, stepId: string, fn: (s: WirePlan["steps"][number]) => WirePlan["steps"][number]): WirePlan => ({
  ...plan,
  steps: plan.steps.map((s) => (s.id === stepId ? fn(s) : s)),
})

export const useWireStore = create<State>()(
  persist(
    (set) => ({
      plans: {},
      order: [],
      put: (plan) =>
        set((s) => {
          const order = [...s.order.filter((id) => id !== plan.id), plan.id]
          const plans = { ...s.plans, [plan.id]: plan }
          for (const id of order.splice(0, Math.max(0, order.length - KEEP))) delete plans[id]
          return { plans, order }
        }),
      setField: (planId, stepId, key, value) =>
        set((s) => {
          const plan = s.plans[planId]
          if (!plan) return s
          return { plans: { ...s.plans, [planId]: mapStep(plan, stepId, (st) => ({ ...st, fields: st.fields.map((f) => (f.key === key ? { ...f, value } : f)) })) } }
        }),
      setStatus: (planId, stepId, status, result) =>
        set((s) => {
          const plan = s.plans[planId]
          if (!plan) return s
          return { plans: { ...s.plans, [planId]: mapStep(plan, stepId, (st) => ({ ...st, status, result })) } }
        }),
    }),
    { name: "bimchat-wires", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ plans: s.plans, order: s.order }) },
  ),
)
