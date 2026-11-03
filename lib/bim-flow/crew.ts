/**
 * lib/bim-flow/crew.ts — Which local model does which job
 *
 * A role is a kind of step, not a model. Each role has a short ladder, smallest
 * first. A step runs on the first installed rung and moves up only when the
 * answer is unsure, off its options, or fails its schema (`escalate`). Code
 * still does the counting; the models only route, pick, pull, and phrase.
 * Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §4.
 */

import type { ModelCall } from "./ollama"
import type { ModelPlan } from "./types"

export type CrewRole = "route" | "gate" | "pick" | "extract" | "prose" | "check"

/** Smallest first. Only installed names are used; a role with none falls back to the main model. */
export const CREW_LADDERS: Record<CrewRole, string[]> = {
  route: ["qwen2.5:3b-instruct", "qwen2.5:14b-instruct"],
  gate: ["qwen2.5:3b-instruct", "qwen2.5:14b-instruct"],
  pick: ["qwen2.5:14b-instruct", "qwen3:30b-a3b"],
  extract: ["qwen2.5:14b-instruct", "qwen3:30b-a3b"],
  prose: ["qwen3:30b-a3b", "qwen2.5:14b-instruct"],
  check: ["qwen2.5:14b-instruct", "qwen3:30b-a3b"],
}

export type Crew = Record<CrewRole, string[]> & { main: string }

/** The ladders cut to what is installed. `main` runs any step no role covers. */
export function crewFor(installed: string[], main?: string): Crew | null {
  if (!installed.length) return null
  const has = new Set(installed)
  const cut = (role: CrewRole) => CREW_LADDERS[role].filter((m) => has.has(m))
  const extract = cut("extract")
  const crew = {
    route: cut("route"),
    gate: cut("gate"),
    pick: cut("pick"),
    extract,
    prose: cut("prose"),
    check: cut("check"),
    main: main && has.has(main) ? main : extract[0] ?? installed[0]!,
  }
  return crew
}

/** The flow engine's two tiers, from the crew. Extract and the rest stay on `main`. */
export function crewModelPlan(crew: Crew): ModelPlan {
  return { gates: crew.gate[0], prose: crew.prose[0] }
}

export interface Hop {
  model: string
  ms: number
  /** Why the next rung was asked, when it was. */
  why?: string
}

/**
 * Ask each rung in turn until `accept` says the answer is good. `accept`
 * returns null to keep the answer, or a short reason to climb. A throw (bad
 * JSON, daemon error) climbs too. The last rung's answer is kept either way.
 */
export async function escalate<T>(
  call: ModelCall,
  ladder: string[],
  req: Omit<Parameters<ModelCall>[0], "model">,
  accept: (out: T) => string | null,
): Promise<{ out: T | null; hops: Hop[] }> {
  const hops: Hop[] = []
  let last: T | null = null
  for (const [i, model] of ladder.entries()) {
    const t0 = Date.now()
    try {
      const out = (await call({ ...req, model })) as T
      last = out
      const why = i < ladder.length - 1 ? accept(out) : null
      hops.push({ model, ms: Date.now() - t0, ...(why ? { why } : {}) })
      if (!why) return { out, hops }
    } catch (error) {
      hops.push({ model, ms: Date.now() - t0, why: error instanceof Error ? error.message : String(error) })
    }
  }
  return { out: last, hops }
}
