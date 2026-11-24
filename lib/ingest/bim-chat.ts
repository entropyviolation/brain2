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
import { groundLine } from "@/lib/bim-flow/chat-lane"
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
import { readDayStream, sinceDate, type GrammarPiece } from "./bim-grammar"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { fireCues, parseKeepTodo, parseKeepTodos, takeTidy, TODO_TIDY_SCHEMA, TODO_TIDY_SYSTEM, tryCueCommand, tryKeepCue, undoLastCue, type KeepTodo } from "./bim-keep"
import { undoLastMoney } from "@/lib/finance-bimby/apply"
import { openMoneyQuestion, tryMoney, tryMoneyPhoto } from "@/lib/finance-bimby/run"
import { undoLastFood } from "@/lib/food-bimby/apply"
import { tryFood } from "@/lib/food-bimby/run"
import { tryDayLog } from "@/lib/day-log-bimby/run"
import { escalate } from "@/lib/bim-flow/crew"
import { CHAT_LANES, runLanes, type ChatLaneId, type LaneBody, type LaneGuard } from "./bim-lanes"
import { BIM_CHAT_AGENT_ID, BIM_CHAT_REV } from "@/lib/agents/adapters/bim-chat"
import { recorder, type EventDraft, type StopReason, type TraceOrigin, type TraceRecorder } from "@/lib/agents/trace"
import { saveTrace } from "@/lib/agents/trace-store"
import { answerTextQuestion, mentionsTexts, namedPeople, TEXTS_ASK_DAYS } from "./bim-texts"
import { readMark } from "./bim-mark"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall, watchModelCalls, type ModelCallSeen } from "@/lib/bim-flow/ollama"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { ingestIncomingAsync } from "./executor"
import { claimsPeriodSongFollowUp } from "./apply-period-song"
import { makeIngestEventId, useIngestStore } from "./ingest-store"
import { looksLikeVerb } from "./parse-message"
import { isWriteKind } from "./phone-undo"
import { createChatQueue } from "./chat-queue"
import { tryReport } from "@/lib/report-bimby/run"
import { tryCommands } from "@/lib/commands-bimby/run"
import { liveSessionDeps, trySocial } from "@/lib/social-bimby/run"
import { trySocialFollow } from "@/lib/social-bimby/session"
import { tryStream } from "@/lib/stream-bimby/run"
import { tryWire } from "@/lib/wire-bimby/run"
import { tryDay } from "@/lib/plan-bimby/day/run"
import { answerWeb, looksLikeWebQuestion, takeHome, type WebAnswer } from "@/lib/bim-flow/web-ask"
import type { WebSearch } from "@/lib/bim-flow/web-lane"
import { replyToCard } from "@/lib/report-bimby/card-reply"
import type { CardRef } from "@/lib/report-bimby/reply-target"
import { splitAside } from "@/lib/bim-flow/web-lane"
import { answerSelf } from "./bim-self"
import { tryCoach, tryRemind } from "@/lib/coach-bimby/apply"
import { learnFromLine } from "@/lib/coach-bimby/learn"
import { parseCoachAsk } from "@/lib/coach-bimby/read"
import { nextQuestion } from "@/lib/follow-through/ask"
import { observeLine, tryFollowAnswer, tryFollowCommand, type MineSources } from "@/lib/follow-through/run"
import { followLedger } from "@/lib/follow-through/store"
import { useOvercomeStore } from "@/lib/overcome-bimby/store"
import { useReportStore } from "@/lib/report-bimby/store"
import { choiceTextFromCallback, inlineKeyboardForResult } from "./telegram-ui.mjs"
import type { ApplyResult, IncomingAttachment, IngestIntentKind, IngestSource } from "./types"

export const BIM_CHAT_ID = "bim-chat"

/** BIM chat's turns, one at a time in send order. */
const bimTurns = createChatQueue()
/** The longest one turn may hold the queue: well past every lane's own cap (Stream's long reads included). */
export const TURN_LIMIT_MS = 180_000
export const BIM_CHAT_SOURCE: IngestSource = { channel: "simulate", chatId: BIM_CHAT_ID }
const TRANSCRIPT_KEY = "bimchat-transcript"
const TRANSCRIPT_CAP = 400
/** Past conversations kept on the device, newest first. The open one is not counted. */
const CONVO_CAP = 30

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
  /** A reply slot whose turn has not finished: the line is queued or running. The finished reply takes its place. */
  waiting?: boolean
  /** On a reply: the id of the line of yours it answers. */
  replyTo?: string
  /** On a line of yours: the card change it replies to ("BIRTHDAY · Nico's birthday", `lib/report-bimby/reply-target.ts`). */
  aboutCard?: string
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
 * seeing Marilyn?"). In memory only: a reload forgets the question, not the answer.
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
 * "What was Marilyn talking about in her last text to me?" (`bim-texts.ts`). Answered from the hub's texts, in ROUTER and
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

