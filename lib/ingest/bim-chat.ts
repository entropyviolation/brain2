/**
 * lib/ingest/bim-chat.ts — BIM Chat: the Telegram bot's brain, in the app
 *
 * A typed line goes through `ingestIncomingAsync`, the same executor Telegram
 * uses, on the `simulate` channel with chat id `bim-chat`. That channel skips
 * pairing and dedupe, so the bot's allowlist, poll offset, and Telegram feed
 * are never touched. Rituals, clarify questions, and `undo` keep their own
 * state under this chat id, apart from Telegram and the Settings simulate box.
 *
 * Clarify buttons come from `inlineKeyboardForResult` and map back through
 * `choiceTextFromCallback`, so a tap here sends the same text a Telegram tap
 * does. The transcript is a per-device convenience in `localStorage`
 * (`bimchat-transcript`, no `brain2-` prefix, so it never joins the vault).
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { linkText } from "@/lib/bim-flow/entity-link"
import { recordRouteVerdict } from "@/lib/bim-flow/route-verdicts"
import { snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { answerFlightQuestion } from "@/lib/flight-bimby/ask"
import { addFlightFromInfo } from "@/lib/flight-bimby/file"
import { useTaskStore } from "@/lib/task-store"
import { looksLikeFlightConfirmation } from "@/lib/flight-bimby/extract"
import { applyTextMirror } from "./apply-text-mirror"
import { applyTripPrep } from "./apply-trip-prep"
import { answerTell, applyTell, type TellPending, type TellReply } from "./apply-tell"
import {
  answerFact,
  looksLikeFactQuestion,
  matchFact,
  parseBareWhen,
  parseInstantStatement,
  parseNoteStatement,
  pruneFacts,
  rememberedText,
  rememberFact,
  type Fact,
} from "./bim-facts"
import { tryResistance, tryResistanceOutcome, tryResistanceWhy, type ResistanceReply } from "./bim-resistance"
import { routable, runSwitchboard, useBimLlmMode, type SwitchboardResult } from "./bim-switchboard"
import { CORRECT_TTL_MS, parseCorrection, whenLabel, type Correction } from "./bim-correct"
import { parseTell } from "./bim-tell"
import { liveFocus, resolveFollowUp, useBimThread } from "./bim-thread"
import { tryHabitAuto, tryHandoff } from "./bimby-handoff"
import { fireCues, parseKeepTodo, tryCueCommand, tryKeepCue, undoLastCue } from "./bim-keep"
import { undoLastMoney } from "@/lib/finance-bimby/apply"
import { openMoneyQuestion, tryMoney, tryMoneyPhoto } from "@/lib/finance-bimby/run"
import { escalate } from "@/lib/bim-flow/crew"
import { CHAT_LANES, runLanes, type ChatLaneId, type LaneBody, type LaneGuard } from "./bim-lanes"
import { BIM_CHAT_AGENT_ID, BIM_CHAT_REV } from "@/lib/agents/adapters/bim-chat"
import { recorder, type StopReason, type TraceRecorder } from "@/lib/agents/trace"
import { saveTrace } from "@/lib/agents/trace-store"
import { answerTextQuestion, mentionsTexts, TEXTS_ASK_DAYS } from "./bim-texts"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { ingestIncomingAsync } from "./executor"
import { makeIngestEventId, useIngestStore } from "./ingest-store"
import { looksLikeVerb } from "./parse-message"
import { isWriteKind } from "./phone-undo"
import { tryReport } from "@/lib/report-bimby/run"
import { trySocial } from "@/lib/social-bimby/run"
import { tryStream } from "@/lib/stream-bimby/run"
import { tryWire } from "@/lib/wire-bimby/run"
import { tryDay } from "@/lib/plan-bimby/day/run"
import { nextQuestion } from "@/lib/follow-through/ask"
import { observeLine, tryFollowAnswer, tryFollowCommand, type MineSources } from "@/lib/follow-through/run"
import { followLedger } from "@/lib/follow-through/store"
import { useOvercomeStore } from "@/lib/overcome-bimby/store"
import { useReportStore } from "@/lib/report-bimby/store"
import { choiceTextFromCallback, inlineKeyboardForResult } from "./telegram-ui.mjs"
import type { ApplyResult, IncomingAttachment, IngestIntentKind, IngestSource } from "./types"

export const BIM_CHAT_ID = "bim-chat"
export const BIM_CHAT_SOURCE: IngestSource = { channel: "simulate", chatId: BIM_CHAT_ID }
const TRANSCRIPT_KEY = "bimchat-transcript"
const TRANSCRIPT_CAP = 400

/** Clarify kinds that are the ladder failing to read a line, not a name to pick or a ritual in progress. */
const RESCUABLE = new Set<string>(["start", "mood", "location"])

export type BimChoice = { label: string; text: string }

export type BimLine = {
  id: string
  at: string
  who: "you" | "bim"
  text: string
  status?: ApplyResult["status"]
  kind?: IngestIntentKind
  /** Tap answers for the clarify question on this line. */
  choices?: BimChoice[]
  /** LLM mode: how the line was routed ("ASK · code · q3 30b-a3b · 4.2s"). */
  route?: string
  /** LLM mode: counted facts and the evidence rows the answer used. */
  evidence?: string[]
  /** The whole question a short follow-up was read as ("and last week?"), from the thread (`bim-thread.ts`). */
  readAs?: string
  /** The chat lane replied with no row or counted fact behind it: general talk, not your data. */
  general?: boolean
  /** A tag the line carries, such as `resistance` when the Overcome lane took it. */
  tag?: "resistance"
  /** The Report BIMBY's plan for this line (`lib/report-bimby/store.ts`); the chat draws it as a card. */
  reportId?: string
  /** The Wire BIMBY's plan for this line (`lib/wire-bimby/store.ts`); the chat draws it as a card. */
  wireId?: string
  /** The Plan BIMBY's day plan for this line (`lib/plan-bimby/day/store.ts`); the chat draws it as a card. */
  dayId?: string
  /** The Habits BIMBY line this reply came from (`lib/habit-helper/store.ts`); the chat draws its proposals to approve. */
  habitLineId?: string
  /** The turn's Trace (`lib/agents/trace-store.ts`): which lanes were tried, which took it, what it cost. */
  traceId?: string
}

