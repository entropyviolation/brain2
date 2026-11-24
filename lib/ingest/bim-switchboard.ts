/**
 * lib/ingest/bim-switchboard.ts — BIM chat's LLM mode: route a line, run a flow
 *
 * Off means BIM chat is the grammar ladder alone, exactly as before. On, a line
 * the ladder would file as a plain capture is routed first (`chat-router.ts`).
 * A question runs the Ask flow on the local models and is answered in chat,
 * writing nothing. A sure `chat` line, or a question about nothing in the vault,
 * gets a reply from the chat lane (`chat-lane.ts`) and is not filed either.
 * Every other label, an unsure route, no reachable model, or a failed run hands
 * the line back to the executor unchanged. Desktop and iPhone
 * and, since 2026-11-21, Telegram through the hub after the executor has replied (`telegram-llm.ts`).
 * Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { groundLine, looksGeneral, runChatLane, type ChatLaneReply, type ChatTurn } from "@/lib/bim-flow/chat-lane"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { routeChat, type ChatRoute } from "@/lib/bim-flow/chat-router"
import { crewModelPlan, type Crew } from "@/lib/bim-flow/crew"
import { taughtExamples, taughtRoute } from "@/lib/bim-flow/route-verdicts"
import { FLOW_REV, flowDef, FLOWS, type FlowId } from "@/lib/bim-flow/flows"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { phoneSearch, useHomeStore } from "@/lib/bim-flow/web-ask"
import { aboutBlock } from "@/lib/coach-bimby/context"
import { runFlow } from "@/lib/bim-flow/run-flow"
import { traceOfFlowRun } from "@/lib/agents/trace-adapters"
import { saveTrace } from "@/lib/agents/trace-store"
import type { TraceRecorder } from "@/lib/agents/trace"
import { snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { secretsAskedFor } from "@/lib/secrets-store"
import { retrieve } from "@/lib/bim-flow/retrieve"
import { contentWords, type VaultSnapshot } from "@/lib/bim-flow/vault-search"
import type { Answer, Evidence, Flow } from "@/lib/bim-flow/types"
import { useIngestStore } from "./ingest-store"
import { parseLinkMessage } from "@/lib/saved-links"
import { looksLikeVerb, parseMessage } from "./parse-message"
import type { IngestSource } from "./types"

const MODE_KEY = "bimchat-llm-mode"
const ROUTE_TIMEOUT_MS = 60_000
/**
 * The Ask flow's whole budget, a retry included. Past it, BIM says what code found (fix 8, `docs/BIM_CHAT_USAGE.md` §7)
 * and offers Retry. 45 s, up from 30 s on 2026-11-24: an unqueued run takes 20 to 24 s (plan, route, answer, check on
 * the 14B). 90 s later that day: a background call that was already mid-prompt when chat cut it can still hold the
 * 14B for tens of seconds, and a slow true answer beats a fast "did not finish".
 */
export const ASK_TIMEOUT_MS = 90_000
const CHAT_TIMEOUT_MS = 90_000

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
  // A line that starts with a link is a saved link (`apply-link.ts`). The router once sent 42 of 72 bare reels to
  // the chat lane, which replied and saved nothing (`docs/BIM_CHAT_USAGE.md` §9).
  if (parseLinkMessage(t)) return false
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
export function routeChip(route: ChatRoute, ms: number, models: string[] = [], lane: { label?: string; notes?: string[] } = {}): string {
  const label = lane.label ?? (route.second ? `${route.intent}+${route.second}` : route.intent)
  const decided = route.answeredBy === "code" ? "code" : route.hops.map((h) => short(h.model)).join("→")
  const parts = [label.toUpperCase(), decided]
  if (!route.sure) parts.push("unsure")
  parts.push(...(lane.notes ?? []))
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
  /** Set when the chat lane replied: talk, with rows behind it or plainly general. Nothing was filed. */
  chat?: Pick<ChatLaneReply, "text" | "general" | "evidence" | "web">
  /** Set when the Ask lane ran and failed (a model error, a timeout): why, short. */
  failed?: string
  /** True when the executor must still run the line (any lane but a lone ask). */
  passThrough: boolean
  /** The router's label and whether it was sure, so a caller can act on a sure `log`. */
  intent?: ChatRoute["intent"]
  sure?: boolean
}

/** A model reply that was empty or not JSON: worth one more try. A timeout or a refused connection is not. */
export function retryable(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === "AbortError" || /abort/i.test(error.message)) return false
  return /json|empty|unexpected (?:end|token)|gave no answer/i.test(error.message)
}