/**
 * The notes could not answer a question that is not about you ("how do I convert Celsius to Fahrenheit?"): look it
 * up on the web instead of saying "I don't know" and asking you. A question with "I/my", a time, or anything the
 * vault knows by name in it is about your own data and still asks you. Null keeps the "I don't know" line; so does a failed search.
 */
async function webInstead(board: SwitchboardResult, question: string, now: Date): Promise<BimLine | null> {
  if (!board.answer || !UNSURE.has(board.answer.confidence) || !/\?\s*$/.test(question.trim())) return null
  const g = groundLine(snapshotFromStores(), question, now)
  if (g.self || g.timed || g.mentions.length) return null
  try {
    const web = await answerWeb(question, now, { llm: true })
    if (web.askedHome || /^I could not search the web/.test(web.text)) return web.askedHome ? webLine(web) : null
    return bimLine(web.text, { route: `${board.route} · notes unsure → ${web.route}`, kind: "tell", ...(web.evidence.length ? { evidence: web.evidence } : {}) })
  } catch {
    return null
  }
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
  // Up to this line's own turn: lines sent after it (queued) and reply slots still waiting are not context.
  const all = convoLinesWhere((ls) => ls.some((l, i) => l.who === "you" && l.text === text && ls[i + 1]?.waiting))
  const mine = all.findIndex((l, i) => l.who === "you" && l.text === text && all[i + 1]?.waiting)
  const before = (mine >= 0 ? all.slice(0, mine) : all.filter((l, i) => !(i === all.length - 1 && l.who === "you" && l.text === text))).filter((l) => !l.waiting)
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
  opts: { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[]; origin?: TraceOrigin; about?: CardRef; search?: WebSearch } = {},
): Promise<BimLine> {
  // One Trace for the whole turn, the follow-through read and the cues included. Every model call made while the
  // turn runs is an event of its own, named by the stage that asked (`turn.stage`), so `cost.calls` is the real count.
  const rec = recorder({ blueprint: { id: BIM_CHAT_AGENT_ID, rev: BIM_CHAT_REV }, input: text, origin: opts.origin ?? "app" })
  const turn: TurnStage = { stage: "correct" }
  const unwatch = watchModelCalls((call) => rec.add(modelEvent(call, turn.stage, rec.clock())))
  const newestBefore = useIngestStore.getState().events[0]?.id
  let learn = false
  const close = (line: BimLine): BimLine => {
    try {
      const stop: StopReason = line.status === "error" ? "error" : line.status === "needs_clarify" ? "needs-person" : "done"
      const proposals = line.reportId || line.wireId || line.dayId || line.habitLineId ? 1 : 0
      saveTrace(rec.finish(stop, { text: line.text, proposals, wrote: writesSince(newestBefore).map((e) => e.kind ?? "write") }))
    } catch {}
    return { ...line, traceId: rec.id }
  }
  try {
    // A line sent as a reply to one change on a card goes to the Card Reply BIMBY first (`lib/report-bimby/card-reply.ts`).
    if (opts.about) {
      turn.stage = "card-reply"
      const t0 = rec.clock()
      const replied = await replyToCard(text, opts.about, now, { search: opts.search }).catch(() => null)
      rec.add({ kind: "tool-call", actor: "card-reply", status: replied ? "ok" : "pass", t0 })
      if (replied) return close(bimLine(replied.text, { route: replied.route, ...(replied.reportId ? { reportId: replied.reportId } : {}), ...(replied.evidence?.length ? { evidence: replied.evidence } : {}) }))
      turn.stage = "correct"
    }
    const routed = await routeToBim(text, now, { ...opts, rec, turn }, newestBefore)
    turn.stage = "follow-through"
    let t0 = rec.clock()
    const line = await followed(routed, text, now, opts)
    rec.add({ kind: "tool-call", actor: "follow-through", status: line === routed ? "pass" : "ok", t0 })
    // BIM learns lasting things about you from what you say, after the reply, off the turn (`lib/coach-bimby/learn.ts`).
    // Started in `finally`, once this turn's Trace stops counting model calls.
    learn = !!opts.llm && !opts.photos?.length && line.status !== "error" && !/^(ME|COACH|REMIND)\b/.test(line.route ?? "")
    // A cue (“remind me if I'm thinking about ordering food”) is checked against every line, after BIM has answered it.
    if (opts.photos?.length || line.status === "error" || /^(KEEP|CORRECT)/.test(line.route ?? "")) return close(line)
    turn.stage = "cues"
    t0 = rec.clock()
    try {
      const cued = await fireCues(text, now, opts.llm ? cueGate : undefined)
      rec.add({ kind: "tool-call", actor: "cues", status: cued ? "ok" : "pass", t0 })
      return close(cued ? { ...line, text: `${line.text}\n\n${cued.text}`, ...(line.choices?.length ? {} : { choices: cued.choices }) } : line)
    } catch {
      rec.add({ kind: "tool-call", actor: "cues", status: "error", t0 })
      return close(line)
    }
  } finally {
    unwatch()
    if (learn) void learnQuietly(text, now)
  }
}

/**
 * The Coach BIMBY's quiet read of one line, on the main model (the 3B returned nothing for "i'm a freelance
 * illustrator and my sister dana is visiting"; the 14B kept both and nothing from moods or errands). Never throws,
 * never holds the turn.
 */