type InlineButton = { text: string; callback_data: string }

/** Tap answers for a result, the same buttons Telegram would show. */
export function bimChoices(result: ApplyResult): BimChoice[] {
  const keyboard = inlineKeyboardForResult(result) as { inline_keyboard: InlineButton[][] } | undefined
  if (!keyboard) return []
  const out: BimChoice[] = []
  for (const row of keyboard.inline_keyboard) {
    for (const button of row) {
      const text = choiceTextFromCallback(button.callback_data)
      if (text) out.push({ label: button.text, text })
    }
  }
  return out
}

/** What BIM says back. Telegram stays silent on an ignored line; the chat shows why. */
export function bimReplyText(result: ApplyResult): string {
  if (result.reply) return result.reply
  if (result.status === "ignored") return result.summary ? `(${result.summary})` : "(ignored)"
  if ("summary" in result && result.summary) return result.summary
  return result.status
}

let seq = 0
function lineId(): string {
  seq += 1
  return `bim-${Date.now().toString(36)}-${seq}`
}

/**
 * The question BIM last asked about a told fact ("When do you remember last
 * seeing Shelby?"). In memory only: a reload forgets the question, not the answer.
 */
let pendingTell: TellPending | null = null

export function openTellQuestion(): TellPending | null {
  return pendingTell
}

function tellLine(reply: TellReply): BimLine {
  return {
    id: lineId(),
    at: new Date().toISOString(),
    who: "bim",
    text: reply.text,
    status: reply.status,
    kind: "tell",
  }
}

function logTell(raw: string, reply: TellReply, now: Date): void {
  useIngestStore.getState().appendEvent({
    id: makeIngestEventId(),
    at: now.toISOString(),
    channel: BIM_CHAT_SOURCE.channel,
    chatId: BIM_CHAT_ID,
    raw,
    kind: "tell",
    status: reply.status === "ok" ? "applied" : "clarify",
    summary: reply.summary,
  })
}

/**
 * A pasted flight confirmation (the Flight BIMBY, `lib/flight-bimby/`): every flight in it becomes a
 * Flight item with its booking details and a calendar event, blanks filled from facts and never guessed.
 * Chatter left on the last fact's line ("…now it's time to order…") goes on through the normal path.
 */
async function tryFlights(text: string, now: Date): Promise<BimLine | null> {
  if (!looksLikeFlightConfirmation(text, now)) return null
  const done = await addFlightFromInfo(text, { now })
  if (!done.filed.length) return null
  let reply = done.text
  let status: ApplyResult["status"] = "ok"
  if (done.leftover) {
    const rest = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: done.leftover, receivedAt: now.toISOString() }, now)
    reply = `${reply}\n\n${bimReplyText(rest)}`
    status = rest.status
  }
  useIngestStore.getState().appendEvent({
    id: makeIngestEventId(),
    at: now.toISOString(),
    channel: BIM_CHAT_SOURCE.channel,
    chatId: BIM_CHAT_ID,
    raw: text,
    kind: "tell",
    status: "applied",
    itemIds: done.filed.map((f) => f.taskId),
    summary: `Flights: ${done.filed.map((f) => `${f.draft.from}→${f.draft.to} ${f.status}`).join(", ")}`,
  })
  return { id: lineId(), at: new Date().toISOString(), who: "bim", text: reply, status, kind: "tell" }
}

/**
 * Facts, questions, and widget commands in plain words (`bim-tell.ts`). Runs
 * ahead of the executor, only here: Telegram's ladder is unchanged. An open
 * ritual or clarify question owns the line, and a real command (`log:`, `groc`)
 * is never read as a fact. Null sends the line to the executor.
 */
function tryTell(text: string, now: Date): BimLine | null {
  const executorBusy = useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)
  const held = pendingTell
  pendingTell = null
  if (executorBusy) return null
  const mirror = held ? null : applyTextMirror(text)
  if (mirror) {
    logTell(text, mirror, now)
    return tellLine(mirror)
  }
  // Trip prep ("have to do before leaving for New York: pack ..."), and the answer to its open question.
  const trip = applyTripPrep(text, now)
  if (trip) {
    logTell(text, trip, now)
    return tellLine(trip)
  }
  if (looksLikeVerb(text, now)) return null

  let reply: TellReply | null = null
  if (held) reply = answerTell(held, text, now)
  if (!reply) {
    const tell = parseTell(text, now)
    reply = tell ? applyTell(tell, now) : null
  }
  if (!reply) return null
  pendingTell = reply.pending ?? null
  logTell(text, reply, now)
  return tellLine(reply)
}

/**
 * "What was Shelby talking about in her last text to me?" (`bim-texts.ts`). Answered from the hub's texts, in ROUTER and
 * LLM mode alike; the model only sums up the texts it is handed, and only with LLM on. The iPhone asks the Mac hub.
 */
