/**
 * lib/report-bimby/decide.ts — Accept or reject effects on a plan
 *
 * Accept applies the effect with the fields as they are now (`apply.ts`) and records the outcome on
 * the plan. Reject writes nothing. Both are reversible in the card: a rejected effect can be
 * reconsidered, and an applied one is one undo step for BIM's `undo`. The Neutral accept (`grade` "ok",
 * `lib/accept-grade.ts`) applies the same way and marks the effect, so nothing learns from it as right.
 */
"use client"

import type { AcceptGrade } from "@/lib/accept-grade"
import { applyEffectPaced } from "./apply"
import { useReportStore } from "./store"
import { rejectFollowEffect } from "@/lib/follow-through/run"

/** Let the browser paint (the "saving" bar) before the heavy write starts. */
const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    const go = () => setTimeout(resolve, 20)
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(go)
    else go()
  })

/** One save at a time: two writes touching the same stores would only fight, and a queue keeps the screen answering between them. */
let queue: Promise<void> = Promise.resolve()
/** Saves in flight. The queue lives here, not in a card, so leaving the screen never cancels a save. */
let inFlight = 0
const warnOnClose = (e: BeforeUnloadEvent) => {
  e.preventDefault()
  e.returnValue = ""
}

/**
 * Accept one effect. It shows "saving" at once, paints, then writes; the write is queued behind any
 * other save. A save over 1 s says how long it took, so a slow writer is named instead of felt.
 */
export function acceptEffect(planId: string, effectId: string, grade: AcceptGrade = "good"): Promise<void> {
  const store = useReportStore.getState()
  const effect = store.plans[planId]?.effects.find((e) => e.id === effectId)
  if (!effect || effect.status === "applied" || effect.status === "working") return Promise.resolve()
  store.setStatus(planId, effectId, "working")
  if (inFlight++ === 0 && typeof window !== "undefined") window.addEventListener("beforeunload", warnOnClose)
  const run = async () => {
    try {
      await save()
    } finally {
      if (--inFlight === 0 && typeof window !== "undefined") window.removeEventListener("beforeunload", warnOnClose)
    }
  }
  const save = async () => {
    await nextPaint()
    const started = performance.now()
    // Fields as they are now: an edit made while this waited in the queue is honored.
    const current = useReportStore.getState().plans[planId]?.effects.find((e) => e.id === effectId) ?? effect
    const done = await applyEffectPaced(current, nextPaint)
    const ms = performance.now() - started
    if (ms > 1000) console.warn(`[report-bimby] ${current.kind} took ${(ms / 1000).toFixed(1)}s`)
    const slow = ms > 1000 ? ` (took ${(ms / 1000).toFixed(1)} s)` : ""
    useReportStore.getState().setStatus(planId, effectId, done.ok ? "applied" : "failed", `${done.message}${slow}`, done.ok ? grade : undefined)
    await nextPaint()
  }
  queue = queue.then(run, run)
  return queue
}

export function rejectEffect(planId: string, effectId: string): void {
  const effect = useReportStore.getState().plans[planId]?.effects.find((e) => e.id === effectId)
  if (!effect || effect.status === "applied") return
  // A rejected link is undone in the ledger and never proposed again.
  if (effect.kind === "verdict" || effect.kind === "feeling") rejectFollowEffect(effect)
  useReportStore.getState().setStatus(planId, effectId, "rejected")
}

export function reconsiderEffect(planId: string, effectId: string): void {
  const effect = useReportStore.getState().plans[planId]?.effects.find((e) => e.id === effectId)
  if (effect && (effect.status === "rejected" || effect.status === "failed")) useReportStore.getState().setStatus(planId, effectId, "pending")
}

/** Accept every effect still pending, in order (an Inventory count before the Intake line, blocks newest first). */
export function acceptAll(planId: string, grade: AcceptGrade = "good"): Promise<void> {
  const pending = (useReportStore.getState().plans[planId]?.effects ?? []).filter((e) => e.status === "pending")
  // Every row shows "saving" now; the queue writes them one by one in this order.
  return Promise.all(pending.map((e) => acceptEffect(planId, e.id, grade))).then(() => undefined)
}

export function rejectAll(planId: string): void {
  for (const e of useReportStore.getState().plans[planId]?.effects ?? []) if (e.status === "pending") rejectEffect(planId, e.id)
}