async function learnQuietly(text: string, now: Date): Promise<void> {
  try {
    const crew = await chatCrew()
    if (!crew) return
    const model = crew.main
    await learnFromLine(text, ollamaCall(model, AbortSignal.timeout(60_000)), model, now)
  } catch {
    /* learning is a bonus */
  }
}

/** The stage of a turn that is running now, so a model call can say who asked for it. */
type TurnStage = { stage: string }

/** A model call as a Trace event: `t0` is when it started, the note says why it took that long (load, prompt, answer). */
function modelEvent(call: ModelCallSeen, actor: string, at: number): EventDraft {
  const parts = [call.task]
  if (call.cached) parts.push("cached")
  if (call.loadMs) parts.push(`load ${call.loadMs}ms`)
  if (call.promptMs) parts.push(`prompt ${call.promptMs}ms`)
  if (call.evalMs) parts.push(`answer ${call.evalMs}ms`)
  if (call.error) parts.push(call.error)
  return {
    kind: "model-reply",
    actor,
    model: call.model,
    status: call.ok ? "ok" : "error",
    t0: Math.max(0, at - call.ms),
    t1: at,
    note: parts.join(" · "),
    data: { ...(call.loadMs !== undefined ? { loadMs: call.loadMs } : {}), ...(call.promptMs !== undefined ? { promptMs: call.promptMs } : {}), ...(call.evalMs !== undefined ? { evalMs: call.evalMs } : {}), ...(call.cached ? { cached: true } : {}) },
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
  if (opts.photos?.length || line.wireId || line.dayId || line.choices?.length || line.status === "needs_clarify" || line.status === "error" || /^(STREAM|FOLLOW|DAY|SOCIAL)/.test(line.route ?? "")) return line
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
  const said = allBimLines().filter((l) => l.who === "you").map((l) => ({ text: l.text, at: l.at }))
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
  if (/^FOOD · logged/.test(turn.route ?? "") && fix.kind === "undo") {
    lastTurn = null
    return correctLine(undoLastFood(now) ?? "There is nothing recent of the Food BIMBY's to undo.")
  }
  if (/^FOOD · logged/.test(turn.route ?? "") && fix.kind === "when") {
    return correctLine("Each food entry kept the day it was eaten. To move one, open it in Tracking → Food, or say “undo that” and tell me again with the day.")
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

type SendOpts = { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[]; rec?: TraceRecorder; turn?: TurnStage }
type LaneCtx = { text: string; now: Date; opts: SendOpts }

const bimLine = (text: string, extra: Partial<BimLine> = {}): BimLine => ({ id: lineId(), at: new Date().toISOString(), who: "bim", text, status: "ok", ...extra })
const executorHolds = () => !!useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)

const webLine = (a: WebAnswer): BimLine => bimLine(a.text, { route: a.route, kind: "tell", ...(a.evidence.length ? { evidence: a.evidence } : {}) })

/**
 * A to-do said beside a web question ("i prob will have to do my laundry can you find out what time …?", `splitAside`).
 * It is only offered, as one key that sends the executor's own `todo today:`; nothing is filed until it is tapped.
 * While BIM waits for home, the to-do waits here and is offered with the answer. In memory only.
 */
let asideTodo: string | null = null
const withTodo = (line: BimLine, todo: string | null | undefined): BimLine =>
  todo ? { ...line, text: `${line.text}\n\nPut "${todo}" on today's To Do?`, choices: [...(line.choices ?? []), { label: `add to do: ${todo}`, text: `todo today: ${todo}` }] } : line

/** A web answer that comes after the line that asked for it (the day plan's kept question). Appended when it is ready. */
async function followWithWeb(question: string, now: Date, llm: boolean, afterDayId?: string): Promise<void> {
  let line: BimLine
  try {
    line = webLine(await answerWeb(question, now, { llm }))
  } catch (error) {
    line = bimLine(`The web search failed: ${error instanceof Error ? error.message : String(error)}`, { status: "error" })
  }
  // `send` adds the line that asked only once `sendToBim` returns; wait for it (up to 10 s) so this one lands under it.
  const hasDay = (st: BimChatState) => [st.lines, ...st.past.map((c) => c.lines)].some((ls) => ls.some((l) => l.dayId === afterDayId))
  if (afterDayId && !hasDay(useBimChatStore.getState())) {
    await new Promise<void>((done) => {
      const timer = setTimeout(() => (stop(), done()), 10_000)
      const stop = useBimChatStore.subscribe((st) => {
        if (hasDay(st)) (clearTimeout(timer), stop(), done())
      })
    })
  }
  // Into the conversation the day line is in, even if another one is open now.
  useBimChatStore.setState((s) => inConvo(s, (ls) => !!afterDayId && ls.some((l) => l.dayId === afterDayId), (ls) => [...ls, line].slice(-TRANSCRIPT_CAP)))
}

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
  // The ladder's own stages (the switchboard's crew check, router, Ask or chat lane, then the executor's write) are
  // events of their own, so a slow turn shows where its time went instead of one long `ladder` step.
  const stage = (name: string) => {
    if (opts.turn) opts.turn.stage = `ladder:${name}`
  }
  const timed = async <T,>(name: string, run: () => Promise<T>, note?: (out: T) => string | undefined): Promise<T> => {
    const t0 = opts.rec?.clock()
    stage(name)
    const out = await run()
    const said = note?.(out)
    opts.rec?.add({ kind: "tool-call", actor: `ladder:${name}`, status: "ok", t0, ...(said ? { note: said } : {}) })
    return out
  }
  const switchboard = (force: boolean) =>
    timed(
      "switchboard",
      () => runSwitchboard(text, now, BIM_CHAT_SOURCE, opts.lastBim, { ...(force ? { force } : {}), turns: earlierTurns(text), stage, rec: opts.rec }),
      (b) => b?.route ?? "not routed",
    )
  const execute = (said: string) => timed("executor", () => ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: said, receivedAt: now.toISOString() }, now), (r) => `${r.status} · ${r.kind}`)
  let board = opts.llm ? await switchboard(false) : null
  if (board?.chat && !board.passThrough) return chatLine(board, text)
  if (board?.answer && !board.passThrough) return (await webInstead(board, text, now)) ?? answerLine(board, text)
  if (board?.failed && !board.passThrough) return failedLine(board)
  let result = await execute(text)
  // The ladder gave up on a line (a start, mood, or place it could not finish). With LLM on, the
  // router gets it before it becomes a question for you: a sure ask is answered, a sure log is filed.
  if (opts.llm && !board && !heldBefore && result.status === "needs_clarify" && RESCUABLE.has(result.pending.kind)) {
    const second = await switchboard(true)
    if (second?.chat && !second.passThrough) {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      return chatLine(second, text)
    }
    if (second?.sure && second.answer && !second.passThrough) {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      return (await webInstead(second, text, now)) ?? answerLine(second, text)
    }
    if (second?.sure && second.intent === "log") {
      useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
      result = await execute(`log: ${text}`)
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

/** Your To Do words with the spelling mended by the main model, each fix checked (`takeTidy`). No model: your words. */
async function tidyTodos(said: string[], llm: boolean): Promise<string[]> {
  const plain = takeTidy(said, null)
  if (!llm) return plain
  try {
    const crew = await chatCrew()
    if (!crew) return plain
    const out = await ollamaCall(crew.main, AbortSignal.timeout(25_000))({
      model: crew.main,
      system: TODO_TIDY_SYSTEM,
      user: said.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      schema: TODO_TIDY_SCHEMA,
      maxTokens: 60 + said.length * 40,
      temperature: 0,
    })
    return takeTidy(said, out)
  } catch {
    return plain
  }
}

/**
 * "to do later X to do later Y" (`parseKeepTodos`): each To Do through the executor's own `todo today`, sent as if on
 * its day, so the To Do pin works as for a typed command. `undo` takes back the last one.
 */
async function keepTodos(todos: KeepTodo[], now: Date, llm: boolean): Promise<BimLine> {
  const names = await tidyTodos(todos.map((t) => t.what), llm)
  const done: string[] = []
  const failed: string[] = []
  let kind: BimLine["kind"]
  for (const [i, t] of todos.entries()) {
    const day = new Date(now)
    day.setDate(day.getDate() + t.dayOffset)
    const result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: `todo today: ${names[i]}`, receivedAt: day.toISOString() }, day)
    kind = result.kind
    ;(result.status === "ok" ? done : failed).push(`${names[i]}${t.dayOffset ? " (tomorrow)" : ""}`)
  }
  const where = todos.every((t) => t.dayOffset) ? "tomorrow's To Do" : "your To Do"
  const lines = [`Added ${done.length} to ${where}:`, ...done.map((d) => `• ${d}`)]
  if (failed.length) lines.push("", `Could not add: ${failed.join("; ")}`)
  const fixed = names.some((n, i) => n.toLowerCase() !== todos[i]!.what.toLowerCase())
  if (fixed) lines.push("", "Spelling fixed from what you typed.")
  return bimLine(lines.join("\n"), { status: failed.length && !done.length ? "error" : "ok", kind, route: `KEEP · to do ×${todos.length} · code${fixed ? " · spelling" : ""}` })
}

