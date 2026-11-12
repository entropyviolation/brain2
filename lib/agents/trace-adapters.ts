/**
 * lib/agents/trace-adapters.ts — The two older runtimes, read as a Trace
 *
 * A BIM flow run (`lib/bim-flow/types.ts` `FlowRun`) and a Tracking BIMBY run (`lib/tracking-helper/run.ts`
 * `HelperRun`) keep their own shapes; nothing in either runtime changes. These read a finished run and return
 * the common Trace (`trace.ts`), so both open in one replay. Pure.
 */

import type { Flow, FlowRun, TraceStep } from "@/lib/bim-flow/types"
import type { HelperRun } from "@/lib/tracking-helper/run"
import type { TraceStage } from "@/lib/tracking-helper/types"
import { NODE_TAG } from "./blueprint"
import { clip, costOf, type StopReason, type Trace, type TraceEvent, type TraceEventKind, type TraceOrigin } from "./trace"

/** The Tracking BIMBY's Blueprint id (`adapters/tracking-helper.ts`). */
const TRACKING_HELPER_ID = "tracking-helper"

let seq = 0
const runId = (prefix: string, at: string) => {
  seq += 1
  return `${prefix}-${Date.parse(at).toString(36)}-${seq.toString(36)}`
}

const ROLE_KIND: Record<string, TraceEventKind> = {
  sense: "sense",
  attend: "decision",
  remember: "memory-read",
  reason: "tool-result",
  act: "propose",
  check: "decision",
  halt: "halt",
}

/** What a flow step is in the Trace: a step that asked a model is a `model-reply`, the rest follow the node's role. */
function stepKind(flow: Flow, step: TraceStep): TraceEventKind {
  if (step.error) return "error"
  if (step.prompt) return "model-reply"
  const node = flow.nodes.find((n) => n.id === step.nodeId)
  return node ? ROLE_KIND[NODE_TAG[node.kind].role] ?? "tool-result" : "tool-result"
}

/**
 * One Trace for a whole flow run. Each message is a `sense` event; its steps nest under it in order, timed
 * end to end from their own `ms` (the runner keeps durations, not clocks).
 */
export function traceOfFlowRun(flow: Flow, run: FlowRun, opts: { flowId: string; origin: TraceOrigin; rev?: string; input?: string }): Trace {
  const id = runId("tr-flow", run.startedAt)
  const events: TraceEvent[] = []
  let t = 0
  let proposals = 0
  let failed = false
  let halted = false
  run.messages.forEach((m) => {
    const parent = `${id}.${events.length + 1}`
    const span = m.steps.reduce((sum, s) => sum + s.ms, 0)
    events.push({ id: parent, kind: "sense", actor: "message", t0: t, t1: t + span, status: "ok", data: clip(m.message.text) })
    for (const s of m.steps) {
      const kind = stepKind(flow, s)
      if (kind === "error") failed = true
      if (kind === "halt") halted = true
      const model = s.prompt ? s.model ?? run.model : undefined
      events.push({
        id: `${id}.${events.length + 1}`,
        parent,
        kind,
        actor: s.nodeId,
        t0: t,
        t1: t + s.ms,
        status: s.error ? "error" : "ok",
        note: s.error ?? (s.ports?.length ? s.ports.join(", ") : s.port),
        ...(model ? { model } : {}),
        data: clip(s.prompt ? { prompt: s.prompt, output: s.output } : s.output),
      })
      t += s.ms
    }
    proposals += m.proposals.length
  })
  const stop: StopReason = failed ? "error" : halted ? "gate-no" : "done"
  const answer = run.messages.flatMap((m) => m.answers).at(-1)?.text
  return {
    run: {
      id,
      blueprint: { id: `bim-flow:${opts.flowId}`, rev: opts.rev ?? "shipped" },
      input: String(clip(opts.input ?? run.messages.map((m) => m.message.text).join("\n"))),
      origin: opts.origin,
      start: run.startedAt,
      end: new Date(Date.parse(run.startedAt) + run.ms).toISOString(),
    },
    events,
    cost: costOf(events, run.ms),
    stop,
    result: { ...(answer ? { text: String(clip(answer)) } : {}), proposals: proposals + run.blocks.length, wrote: [] },
  }
}

const STAGE_KIND: Record<TraceStage["stage"], TraceEventKind> = {
  route: "decision",
  tokenize: "sense",
  wire: "model-reply",
  place: "tool-result",
  where: "memory-read",
}

/**
 * One Trace for a Tracking BIMBY run. A WIRE stage that fell back to rules asked no model, so it is a
 * `tool-result`. A question (the BIMBY files what happened; it does not answer) stops as `gate-no`.
 */
export function traceOfHelperRun(run: HelperRun, opts: { origin: TraceOrigin; input: string; startedAt: string; rev?: string }): Trace {
  const id = runId("tr-helper", opts.startedAt)
  const events: TraceEvent[] = []
  let t = 0
  for (const s of run.trace) {
    const asked = s.stage === "wire" && !!s.model
    events.push({
      id: `${id}.${events.length + 1}`,
      kind: s.stage === "wire" && !asked ? "tool-result" : STAGE_KIND[s.stage],
      actor: s.stage,
      t0: t,
      t1: t + s.ms,
      status: "ok",
      note: s.note,
      ...(asked ? { model: s.model } : {}),
      data: clip(s.prompt ? { prompt: s.prompt, output: s.output } : s.output),
    })
    t += s.ms
  }
  if (run.blocks.length) {
    events.push({ id: `${id}.${events.length + 1}`, kind: "propose", actor: "blocks", t0: t, t1: t, status: "ok", note: `${run.blocks.length} block${run.blocks.length === 1 ? "" : "s"}` })
  }
  const stop: StopReason = run.route === "question" ? "gate-no" : run.unplaced.length && !run.blocks.length ? "needs-person" : "done"
  return {
    run: {
      id,
      blueprint: { id: TRACKING_HELPER_ID, rev: opts.rev ?? "shipped" },
      input: String(clip(opts.input)),
      origin: opts.origin,
      start: opts.startedAt,
      end: new Date(Date.parse(opts.startedAt) + t).toISOString(),
    },
    events,
    cost: costOf(events, t),
    stop,
    result: { proposals: run.blocks.length, wrote: [] },
  }
}