async function tryTexts(text: string, now: Date, llm: boolean): Promise<BimLine | null> {
  if (!mentionsTexts(text)) return null
  const snap = snapshotFromStores()
  const found = await answerTextQuestion(text, now, {
    snap,
    load: async (people, hideHandles) => {
      const base = isPhoneWebStorage() ? (await import("@/lib/phone-window").then((m) => m.phoneHubRoute())).url : undefined
      if (base === "") return null
      return loadTexts({ days: TEXTS_ASK_DAYS, people, hideHandles, ...(base ? { base } : {}) })
    },
    ...(llm
      ? { model: () => chatCrew().then((crew) => (crew ? { call: ollamaCall(crew.main, AbortSignal.timeout(45_000)), name: crew.main } : null)) }
      : {}),
  })
  if (!found) return null
  return {
    id: lineId(),
    at: new Date().toISOString(),
    who: "bim",
    text: found.text,
    status: "ok",
    route: found.route,
    ...(found.evidence.length ? { evidence: found.evidence } : {}),
    ...(found.choices?.length ? { choices: found.choices } : {}),
  }
}

// ---------------------------------------------------------------- told facts

/**
 * Facts you tell BIM in passing ("Claude limit resets at 2am", "remember that the gate code is 4412"),
 * kept on this device. A moment is trusted only until it passes (`bim-facts.ts`).
 */
export const useBimFactsStore = create<{ facts: Fact[]; set: (facts: Fact[]) => void }>()(
  persist((set) => ({ facts: [], set: (facts) => set({ facts }) }), {
    name: "bimchat-facts",
    storage: createJSONStorage(() => localStorage),
  }),
)

/** After "I don't know", the next bare time ("at 3am") is the answer for this fact. In memory only. */
let awaitingFact: Pick<Fact, "label" | "tokens"> | null = null

function factLine(text: string, extra: Partial<BimLine> = {}): BimLine {
  return { id: lineId(), at: new Date().toISOString(), who: "bim", text, status: "ok", kind: "tell", ...extra }
}

function keepFact(draft: Omit<Fact, "id" | "toldAt">, now: Date): BimLine {
  const store = useBimFactsStore.getState()
  const full = { ...draft, toldAt: now.getTime() }
  store.set(rememberFact(pruneFacts(store.facts, now), full, `fact-${now.getTime().toString(36)}`))
  return factLine(rememberedText(full, now))
}

/**
 * Told facts and questions about them. Runs after `tryTell` and before the router, only in chat. A statement is
 * kept; a question that matches a kept fact is answered from it, with no model. Null leaves the line to the rest.
 */
function tryFact(text: string, now: Date): BimLine | null {
  if (useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID) || looksLikeVerb(text, now)) return null
  const waiting = awaitingFact
  awaitingFact = null
  if (waiting) {
    const when = parseBareWhen(text, now)
    if (when !== null) return keepFact({ kind: "instant", label: waiting.label, tokens: waiting.tokens, at: when }, now)
  }
  const instant = parseInstantStatement(text, now)
  if (instant) return keepFact(instant, now)
  const note = parseNoteStatement(text)
  if (note) return keepFact(note, now)
  if (!looksLikeFactQuestion(text)) return null
  const facts = pruneFacts(useBimFactsStore.getState().facts, now)
  const hit = matchFact(facts, text)
  if (!hit) return null
  const answer = answerFact(hit, now)
  if (answer.state === "unknown" || answer.state === "just-passed") awaitingFact = { label: hit.label, tokens: hit.tokens }
  return factLine(answer.text, { route: "FACT · memory · code" })
}

// ---------------------------------------------------------------- BIM asks you

/**
 * A question BIM put to you: a check-in ("What are you doing right now?") or a
 * fact it could not find in your data. The next plain line answers it and is
 * filed as `doing:`, `mood:`, or a log line naming the question, so the answer
 * is evidence next time. `skip` drops it; a real command drops it and runs.
 * In memory only, like the tell question.
 */
export type AskBack = { kind: "doing" | "mood" | "fact"; question: string }
let pendingAsk: AskBack | null = null

export function openAskBack(): AskBack | null {
  return pendingAsk
}

export const CHECK_INS: { kind: "doing" | "mood"; question: string; choices: string[] }[] = [
  { kind: "doing", question: "What are you doing right now?", choices: [] },
  { kind: "mood", question: "How are you feeling right now?", choices: ["good", "okay", "tired", "anxious", "sad"] },
]
const SKIP: BimChoice = { label: "skip", text: "skip" }
const CHECKIN_KEY = "bimchat-checkin-at"
/** BIM checks in on its own when the chat opens this long after the last check-in. */
export const CHECKIN_EVERY_MS = 2 * 60 * 60 * 1000

function lastCheckIn(): { at: number; kind?: string } {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY)
    return raw ? (JSON.parse(raw) as { at: number; kind?: string }) : { at: 0 }
  } catch {
    return { at: 0 }
  }
}

/** The check-in line, and BIM now waits for its answer. Alternates doing and mood unless `kind` is given. */
export function checkInLine(kind?: "doing" | "mood", now = new Date()): BimLine {
  const prev = lastCheckIn().kind
  const pick = CHECK_INS.find((c) => c.kind === kind) ?? CHECK_INS.find((c) => c.kind !== prev) ?? CHECK_INS[0]!
  pendingAsk = { kind: pick.kind, question: pick.question }
  try {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify({ at: now.getTime(), kind: pick.kind }))
  } catch {}
  return {
    id: lineId(),
    at: now.toISOString(),
    who: "bim",
    text: pick.question,
    status: "needs_clarify",
    choices: [...pick.choices.map((c) => ({ label: c, text: c })), SKIP],
  }
}

/** True when BIM should check in now: long enough since the last one and nothing else is open. */
export function checkInDue(now = new Date()): boolean {
  if (pendingAsk || pendingTell || useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)) return false
  return now.getTime() - lastCheckIn().at >= CHECKIN_EVERY_MS
}

function askLine(text: string, extra: Partial<BimLine> = {}): BimLine {
  return { id: lineId(), at: new Date().toISOString(), who: "bim", text, ...extra }
}

