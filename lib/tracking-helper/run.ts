/**
 * lib/tracking-helper/run.ts — One message through the Helper's flow
 *
 * ROUTE (code) → TOKENIZE (code) → WIRE (one model call) → PLACE + WHERE (code, `assemble.ts`).
 * Routes: `log` adds blocks; `revise` re-reads the earlier account with this correction after it
 * (later lines win), so a fix needs no second schema; `question` is answered without a model, because
 * the Helper only files what happened. Every stage is timed into `trace` for the lab. Writes nothing.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { idsOf, pickSkills, renderSkills } from "@/lib/skills/bank"
import type { SkillBank } from "@/lib/skills/types"
import { assemble, type Assembled } from "./assemble"
import type { HelperFlow } from "./flow"
import { tokenize } from "./tokens"
import type { HelperContext, HelperRoute, TraceStage } from "./types"
import { wire } from "./wire"

export interface HelperRun extends Assembled {
  route: HelperRoute
  /** The text the stages read: for a revise, the earlier account plus the correction. */
  text: string
  marked: string
  trace: TraceStage[]
  model?: string
  /** Set when rules answered instead of a model, with why. */
  fallback?: string
  /** Ids of the learned skills that were in the WIRE prompt. */
  skillsUsed: string[]
}

export const QUESTION_REPLY = "I file what already happened. Tell me what you did and roughly when, like “Friday I walked Ocean Beach from 4:30 to 5, then did dishes until 6:19.”"

function safeRe(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i")
  } catch {
    return null
  }
}

/** Code-only route. `pending` is the account whose blocks are still on screen, if any. */
export function routeOf(text: string, flow: HelperFlow, pending: string | null): HelperRoute {
  const hasTime = tokenize(text).tokens.some((t) => t.kind !== "dur")
  if (pending && safeRe(flow.route.revise)?.test(text)) return "revise"
  if (!hasTime && safeRe(flow.route.question)?.test(text)) return "question"
  return "log"
}

export interface RunInput {
  text: string
  flow: HelperFlow
  ctx: HelperContext
  call: ModelCall | null
  /** The model ladder for the WIRE stage, smallest first. */
  ladder: string[]
  /** The account whose blocks are on screen, for `revise`. */
  pending?: string | null
  /** Learned skills. The ones that fit this text go into the WIRE prompt. Empty or absent leaves the prompt as it was. */
  bank?: SkillBank
}

export async function runHelper(input: RunInput): Promise<HelperRun> {
  const { flow, ctx } = input
  const trace: TraceStage[] = []
  const t0 = Date.now()
  const route = routeOf(input.text, flow, input.pending ?? null)
  trace.push({ stage: "route", ms: Date.now() - t0, note: route, output: route })
  const empty = { blocks: [], unplaced: [] }
  if (route === "question") return { route, text: input.text, marked: input.text, trace, skillsUsed: [], ...empty }

  const text = route === "revise" && input.pending ? `${input.pending.trim()}\nCorrection: ${input.text.trim()}` : input.text
  const t1 = Date.now()
  const { tokens, marked } = tokenize(text)
  trace.push({ stage: "tokenize", ms: Date.now() - t1, note: `${tokens.length} tags`, output: tokens })

  const picked = input.bank ? pickSkills(input.bank, text) : { general: [], task: [] }
  const skillText = renderSkills(picked)
  const t2 = Date.now()
  const wired = await wire(input.call, input.ladder, flow, marked, tokens, ctx, skillText).catch((err) => ({
    wiring: { segments: [] },
    hops: [],
    prompt: "",
    model: undefined,
    fallback: err instanceof Error ? err.message : "model failed",
  }))
  trace.push({ stage: "wire", ms: Date.now() - t2, note: `${wired.model ?? wired.fallback ?? "rules"}${idsOf(picked).length ? ` · ${idsOf(picked).length} skills` : ""}`, prompt: wired.prompt, output: wired.wiring, model: wired.model })

  const t3 = Date.now()
  const placeCtx = flow.place.learnPlaces ? ctx : { ...ctx, history: [] }
  const out = assemble(wired.wiring, tokens, text, placeCtx, flow.place.openMin)
  trace.push({ stage: "place", ms: Date.now() - t3, note: `${out.blocks.length} blocks`, output: out.blocks })
  return { route, text, marked, trace, ...out, model: wired.model, fallback: wired.fallback, skillsUsed: idsOf(picked) }
}