/** An Activity pen the words name ("clean house" → the pen "Cleaning"), so a new wording does not make a new pen. */
function activityPenName(what: string): string {
  const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")?.pens ?? []
  const said = what.toLowerCase()
  const stem = (w: string) => w.replace(/(?:ing|ed|s)$/, "")
  const saidStems = said.split(/\s+/).map(stem)
  const hit =
    pens.find((p) => p.name.trim().toLowerCase() === said) ??
    pens.find((p) => {
      const name = p.name.trim().toLowerCase()
      return name.length >= 3 && (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(said) || (!name.includes(" ") && saidStems.includes(stem(name))))
    })
  return hit?.name ?? what
}

/** The executor command for one piece of a day-stream line, and the moment it is sent as. */
function grammarCommand(piece: GrammarPiece, now: Date): { text: string; at: Date } {
  switch (piece.kind) {
    case "todo": {
      const day = new Date(now)
      day.setDate(day.getDate() + piece.dayOffset)
      return { text: `todo today: ${piece.what}`, at: day }
    }
    case "want":
      return { text: `needed: ${piece.what}`, at: now }
    case "intake":
      return { text: `intake ${piece.cls}: ${piece.what}`, at: now }
    case "start":
      return { text: `currently ${activityPenName(piece.what)}`, at: piece.since ? sinceDate(piece.since, now) : now }
    case "stop":
      return { text: `stopped ${activityPenName(piece.what)}`, at: now }
    case "habit":
      return { text: `did: ${piece.what}${piece.note ? ` -- ${piece.note}` : ""}`, at: now }
    case "rest":
      return { text: `log: ${piece.what}`, at: now }
  }
}