/** The line that answers BIM's open question, filed as what was asked; null when nothing is open or the line is a command. */
async function answerAskBack(text: string, now: Date): Promise<BimLine | null> {
  const held = pendingAsk
  if (!held) return null
  pendingAsk = null
  if (/^(skip|no|nah|not now|pass)$/i.test(text.trim())) {
    return askLine(held.kind === "fact" ? "Okay. I will say I do not know if you ask again." : "Okay, skipped.", { status: "ok" })
  }
  // A command or a new question is not the answer: drop the question and run the line.
  if (looksLikeVerb(text, now) || /\?\s*$/.test(text)) return null
  const line =
    held.kind === "doing" ? `doing: ${text}` : held.kind === "mood" ? `mood: ${text}` : `log: ${text} (answer to "${held.question}")`
  const result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: line, receivedAt: now.toISOString() }, now)
  const choices = bimChoices(result)
  return askLine(held.kind === "fact" && result.status === "ok" ? `Saved. I will know it next time.\n${bimReplyText(result)}` : bimReplyText(result), {
    status: result.status,
    kind: result.kind,
    ...(choices.length ? { choices } : {}),
  })
}

/** Confidence too low to say: BIM says it does not know and asks you instead. */
const UNSURE = new Set(["none", "low"])

function answerLine(board: SwitchboardResult, question: string): BimLine {
  const answer = board.answer!
  const unsure = UNSURE.has(answer.confidence)
  if (unsure) pendingAsk = { kind: "fact", question }
  const text = unsure
    ? `I don't know. ${answer.text}\n\nDo you know? Tell me and I'll keep it, so I know next time. (skip to leave it)`
    : answer.text
  return {
    id: lineId(),
    at: new Date().toISOString(),
    who: "bim",
    text,
    status: unsure ? "needs_clarify" : "ok",
    route: board.route,
    ...(answer.evidence.length ? { evidence: answer.evidence } : {}),
    ...(unsure ? { choices: [SKIP] } : {}),
  }
}

/**
 * The chat lane replied (`lib/bim-flow/chat-lane.ts`). Nothing was filed, so a statement gets a "log it" key that
 * files your own words; the model's words are never filed. A reply with no data behind it says it is general.
 */
function chatLine(board: SwitchboardResult, said: string): BimLine {
  const chat = board.chat!
  const statement = !/\?\s*$/.test(said)
  return {
    id: lineId(),
    at: new Date().toISOString(),
    who: "bim",
    text: chat.text,
    status: "ok",
    route: board.route,
    ...(chat.general ? { general: true } : {}),
    ...(chat.evidence.length ? { evidence: chat.evidence } : {}),
    ...(statement ? { choices: [{ label: "log it", text: `log: ${said}` }] } : {}),
  }
}

/** The turns before this line, oldest first, for the chat lane. The line being sent is already last in the transcript. */
function earlierTurns(text: string): { who: "you" | "bim"; text: string }[] {
  const lines = useBimChatStore.getState().lines
  const last = lines[lines.length - 1]
  const before = last?.who === "you" && last.text === text ? lines.slice(0, -1) : lines
  return before.slice(-8).map((l) => ({ who: l.who, text: l.text }))
}

function resistanceLine(r: ResistanceReply, tag = false): BimLine {
  return { id: lineId(), at: new Date().toISOString(), who: "bim", text: r.text, status: "ok", route: r.route, ...(r.choices.length ? { choices: r.choices } : {}), ...(tag ? { tag: "resistance" as const } : {}) }
}

/** The Ask lane ran and failed: say so plainly instead of handing the question to the ladder. */
function failedLine(board: SwitchboardResult): BimLine {
  return askLine(`I tried to look that up in your data, but the model run failed (${board.failed}). Ask again in a minute.`, {
    status: "error",
    route: board.route,
  })
}

const NO_MODELS =
  "I can't reach the local models (Ollama on the Mac), so I can't look that up right now. Turn LLM off to use plain routing, or send log: and the line to file it."

/**
 * The thread (`bim-thread.ts`): a short follow-up to the last question ("and last week?", "what about
 * Elijah?", "where did she go?") becomes the whole question, in code, before any lane reads it. An open
 * question owns the line instead; a new question is the one thing that may follow BIM's "Do you know?".
 */
function followUp(text: string, now: Date) {
  const focus = liveFocus(now)
  if (!focus || pendingTell || awaitingFact) return null
  if (pendingAsk && !/\?\s*$/.test(text)) return null
  if (useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)) return null
  let snap: ReturnType<typeof snapshotFromStores> | null = null
  return resolveFollowUp(text, focus, (t) => linkText((snap ??= snapshotFromStores()), t, { kind: "person" }))
}

/**
 * One line from you. Never throws. A follow-up is made whole from the thread first; the reply carries
 * `readAs` so you can see what BIM took it to mean. Any question becomes the thread's new focus.
 */
export async function sendToBim(
  text: string,
  now = new Date(),
  opts: { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[] } = {},
): Promise<BimLine> {
  const line = await followed(await routeToBim(text, now, opts), text, now, opts)
  // A cue (“remind me if I'm thinking about ordering food”) is checked against every line, after BIM has answered it.
  if (opts.photos?.length || line.status === "error" || /^(KEEP|CORRECT)/.test(line.route ?? "")) return line
  try {
    const cued = await fireCues(text, now, opts.llm ? cueGate : undefined)
    return cued ? { ...line, text: `${line.text}\n\n${cued.text}`, ...(line.choices?.length ? {} : { choices: cued.choices }) } : line
  } catch {
    return line
  }
}

