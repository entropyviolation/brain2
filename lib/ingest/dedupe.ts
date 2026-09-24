/**
 * lib/ingest/dedupe.ts — Ignore retried Telegram updates / duplicate message ids
 *
 * First match wins at the executor gate. Webhook retries and double pollers must
 * not create two inbox items, plan rows, habit completions, or tracker logs.
 */
import type { IncomingMessage } from "./types"

const MAX_SEEN = 500

/** In-memory ring of recently claimed keys (also mirrored on the ingest store). */
const memorySeen = new Set<string>()
const memoryOrder: string[] = []

export function ingestDedupeKey(message: IncomingMessage): string | null {
  if (message.source.channel === "simulate") return null
  if (message.telegramUpdateId != null) {
    return `upd:${message.telegramUpdateId}`
  }
  if (message.telegramMessageId != null) {
    return `msg:${message.source.channel}:${message.source.chatId}:${message.telegramMessageId}`
  }
  return null
}

/**
 * Claim a key. Returns false when this update was already processed (caller
 * should ignore without writing). Passing null always claims (no-op key).
 */
export function claimIngestDedupe(key: string | null, alreadySeen?: (k: string) => boolean, remember?: (k: string) => void): boolean {
  if (!key) return true
  if (memorySeen.has(key) || alreadySeen?.(key)) return false
  memorySeen.add(key)
  memoryOrder.push(key)
  while (memoryOrder.length > MAX_SEEN) {
    const drop = memoryOrder.shift()
    if (drop) memorySeen.delete(drop)
  }
  remember?.(key)
  return true
}

/** Test helper — clear the process-local ring. */
export function resetIngestDedupeForTests(): void {
  memorySeen.clear()
  memoryOrder.length = 0
}
