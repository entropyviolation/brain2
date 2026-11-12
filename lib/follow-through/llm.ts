/**
 * lib/follow-through/llm.ts — A local model reads the plans and feelings; code checks every answer
 *
 * Code picks the few pieces that carry a plan, a feeling or a "didn't" (the rest of the stream is
 * not sent), and lists the day's actions and the steps still open. The model splits each plan into
 * steps with a hedge, marks pull, push, importance and satisfaction 0–4 (−1 = not stated), says
 * what a feeling is about, and pairs open steps with the actions that answered them. It pairs
 * only: code computes the delay and decides done or late. A step or an "about" whose words are not
 * in the piece is dropped (`read.ts`), and a pair that names no real step or action is dropped here.
 */
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { escalate } from "@/lib/bim-flow/crew"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import type { ModelHint } from "./read"

const TIMEOUT_MS = 180_000

export const FOLLOW_SYSTEM = `You read parts of one person's running log of their day. Some lines are plans, some are feelings. Do three things.

1. For each numbered LINE:
- steps: when the line is a plan or a thing to do, the ordered steps in it. "what" is the step in the person's own words, copied from the line, without "gonna", "maybe", "then". "hedge" is "must" (need to, have to), "will" (gonna, going to), or "maybe" (maybe, might, try to).
- excitement: 0-4, how much they want to do it. -1 when the line does not show it.
- resistance: 0-4, how much they push away from it. Pleading, repeating "I need to", capitals, "I guess" and "ugh" are resistance. -1 when not shown. Excitement and resistance are separate: both can be high.
- importance: 0-4, or -1.
- satisfaction: 0-4 for a feeling about something already done (0 awful, 2 fine, 4 great). -1 for a plan.
- about: for a feeling, the thing it is about, copied from the line ("I woke up early"). "" when it names nothing.

2. outcomes: pair an OPEN STEP with the ACTION that did it, by their numbers. verdict is "done" when the action is that step, "displaced" when the person says they did the action instead of the step. Only pair what the text supports. Leave a step out when nothing answers it.

Do not invent words. Output JSON only.

Example.
LINES:
1. Gonna eat the samosa, maybe watch a video and then work on the app.
2. CALL SHELBY I NEED TO I NEED TO
3. proud of myself because I woke up early
OPEN STEPS: (none)
ACTIONS:
1. 09:19 samosa
{"lines":[{"n":1,"steps":[{"what":"eat the samosa","hedge":"will"},{"what":"watch a video","hedge":"maybe"},{"what":"work on the app","hedge":"will"}],"excitement":-1,"resistance":-1,"importance":-1,"satisfaction":-1,"about":""},{"n":2,"steps":[{"what":"call Shelby","hedge":"must"}],"excitement":0,"resistance":3,"importance":4,"satisfaction":-1,"about":""},{"n":3,"steps":[],"excitement":-1,"resistance":-1,"importance":-1,"satisfaction":4,"about":"I woke up early"}],"outcomes":[]}`

const level = { type: "integer", minimum: -1, maximum: 4 }

export const FOLLOW_SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          steps: { type: "array", items: { type: "object", properties: { what: { type: "string" }, hedge: { type: "string", enum: ["must", "will", "maybe"] } }, required: ["what", "hedge"] } },
          excitement: level,
          resistance: level,
          importance: level,
          satisfaction: level,
          about: { type: "string" },
        },
        required: ["n"],
      },
    },
    outcomes: {
      type: "array",
      items: { type: "object", properties: { step: { type: "integer" }, action: { type: "integer" }, verdict: { type: "string", enum: ["done", "displaced"] } }, required: ["step", "action", "verdict"] },
    },
  },
  required: ["lines"],
}

export interface FollowAsk {
  /** The pieces sent, with their index in the stream. */
  lines: { index: number; text: string }[]
  /** Steps still open from earlier, by id. */
  openSteps: { id: string; what: string }[]
  /** The day's actions, by id. */
  actions: { id: string; label: string }[]
}

export interface Pairing {
  stepId: string
  actionId: string
  verdict: "done" | "displaced"
}

