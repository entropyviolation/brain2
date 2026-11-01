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
import { answerTell, applyTell, type TellPending, type TellReply } from "./apply-tell"
import { runSwitchboard, useBimLlmMode, type SwitchboardResult } from "./bim-switchboard"
import { parseTell } from "./bim-tell"
import { ingestIncomingAsync } from "./executor"
import { makeIngestEventId, useIngestStore } from "./ingest-store"
import { looksLikeVerb } from "./parse-message"
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
 * Facts, questions, and widget commands in plain words (`bim-tell.ts`). Runs
 * ahead of the executor, only here: Telegram's ladder is unchanged. An open
 * ritual or clarify question owns the line, and a real command (`log:`, `groc`)
 * is never read as a fact. Null sends the line to the executor.
 */
function tryTell(text: string, now: Date): BimLine | null {
  const executorBusy = useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)
  const held = pendingTell
  pendingTell = null
  if (executorBusy || looksLikeVerb(text, now)) return null

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

function answerLine(board: SwitchboardResult): BimLine {
  return {
    id: lineId(),
    at: new Date().toISOString(),
    who: "bim",
    text: board.answer!.text,
    status: "ok",
    route: board.route,
    ...(board.answer!.evidence.length ? { evidence: board.answer!.evidence } : {}),
  }
}

/**
 * Run one line through the bot's executor. Never throws. With `llm`, a line the
 * ladder would only capture is routed first (`bim-switchboard.ts`); a question
 * is answered and not filed. Without it, this is the grammar ladder alone.
 */
export async function sendToBim(
  text: string,
  now = new Date(),
  opts: { llm?: boolean; lastBim?: string; photos?: IncomingAttachment[] } = {},
): Promise<BimLine> {
  try {
    // A photo and its caption go straight to the executor, as on Telegram: no tell, no router.
    if (opts.photos?.length) {
      const result = await ingestIncomingAsync(
        { source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString(), attachments: opts.photos },
        now,
      )
      const choices = bimChoices(result)
      return {
        id: lineId(),
        at: new Date().toISOString(),
        who: "bim",
        text: bimReplyText(result),
        status: result.status,
        kind: result.kind,
        ...(choices.length ? { choices } : {}),
      }
    }
    const told = tryTell(text, now)
    if (told) return told
    const heldBefore = !!useIngestStore.getState().getPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID)
    let board = opts.llm ? await runSwitchboard(text, now, BIM_CHAT_SOURCE, opts.lastBim) : null
    if (board?.answer && !board.passThrough) return answerLine(board)
    let result = await ingestIncomingAsync(
      { source: BIM_CHAT_SOURCE, text, receivedAt: now.toISOString() },
      now,
    )
    // The ladder gave up on a line (a start, mood, or place it could not finish). With LLM on, the
    // router gets it before it becomes a question for you: a sure ask is answered, a sure log is filed.
    if (opts.llm && !board && !heldBefore && result.status === "needs_clarify" && RESCUABLE.has(result.pending.kind)) {
      const second = await runSwitchboard(text, now, BIM_CHAT_SOURCE, opts.lastBim, { force: true })
      if (second?.sure && second.answer && !second.passThrough) {
        useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
        return answerLine(second)
      }
      if (second?.sure && second.intent === "log") {
        useIngestStore.getState().setPending(BIM_CHAT_SOURCE.channel, BIM_CHAT_ID, null)
        result = await ingestIncomingAsync(
          { source: BIM_CHAT_SOURCE, text: `log: ${text}`, receivedAt: now.toISOString() },
          now,
        )
      }
      board = second
    }
    const choices = bimChoices(result)
    const filed = bimReplyText(result)
    return {
      id: lineId(),
      at: new Date().toISOString(),
      who: "bim",
      text: board?.answer ? `${filed}\n\n${board.answer.text}` : filed,
      status: result.status,
      kind: result.kind,
      ...(choices.length ? { choices } : {}),
      ...(board ? { route: board.route } : {}),
      ...(board?.answer?.evidence.length ? { evidence: board.answer.evidence } : {}),
    }
  } catch (error) {
    return {
      id: lineId(),
      at: new Date().toISOString(),
      who: "bim",
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    }
  }
}

type BimChatState = {
  lines: BimLine[]
  busy: boolean
  send: (text: string, photos?: IncomingAttachment[]) => Promise<void>
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
      clear: () => set({ lines: [] }),
    }),
    {
      name: TRANSCRIPT_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
)
