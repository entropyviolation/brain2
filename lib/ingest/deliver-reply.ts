/**
 * lib/ingest/deliver-reply.ts — Send bot replies and pin the grocery card
 *
 * Callers pass channel send/pin/edit. Pinning the first chunk of `pinText` keeps
 * that card at the top of the Telegram chat when the laptop is off.
 * Grocery and to-do today are separate pins (`pinKind`).
 * An open ritual keeps one bot message: later steps edit that card.
 */
import { chunkTelegramText } from "./chunk-text"
import { useIngestStore } from "./ingest-store"
import { inlineKeyboardForResult } from "./telegram-ui.mjs"
import type { ApplyResult, PendingClarify } from "./types"

export interface IngestReplyMarkup {
  inline_keyboard: { text: string; callback_data: string }[][]
}

export interface IngestTransport {
  send: (
    chatId: string,
    text: string,
    markup?: IngestReplyMarkup,
  ) => Promise<{ messageId?: number } | void>
  pin?: (chatId: string, messageId: number, previousId?: number) => Promise<void>
  /** Edit the bot's own ritual card. Never a person's message id. */
  edit?: (chatId: string, messageId: number, text: string, markup?: IngestReplyMarkup) => Promise<void>
}

function ritualCardId(result: ApplyResult): number | undefined {
  if (result.ritualCardMessageId != null) return result.ritualCardMessageId
  if (result.status === "needs_clarify" && result.pending.ritualCardMessageId != null) {
    return result.pending.ritualCardMessageId
  }
  return undefined
}

function rememberRitualCard(chatId: string, pending: PendingClarify, messageId: number) {
  if (pending.kind !== "ritual") return
  useIngestStore.getState().setPending("telegram", chatId, {
    ...pending,
    ritualCardMessageId: messageId,
  })
}

export async function deliverIngestReply(
  chatId: string,
  result: ApplyResult,
  transport: IngestTransport,
): Promise<void> {
  const reply = "reply" in result ? result.reply : undefined
  const pinText =
    result.status === "ok" || result.status === "needs_clarify" ? result.pinText : undefined
  const pinKind =
    result.status === "ok" || result.status === "needs_clarify" ? result.pinKind ?? "grocery" : "grocery"
  const replyChunks = chunkTelegramText(reply || "")
  const markup = inlineKeyboardForResult(result)
  const sentIds: number[] = []
  const cardId = ritualCardId(result)
  const ritualPending = result.status === "needs_clarify" && result.pending.kind === "ritual" ? result.pending : null

  if (cardId != null && transport.edit && replyChunks.length) {
    try {
      await transport.edit(chatId, cardId, replyChunks[0] || "", markup)
      for (const extra of replyChunks.slice(1)) {
        await transport.send(chatId, extra)
      }
      if (ritualPending) rememberRitualCard(chatId, ritualPending, cardId)
      await pinReply(chatId, pinText, pinKind, reply || "", sentIds, transport)
      return
    } catch {
      /* the card is gone — send a fresh one below */
    }
  }

  for (let i = 0; i < replyChunks.length; i++) {
    const part = replyChunks[i]
    const sent =
      markup && i === replyChunks.length - 1
        ? await transport.send(chatId, part, markup)
        : await transport.send(chatId, part)
    if (sent && typeof sent.messageId === "number") sentIds.push(sent.messageId)
  }
  if (ritualPending && sentIds[0] != null) rememberRitualCard(chatId, ritualPending, sentIds[0])

  await pinReply(chatId, pinText, pinKind, reply || "", sentIds, transport)
}

async function pinReply(
  chatId: string,
  pinText: string | undefined,
  pinKind: string,
  reply: string,
  sentIds: number[],
  transport: IngestTransport,
) {
  if (!pinText || !transport.pin) return

  let pinId = sameText(pinText, reply) ? sentIds[0] : undefined
  if (pinId == null) {
    const pinChunks = chunkTelegramText(pinText)
    const first = pinChunks[0]
    if (!first) return
    const sent = await transport.send(chatId, first)
    if (sent && typeof sent.messageId === "number") pinId = sent.messageId
    for (const extra of pinChunks.slice(1)) {
      await transport.send(chatId, extra)
    }
  }
  if (pinId == null) return

  const prev = useIngestStore.getState().livePins[pinKind]
  const previousId = prev && prev.chatId === chatId ? prev.messageId : undefined
  try {
    await transport.pin(chatId, pinId, previousId)
    useIngestStore.getState().setLivePin(pinKind, {
      chatId,
      messageId: pinId,
      kind: pinKind,
      at: new Date().toISOString(),
    })
  } catch {
    /* pin is best-effort (permissions / private-chat quirks) */
  }
}

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim()
}
