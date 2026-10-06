/**
 * lib/ingest/message-time.ts — When the person sent the text
 *
 * Telegram `message.date` is unix seconds. Inbox rows, tracking blocks, and
 * the ingest log use that instant. Processing time is only the fallback when
 * a payload has no send time (simulate, or a transport that omitted it).
 */
import type { IncomingMessage } from "./types"

export function messageSentAt(message: Pick<IncomingMessage, "receivedAt">, fallback = new Date()): Date {
  const raw = message.receivedAt
  if (!raw) return fallback
  const stamped = new Date(raw)
  if (Number.isNaN(stamped.getTime()) || stamped.getTime() <= 0) return fallback
  return stamped
}

/** Telegram unix `message.date` → ISO. Missing or zero is null (caller falls back). */
export function telegramDateToIso(unixSeconds: unknown): string | null {
  const unix = Number(unixSeconds)
  if (!Number.isFinite(unix) || unix <= 0) return null
  return new Date(unix * 1000).toISOString()
}

export function compareSentOrder(
  a: { receivedAt?: string; telegramMessageId?: number },
  b: { receivedAt?: string; telegramMessageId?: number },
): number {
  const at = a.receivedAt ? Date.parse(a.receivedAt) : 0
  const bt = b.receivedAt ? Date.parse(b.receivedAt) : 0
  if (at !== bt) return at - bt
  return (a.telegramMessageId ?? 0) - (b.telegramMessageId ?? 0)
}