/**
 * The Ask flow failed or ran out of time, but code can still look: the rows that mention the question's words,
 * said plainly as "what I found" with the reason the model did not finish. Null when code found nothing either.
 */
export function foundAnswer(why: string, ev: Evidence | null): SwitchboardAnswer | null {
  if (!ev?.rows.length && !ev?.facts.length) return null
  const rows = ev.rows.map((r) => `${r.when} · ${r.source} · ${r.text}`)
  const shown = [...ev.facts, ...rows].slice(0, 3)
  return {
    text: `The model did not finish (${why}). What your data has on it:\n${shown.map((l) => `• ${l}`).join("\n")}`,
    confidence: "medium",
    evidence: [...ev.facts, ...rows].slice(0, 12),
  }
}

/** Code's own look, with no model: the last 90 days of text rows that name the question's words. */
async function codeLook(text: string, snap: VaultSnapshot, now: Date): Promise<Evidence | null> {
  const terms = contentWords(text)
  if (!terms.length) return null
  try {
    return await retrieve(snap, { kind: "text", days: 90, limit: 8 }, { terms, now })
  } catch {
    return null
  }
}

/**
 * Secrets for one line: a line that EXPLICITLY said "secrets included" (`secretsAskedFor`) gets a snapshot and model
 * calls that keep `\secret` spans and secret items. Every other line gets neither (`docs/SECRETS.md`).
 */
interface Secrets {
  call: { secrets?: "included" }
  snap: () => ReturnType<typeof snapshotFromStores>
}
function secretsFor(text: string): Secrets {
  const on = secretsAskedFor(text)
  return { call: on ? { secrets: "included" } : {}, snap: () => (on ? snapshotFromStores(true) : snapshotFromStores()) }
}

async function askOnce(text: string, crew: Crew, now: Date, signal: AbortSignal, secrets: Secrets): Promise<{ answer: SwitchboardAnswer; models: string[] }> {
  const flow = savedFlow("ask")
  const run = await runFlow(
    flow,
    [{ id: `bim-chat-${now.getTime()}`, text, at: now.toISOString(), prior: [] }],
    ollamaCall(crew.main, signal, secrets.call),
    secrets.snap(),
    {
      model: crew.main,
      // Chat keeps the answer on `main` (the 14B) beside the 3B gates: both stay loaded on a 32 GB Mac.
      // The 30B prose model would push the 14B out and reload on every question (2+ minutes).
      models: { ...crewModelPlan(crew), prose: crew.main },
      getFlow: (id) => (FLOWS.some((f) => f.id === id) ? flowDef(id as FlowId).build() : undefined),
    },
  )
  // The Ask flow's own Trace. It is not yet nested under the chat turn's Trace; both carry the same input.
  try {
    saveTrace(traceOfFlowRun(flow, run, { flowId: "ask", origin: "app", input: text }))
  } catch {}
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
}

/** The Ask flow inside one budget (`ASK_TIMEOUT_MS`), tried a second time when the model's reply was empty or not JSON. */
async function askLane(text: string, crew: Crew, now: Date, secrets: Secrets): Promise<{ answer: SwitchboardAnswer; models: string[]; tries: number }> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), ASK_TIMEOUT_MS)
  try {
    try {
      return { ...(await askOnce(text, crew, now, abort.signal, secrets)), tries: 1 }
    } catch (error) {
      if (!retryable(error) || abort.signal.aborted) throw error
      return { ...(await askOnce(text, crew, now, abort.signal, secrets)), tries: 2 }
    }
  } finally {
    clearTimeout(timer)
  }
}

/** "CHAT · q2.5 3b · general · q2.5 14b · 3.1s · 1 call": what was looked up, or that nothing stands behind the reply. */
function chatChip(route: ChatRoute, ms: number, reply: ChatLaneReply): string {
  const looked = reply.hops.map((h) => `${h.tool}${h.found ? "" : " ∅"}`)
  const notes = [...looked, ...(reply.general ? ["general"] : [])]
  return `${routeChip(route, ms, reply.models, { label: reply.web ? "web" : "chat", notes })} · ${reply.calls} call${reply.calls === 1 ? "" : "s"}`
}

