/**
 * lib/ingest/deliver-reply.ts — Send bot replies and pin the grocery card
 *
 * Callers pass channel send/pin. Pinning the first chunk of `pinText` keeps
 * the open grocery lines at the top of the Telegram chat when the laptop is off.
 */
import { chunkTelegramText } from "./chunk-text"
import { useIngestStore } from "./ingest-store"
import type { ApplyResult } from "./types"

export interface IngestTransport {
  send: (chatId: string, text: string) => Promise<{ messageId?: number } | void>
  pin?: (chatId: string, messageId: number, previousId?: number) => Promise<void>
}

export async function deliverIngestReply(
  chatId: string,
  result: ApplyResult,
  transport: IngestTransport,
): Promise<void> {
  const reply = "reply" in result ? result.reply : undefined
  const pinText =
    result.status === "ok" || result.status === "needs_clarify" ? result.pinText : undefined
  const replyChunks = chunkTelegramText(reply || "")
  const sentIds: number[] = []

  for (const part of replyChunks) {
    const sent = await transport.send(chatId, part)
    if (sent && typeof sent.messageId === "number") sentIds.push(sent.messageId)
  }

  if (!pinText || !transport.pin) return

  let pinId = sameText(pinText, reply || "") ? sentIds[0] : undefined
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

  const prev = useIngestStore.getState().livePins.grocery
  const previousId = prev && prev.chatId === chatId ? prev.messageId : undefined
  try {
    await transport.pin(chatId, pinId, previousId)
    useIngestStore.getState().setLivePin("grocery", {
      chatId,
      messageId: pinId,
      kind: "grocery",
      at: new Date().toISOString(),
    })
  } catch {
    /* pin is best-effort (permissions / private-chat quirks) */
  }
}

function sameText(a: string, b: string): boolean {
  return a.trim() === b.trim()
}