export interface FollowReading {
  /** Hints by stream piece index. */
  hints: Map<number, ModelHint>
  pairings: Pairing[]
  model: string
  trace: string[]
}

export function followPrompt(ask: FollowAsk): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x, i) => `${i + 1}. ${x}`).join("\n") : "(none)")
  return `LINES:\n${list(ask.lines.map((l) => l.text))}\nOPEN STEPS:\n${list(ask.openSteps.map((s) => s.what))}\nACTIONS:\n${list(ask.actions.map((a) => a.label))}`
}

/** Check the model's answer against what was asked. Pure. */
export function followFromModel(raw: unknown, ask: FollowAsk): { hints: Map<number, ModelHint>; pairings: Pairing[]; dropped: string[] } {
  const hints = new Map<number, ModelHint>()
  const pairings: Pairing[] = []
  const dropped: string[] = []
  const lines = (raw as { lines?: unknown })?.lines
  if (Array.isArray(lines)) {
    for (const item of lines as (ModelHint & { n?: unknown })[]) {
      const line = typeof item.n === "number" ? ask.lines[item.n - 1] : undefined
      if (!line) {
        dropped.push(`line ${String(item.n)} was not asked`)
        continue
      }
      // -1 means "not stated": it is left out so the rules' reading stands.
      const scale = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 4 ? Math.round(v) : undefined)
      hints.set(line.index, {
        ...(Array.isArray(item.steps) && item.steps.length ? { steps: item.steps } : {}),
        excitement: scale(item.excitement),
        resistance: scale(item.resistance),
        importance: scale(item.importance),
        satisfaction: scale(item.satisfaction),
        ...(typeof item.about === "string" && item.about.trim() ? { about: item.about } : {}),
      })
    }
  }
  const outcomes = (raw as { outcomes?: unknown })?.outcomes
  if (Array.isArray(outcomes)) {
    for (const o of outcomes as { step?: unknown; action?: unknown; verdict?: unknown }[]) {
      const step = typeof o.step === "number" ? ask.openSteps[o.step - 1] : undefined
      const action = typeof o.action === "number" ? ask.actions[o.action - 1] : undefined
      if (!step || !action || (o.verdict !== "done" && o.verdict !== "displaced")) {
        dropped.push(`pair ${String(o.step)}→${String(o.action)} names no real step or action`)
        continue
      }
      if (pairings.some((p) => p.stepId === step.id || (p.actionId === action.id && p.verdict === "done" && o.verdict === "done"))) continue
      pairings.push({ stepId: step.id, actionId: action.id, verdict: o.verdict })
    }
  }
  return { hints, pairings, dropped }
}

/** Ask the crew's extract ladder. Null when no model is reachable or it gave nothing usable. */
export async function readFollowWithModel(ask: FollowAsk): Promise<FollowReading | null> {
  if (!ask.lines.length && !(ask.openSteps.length && ask.actions.length)) return null
  const crew = await chatCrew()
  if (!crew) return null
  const call = ollamaCall(crew.main, AbortSignal.timeout(TIMEOUT_MS))
  const { out, hops } = await escalate<unknown>(call, crew.extract.length ? crew.extract : [crew.main], { system: FOLLOW_SYSTEM, user: followPrompt(ask), schema: FOLLOW_SCHEMA, maxTokens: 1200 }, (raw) => {
    const { hints, pairings } = followFromModel(raw, ask)
    return hints.size || pairings.length ? null : "nothing usable"
  })
  if (!out) return null
  const { hints, pairings, dropped } = followFromModel(out, ask)
  if (!hints.size && !pairings.length) return null
  const model = hops.at(-1)?.model ?? crew.main
  const trace = [`Model ${model} read ${hints.size} plan or feeling line${hints.size === 1 ? "" : "s"}${pairings.length ? ` and paired ${pairings.length} step${pairings.length === 1 ? "" : "s"} with an action` : ""}.`]
  if (dropped.length) trace.push(`Dropped from its answer: ${dropped.slice(0, 3).join("; ")}.`)
  return { hints, pairings, model, trace }
}
