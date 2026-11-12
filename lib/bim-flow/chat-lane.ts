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
 * The `web` tool (`web-lane.ts`) is offered only when the caller hands in a search, and only for a question.
 * It is the one tool that reads outside the vault: the pick model writes the query, the Mac hub searches, and
 * the reply carries its sources. Questions with a sure code cue never get here; the Web BIMBY (`web-ask.ts`) takes them.
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
import { freshCue, tidyQuery, webLines, type WebLines, type WebSearch } from "./web-lane"

export const CHAT_TOOLS = ["count", "last", "day", "person-days", "search", "texts-day", "none"] as const
/** A vault read, or `web`: a search outside the vault, offered only when `ChatLaneInput.web` is set. */
export type ChatTool = (typeof CHAT_TOOLS)[number] | "web"

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
  "none: the line needs no lookup (a feeling, an opinion, small talk, general knowledge). "
const PICK_SUBJECT = "subject is one to three words taken from the line, the thing to look up; empty for day, texts-day and none. JSON only."
const PICK_WEB =
  "web: search the internet, only when the answer depends on the outside world right now or on a named place or business " +
  "(what is nearby, a price, news, a score, a release date). Not for their own data, and not for general knowledge you already have. " +
  "For web, subject is a short search query, three to eight plain keywords from the line; add the HOME place only for 'near me'; " +
  "do not add a year or words the line does not need; never put a person's name in it. " +
  "For the other tools, "

const pickSystem = (web: boolean) => PICK_SYSTEM + (web ? PICK_WEB : "") + PICK_SUBJECT

const pickSchema = (web: boolean) => ({
  type: "object",
  properties: {
    tool: { type: "string", enum: web ? [...CHAT_TOOLS, "web"] : [...CHAT_TOOLS] },
    subject: { type: "string", maxLength: web ? 70 : 40 },
    why: { type: "string", maxLength: 80 },
  },
  required: ["tool", "subject", "why"],
})

const REPLY_SYSTEM =
  "You are BIM, the assistant inside one person's own tracking app, talking with that person. Reply in one to three short plain sentences. " +
  "FACTS and ROWS, when given, are counted by code from their own data: use them for anything you say about their life, and say nothing about their life that is not there. " +
  "With no FACTS or ROWS you know nothing about their life: answer from general knowledge, or just respond to what they said, and do not pretend to know their data. " +
  "When they share a feeling, be warm and brief; offer a fact from FACTS only if it bears on it; never lecture or give advice they did not ask for. " +
  "Refer to people by name. Never use he, she, him, her, his or hers for anyone. " +
  "basis is data only when the reply states something taken from FACTS or ROWS; otherwise general. "
const REPLY_WEB =
  "WEB RESULTS, when given, were fetched from the internet just now for this line: use them for facts about the outside world, " +
  "name what they name, and say plainly what they do not state rather than guessing. With WEB RESULTS you may use up to five short sentences. " +
  "basis is web when the reply states something taken from WEB RESULTS. " +
  "If the web search failed, say you could not search the web just now, then answer from general knowledge if you can. "
const REPLY_END = "No lists, no headings, no emoji. JSON only."

const replySchema = (web: boolean) => ({
  type: "object",
  properties: { reply: { type: "string", maxLength: web ? 900 : 600 }, basis: { type: "string", enum: web ? ["data", "web", "general"] : ["data", "general"] } },
  required: ["reply", "basis"],
})

type RawPick = { tool?: string; subject?: string; why?: string }
const isTool = (x: unknown, web = false): x is ChatTool => typeof x === "string" && ((CHAT_TOOLS as readonly string[]).includes(x) || (web && x === "web"))