/** One yes/no to a small model: is this line the situation a cue waits for? No model, a slow one or a throw means no. */
async function cueGate(prompt: { system: string; user: string; schema: Record<string, unknown> }): Promise<boolean> {
  const crew = await chatCrew().catch(() => null)
  if (!crew) return false
  const asked = escalate<{ fits?: boolean }>(ollamaCall(crew.main), crew.gate.length ? crew.gate : [crew.main], { ...prompt, maxTokens: 20 }, () => null)
  const slow = new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000))
  const got = await Promise.race([asked, slow])
  return got?.out?.fits === true
}

/** The follow-through ledger's read of a plain line, and its one-tap question. */
async function followed(line: BimLine, text: string, now: Date, opts: { photos?: IncomingAttachment[] }): Promise<BimLine> {
  if (opts.photos?.length || line.wireId || line.dayId || line.choices?.length || line.status === "needs_clarify" || line.status === "error" || /^(STREAM|FOLLOW|DAY)/.test(line.route ?? "")) return line
  // A plain line of the stream (and a status report) is still read into the follow-through ledger, by rules, and its gap asked in one tap.
  try {
    if (!observeLine(text, now)) return line
    const q = nextQuestion(followLedger(), now)
    return q ? { ...line, text: `${line.text}\n\n${q.text}`, choices: q.choices } : line
  } catch {
    return line
  }
}

/** What the app already holds that the follow-through ledger can be read from. */
function mineSources(): MineSources {
  const said = useBimChatStore.getState().lines.filter((l) => l.who === "you").map((l) => ({ text: l.text, at: l.at }))
  const plans = Object.values(useReportStore.getState().plans).map((p) => ({ text: p.text, at: p.at }))
  return { texts: [...plans, ...said], overcome: useOvercomeStore.getState().log }
}

// ---------------------------------------------------------------- corrections

/**
 * The turn a correction would be about: what you sent, when, how BIM took it, and the executor line it
 * filed (if it filed one). In memory only: after a reload there is no last turn, so "no, yesterday" is a line again.
 */
type LastTurn = {
  said: string
  /** When the turn was sent; a correction must come soon after this. */
  sentAt: Date
  /** The time the write carries: the send time, or where a correction moved it. "At 3pm" keeps this day. */
  at: Date
  route?: string
  filed?: string
  filedAs?: string
}
let lastTurn: LastTurn | null = null

const executorSend = (text: string, now: Date) => ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString() }, now)
const correctLine = (text: string, extra: Partial<BimLine> = {}): BimLine => ({ id: lineId(), at: new Date().toISOString(), who: "bim", text, status: "ok", route: "CORRECT · code", ...extra })
const tookAs = (turn: LastTurn) => (turn.route?.split(" · ")[0] ?? "ladder").toLowerCase()

/** Undo the last write through the executor's own `undo`. False when something else changed since, so nothing was undone. */
async function undoLast(now: Date): Promise<boolean> {
  const result = await executorSend("undo", now)
  return /^Undid\b/.test(bimReplyText(result))
}

const CANT_UNDO = "I could not undo it: something else changed after that line, so I left everything as it is."

/**
 * The `correct` lane (`bim-correct.ts`): the line fixes BIM's last turn. Runs first, in code, and only when there
 * is a fresh last turn and nothing else is open. Null means the line is not a correction.
 */
async function tryCorrect(text: string, now: Date, opts: SendOpts): Promise<BimLine | null> {
  const turn = lastTurn
  if (!turn || now.getTime() - turn.sentAt.getTime() > CORRECT_TTL_MS || now.getTime() < turn.sentAt.getTime()) return null
  if (pendingAsk || pendingTell || awaitingFact || openMoneyQuestion() || useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)) return null
  const fix: Correction | null = parseCorrection(text, turn.at)
  if (!fix) return null
  // A money write or a cue is not an executor line, so it is taken back by the lane that made it.
  if (/^MONEY · (?:spend|earning|debt|settle|perk|verdict|receipt)/.test(turn.route ?? "")) {
    if (fix.kind === "undo") {
      lastTurn = null
      return correctLine(undoLastMoney(now) ?? "There is nothing recent of the Financial BIMBY's to undo.")
    }
    if (fix.kind === "when" && /^MONEY · (?:spend|earning)/.test(turn.route ?? "")) {
      if (fix.at.getTime() > now.getTime()) return correctLine(`${whenLabel(fix.at)} has not happened yet, so I left it where it is.`)
      if (!undoLastMoney(now)) return correctLine(CANT_UNDO, { status: "error" })
      const again = await tryMoney(turn.said, fix.at, { call: null })
      lastTurn = { ...turn, sentAt: now, at: fix.at }
      return correctLine(`Moved to ${whenLabel(fix.at)}.\n${again?.text ?? ""}`)
    }
    if (fix.kind !== "leave") return null
  }
  if (/^KEEP · cue/.test(turn.route ?? "") && fix.kind === "undo") {
    lastTurn = null
    return correctLine(undoLastCue(now) ?? "There is no recent reminder to undo.")
  }
  const did = turn.filed ? `I filed "${turn.said}"${turn.filedAs ? ` (${turn.filedAs})` : ""}.` : `I did not file "${turn.said}".`

  switch (fix.kind) {
    case "leave":
      lastTurn = null
      return correctLine("Okay, left as it is.")
    case "unsure": {
      const other = turn.filed ? { label: "it was a question", text: "that was a question" } : { label: "just log it", text: "just log it" }
      const choices = [...(turn.filed ? [{ label: "undo it", text: "undo that" }] : []), other, { label: "leave it", text: "leave it" }]
      return correctLine(`${did} What should change? You can also say when it was ("no, yesterday at 3pm").`, { status: "needs_clarify", choices })
    }
    case "undo": {
      if (!turn.filed) return correctLine(`${did} There is nothing to undo.`)
      if (!(await undoLast(now))) return correctLine(CANT_UNDO, { status: "error" })
      lastTurn = null
      return correctLine(`Undone. "${turn.said}" is no longer filed.`)
    }
    case "when": {
      if (!turn.filed) return correctLine(`${did} There is nothing to move.`)
      if (fix.at.getTime() > now.getTime()) return correctLine(`${whenLabel(fix.at)} has not happened yet, so I left it where it is.`)
      if (!(await undoLast(now))) return correctLine(CANT_UNDO, { status: "error" })
      // The same executor line, sent as if at the corrected time, so every verb moves the way it files.
      const result = await executorSend(turn.filed, fix.at)
      if (result.status !== "ok") {
        lastTurn = null
        return correctLine(`I undid it but could not file it again at ${whenLabel(fix.at)}: ${bimReplyText(result)}`, { status: "error" })
      }
      lastTurn = { ...turn, sentAt: now, at: fix.at }
      return correctLine(`Moved to ${whenLabel(fix.at)}.\n${bimReplyText(result)}`, { kind: result.kind })
    }
    case "is-log": {
      if (turn.filed) return correctLine(`${did} It is already filed.`)
      const result = await executorSend(`log: ${turn.said}`, turn.at)
      recordRouteVerdict({ text: turn.said, was: tookAs(turn), shouldBe: "log", at: now.toISOString() })
      lastTurn = result.status === "ok" ? { ...turn, sentAt: now, filed: `log: ${turn.said}`, filedAs: result.kind } : null
      return correctLine(`Filed it, and I will take those words as a log line from now on.\n${bimReplyText(result)}`, { status: result.status, kind: result.kind })
    }
    case "is-ask": {
      if (!turn.filed) return correctLine(`${did} Ask it again and I will answer.`)
      if (!(await undoLast(now))) return correctLine(CANT_UNDO, { status: "error" })
      recordRouteVerdict({ text: turn.said, was: tookAs(turn), shouldBe: "ask", at: now.toISOString() })
      lastTurn = null
      const answer = await sendLine(/\?\s*$/.test(turn.said) ? turn.said : `${turn.said}?`, now, opts)
      return { ...answer, text: `Undone, and I will take those words as a question from now on.\n\n${answer.text}` }
    }
  }
}

