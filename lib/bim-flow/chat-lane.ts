/**
 * lib/bim-flow/chat-lane.ts — BIM Chat's `chat` lane: talk, grounded or plainly general
 *
 * A line the router calls `chat` (thinking out loud, a feeling, a general question) used to be
 * filed as a log line. Here it gets a reply and writes nothing. The lane is agent-lite: the model
 * chooses, code fetches, and the budget is fixed.
 *
 *   1. link    code. Names and topics in the line (`entity-link.ts`), words the vault has seen
 *              (`premiseCheck`), a time word. None of those: the line is not about the vault.
 *   2. pick    model, role `pick`. At most ONE tool from a closed list. Skipped when step 1 found
 *              nothing. Asked once more only when the first tool came back empty.
 *   3. fetch   code. The tool is one of the existing `runCompute` / `retrieve` reads.
 *   4. reply   model, the main model. Sees the last turns and the tool result.
 *
 * "General" leans on code, not on the model: a reply with no rows and no counted facts behind it is
 * always general, and the chat says so. With rows in hand the model may still say its reply did not
 * use them (general knowledge about a thing the vault happens to mention); it can only move a reply
 * toward general, never away from it. The model never writes to the vault and its words are never
 * filed. Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §5.
 */

import { parseWhen, premiseCheck, runCompute } from "./compute"
import { escalate } from "./crew"
import { describeLinks, linkText, type LinkedMention } from "./entity-link"
import type { ModelCall } from "./ollama"
import { retrieve } from "./retrieve"
import type { Evidence } from "./types"
import { contentWords, type VaultSnapshot } from "./vault-search"

export const CHAT_TOOLS = ["count", "last", "day", "person-days", "search", "texts-day", "none"] as const
export type ChatTool = (typeof CHAT_TOOLS)[number]

/** Most tool reads for one line. The second is asked for only when the first found nothing. */
export const MAX_TOOL_HOPS = 2
/** Turns of the conversation the reply sees. */
export const THREAD_TURNS = 8

export interface ChatTurn {
  who: "you" | "bim"
  text: string
}

export interface ChatGround {
  mentions: LinkedMention[]
  /** Content words of the line the vault has seen somewhere. */
  known: string[]
  /** A linked person's name, as the vault spells it. */
  person?: string
  /** True when the line names a time ("yesterday", "this week"). */
  timed: boolean
  /** True when the line speaks of the person themself ("I", "my"). */
  self: boolean
}

/** Step 1, in code: what in this line could be looked up. */
export function groundLine(snap: VaultSnapshot, text: string, now: Date): ChatGround {
  const mentions = linkText(snap, text).filter((m) => m.status !== "nil")
  const person = mentions.find((m) => m.status === "linked" && m.best?.sub === "person")?.best?.label
  return {
    mentions,
    known: premiseCheck(snap, contentWords(text)).known,
    ...(person ? { person } : {}),
    timed: !!parseWhen(text, now),
    self: /\b(i|i'm|im|i've|ive|i'd|i'll|my|me|mine|myself|we|our|us)\b/i.test(text),
  }
}

/**
 * True when nothing in the line points at the vault: no "I" or "my", no time word, no known name
 * or topic, no word the vault has seen. "What temp for garlic confit?" in a vault with no garlic.
 * Such a question skips the Ask flow, which could only say "I don't know".
 */
export function looksGeneral(g: ChatGround): boolean {
  return !g.self && !g.timed && g.mentions.length === 0 && g.known.length === 0
}

const PICK_SYSTEM =
  "You choose ONE lookup for BIM, the assistant inside a person's own tracking app, before it replies to their chat line. " +
  "Pick the single tool whose result would make the reply truer, or none. " +
  "count: how often or how long the subject was tracked in a time span. " +
  "last: when the subject was last tracked. " +
  "day: everything tracked today. " +
  "person-days: what happened on days a named person was around. " +
  "search: their messages, logs, notes and item titles that mention the subject. " +
  "texts-day: today's phone texts. " +
  "none: the line needs no lookup (a feeling, an opinion, small talk, general knowledge). " +
  "subject is one to three words taken from the line, the thing to look up; empty for day, texts-day and none. JSON only."

const PICK_SCHEMA = {
  type: "object",
  properties: {
    tool: { type: "string", enum: [...CHAT_TOOLS] },
    subject: { type: "string", maxLength: 40 },
    why: { type: "string", maxLength: 80 },
  },
  required: ["tool", "subject", "why"],
}

const REPLY_SYSTEM =
  "You are BIM, the assistant inside one person's own tracking app, talking with that person. Reply in one to three short plain sentences. " +
  "FACTS and ROWS, when given, are counted by code from their own data: use them for anything you say about their life, and say nothing about their life that is not there. " +
  "With no FACTS or ROWS you know nothing about their life: answer from general knowledge, or just respond to what they said, and do not pretend to know their data. " +
  "When they share a feeling, be warm and brief; offer a fact from FACTS only if it bears on it; never lecture or give advice they did not ask for. " +
  "Refer to people by name. Never use he, she, him, her, his or hers for anyone. " +
  "basis is data only when the reply states something taken from FACTS or ROWS; otherwise general. " +
  "No lists, no headings, no emoji. JSON only."

const REPLY_SCHEMA = {
  type: "object",
  properties: { reply: { type: "string", maxLength: 600 }, basis: { type: "string", enum: ["data", "general"] } },
  required: ["reply", "basis"],
}