/** Step 3, in code: run one tool with the existing reads. `none` reads nothing. */
export async function runChatTool(snap: VaultSnapshot, tool: ChatTool, subject: string, text: string, g: ChatGround, now: Date): Promise<Evidence | null> {
  const terms = contentWords(subject)
  switch (tool) {
    case "none":
    case "web":
      // `web` reads outside the vault; `runChatLane` runs it through the search it was handed.
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
  /** Set when the reply stands on a web search: the query that left the Mac. The sources are in `evidence`. */
  web?: { query: string }
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
  /** A web search the pick model may choose for a question. Absent: the lane reads the vault only. `home` is where the person lives. */
  web?: { search: WebSearch; home?: string }
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
  // The web is offered for a question only: a feeling or a remark is never sent to a search engine.
  const web = input.web && /\?\s*$/.test(text.trim()) ? input.web : undefined
  let webTry: { query: string; got: WebLines | null } | null = null

  // Nothing in the line points at the vault: no vault tool can help, so no model is asked to pick one,
  // unless the web is on hand and the question may be about the world right now (`freshCue`: a price, a score, "the latest").
  // Plain general knowledge ("what is the boiling point of nitrogen?") is still one call and no search.
  const canLook = input.pick.length > 0 && (!looksGeneral(g) || (!!web && freshCue(text)))
  for (let hop = 0; canLook && hop < MAX_TOOL_HOPS; hop++) {
    const tried = hops.map((h) => `${h.tool}${h.subject ? ` "${h.subject}"` : ""} found nothing`).join("; ")
    const user = [
      ...describeLinks(g.mentions).map((l) => `KNOWN ${l}`),
      g.known.length ? `WORDS THEIR DATA HAS SEEN: ${g.known.slice(0, 8).join(", ")}` : "",
      tried ? `ALREADY TRIED: ${tried}. Pick a different tool or subject, or none.` : "",
      web?.home ? `HOME: ${web.home}` : "",
      web ? `TODAY: ${now.toDateString()}` : "",
      `LINE: ${text}`,
    ].filter(Boolean).join("\n")
    const { out, hops: asked } = await escalate<RawPick>(call, input.pick, { system: pickSystem(!!web), user, schema: pickSchema(!!web), maxTokens: 80 }, (r) => (isTool(r.tool, !!web) ? null : "tool off the list"))
    calls += asked.length
    models.push(...asked.map((h) => h.model))
    const tool: ChatTool = out && isTool(out.tool, !!web) ? out.tool : "none"
    if (tool === "none") break
    const said = String(out?.subject ?? "").trim()
    const subject = tool === "web" ? tidyQuery(said, web?.home) : said.slice(0, 40)
    // The same read twice finds the same nothing.
    if (hops.some((h) => h.tool === tool && h.subject === subject)) break
    if (tool === "web") {
      if (!subject) break
      const hit = await web!.search(subject).catch(() => null)
      webTry = { query: hit?.query ?? subject, got: hit?.results.length ? webLines(hit, text) : null }
      hops.push({ tool, subject, found: hit?.results.length ?? 0 })
      if (webTry.got) break
      continue
    }
    const result = await runChatTool(snap, tool, subject, text, g, now)
    hops.push({ tool, subject, found: result?.total ?? 0 })
    if (hasData(result)) {
      found = result
      break
    }
  }

  const turns = (input.turns ?? []).slice(-THREAD_TURNS)
  const searched = webTry as { query: string; got: WebLines | null } | null
  const webGot = searched?.got ?? null
  const user = [
    turns.length ? `EARLIER IN THIS CHAT:\n${turns.map((t) => `${t.who === "you" ? "THEM" : "BIM"}: ${t.text.slice(0, 300)}`).join("\n")}` : "",
    found ? `FACTS (counted by code):\n${found.facts.join("\n") || "(none)"}` : "",
    found?.rows.length ? `ROWS:\n${found.rows.slice(0, 8).map((r) => `${r.when} · ${r.source} · ${r.text}`).join("\n")}` : "",
    !found ? "No FACTS or ROWS: you know nothing about their life for this reply." : "",
    webGot ? `WEB RESULTS (searched just now for "${searched!.query}"):\n${webGot.lines.join("\n")}` : "",
    searched && !webGot ? "The web search failed or found nothing." : "",
    `TODAY: ${now.toDateString()}`,
    `THEM: ${text}`,
  ].filter(Boolean).join("\n\n")
  const out = (await call({
    model: input.main,
    system: REPLY_SYSTEM + (searched ? REPLY_WEB : "") + REPLY_END,
    user,
    schema: replySchema(!!searched),
    // Room for five sentences inside JSON: at 360 a longer web answer was cut off mid-string.
    maxTokens: searched ? 520 : 220,
    temperature: searched ? 0.2 : 0.5,
  })) as { reply?: string; basis?: string }
  calls += 1
  models.push(input.main)
  const reply = String(out?.reply ?? "").trim()
  if (!reply) throw new Error("the chat lane gave no reply")

  const grounded = !!found && out.basis !== "general"
  // Like data, the web can only be claimed with results in hand; the model may still say it did not use them.
  const fromWeb = !!webGot && out.basis !== "general" && out.basis !== "data"
  return {
    text: reply,
    general: !grounded && !fromWeb,
    hops,
    evidence: [
      ...(found && grounded ? [...found.facts, ...found.rows.slice(0, 8).map((r) => `${r.when} · ${r.source} · ${r.text}`)].slice(0, 12) : []),
      ...(fromWeb ? webGot!.sources : []),
    ],
    models,
    calls,
    ...(fromWeb ? { web: { query: searched!.query } } : {}),
  }
}