/** The writes this chat's executor applied after `newestBefore`, newest first. The ingest log is newest first: everything ahead of that event is new. */
function writesSince(newestBefore: string | undefined) {
  const events = useIngestStore.getState().events
  const cut = newestBefore ? events.findIndex((e) => e.id === newestBefore) : -1
  return (cut < 0 ? (newestBefore ? [] : events) : events.slice(0, cut)).filter((e) => e.chatId === BIM_CHAT_ID && e.status === "applied" && isWriteKind(e.kind))
}

/** Remember this turn for the `correct` lane: the executor line it filed is the newest applied event the send added. */
function noteTurn(said: string, now: Date, line: BimLine, newestBefore: string | undefined): void {
  if (line.status === "error" || line.status === "needs_clarify" || line.reportId || line.wireId || line.dayId || line.habitLineId || /^DAY/.test(line.route ?? "")) {
    lastTurn = null
    return
  }
  const wrote = writesSince(newestBefore)[0]
  lastTurn = { said, sentAt: now, at: now, ...(line.route ? { route: line.route } : {}), ...(wrote ? { filed: wrote.raw, filedAs: wrote.kind } : {}) }
}

// ---------------------------------------------------------------- lanes

type SendOpts = { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[]; rec?: TraceRecorder }
type LaneCtx = { text: string; now: Date; opts: SendOpts }

const bimLine = (text: string, extra: Partial<BimLine> = {}): BimLine => ({ id: lineId(), at: new Date().toISOString(), who: "bim", text, status: "ok", ...extra })
const executorHolds = () => !!useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)

/** What each lane guard (`bim-lanes.ts`) means right now. Read when the lane comes up: `tell` closes the tell question as it runs. */
function guardHolds(guard: LaneGuard, ctx: LaneCtx): boolean {
  switch (guard) {
    case "tell-open":
      return !!pendingTell
    case "question-open":
      return executorHolds()
    case "verb":
      return looksLikeVerb(ctx.text, ctx.now)
  }
}

/**
 * The last lane. With `llm`, a line the ladder would only capture is routed first (`bim-switchboard.ts`): a
 * question is answered and not filed. Then the bot's executor. Without `llm` this is the grammar ladder alone.
 */
async function ladderLane({ text, now, opts }: LaneCtx): Promise<BimLine> {
  const heldBefore = executorHolds()
  let board = opts.llm ? await runSwitchboard(text, now, BIM_CHAT_SOURCE, opts.lastBim, { turns: earlierTurns(text) }) : null
  if (board?.chat && !board.passThrough) return chatLine(board, text)
  if (board?.answer && !board.passThrough) return answerLine(board, text)
  if (board?.failed && !board.passThrough) return failedLine(board)
  let result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString() }, now)
  // The ladder gave up on a line (a start, mood, or place it could not finish). With LLM on, the
  // router gets it before it becomes a question for you: a sure ask is answered, a sure log is filed.
  if (opts.llm && !board && !heldBefore && result.status === "needs_clarify" && RESCUABLE.has(result.pending.kind)) {
    const second = await runSwitchboard(text, now, BIM_CHAT_SOURCE, opts.lastBim, { force: true, turns: earlierTurns(text) })
    if (second?.chat && !second.passThrough) {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      return chatLine(second, text)
    }
    if (second?.sure && second.answer && !second.passThrough) {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      return answerLine(second, text)
    }
    if (second?.sure && second.intent === "log") {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: `log: ${text}`, receivedAt: now.toISOString() }, now)
    }
    board = second
  }
  const choices = bimChoices(result)
  // LLM on, but no model answered: the ladder's "needs LLM on" would be wrong.
  const filed = opts.llm && !board && "summary" in result && result.summary === "Question, not filed" ? NO_MODELS : bimReplyText(result)
  return bimLine(board?.answer ? `${filed}\n\n${board.answer.text}` : filed, {
    status: result.status,
    kind: result.kind,
    ...(choices.length ? { choices } : {}),
    ...(board ? { route: board.route } : {}),
    ...(board?.answer?.evidence.length ? { evidence: board.answer.evidence } : {}),
  })
}