async function chatLane(text: string, crew: Crew, now: Date, turns: ChatTurn[] | undefined, snap: ReturnType<typeof snapshotFromStores>, secrets: Secrets): Promise<ChatLaneReply> {
  // The web is a tool the pick model may choose for a question with no code cue ("who won the game last night?").
  // The search is the Web BIMBY's, and so is home (`web-ask.ts`); only the query leaves the Mac.
  const home = useHomeStore.getState().home
  const web = { search: async (q: string) => (await phoneSearch())(q), ...(home ? { home } : {}) }
  // What BIM knows about you (Coach BIMBY), so the reply can speak to who you are and what you are working toward.
  let about = ""
  try {
    about = aboutBlock(now)
  } catch {
    /* a store not loaded here: talk without it */
  }
  return runChatLane({ text, turns, now, snap, call: ollamaCall(crew.main, AbortSignal.timeout(CHAT_TIMEOUT_MS), secrets.call), pick: crew.pick, main: crew.main, web, ...(about ? { about } : {}) })
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
  opts: { force?: boolean; turns?: ChatTurn[]; stage?: (name: string) => void; rec?: TraceRecorder } = {},
): Promise<SwitchboardResult | null> {
  // Each stage is named for the turn's Trace (a model call says which stage asked) and timed as an event of its own.
  const stage = opts.stage ?? (() => {})
  const timed = async <T,>(name: string, run: () => Promise<T>): Promise<T> => {
    const t0 = opts.rec?.clock()
    stage(name)
    try {
      return await run()
    } finally {
      opts.rec?.add({ kind: "tool-call", actor: `switchboard:${name}`, status: "ok", t0 })
    }
  }
  const pending = !!useIngestStore.getState().getPending(source.channel, source.chatId)
  // `force` is for a line the ladder already gave up on (a clarify it could not finish): skip the capture-only test.
  const ok = opts.force ? !!text.trim() && text.length <= 400 && !text.includes("\n") : routable(text, pending, now)
  if (!ok) return null
  const crew = await timed("crew", () => chatCrew())
  if (!crew) return null
  const secrets = secretsFor(text)
  const t0 = Date.now()
  // A busy daemon must not leave chat waiting: past this, the line goes to the executor as before.
  // Words the person already corrected go straight to the lane they named (`route-verdicts.ts`); no model is asked.
  const taught = taughtRoute(text)
  const route: ChatRoute = taught
    ? { intent: taught, sure: true, answeredBy: "code", why: "you corrected this line before", hops: [] }
    : await timed("router", () => routeChat(text, ollamaCall(crew.main, AbortSignal.timeout(ROUTE_TIMEOUT_MS)), crew.route, lastBim, taughtExamples()))
  // The chat lane: a sure, lone `chat` line, or a question the code rules called `ask` that names nothing in the vault
  // ("what temp for garlic confit?"), which the Ask flow could only answer with "I don't know".
  const loneChat = route.sure && route.intent === "chat" && !route.second
  let snap: ReturnType<typeof snapshotFromStores> | null = null
  const general = !taught && route.sure && route.intent === "ask" && !route.second && looksGeneral(groundLine((snap = secrets.snap()), text, now))
  if (loneChat || general) {
    try {
      const reply = await timed("chat", () => chatLane(text, crew, now, opts.turns, snap ?? secrets.snap(), secrets))
      const chat = { text: reply.text, general: reply.general, evidence: reply.evidence, ...(reply.web ? { web: reply.web } : {}) }
      return { route: chatChip(route, Date.now() - t0, reply), chat, passThrough: false, intent: "chat", sure: true }
    } catch {
      // A failed reply loses nothing: a chat line is filed as before, a question goes on to the Ask flow.
      if (loneChat) return { route: `${routeChip(route, Date.now() - t0)} · chat failed`, passThrough: true, intent: route.intent, sure: route.sure }
    }
  }
  const wantsAsk = route.sure && (route.intent === "ask" || route.second === "ask")
  const passThrough = route.intent !== "ask" || !route.sure
  if (!wantsAsk) return { route: routeChip(route, Date.now() - t0), passThrough: true, intent: route.intent, sure: route.sure }
  try {
    const { answer, models, tries } = await timed("ask", () => askLane(text, crew, now, secrets))
    return { route: `${routeChip(route, Date.now() - t0, models)}${tries > 1 ? " · retried" : ""}`, answer, passThrough, intent: route.intent, sure: route.sure }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message))
    const why = aborted ? `timed out after ${ASK_TIMEOUT_MS / 1000}s` : error instanceof Error ? error.message : String(error)
    const failed = why.slice(0, 80)
    // Say what code found rather than only that the model failed.
    const found = foundAnswer(failed, await codeLook(text, snap ?? secrets.snap(), now))
    if (found) return { route: `${routeChip(route, Date.now() - t0)} · ask failed · code look`, answer: found, passThrough, intent: route.intent, sure: route.sure }
    return { route: `${routeChip(route, Date.now() - t0)} · ask failed`, failed, passThrough, intent: route.intent, sure: route.sure }
  }
}
