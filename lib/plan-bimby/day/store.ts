/**
 * lib/plan-bimby/day/store.ts — Day plans made in BIM chat, kept on this device
 *
 * A chat line points at a plan by id (`BimLine.dayId`). Edits on the card, chat tweaks, answers and the
 * model's notes all change the plan here, so the card updates without rewriting the transcript. Per device
 * in `localStorage` (`bimchat-days`), last 20. Same pattern as `lib/report-bimby/store.ts`.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { DayItem, DayPlan } from "./types"

const KEEP = 20
/** A plan stops taking chat lines this long after it was made. */
export const LIVE_FOR_MS = 16 * 60 * 60 * 1000

type State = {
  plans: Record<string, DayPlan>
  order: string[]
  put: (plan: DayPlan) => void
  patch: (planId: string, fn: (plan: DayPlan) => DayPlan) => void
  patchItem: (planId: string, itemId: string, patch: Partial<DayItem>) => void
}

export const useDayPlanStore = create<State>()(
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
      patch: (planId, fn) =>
        set((s) => {
          const plan = s.plans[planId]
          return plan ? { plans: { ...s.plans, [planId]: fn(plan) } } : s
        }),
      patchItem: (planId, itemId, patch) =>
        set((s) => {
          const plan = s.plans[planId]
          return plan ? { plans: { ...s.plans, [planId]: { ...plan, items: plan.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } } } : s
        }),
    }),
    {
      name: "bimchat-days",
      storage: createJSONStorage(() => localStorage),
      // A model run cut off by a reload never finished.
      partialize: (s) => ({ plans: Object.fromEntries(Object.entries(s.plans).map(([id, p]) => [id, { ...p, thinking: false }])), order: s.order }),
    },
  ),
)

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** The plan chat lines still belong to: the newest one made today (or in the last few hours) and not rejected. */
export function liveDayPlan(now = new Date()): DayPlan | null {
  const { plans, order } = useDayPlanStore.getState()
  for (const id of [...order].reverse()) {
    const plan = plans[id]
    if (!plan || plan.rejected) continue
    const at = new Date(plan.at)
    const age = now.getTime() - at.getTime()
    return age >= 0 && age < LIVE_FOR_MS && (sameDay(at, now) || age < 6 * 60 * 60 * 1000) ? plan : null
  }
  return null
}