/**
 * A body for every lane in `CHAT_LANES`. The order, the guards and what each lane is for live in that table;
 * this is only what each one runs. A body returns null to leave the line for the next lane.
 */
const LANE_BODIES: Record<ChatLaneId, LaneBody<LaneCtx, BimLine>> = {
  handoff: async ({ text }) => {
    const handed = await tryHandoff(text)
    return handed ? bimLine(handed.text, { route: handed.route, ...(handed.habitLineId ? { habitLineId: handed.habitLineId } : {}), ...(handed.reportId ? { reportId: handed.reportId } : {}) }) : null
  },
  "ask-back": ({ text, now }) => answerAskBack(text, now),
  "follow-through": ({ text, now }) => {
    const followed = tryFollowAnswer(text, now) ?? tryFollowCommand(text, now, mineSources)
    return followed ? bimLine(followed.text, { route: followed.route, ...(followed.choices.length ? { choices: followed.choices } : {}) }) : null
  },
  "flight-file": ({ text, now }) => tryFlights(text, now),
  keep: async ({ text, now }) => {
    // "stop reminding me about …" starts with one of the executor's words, so the cue commands are read before the verb check.
    const said = tryCueCommand(text, now) ?? (looksLikeVerb(text, now) ? null : tryKeepCue(text, now))
    if (said) return bimLine(said.text, { route: said.route, kind: "tell" })
    if (looksLikeVerb(text, now)) return null
    const todo = parseKeepTodo(text)
    if (!todo) return null
    // Through the executor's own `todo today`, sent as if on that day, so `undo` and the To Do pin work as for a typed command.
    const day = new Date(now)
    day.setDate(day.getDate() + todo.dayOffset)
    const result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: `todo today: ${todo.what}`, receivedAt: day.toISOString() }, day)
    const where = todo.dayOffset ? "tomorrow's To Do" : "today's To Do"
    const reply = result.status === "ok" ? `On ${where}: ${todo.what}.` : bimReplyText(result)
    return bimLine(reply, { status: result.status, kind: result.kind, route: "KEEP · to do · code" })
  },
  money: async ({ text, now, opts }) => {
    // An open question of the BIMBY's is only answered by the very next line, the one under the question.
    const answering = /Did you use it\?|keep your words with it/.test(opts.lastBim ?? "")
    const money = await tryMoney(text, now, { llm: !!opts.llm, ...(opts.llm ? {} : { call: null }), answering })
    return money ? bimLine(money.text, { route: money.route, kind: "tell", ...(money.choices?.length ? { choices: money.choices } : {}) }) : null
  },
  "flight-ask": ({ text, now }) => {
    const flown = answerFlightQuestion(text, now, useTaskStore.getState().tasks)
    return flown ? bimLine(flown, { kind: "tell" }) : null
  },
  day: async ({ text, now, opts }) => {
    const day = await tryDay(text, now, { llm: !!opts.llm, lastBim: opts.lastBim })
    return day ? bimLine(day.text, { route: day.route, ...(day.dayId ? { dayId: day.dayId } : {}), ...(day.choices?.length ? { choices: day.choices } : {}) }) : null
  },
  stream: async ({ text, now, opts }) => {
    const stream = await tryStream(text, now, { llm: !!opts.llm })
    return stream ? bimLine(stream.text, { route: stream.route, reportId: stream.reportId, ...(stream.choices?.length ? { choices: stream.choices } : {}) }) : null
  },
  social: ({ text, now }) => {
    const social = trySocial(text, now)
    return social ? bimLine(social.text, { route: social.route, reportId: social.reportId }) : null
  },
  texts: ({ text, now, opts }) => tryTexts(text, now, !!opts.llm),
  fact: ({ text, now }) => tryFact(text, now),
  tell: ({ text, now }) => tryTell(text, now),
  wire: ({ text, now }) => {
    const wired = tryWire(text, now)
    return wired ? bimLine(wired.text, { route: wired.route, wireId: wired.wireId }) : null
  },
  "habit-auto": async ({ text, now }) => {
    const handed = await tryHabitAuto(text, now, looksLikeVerb(text, now))
    return handed ? bimLine(handed.text, { route: handed.route, ...(handed.habitLineId ? { habitLineId: handed.habitLineId } : {}) }) : null
  },
  report: async ({ text, now }) => {
    const report = await tryReport(text, now)
    return report ? bimLine(report.text, { route: report.route, reportId: report.reportId }) : null
  },
  "resistance-outcome": async ({ text, now, opts }) => {
    const outcome = tryResistanceOutcome(text) ?? (await tryResistanceWhy(text, !!opts.llm, now))
    return outcome ? resistanceLine(outcome) : null
  },
  resistance: async ({ text, now, opts }) => {
    if (!routable(text, false, now)) return null
    const resisting = await tryResistance(text, !!opts.llm, now)
    return resisting ? resistanceLine(resisting, true) : null
  },
  ladder: ladderLane,
}

/**
 * One turn, with its Trace (`lib/agents/trace.ts`): the correction read, the thread's reading, every lane
 * tried, what was written and why it stopped. The Trace is kept (`trace-store.ts`) and its id rides on the reply.
 */
