/**
 * lib/report-bimby/store.ts — The plans BIM has proposed from reports, kept on this device
 *
 * A chat line points at a plan by id (`BimLine.reportId`). The plan lives here so a field edit or an
 * accept updates the card without rewriting the transcript. Per device in `localStorage`
 * (`bimchat-reports`, no `brain2-` prefix), like the transcript itself. Oldest plans drop past `KEEP`.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { EffectStatus, ReportPlan } from "./types"

const KEEP = 40

type State = {
  plans: Record<string, ReportPlan>
  order: string[]
  put: (plan: ReportPlan) => void
  setField: (planId: string, effectId: string, key: string, value: string) => void
  setStatus: (planId: string, effectId: string, status: EffectStatus, result?: string) => void
}

const mapEffect = (plan: ReportPlan, effectId: string, fn: (e: ReportPlan["effects"][number]) => ReportPlan["effects"][number]): ReportPlan => ({
  ...plan,
  effects: plan.effects.map((e) => (e.id === effectId ? fn(e) : e)),
})

export const useReportStore = create<State>()(
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
      setField: (planId, effectId, key, value) =>
        set((s) => {
          const plan = s.plans[planId]
          if (!plan) return s
          return {
            plans: { ...s.plans, [planId]: mapEffect(plan, effectId, (e) => ({ ...e, fields: e.fields.map((f) => (f.key === key ? { ...f, value } : f)) })) },
          }
        }),
      setStatus: (planId, effectId, status, result) =>
        set((s) => {
          const plan = s.plans[planId]
          if (!plan) return s
          return { plans: { ...s.plans, [planId]: mapEffect(plan, effectId, (e) => ({ ...e, status, result })) } }
        }),
    }),
    { name: "bimchat-reports", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ plans: s.plans, order: s.order }) },
  ),
)
