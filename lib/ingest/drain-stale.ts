/**
 * lib/ingest/drain-stale.ts — Late-reply note for texts drained from the capture box
 *
 * A drained text is applied with its original send time. If the Mac was off for
 * hours, the answer lands late, so the reply starts with "(from 3h ago)".
 */

export const DEFAULT_DRAIN_STALE_MINUTES = 30

export function drainStaleMinutes(raw: string | undefined): number {
  const n = Number(String(raw ?? "").trim())
  return raw != null && String(raw).trim() !== "" && Number.isFinite(n) && n >= 0 ? n : DEFAULT_DRAIN_STALE_MINUTES
}

/** "5m", "3h", "2d". Under a minute reads "1m". */
export function formatAge(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/** The prefix line for a late reply, or "" when the text is fresh or the time is unusable. */
export function staleReplyNote(sentAtIso: string | undefined, nowMs: number, staleMinutes: number): string {
  const sent = sentAtIso ? Date.parse(sentAtIso) : NaN
  if (!Number.isFinite(sent)) return ""
  const age = nowMs - sent
  if (age <= staleMinutes * 60000) return ""
  return `(from ${formatAge(age)} ago)`
}

export function prefixStaleReply(text: string, note: string): string {
  return note ? `${note}\n${text}` : text
}