async function routeToBim(
  text: string,
  now: Date,
  opts: { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[] },
): Promise<BimLine> {
  const rec = recorder({ blueprint: { id: BIM_CHAT_AGENT_ID, rev: BIM_CHAT_REV }, input: text, origin: "app" })
  const newestBefore = useIngestStore.getState().events[0]?.id
  const close = (line: BimLine): BimLine => {
    try {
      const stop: StopReason = line.status === "error" ? "error" : line.status === "needs_clarify" ? "needs-person" : "done"
      const proposals = line.reportId || line.wireId || line.dayId || line.habitLineId ? 1 : 0
      saveTrace(rec.finish(stop, { text: line.text, proposals, wrote: writesSince(newestBefore).map((e) => e.kind ?? "write") }))
    } catch {}
    return { ...line, traceId: rec.id }
  }
  if (!opts.photos?.length) {
    const t0 = rec.clock()
    const fixed = await tryCorrect(text, now, { ...opts, rec }).catch(() => null)
    rec.add({ kind: "decision", actor: "correct", status: fixed ? "ok" : "pass", t0, ...(fixed?.route ? { note: fixed.route } : {}) })
    if (fixed) return close(fixed)
  }
  let read: ReturnType<typeof followUp> = null
  try {
    read = opts.photos?.length ? null : followUp(text, now)
  } catch {
    read = null
  }
  if (read) rec.add({ kind: "decision", actor: "thread", status: "pass", note: `read as: ${read.text}` })
  const asked = read?.text ?? text
  const line = await sendLine(asked, now, { ...opts, rec })
  if (!opts.photos?.length && line.status !== "error" && looksLikeFactQuestion(asked)) {
    useBimThread.getState().setFocus({ question: asked.trim(), at: now.getTime() })
  }
  if (!opts.photos?.length) noteTurn(asked, now, line, newestBefore)
  return close(read ? { ...line, readAs: read.text } : line)
}

/**
 * Run one line through the bot's executor. Never throws. With `llm`, a line the
 * ladder would only capture is routed first (`bim-switchboard.ts`); a question
 * is answered and not filed. Without it, this is the grammar ladder alone.
 */
async function sendLine(text: string, now = new Date(), opts: SendOpts = {}): Promise<BimLine> {
  try {
    // A photo and its caption go straight to the executor, as on Telegram: no tell, no router.
    if (opts.photos?.length) {
      // A receipt for a purchase (its caption is a spend, or names one, or one was just told) is the Financial BIMBY's.
      const receipt = await tryMoneyPhoto(text, opts.photos, now, { llm: !!opts.llm }).catch(() => null)
      if (receipt) {
        opts.rec?.add({ kind: "decision", actor: "money", status: "ok", agent: "finance-bimby", note: receipt.route })
        return bimLine(receipt.text, { route: receipt.route, kind: "tell", ...(receipt.choices?.length ? { choices: receipt.choices } : {}) })
      }
      const t0 = opts.rec?.clock()
      const result = await ingestIncomingAsync(
        { source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString(), attachments: opts.photos },
        now,
      )
      opts.rec?.add({ kind: "decision", actor: "photo", status: "ok", t0, note: result.kind })
      const choices = bimChoices(result)
      return bimLine(bimReplyText(result), { status: result.status, kind: result.kind, ...(choices.length ? { choices } : {}) })
    }
    const ctx: LaneCtx = { text, now, opts }
    const hit = await runLanes(CHAT_LANES, LANE_BODIES, ctx, {
      is: (guard) => guardHolds(guard, ctx),
      rec: opts.rec,
      note: (line) => line.route ?? line.kind,
    })
    // The ladder is last and always answers, so this is only reached if the lane list is ever cut short.
    return hit?.line ?? (await LANE_BODIES.ladder(ctx))!
  } catch (error) {
    return bimLine(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: "error" })
  }
}

type BimChatState = {
  lines: BimLine[]
  busy: boolean
  send: (text: string, photos?: IncomingAttachment[]) => Promise<void>
  /** BIM asks you something (a check-in). Without `kind` it alternates doing and mood. */
  checkIn: (kind?: "doing" | "mood") => void
  clear: () => void
}

export const useBimChatStore = create<BimChatState>()(
  persist(
    (set, get) => ({
      lines: [],
      busy: false,
      send: async (raw, photos = []) => {
        const text = raw.trim()
        if ((!text && !photos.length) || get().busy) return
        const tag = photos.length ? `📷 ${photos.length === 1 ? "photo" : `${photos.length} photos`}` : ""
        const mine: BimLine = { id: lineId(), at: new Date().toISOString(), who: "you", text: [tag, text].filter(Boolean).join(" · ") }
        set((s) => ({ busy: true, lines: [...s.lines, mine].slice(-TRANSCRIPT_CAP) }))
        let reply: BimLine
        try {
          const lastBim = [...get().lines].reverse().find((l) => l.who === "bim")?.text
          reply = await sendToBim(text, new Date(), { llm: useBimLlmMode.getState().on, lastBim, photos })
        } catch (error) {
          reply = {
            id: lineId(),
            at: new Date().toISOString(),
            who: "bim",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            status: "error",
          }
        }
        set((s) => ({ busy: false, lines: [...s.lines, reply].slice(-TRANSCRIPT_CAP) }))
      },
      checkIn: (kind) => {
        if (get().busy) return
        const line = checkInLine(kind)
        set((s) => ({ lines: [...s.lines, line].slice(-TRANSCRIPT_CAP) }))
      },
      clear: () => {
        pendingAsk = null
        lastTurn = null
        useBimThread.getState().setFocus(null)
        set({ lines: [] })
      },
    }),
    {
      name: TRANSCRIPT_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
)