/**
 * The day-stream grammar (`bim-grammar.ts`): each part of the line through the executor as BIM's own command, so
 * `undo` and the pins work as for a typed one. A stop with nothing open to stop is kept as a log line instead.
 */
async function grammarLine(pieces: GrammarPiece[], now: Date): Promise<BimLine> {
  const said: string[] = []
  const kinds: string[] = []
  let status: BimLine["status"] = "ok"
  let kind: IngestIntentKind | undefined
  for (const piece of pieces) {
    const cmd = grammarCommand(piece, now)
    let result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text: cmd.text, receivedAt: cmd.at.toISOString() }, cmd.at)
    if (piece.kind === "stop" && result.status !== "ok") result = await executorSend(`log: done with ${piece.what}`, now)
    if (result.status !== "ok") status = result.status
    kind ??= result.kind
    kinds.push(piece.kind === "stop" && result.kind !== "stopped-activity" ? "log" : piece.kind)
    said.push(bimReplyText(result))
  }
  const lanes = [...new Set(kinds)].join(", ")
  return bimLine(said.join("\n"), { status, ...(kind ? { kind } : {}), route: `GRAMMAR · ${lanes} · code` })
}

/**
 * A body for every lane in `CHAT_LANES`. The order, the guards and what each lane is for live in that table;
 * this is only what each one runs. A body returns null to leave the line for the next lane.
 */
