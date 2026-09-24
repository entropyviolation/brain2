/**
 * lib/ingest/pairing.ts — Telegram allowlisting: codes, and pair-by-sight
 *
 * Settings generates a 6-digit code valid for 10 minutes. The user DMs
 * `/start 123456` or `pair: 123456`. Unknown senders get no reply.
 *
 * A refused message is still logged, so the second route skips the code
 * entirely: `unpairedSenders` reads those refusals back and Settings pairs the
 * chat with one click. Pairing never expires once granted.
 */
import type { IngestEvent } from "./types"

export const PAIRING_TTL_MS = 10 * 60 * 1000

/** Written by the executor when a chat is not on the allowlist. */
export const UNPAIRED_SUMMARY = "Unpaired sender"

export function generatePairingCode(now = Date.now()): { code: string; expiresAt: number } {
  const n = Math.floor(100000 + Math.random() * 900000)
  return { code: String(n), expiresAt: now + PAIRING_TTL_MS }
}

export function pairingCodeValid(
  stored: { code: string; expiresAt: number } | null | undefined,
  offered: string,
  now = Date.now(),
): boolean {
  if (!stored?.code) return false
  if (now > stored.expiresAt) return false
  const digits = String(offered || "").replace(/\D/g, "")
  return digits.length === 6 && digits === stored.code
}

export function chatKey(channel: string, chatId: string): string {
  return `${channel}:${chatId}`
}

export interface UnpairedSender {
  chatId: string
  channel: string
  username?: string
  userId?: string
  /** Most recent refusal, newest first in the returned list. */
  lastAt: string
  attempts: number
  lastText: string
}

/**
 * Distinct senders whose messages were refused for not being paired, newest
 * first, minus anyone already allowed. Settings turns these into one-click
 * pairing so a code round-trip is never required.
 */
export function unpairedSenders(
  events: readonly IngestEvent[],
  pairedChatIds: Iterable<string>,
  limit = 5,
): UnpairedSender[] {
  const paired = new Set(pairedChatIds)
  const byChat = new Map<string, UnpairedSender>()

  for (const event of events) {
    if (event.status !== "ignored" || event.summary !== UNPAIRED_SUMMARY) continue
    if (paired.has(event.chatId)) continue
    const seen = byChat.get(event.chatId)
    if (seen) {
      seen.attempts += 1
      if (!seen.username && event.username) seen.username = event.username
      continue
    }
    byChat.set(event.chatId, {
      chatId: event.chatId,
      channel: event.channel,
      username: event.username,
      userId: event.userId,
      lastAt: event.at,
      attempts: 1,
      lastText: event.raw,
    })
  }

  return [...byChat.values()]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, limit)
}
