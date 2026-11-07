/**
 * lib/report-bimby/decide.ts — Accept or reject effects on a plan
 *
 * Accept applies the effect with the fields as they are now (`apply.ts`) and records the outcome on
 * the plan. Reject writes nothing. Both are reversible in the card: a rejected effect can be
 * reconsidered, and an applied one is one undo step for BIM's `undo`.
 */
"use client"

import { applyEffect } from "./apply"
import { useReportStore } from "./store"

export function acceptEffect(planId: string, effectId: string): void {
  const store = useReportStore.getState()
  const effect = store.plans[planId]?.effects.find((e) => e.id === effectId)
  if (!effect || effect.status === "applied") return
  const done = applyEffect(effect)
  store.setStatus(planId, effectId, done.ok ? "applied" : "failed", done.message)
}

export function rejectEffect(planId: string, effectId: string): void {
  const effect = useReportStore.getState().plans[planId]?.effects.find((e) => e.id === effectId)
  if (effect && effect.status !== "applied") useReportStore.getState().setStatus(planId, effectId, "rejected")
}

export function reconsiderEffect(planId: string, effectId: string): void {
  const effect = useReportStore.getState().plans[planId]?.effects.find((e) => e.id === effectId)
  if (effect && (effect.status === "rejected" || effect.status === "failed")) useReportStore.getState().setStatus(planId, effectId, "pending")
}

/** Accept every effect still pending, in order (an Inventory count before the Intake line, blocks newest first). */
export function acceptAll(planId: string): void {
  for (const e of useReportStore.getState().plans[planId]?.effects ?? []) if (e.status === "pending") acceptEffect(planId, e.id)
}

export function rejectAll(planId: string): void {
  for (const e of useReportStore.getState().plans[planId]?.effects ?? []) if (e.status === "pending") rejectEffect(planId, e.id)
}