const LANE_BODIES: Record<ChatLaneId, LaneBody<LaneCtx, BimLine>> = {
  handoff: async ({ text, opts }) => {
    // LLM off means no model anywhere in the turn, the BIMBY handed to included: it runs its rules alone.
    const handed = await tryHandoff(text, { llm: !!opts.llm })
    return handed ? bimLine(handed.text, { route: handed.route, ...(handed.habitLineId ? { habitLineId: handed.habitLineId } : {}), ...(handed.reportId ? { reportId: handed.reportId } : {}) }) : null
  },
  commands: ({ text, now }) => {
    const said = tryCommands(text, now)
    return said ? bimLine(said.text, { route: said.route, kind: "tell" }) : null
  },
  song: async ({ text, now }) => {
    if (!claimsPeriodSongFollowUp({ source: BIM_CHAT_SOURCE }, text, now)) return null
    const result = await ingestIncomingAsync({ source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString() }, now)
    return bimLine(bimReplyText(result), { status: result.status, kind: result.kind, route: "SONG · period · code" })
  },
  "web-home": async ({ text, now, opts }) => {
    const took = await takeHome(text, now, { llm: !!opts.llm, lastBim: opts.lastBim })
    if (!took) return null
    const todo = took.askedHome ? null : asideTodo
    if (!took.askedHome) asideTodo = null
    return withTodo(webLine(took), todo)
  },
  "social-follow": async ({ text, now }) => {
    const follow = await trySocialFollow(text, now, liveSessionDeps())
    return follow ? bimLine(follow.text, { route: follow.route, ...(follow.reportId ? { reportId: follow.reportId } : {}) }) : null
  },
  "ask-back": ({ text, now }) => answerAskBack(text, now),
  "follow-through": ({ text, now }) => {
    const followed = tryFollowAnswer(text, now) ?? tryFollowCommand(text, now, mineSources)
    return followed ? bimLine(followed.text, { route: followed.route, ...(followed.choices.length ? { choices: followed.choices } : {}) }) : null
  },
  "flight-file": ({ text, now }) => tryFlights(text, now),
  food: async ({ text, now, opts }) => {
    const food = await tryFood(text, now, { llm: !!opts.llm })
    return food ? bimLine(food.text, { route: food.route, kind: "tell", ...(food.choices?.length ? { choices: food.choices } : {}) }) : null
  },
  "day-log": async ({ text, now, opts }) => {
    const said = await tryDayLog(text, now, { llm: !!opts.llm })
    return said ? bimLine(said.text, { route: said.route, kind: "tell" }) : null
  },
  self: ({ text, opts }) => {
    const said = answerSelf(text, { llm: !!opts.llm })
    return said ? bimLine(said.text, { route: said.route, kind: "tell", evidence: said.evidence }) : null
  },
  remind: ({ text, now }) => {
    const said = tryRemind(text, now)
    return said ? bimLine(said.text, { route: said.route, kind: "tell" }) : null
  },
  coach: async ({ text, now, opts }) => {
    // Only "coach me" / "what should I do now?" uses a model: every other line skips the crew lookup.
    const crew = opts.llm && parseCoachAsk(text) ? await chatCrew().catch(() => null) : null
    const model = crew ? { call: ollamaCall(crew.main, AbortSignal.timeout(60_000)), model: crew.main, turns: earlierTurns(text) } : null
    const said = await tryCoach(text, now, model)
    return said ? bimLine(said.text, { route: said.route, kind: "tell" }) : null
  },
  keep: async ({ text, now, opts }) => {
    // "stop reminding me about …" starts with one of the executor's words, so the cue commands are read before the verb check.
    const said = tryCueCommand(text, now) ?? (looksLikeVerb(text, now) ? null : tryKeepCue(text, now))
    if (said) return bimLine(said.text, { route: said.route, kind: "tell" })
    if (looksLikeVerb(text, now)) return null
    const todos = parseKeepTodos(text)
    if (todos) return keepTodos(todos, now, !!opts.llm)
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
  mark: async ({ text, now }) => {
    // The person a recent texts question named, newest first: "that text" in the line is theirs.
    const recent = useBimChatStore.getState().lines.filter((l) => l.who === "you" && l.text !== text).slice(-12).reverse().map((l) => l.text)
    let people: ReturnType<typeof snapshotFromStores>["people"] | null = null
    const named = (line: string) => {
      if (!mentionsTexts(line)) return null
      const hit = namedPeople((people ??= snapshotFromStores().people ?? []), line)
      return hit.length === 1 ? (hit[0]!.names[0] ?? hit[0]!.title) : null
    }
    const mark = readMark(text, recent, named)
    if (!mark) return null
    const result = await executorSend(`log: ${mark.body}`, now)
    const choices = bimChoices(result)
    return bimLine(bimReplyText(result), { status: result.status, kind: result.kind, route: `MARK · log · code${mark.person ? ` · ${mark.person}` : ""}`, ...(choices.length ? { choices } : {}) })
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
    if (!day) return null
    // The plan kept a question for the web ("can you find out when the laundromats close?"): answered in a line of its own.
    if (day.webQuestion) void followWithWeb(day.webQuestion, now, !!opts.llm, day.dayId)
    return bimLine(day.text, { route: day.route, ...(day.dayId ? { dayId: day.dayId } : {}), ...(day.reportId ? { reportId: day.reportId } : {}), ...(day.choices?.length ? { choices: day.choices } : {}) })
  },
  stream: async ({ text, now, opts }) => {
    const stream = await tryStream(text, now, { llm: !!opts.llm })
    return stream ? bimLine(stream.text, { route: stream.route, reportId: stream.reportId, ...(stream.choices?.length ? { choices: stream.choices } : {}) }) : null
  },
  social: async ({ text, now }) => {
    const social = await trySocial(text, now)
    return social ? bimLine(social.text, { route: social.route, reportId: social.reportId }) : null
  },
  texts: ({ text, now, opts }) => tryTexts(text, now, !!opts.llm),
  web: async ({ text, now, opts }) => {
    if (!looksLikeWebQuestion(text)) return null
    // Two things in one line: only the question is searched, and the thing to do is offered beside the answer.
    const aside = splitAside(text)
    const split = !!aside.todo && looksLikeWebQuestion(aside.question)
    const answer = await answerWeb(split ? aside.question : text, now, { llm: !!opts.llm })
    asideTodo = split && answer.askedHome ? aside.todo! : null
    return withTodo(webLine(answer), split && !answer.askedHome ? aside.todo : null)
  },
  fact: ({ text, now }) => tryFact(text, now),
  tell: ({ text, now }) => tryTell(text, now),
  wire: ({ text, now }) => {
    const wired = tryWire(text, now)
    return wired ? bimLine(wired.text, { route: wired.route, wireId: wired.wireId }) : null
  },
  "habit-auto": async ({ text, now, opts }) => {
    const handed = await tryHabitAuto(text, now, looksLikeVerb(text, now), { llm: !!opts.llm })
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
  grammar: async ({ text, now }) => {
    const pieces = readDayStream(text)
    return pieces ? grammarLine(pieces, now) : null
  },
  resistance: async ({ text, now, opts }) => {
    if (!routable(text, false, now)) return null
    const resisting = await tryResistance(text, !!opts.llm, now)
    return resisting ? resistanceLine(resisting, true) : null
  },
  ladder: ladderLane,
}

/**
 * One turn's routing, into the Trace `sendToBim` keeps (`lib/agents/trace.ts`): the correction read, the thread's
 * reading, every lane tried. `sendToBim` adds the follow-through read and the cues, then closes the Trace.
 */
async function routeToBim(
  text: string,
  now: Date,
  opts: SendOpts & { rec: TraceRecorder; turn: TurnStage },
  newestBefore: string | undefined,
): Promise<BimLine> {
  const { rec } = opts
  if (!opts.photos?.length) {
    const t0 = rec.clock()
    const fixed = await tryCorrect(text, now, opts).catch(() => null)
    rec.add({ kind: "decision", actor: "correct", status: fixed ? "ok" : "pass", t0, ...(fixed?.route ? { note: fixed.route } : {}) })
    if (fixed) return fixed
  }
  let read: ReturnType<typeof followUp> = null
  try {
    read = opts.photos?.length ? null : followUp(text, now)
  } catch {
    read = null
  }
  if (read) rec.add({ kind: "decision", actor: "thread", status: "pass", note: `read as: ${read.text}` })
  const asked = read?.text ?? text
  const line = await sendLine(asked, now, opts)
  if (!opts.photos?.length && line.status !== "error" && looksLikeFactQuestion(asked)) {
    useBimThread.getState().setFocus({ question: asked.trim(), at: now.getTime() })
  }
  if (!opts.photos?.length) noteTurn(asked, now, line, newestBefore)
  return read ? { ...line, readAs: read.text } : line
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
      onLane: (lane) => {
        if (opts.turn) opts.turn.stage = lane
      },
    })
    // The ladder is last and always answers, so this is only reached if the lane list is ever cut short.
    return hit?.line ?? (await LANE_BODIES.ladder(ctx))!
  } catch (error) {
    return bimLine(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: "error" })
  }
}

