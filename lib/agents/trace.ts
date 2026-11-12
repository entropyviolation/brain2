/**
 * lib/agents/trace.ts — One record of a run, whatever ran
 *
 * The common Trace of `docs/AGENT_LAB_PLAN.md` §3 (slice `PH-2`): who ran (a Blueprint id and rev), what came
 * in, every step in order, what it cost, why it stopped, and what came out. A BIM chat turn, a BIM flow run and
 * a Tracking BIMBY run all fit, so one replay and one eval can read them.
 *
 * Pure. `recorder` builds a Trace as a run goes; `trace-adapters.ts` builds one from a finished run of the two
 * older runtimes; `trace-store.ts` keeps them.
 */

export type TraceOrigin = "lab" | "app" | "test" | "eval"

/** The closed list of event kinds from the plan. A new kind is a plan change, not a string. */
export type TraceEventKind =
  | "sense"
  | "wake"
  | "memory-read"
  | "memory-write"
  | "prompt"
  | "model-reply"
  | "tool-call"
  | "tool-result"
  | "decision"
  | "branch"
  | "merge"
  | "propose"
  | "stall"
  | "halt"
  | "error"
  | "person-verdict"

/**
 * How one step ended. `ok` did its work. `pass` looked and left the input for the next step. `skip` never ran
 * (a guard kept it out; `note` names the guard). `error` threw.
 */
export type TraceStatus = "ok" | "pass" | "skip" | "error"

/** Why the run ended. Closed, so a scorecard can count them. */
export type StopReason = "done" | "gate-no" | "budget" | "needs-person" | "error" | "refused-tool"

export interface TraceEvent {
  id: string
  /** The event this one happened inside, so a lane's own steps (and another agent's run) nest. */
  parent?: string
  kind: TraceEventKind
  /** The stage, node or lane that did it. */
  actor: string
  /** The Blueprint the actor belongs to, when it is another agent's (`lib/agents/registry.ts`). */
  agent?: string
  /** Milliseconds from the run's start. */
  t0: number
  t1: number
  status: TraceStatus
  /** One short line: the guard that skipped it, the route chip, the error. */
  note?: string
  /** The model asked, when one was. */
  model?: string
  /** Prompt, output, rows. Cut to size by `clip`. */
  data?: unknown
}

export interface TraceCost {
  /** Model calls. */
  calls: number
  ms: number
  models: Record<string, { calls: number; ms: number }>
}

export interface TraceResult {
  /** What the person was told. */
  text?: string
  /** Proposals shown and not yet written. */
  proposals: number
  /** What was written, as short labels (an ingest kind, a block). Empty for a read-only run. */
  wrote: string[]
}

export interface Trace {
  run: {
    id: string
    blueprint: { id: string; rev: string }
    input: string
    origin: TraceOrigin
    /** ISO. */
    start: string
    end: string
  }
  events: TraceEvent[]
  cost: TraceCost
  stop: StopReason
  result: TraceResult
}

const CLIP = 2000

/** Keeps a prompt or an output small enough to store: long strings are cut, big objects become cut JSON. */
export function clip(value: unknown, cap = CLIP): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === "string") return value.length > cap ? `${value.slice(0, cap)} …(cut)` : value
  if (typeof value !== "object") return value
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    return "(not serializable)"
  }
  return json.length > cap ? `${json.slice(0, cap)} …(cut)` : value
}

let seq = 0
const newId = (prefix: string) => {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`
}

export type EventDraft = Omit<TraceEvent, "id" | "t0" | "t1"> & { t0?: number; t1?: number }

export interface TraceRecorder {
  readonly id: string
  /** Milliseconds since the run began, for an event's `t0`. */
  clock(): number
  /** Adds one event and returns its id, so later events can name it as `parent`. Times default to now. */
  add(event: EventDraft): string
  /** Closes the run. The recorder can be finished once; a second call returns the same Trace. */
  finish(stop: StopReason, result?: Partial<TraceResult>): Trace
}

/**
 * Starts a Trace. `now` is the wall clock, passed in so tests are exact. Model calls are counted from events
 * of kind `model-reply` that name a model.
 */
export function recorder(
  run: { blueprint: { id: string; rev: string }; input: string; origin: TraceOrigin },
  now: () => number = Date.now,
): TraceRecorder {
  const id = newId("tr")
  const began = now()
  const events: TraceEvent[] = []
  let done: Trace | null = null
  const clock = () => Math.max(0, now() - began)
  return {
    id,
    clock,
    add(event) {
      const at = clock()
      const t0 = event.t0 ?? at
      const full: TraceEvent = { ...event, id: `${id}.${events.length + 1}`, t0, t1: Math.max(t0, event.t1 ?? at) }
      if (full.data !== undefined) full.data = clip(full.data)
      if (!done) events.push(full)
      return full.id
    },
    finish(stop, result = {}) {
      if (done) return done
      done = {
        run: { id, blueprint: run.blueprint, input: String(clip(run.input)), origin: run.origin, start: new Date(began).toISOString(), end: new Date(now()).toISOString() },
        events,
        cost: costOf(events, clock()),
        stop,
        result: { proposals: 0, wrote: [], ...result, ...(result.text !== undefined ? { text: String(clip(result.text)) } : {}) },
      }
      return done
    },
  }
}

/** Calls and time per model, from the events. */
export function costOf(events: TraceEvent[], ms: number): TraceCost {
  const models: TraceCost["models"] = {}
  let calls = 0
  for (const e of events) {
    if (e.kind !== "model-reply" || !e.model) continue
    calls += 1
    const row = (models[e.model] ??= { calls: 0, ms: 0 })
    row.calls += 1
    row.ms += e.t1 - e.t0
  }
  return { calls, ms, models }
}

/** The actor that took the input: the last `ok` decision at the top level. Null when nothing did. */
export function takenBy(trace: Trace): string | null {
  for (let i = trace.events.length - 1; i >= 0; i -= 1) {
    const e = trace.events[i]!
    if (e.kind === "decision" && e.status === "ok" && !e.parent) return e.actor
  }
  return null
}

/** Plain problems with a Trace, empty when sound. Old kept traces are checked with this before a replay. */
export function validateTrace(t: Trace): string[] {
  const out: string[] = []
  if (!t.run?.id) out.push("run id is empty")
  if (!t.run?.blueprint?.id) out.push("blueprint id is empty")
  const ids = new Set<string>()
  for (const e of t.events ?? []) {
    if (ids.has(e.id)) out.push(`event "${e.id}" is listed twice`)
    if (e.parent && !ids.has(e.parent)) out.push(`event "${e.id}" names a parent that is not before it`)
    if (e.t1 < e.t0) out.push(`event "${e.id}" ends before it starts`)
    ids.add(e.id)
  }
  return out
}