type RawPick = { tool?: string; subject?: string; why?: string }
const isTool = (x: unknown): x is ChatTool => typeof x === "string" && (CHAT_TOOLS as readonly string[]).includes(x)

/** Step 3, in code: run one tool with the existing reads. `none` reads nothing. */
export async function runChatTool(snap: VaultSnapshot, tool: ChatTool, subject: string, text: string, g: ChatGround, now: Date): Promise<Evidence | null> {
  const terms = contentWords(subject)
  switch (tool) {
    case "none":
      return null
    case "count":
      return runCompute(snap, { fn: "minutes", limit: 6 }, { terms, now, text })
    case "last":
      return runCompute(snap, { fn: "days-since", limit: 4 }, { terms, now, text })
    case "day":
      return retrieve(snap, { kind: "day" }, { terms: [], now })
    case "texts-day":
      return retrieve(snap, { kind: "texts", days: 1, limit: 12 }, { terms: [], now })
    case "search":
      return retrieve(snap, { kind: "text", days: 90, limit: 8 }, { terms, now })
    case "person-days":
      return retrieve(snap, { kind: "overlap", days: 90, limit: 8 }, { terms, ...(g.person ? { person: g.person } : {}), now })
  }
}

export interface ChatHop {
  tool: ChatTool
  subject: string
  /** Rows found, before any cap. */
  found: number
}

export interface ChatLaneReply {
  text: string
  /** True when no row or counted fact stands behind the reply, or the model said it did not use them. */
  general: boolean
  hops: ChatHop[]
  /** Counted facts, then rows, as the chat's evidence fold shows them. */
  evidence: string[]
  /** Every model asked, in order. */
  models: string[]
  calls: number
}

export interface ChatLaneInput {
  text: string
  /** Earlier turns, oldest first. Only the last `THREAD_TURNS` are read. */
  turns?: ChatTurn[]
  now: Date
  snap: VaultSnapshot
  call: ModelCall
  /** The crew's `pick` rungs. Empty: no tool is picked and the reply is general. */
  pick: string[]
  /** The model that writes the reply. */
  main: string
}

const hasData = (e: Evidence | null): e is Evidence => !!e && e.total > 0

/** Run the lane for one line. Throws when the reply model fails; the caller files the line as before. */
export async function runChatLane(input: ChatLaneInput): Promise<ChatLaneReply> {
  const { text, now, snap, call } = input
  const g = groundLine(snap, text, now)
  const models: string[] = []
  const hops: ChatHop[] = []
  let calls = 0
  let found: Evidence | null = null

  // Nothing in the line points at the vault: no tool can help, so no model is asked to pick one.
  const canLook = input.pick.length > 0 && !looksGeneral(g)
  for (let hop = 0; canLook && hop < MAX_TOOL_HOPS; hop++) {
    const tried = hops.map((h) => `${h.tool}${h.subject ? ` "${h.subject}"` : ""} found nothing`).join("; ")
    const user = [
      ...describeLinks(g.mentions).map((l) => `KNOWN ${l}`),
      g.known.length ? `WORDS THEIR DATA HAS SEEN: ${g.known.slice(0, 8).join(", ")}` : "",
      tried ? `ALREADY TRIED: ${tried}. Pick a different tool or subject, or none.` : "",
      `LINE: ${text}`,
    ].filter(Boolean).join("\n")
    const { out, hops: asked } = await escalate<RawPick>(call, input.pick, { system: PICK_SYSTEM, user, schema: PICK_SCHEMA, maxTokens: 80 }, (r) => (isTool(r.tool) ? null : "tool off the list"))
    calls += asked.length
    models.push(...asked.map((h) => h.model))
    const tool: ChatTool = out && isTool(out.tool) ? out.tool : "none"
    if (tool === "none") break
    const subject = String(out?.subject ?? "").trim().slice(0, 40)
    // The same read twice finds the same nothing.
    if (hops.some((h) => h.tool === tool && h.subject === subject)) break
    const result = await runChatTool(snap, tool, subject, text, g, now)
    hops.push({ tool, subject, found: result?.total ?? 0 })
    if (hasData(result)) {
      found = result
      break
    }
  }

  const turns = (input.turns ?? []).slice(-THREAD_TURNS)
  const user = [
    turns.length ? `EARLIER IN THIS CHAT:\n${turns.map((t) => `${t.who === "you" ? "THEM" : "BIM"}: ${t.text.slice(0, 300)}`).join("\n")}` : "",
    found ? `FACTS (counted by code):\n${found.facts.join("\n") || "(none)"}` : "",
    found?.rows.length ? `ROWS:\n${found.rows.slice(0, 8).map((r) => `${r.when} · ${r.source} · ${r.text}`).join("\n")}` : "",
    !found ? "No FACTS or ROWS: you know nothing about their life for this reply." : "",
    `TODAY: ${now.toDateString()}`,
    `THEM: ${text}`,
  ].filter(Boolean).join("\n\n")
  const out = (await call({ model: input.main, system: REPLY_SYSTEM, user, schema: REPLY_SCHEMA, maxTokens: 220, temperature: 0.5 })) as { reply?: string; basis?: string }
  calls += 1
  models.push(input.main)
  const reply = String(out?.reply ?? "").trim()
  if (!reply) throw new Error("the chat lane gave no reply")

  const grounded = !!found && out.basis !== "general"
  return {
    text: reply,
    general: !grounded,
    hops,
    evidence: found && grounded ? [...found.facts, ...found.rows.slice(0, 8).map((r) => `${r.when} · ${r.source} · ${r.text}`)].slice(0, 12) : [],
    models,
    calls,
  }
}
