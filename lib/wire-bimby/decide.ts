/**
 * lib/wire-bimby/decide.ts — Accept, reject, or tweak a wiring plan
 *
 * Accept writes the step as its fields stand now (`apply.ts`). Reject writes nothing. Tweak
 * rebuilds the plan from the original sentence plus the new instruction, keeping the same card
 * and keeping any step already applied exactly as it was.
 */
"use client"

import { liveDeps, applyStep } from "./apply"
import { planWire, signature } from "./plan"
import { useWireStore } from "./store"

export function acceptStep(planId: string, stepId: string): void {
  const store = useWireStore.getState()
  const step = store.plans[planId]?.steps.find((s) => s.id === stepId)
  if (!step || step.status === "applied") return
  const done = applyStep(step)
  store.setStatus(planId, stepId, done.ok ? "applied" : "failed", done.message)
}

export function rejectStep(planId: string, stepId: string): void {
  const step = useWireStore.getState().plans[planId]?.steps.find((s) => s.id === stepId)
  if (step && step.status !== "applied") useWireStore.getState().setStatus(planId, stepId, "rejected")
}

export function reconsiderStep(planId: string, stepId: string): void {
  const step = useWireStore.getState().plans[planId]?.steps.find((s) => s.id === stepId)
  if (step && (step.status === "rejected" || step.status === "failed")) useWireStore.getState().setStatus(planId, stepId, "pending")
}

export function acceptAllSteps(planId: string): void {
  for (const s of useWireStore.getState().plans[planId]?.steps ?? []) if (s.status === "pending") acceptStep(planId, s.id)
}

export function rejectAllSteps(planId: string): void {
  for (const s of useWireStore.getState().plans[planId]?.steps ?? []) if (s.status === "pending") rejectStep(planId, s.id)
}

/** Ask for a change: "use the Wednesday habit instead", "also let me type it in". Returns false when nothing could be built. */
export function reviseWire(planId: string, instruction: string, now = new Date()): boolean {
  const store = useWireStore.getState()
  const old = store.plans[planId]
  const extra = instruction.trim()
  if (!old || !extra) return false
  const text = `${old.text}\n${extra}`
  const next = planWire(text, liveDeps(), now, old.id)
  if (!next.steps.length) return false
  const applied = new Map(old.steps.filter((s) => s.status === "applied").map((s) => [signature(s), s]))
  store.put({
    ...next,
    revisions: old.revisions + 1,
    steps: next.steps.map((s) => {
      const kept = applied.get(signature(s))
      return kept ? { ...s, status: "applied", result: kept.result } : s
    }),
  })
  return true
}
