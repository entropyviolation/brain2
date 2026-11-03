/**
 * lib/bim-flow/chat-router.ts — Which lane a BIM chat line goes to
 *
 * Only lines the grammar ladder would file as a plain capture get here. Code
 * rules first; then the smallest model picks one label from a closed list and
 * climbs to the next model when it says it is unsure or fights a code hint.
 * Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §3 L1.
 */

import { escalate, type Hop } from "./crew"
import type { ModelCall } from "./ollama"

export const CHAT_INTENTS = ["ask", "log", "tell", "build", "correct", "chat", "unclear"] as const
export type ChatIntent = (typeof CHAT_INTENTS)[number]

export interface ChatRoute {
  intent: ChatIntent
  /** A second lane, when the line is two things ("back from Sam's, when did I last see Jo?"). */
  second?: ChatIntent
  sure: boolean
  answeredBy: "code" | "model"
  why: string
  hops: Hop[]
}

const WH = /^(when|what|how|who|where|which|why|did|do|does|have|has|was|were|is|am|are|can|could|should)\b/i

/** A sure label from the words alone, or a hint the model must agree with, or nothing. */
export function routeByCode(text: string): { intent: ChatIntent; sure: boolean; why: string } | null {
  const t = text.trim()
  const lower = t.toLowerCase()
  if (/\?\s*$/.test(t) && WH.test(lower)) return { intent: "ask", sure: true, why: "a question word and a question mark" }
  if (/^(how many|how much|how long|how often|when was the last|when did i last)\b/.test(lower)) return { intent: "ask", sure: true, why: "a counting or last-time question" }
  if (/^(make|create|add|build|set up)\s+(me\s+)?(a|an|new)\s+.*\b(habit|list|widget|countdown|folder|rule|tracker)\b/.test(lower)) {
    return { intent: "build", sure: true, why: "asks to make a habit, list, or widget" }
  }
  if (/\?\s*$/.test(t)) return { intent: "ask", sure: false, why: "ends in a question mark" }
  return null
}

const SYSTEM =
  "You sort one chat line a person sent to BIM, the assistant inside their personal tracking app. " +
  "Pick exactly one label. " +
  "ask: they want a fact from their own tracked data or notes (when, how many, how long, what did I). " +
  "log: something that happened, is happening, or they did. " +
  "tell: a fact about a person, date, or thing to remember. " +
  "build: they want a habit, list, widget, or rule made. " +
  "correct: they are fixing what BIM just said or did. " +
  "chat: talking, feelings, opinions, or a general question not about their data. " +
  "unclear: too short or vague to tell. " +
  "second is only for a line that is clearly two things; otherwise leave it as none. " +
  "sure is low when two labels fit. JSON only."

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...CHAT_INTENTS] },
    second: { type: "string", enum: [...CHAT_INTENTS, "none"] },
    sure: { type: "string", enum: ["high", "low"] },
    why: { type: "string", maxLength: 80 },
  },
  required: ["intent", "second", "sure", "why"],
}

type Raw = { intent?: string; second?: string; sure?: string; why?: string }

const isIntent = (x: unknown): x is ChatIntent => typeof x === "string" && (CHAT_INTENTS as readonly string[]).includes(x)

/** Route one line. `ladder` is the crew's `route` rungs; empty means code only. */
export async function routeChat(text: string, call: ModelCall | null, ladder: string[], lastBim?: string): Promise<ChatRoute> {
  const hint = routeByCode(text)
  if (hint?.sure) return { ...hint, answeredBy: "code", hops: [] }
  if (!call || !ladder.length) {
    return hint ? { ...hint, answeredBy: "code", hops: [] } : { intent: "log", sure: false, answeredBy: "code", why: "no model", hops: [] }
  }
  const user = `${lastBim ? `BIM's last reply: ${lastBim.slice(0, 200)}\n` : ""}LINE: ${text}`
  const { out, hops } = await escalate<Raw>(call, ladder, { system: SYSTEM, user, schema: SCHEMA, maxTokens: 80 }, (r) => {
    if (!isIntent(r.intent)) return "label off the list"
    if (r.sure !== "high") return "unsure"
    if (hint && r.intent !== hint.intent) return `code saw ${hint.intent}`
    return null
  })
  if (!out || !isIntent(out.intent)) {
    return hint ? { ...hint, answeredBy: "code", hops } : { intent: "log", sure: false, answeredBy: "code", why: "model gave no label", hops }
  }
  const second = isIntent(out.second) && out.second !== out.intent ? out.second : undefined
  return {
    intent: out.intent,
    ...(second ? { second } : {}),
    sure: out.sure === "high",
    answeredBy: "model",
    why: String(out.why ?? "").slice(0, 80),
    hops,
  }
}
