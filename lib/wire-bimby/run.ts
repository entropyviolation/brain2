/**
 * lib/wire-bimby/run.ts — BIM chat's door to the Wire BIMBY
 *
 * `tryWire` is called by `sendToBim` after the report lane. A line that asks to change a habit's
 * detail view or to connect a module to a habit becomes a plan in `useWireStore` and a short
 * chat line pointing at it. It writes nothing: every step waits for Accept on the card.
 * Rules only. Null leaves the line to the rest of the chat.
 */
"use client"

import { liveDeps } from "./apply"
import { looksLikeWire, planWire } from "./plan"
import { useWireStore } from "./store"

export interface WireReply {
  text: string
  wireId: string
  route: string
}

export function tryWire(text: string, now: Date): WireReply | null {
  if (!looksLikeWire(text)) return null
  const started = Date.now()
  const plan = planWire(text, liveDeps(), now)
  if (!plan.steps.length) return null
  useWireStore.getState().put(plan)
  const n = plan.steps.length
  const what = plan.steps.every((s) => s.kind === "track") ? "in Tracking" : "on your habits"
  return {
    text: `I read that as ${n} step${n === 1 ? "" : "s"} ${what}. Each one is checked against your real data and a sample report. Nothing is saved until you accept; you can edit a field, reject a step, or tell me what to change.`,
    wireId: plan.id,
    route: `WIRE · rules · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
