/**
 * lib/ingest/telegram-llm.ts — The Telegram bot's LLM lanes: code first, then the model's answer as a second message
 *
 * The person asked for the bot to have BIM chat's LLM features. The hub (`scripts/phone-hub.ts`) still runs the
 * executor first and sends its reply at once, as before: commands, filings and readouts never wait on a model.
 * Then, for a line the executor could only log or turned away as a question, the same switchboard BIM chat runs
 * (`bim-switchboard.ts`: code rules, the 3B router, the Ask flow or the chat lane, with their timeouts) reads it.
 * An answer or a reply comes as a second message, with the route chip. Nothing more is written: the Ask and chat
 * lanes only read. With the switch off, or no model, or nothing to add, it is silent.
 *
 * Plan: `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §6 (Telegram used to be "never").
 */

import { runSwitchboard, type SwitchboardResult } from "./bim-switchboard"
import type { ApplyResult, IngestSource } from "./types"

/** Executor results the model may add to: a plain log, a capture, or a question it would not file. */
function modelMayAdd(result: ApplyResult): boolean {
  if (result.status === "ignored") return true
  return result.status === "ok" && (result.kind === "event-log" || result.kind === "capture")
}

/** The second message for one Telegram line, or null. Never throws. */
export async function telegramFollowUp(
  text: string,
  now: Date,
  source: IngestSource,
  result: ApplyResult,
  opts: { llm: boolean; lastBim?: string; run?: typeof runSwitchboard } = { llm: true },
): Promise<string | null> {
  if (!opts.llm || !text.trim() || !modelMayAdd(result)) return null
  let board: SwitchboardResult | null
  try {
    // `force`: the executor already ran, so its pending question (if any) does not block the read.
    board = await (opts.run ?? runSwitchboard)(text, now, source, opts.lastBim, { force: true })
  } catch {
    return null
  }
  if (!board) return null
  if (board.chat) return `${board.chat.text}${board.chat.general ? "\n(general, not from your data)" : ""}\n\n${board.route}`
  if (board.answer) {
    const rows = board.answer.evidence.slice(0, 3).map((r) => `• ${r}`)
    return [board.answer.text, ...(rows.length ? ["", ...rows] : []), "", board.route].join("\n")
  }
  if (board.failed) return `I tried to look that up, but the model run failed (${board.failed}).\n\n${board.route}`
  return null
}
