/**
 * lib/ingest/bim-switchboard.ts — BIM chat's LLM mode: route a line, run a flow
 *
 * Off means BIM chat is the grammar ladder alone, exactly as before. On, a line
 * the ladder would file as a plain capture is routed first (`chat-router.ts`).
 * A question runs the Ask flow on the local models and is answered in chat,
 * writing nothing. Every other label, an unsure route, no reachable model, or a
 * failed run hands the line back to the executor unchanged. Desktop and iPhone
 * only: Telegram never comes through here. Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { routeChat, type ChatRoute } from "@/lib/bim-flow/chat-router"
import { crewModelPlan, type Crew } from "@/lib/bim-flow/crew"
import { FLOW_REV, flowDef, FLOWS, type FlowId } from "@/lib/bim-flow/flows"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { runFlow } from "@/lib/bim-flow/run-flow"
import { snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import type { Answer, Flow } from "@/lib/bim-flow/types"
import { useIngestStore } from "./ingest-store"
import { looksLikeVerb, parseMessage } from "./parse-message"
import type { IngestSource } from "./types"

const MODE_KEY = "bimchat-llm-mode"
const ROUTE_TIMEOUT_MS = 45_000
const ASK_TIMEOUT_MS = 120_000

type LlmModeState = { on: boolean; setOn: (on: boolean) => void }

/** The LLM mode switch, per device. On by default; off is the old chat. */
export const useBimLlmMode = create<LlmModeState>()(
  persist((set) => ({ on: true, setOn: (on) => set({ on }) }), {
    name: MODE_KEY,
    storage: createJSONStorage(() => localStorage),
  }),
)

/** True when the grammar ladder would only file this line as a capture: one line, no verb, nothing open. */
export function routable(text: string, chatPending: boolean, now = new Date()): boolean {
  const t = text.trim()
  if (!t || t.length > 400 || t.includes("\n") || chatPending) return false
  if (looksLikeVerb(t, now)) return false
  return parseMessage(t, now).kind === "capture"
}

/** The bench's saved copy when it is current, else the shipped graph. Read only. */
function savedFlow(id: FlowId): Flow {
  try {
    const rev = FLOW_REV[id]
    if (!rev || localStorage.getItem(`bimflow-graph-rev:${id}`) === rev) {
      const raw = localStorage.getItem(`bimflow-graph-v2:${id}`)
      const flow = raw ? (JSON.parse(raw) as Flow) : null
      if (flow?.version === 1 && Array.isArray(flow.nodes) && flow.nodes.length) return flow
    }
  } catch {
    /* unreadable saved copy: use the shipped graph */
  }
  return flowDef(id).build()
}

const short = (model: string) => model.replace(/-instruct$/, "").replace(/^qwen2\.5:/, "q2.5 ").replace(/^qwen3:/, "q3 ")

/** "ASK · code · q2.5 14b → q3 30b-a3b · 4.2s": the route, who decided it, the models asked, the time. */
export function routeChip(route: ChatRoute, ms: number, models: string[] = []): string {
  const label = route.second ? `${route.intent}+${route.second}` : route.intent
  const decided = route.answeredBy === "code" ? "code" : route.hops.map((h) => short(h.model)).join("→")
  const parts = [label.toUpperCase(), decided]
  if (!route.sure) parts.push("unsure")
  const ran = [...new Set(models)].map(short)
  if (ran.length) parts.push(ran.join(" · "))
  parts.push(`${(ms / 1000).toFixed(1)}s`)
  return parts.join(" · ")
}

export interface SwitchboardAnswer {
  text: string
  confidence: Answer["confidence"]
  evidence: string[]
}

export interface SwitchboardResult {
  route: string
  /** Set when the Ask lane answered. */
  answer?: SwitchboardAnswer
  /** True when the executor must still run the line (any lane but a lone ask). */
  passThrough: boolean
  /** The router's label and whether it was sure, so a caller can act on a sure `log`. */
  intent?: ChatRoute["intent"]
  sure?: boolean
}

async function askLane(text: string, crew: Crew, now: Date): Promise<{ answer: SwitchboardAnswer; models: string[] }> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), ASK_TIMEOUT_MS)
  try {
    const run = await runFlow(
      savedFlow("ask"),
      [{ id: `bim-chat-${now.getTime()}`, text, at: now.toISOString(), prior: [] }],
      ollamaCall(crew.main, abort.signal),
      snapshotFromStores(),
      {
        model: crew.main,
        models: crewModelPlan(crew),
        getFlow: (id) => (FLOWS.some((f) => f.id === id) ? flowDef(id as FlowId).build() : undefined),
      },
    )
    const steps = run.messages[0]?.steps ?? []
    const failed = steps.find((s) => s.error)
    const answers = run.messages[0]?.answers ?? []
    const final = answers[answers.length - 1]
    if (!final) throw new Error(failed?.error ?? "the Ask flow gave no answer")
    const used = new Set(final.used)
    const rows = final.evidence.filter((_, i) => used.has(i + 1))
    return {
      answer: {
        text: final.text,
        confidence: final.confidence,
        evidence: [...final.facts, ...rows.map((r) => `${r.when} · ${r.source} · ${r.text}`)].slice(0, 12),
      },
      models: [crew.main, ...steps.map((s) => s.model).filter((m): m is string => !!m)],
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Route one line and run the lane it needs. Null means LLM mode has nothing to
 * add (not routable, or no model reachable): the executor runs as before.
 */
export async function runSwitchboard(
  text: string,
  now: Date,
  source: IngestSource,
  lastBim?: string,
  opts: { force?: boolean } = {},
): Promise<SwitchboardResult | null> {
  const pending = !!useIngestStore.getState().getPending(source.channel, source.chatId)
  // `force` is for a line the ladder already gave up on (a clarify it could not finish): skip the capture-only test.
  const ok = opts.force ? !!text.trim() && text.length <= 400 && !text.includes("\n") : routable(text, pending, now)
  if (!ok) return null
  const crew = await chatCrew()
  if (!crew) return null
  const t0 = Date.now()
  // A busy daemon must not leave chat waiting: past this, the line goes to the executor as before.
  const route = await routeChat(text, ollamaCall(crew.main, AbortSignal.timeout(ROUTE_TIMEOUT_MS)), crew.route, lastBim)
  const wantsAsk = route.sure && (route.intent === "ask" || route.second === "ask")
  const passThrough = route.intent !== "ask" || !route.sure
  if (!wantsAsk) return { route: routeChip(route, Date.now() - t0), passThrough: true, intent: route.intent, sure: route.sure }
  try {
    const { answer, models } = await askLane(text, crew, now)
    return { route: routeChip(route, Date.now() - t0, models), answer, passThrough, intent: route.intent, sure: route.sure }
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    return { route: `${routeChip(route, Date.now() - t0)} · ask failed: ${why.slice(0, 60)}`, passThrough: true, intent: route.intent, sure: route.sure }
  }
}
