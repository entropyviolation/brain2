/**
 * lib/critic-bimby/gate.ts — Which models may be the critic, and the setting that turns the model layer on
 *
 * A model is allowed the role for a host only after it passes the bench (`bench.ts`) for that host. Dochkina's threshold
 * and Aratchige's "a good proposer can be a poor judge", applied: a small critic that misses faults or cries wolf is
 * switched off, not trusted. The dials are starting values (`docs/CRITIC_BIMBY_PLAN.md` §5.4), kept in one place.
 * Stored per device. Reads and writes never throw.
 */

import type { BenchReport } from "./bench"

/** Bump when a dial changes, so old passes are forgotten. */
export const GATE_REV = 1

export const DIALS = {
  /** Share of injected faults caught, over every fault kind. */
  catchAtLeast: 0.6,
  /** Share of clean gold plans the critic may raise anything on. */
  falseAlarmAtMost: 0.1,
  /** How far the model layer must beat the code layer on the faults only a model can see. */
  marginAtLeast: 0.15,
} as const

export const MODEL_ONLY_FAULTS = ["wrong-object"] as const

export interface GateResult {
  ready: boolean
  catchRate: number
  falseAlarmRate: number
  /** Combined catch rate minus code-only catch rate on the model-only faults. */
  margin: number
  why: string[]
}

const rate = (r: BenchReport["byFault"][string] | undefined) => (r && r.of ? r.caught / r.of : 0)

/** Judge a model's bench (code plus model) against the code layer's own bench. */
export function gateOf(code: BenchReport, combined: BenchReport): GateResult {
  const catchRate = combined.of ? combined.caught / combined.of : 0
  const falseAlarmRate = combined.falseAlarms.of ? combined.falseAlarms.raised / combined.falseAlarms.of : 1
  const only = (r: BenchReport) => {
    const rows = MODEL_ONLY_FAULTS.map((k) => r.byFault[k]).filter(Boolean)
    const of = rows.reduce((n, x) => n + x!.of, 0)
    return of ? rows.reduce((n, x) => n + x!.caught, 0) / of : 0
  }
  const margin = only(combined) - only(code)
  const why: string[] = []
  if (catchRate < DIALS.catchAtLeast) why.push(`caught ${Math.round(catchRate * 100)}% of faults, under ${DIALS.catchAtLeast * 100}%`)
  if (falseAlarmRate > DIALS.falseAlarmAtMost) why.push(`raised something on ${Math.round(falseAlarmRate * 100)}% of clean plans, over ${DIALS.falseAlarmAtMost * 100}%`)
  if (margin < DIALS.marginAtLeast) why.push(`beat the free checks by ${Math.round(margin * 100)} points on what only a model can see, under ${DIALS.marginAtLeast * 100}`)
  return { ready: !why.length, catchRate, falseAlarmRate, margin, why }
}

export { rate as faultRate }

const READY_KEY = "critic-ready-v1"
const ON_KEY = "critic-model-layer"

interface Stored {
  rev: number
  models: Record<string, GateResult & { at: string }>
}

function safe(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}

type Reader = Pick<Storage, "getItem">
type Writer = Pick<Storage, "getItem" | "setItem">

function load(storage: Reader | undefined): Stored {
  try {
    const v = JSON.parse(storage?.getItem(READY_KEY) ?? "null") as Stored | null
    if (v && v.rev === GATE_REV && v.models) return v
  } catch {
    // Fall through to empty.
  }
  return { rev: GATE_REV, models: {} }
}

export function recordGate(host: string, model: string, result: GateResult, storage: Writer | undefined = safe(), now = new Date()): void {
  try {
    const cur = load(storage)
    cur.models[`${host}:${model}`] = { ...result, at: now.toISOString() }
    storage?.setItem(READY_KEY, JSON.stringify(cur))
  } catch {
    // Nothing kept; the model simply is not ready.
  }
}

export function isReady(host: string, model: string, storage: Reader | undefined = safe()): boolean {
  return load(storage).models[`${host}:${model}`]?.ready === true
}

export function gateFor(host: string, model: string, storage: Reader | undefined = safe()): (GateResult & { at: string }) | null {
  return load(storage).models[`${host}:${model}`] ?? null
}

/** The "Second look" setting: is the model layer on? Off until the person turns it on. */
export function modelLayerOn(storage: Reader | undefined = safe()): boolean {
  try {
    return storage?.getItem(ON_KEY) === "1"
  } catch {
    return false
  }
}

export function setModelLayer(on: boolean, storage: Pick<Storage, "setItem"> | undefined = safe()): void {
  try {
    storage?.setItem(ON_KEY, on ? "1" : "0")
  } catch {
    // Not remembered.
  }
}
