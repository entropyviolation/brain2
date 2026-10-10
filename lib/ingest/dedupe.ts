/**
 * lib/ingest/dedupe.ts — Ignore retried Telegram updates / duplicate message ids
 *
 * First match wins at the executor gate. Webhook retries and double pollers must
 * not create two inbox items, plan rows, habit completions, or tracker logs.
 * A text message is keyed by chat plus message id, so an edit (new update id,
 * same message id) does not run again. Live Location is the edit that
 * re-applies: each sample keeps its own update id. Simulate has no Telegram
 * ids and is not deduped. A Telegram (or hub) message with neither update id
 * nor message id has a null key: the executor logs that key and does not apply.
 */
import type { IncomingMessage } from "./types"

const MAX_SEEN = 500

/** In-memory ring of recently claimed keys (also mirrored on the ingest store). */
const memorySeen = new Set<string>()
const memoryOrder: string[] = []

function messageKey(message: IncomingMessage): string | null {
  if (message.telegramMessageId == null) return null
  return `msg:${message.source.channel}:${message.source.chatId}:${message.telegramMessageId}`
}

function updateKey(message: IncomingMessage): string | null {
  if (message.telegramUpdateId == null) return null
  return `upd:${message.telegramUpdateId}`
}

/** Every key this update should claim. Empty for simulate. */
export function ingestDedupeKeys(message: IncomingMessage): string[] {
  if (message.source.channel === "simulate") return []
  const msg = messageKey(message)
  const upd = updateKey(message)
  if (message.locationUpdate) {
    if (upd) return [upd]
    return msg ? [msg] : []
  }
  const keys: string[] = []
  if (msg) keys.push(msg)
  if (upd) keys.push(upd)
  return keys
}

/**
 * Key stored on the ingest event. Text prefers chat+message id so an edit
 * matches the original. Live Location prefers update id.
 */
export function ingestDedupeKey(message: IncomingMessage): string | null {
  if (message.source.channel === "simulate") return null
  return ingestDedupeKeys(message)[0] ?? null
}

/**
 * Claim a key. Returns false when this update was already processed (caller
 * should ignore without writing). Passing null always claims (no-op key).
 */
/** Claim every key, or none when any key was already seen. */
export function claimIngestDedupeKeys(
  keys: readonly string[],
  alreadySeen?: (k: string) => boolean,
  remember?: (k: string) => void,
): boolean {
  if (keys.length === 0) return true
  if (keys.some((key) => memorySeen.has(key) || alreadySeen?.(key))) return false
  for (const key of keys) claimIngestDedupe(key, alreadySeen, remember)
  return true
}

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