/** One BIM chat conversation. The open one's lines are `BimChatState.lines`; the rest wait in `past`. */
export type BimConvo = { id: string; title: string; startedAt: string; lines: BimLine[] }

function convoId(): string {
  return `convo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** A conversation's title: its first line of yours, cut short. */
export function convoTitle(lines: BimLine[]): string {
  const first = lines.find((l) => l.who === "you")?.text.replace(/\s+/g, " ").trim()
  if (!first) return "New chat"
  return first.length > 48 ? `${first.slice(0, 47)}…` : first
}

/**
 * Change the lines of the conversation that `has` matches: the open one first, then the past ones.
 * When none matches, the open one is changed.
 */
function inConvo(s: BimChatState, has: (lines: BimLine[]) => boolean, change: (lines: BimLine[]) => BimLine[]): Partial<BimChatState> {
  if (has(s.lines)) return { lines: change(s.lines) }
  const at = s.past.findIndex((c) => has(c.lines))
  if (at < 0) return { lines: change(s.lines) }
  return { past: s.past.map((c, i) => (i === at ? { ...c, lines: change(c.lines) } : c)) }
}

/** The lines of the conversation `has` matches, else the open one's. */
function convoLinesWhere(has: (lines: BimLine[]) => boolean): BimLine[] {
  const s = useBimChatStore.getState()
  if (has(s.lines)) return s.lines
  return s.past.find((c) => has(c.lines))?.lines ?? s.lines
}

/** Every line of every kept conversation, oldest conversation first. For readers that mine what you said. */
export function allBimLines(): BimLine[] {
  const s = useBimChatStore.getState()
  return [...[...s.past].reverse().flatMap((c) => c.lines), ...s.lines]
}

/** What BIM holds between messages: the open question, the to-do aside, the last write for `undo`, the thread. */
function forgetBetweenTurns(): void {
  pendingAsk = null
  asideTodo = null
  lastTurn = null
  useBimThread.getState().setFocus(null)
}

/** The open conversation, as a past entry. Empty ones are not kept. */
function shelve(s: BimChatState): BimConvo[] {
  if (!s.lines.length) return s.past
  const open: BimConvo = { id: s.openId, title: convoTitle(s.lines), startedAt: s.openStartedAt || s.lines[0]!.at, lines: s.lines }
  return [open, ...s.past.filter((c) => c.id !== s.openId)].slice(0, CONVO_CAP)
}

type BimChatState = {
  /** The open conversation's lines. */
  lines: BimLine[]
  openId: string
  openStartedAt: string
  /** Other conversations, newest first. A reply that lands after you switched goes to its own one here. */
  past: BimConvo[]
  /** A turn is running. The input never waits on it: lines sent meanwhile queue. */
  busy: boolean
  /** Lines sent and not yet answered, the running one included. */
  queued: number
  /**
   * Send a line. Never blocks: the line and its reply slot show at once, and the turn runs after the ones sent
   * before it. Resolves when this line's reply is in.
   */
  send: (text: string, photos?: IncomingAttachment[], about?: CardRef) => Promise<void>
  /** BIM asks you something (a check-in). Without `kind` it alternates doing and mood. */
  checkIn: (kind?: "doing" | "mood") => void
  clear: () => void
  /** Start a new conversation. The open one is kept in `past`; what BIM held between messages is dropped. */
  newConvo: () => void
  /** Open a past conversation. The open one is kept in `past`; what BIM held between messages is dropped. */
  openConvo: (id: string) => void
  /** Delete a past conversation. */
  dropConvo: (id: string) => void
}

const unwaited = (lines: BimLine[]): BimLine[] =>
  lines.map((l) => (l.waiting ? { ...l, waiting: undefined, status: "error" as const, text: "Not answered: BIM was closed before this line's turn ran. Send it again." } : l))

export const useBimChatStore = create<BimChatState>()(
  persist(
    (set, get) => ({
      lines: [],
      openId: convoId(),
      openStartedAt: "",
      past: [],
      busy: false,
      queued: 0,
      send: async (raw, photos = [], about) => {
        const text = raw.trim()
        if (!text && !photos.length) return
        const tag = photos.length ? `📷 ${photos.length === 1 ? "photo" : `${photos.length} photos`}` : ""
        const sentAt = new Date()
        const mine: BimLine = { id: lineId(), at: sentAt.toISOString(), who: "you", text: [tag, text].filter(Boolean).join(" · "), ...(about ? { aboutCard: about.label } : {}) }
        const ahead = get().queued
        const slot: BimLine = { id: lineId(), at: sentAt.toISOString(), who: "bim", text: ahead ? `queued · ${ahead} ahead` : "…", waiting: true, replyTo: mine.id }
        set((s) => ({ queued: s.queued + 1, lines: [...s.lines, mine, slot].slice(-TRANSCRIPT_CAP), openStartedAt: s.openStartedAt || sentAt.toISOString() }))
        // The slot may be in a past conversation by the time it runs or is answered; find it by its id.
        const hasSlot = (ls: BimLine[]) => ls.some((l) => l.id === slot.id)
        // One turn at a time, in the order sent (`chat-queue.ts`): a turn reads what the one before it wrote (the
        // open question, the thread, the last write for "undo"), and one model call at a time keeps the 3B and 14B
        // loaded together. Nothing is dropped, deduped or merged: every line gets its own turn, Trace and reply.
        await bimTurns(BIM_CHAT_ID, async () => {
          set({ busy: true })
          set((s) => inConvo(s, hasSlot, (ls) => ls.map((l) => (l.id === slot.id ? { ...l, text: "…" } : l))))
          let reply: BimLine
          try {
            // BIM's last reply before this line, finished ones only: what this line answers.
            const own = convoLinesWhere(hasSlot)
            const at = own.findIndex((l) => l.id === slot.id)
            const lastBim = own.slice(0, at < 0 ? undefined : at).reverse().find((l) => l.who === "bim" && !l.waiting)?.text
            // A turn that never ends must not hold every line sent after it: past TURN_LIMIT_MS this line is marked
            // failed (with "try again") and the next one runs.
            reply = await Promise.race([
              sendToBim(text, sentAt, { llm: useBimLlmMode.getState().on, lastBim, photos, ...(about ? { about } : {}) }),
              new Promise<BimLine>((done) => setTimeout(() => done(bimLine(`No answer after ${TURN_LIMIT_MS / 1000}s, so I moved on to your next line.`, { status: "error" })), TURN_LIMIT_MS)),
            ])
          } catch (error) {
            reply = bimLine(`Error: ${error instanceof Error ? error.message : String(error)}`, { status: "error" })
          }
          // A failed turn marks only this line, and offers to send it again.
          if (reply.status === "error" && text && !photos.length) reply = { ...reply, choices: [...(reply.choices ?? []), { label: "try again", text }] }
          const done: BimLine = { ...reply, id: slot.id, replyTo: mine.id }
          set((s) => ({
            busy: false,
            queued: Math.max(0, s.queued - 1),
            ...inConvo(s, hasSlot, (ls) => (hasSlot(ls) ? ls.map((l) => (l.id === slot.id ? done : l)) : [...ls, done].slice(-TRANSCRIPT_CAP))),
          }))
        })
      },
      checkIn: (kind) => {
        if (get().busy || get().queued) return
        const line = checkInLine(kind)
        set((s) => ({ lines: [...s.lines, line].slice(-TRANSCRIPT_CAP) }))
      },
      clear: () => {
        forgetBetweenTurns()
        set({ lines: [], openStartedAt: "" })
      },
      newConvo: () => {
        forgetBetweenTurns()
        if (!get().lines.length) return
        set((s) => ({ past: shelve(s), lines: [], openId: convoId(), openStartedAt: "" }))
      },
      openConvo: (id) => {
        const target = get().past.find((c) => c.id === id)
        if (!target || id === get().openId) return
        forgetBetweenTurns()
        set((s) => ({ past: shelve(s).filter((c) => c.id !== id), lines: target.lines, openId: target.id, openStartedAt: target.startedAt }))
      },
      dropConvo: (id) => set((s) => ({ past: s.past.filter((c) => c.id !== id) })),
    }),
    {
      name: TRANSCRIPT_KEY,
      storage: createJSONStorage(() => localStorage),
      // A reply slot still waiting when the app closed never finishes: it is kept as a line that says so.
      // A saved transcript from before conversations has `lines` alone: it becomes the open conversation.
      partialize: (s) => ({ lines: unwaited(s.lines), openId: s.openId, openStartedAt: s.openStartedAt, past: s.past.map((c) => ({ ...c, lines: unwaited(c.lines) })) }),
    },
  ),
)
