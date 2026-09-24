/**
 * lib/ingest/ritual-skip.ts — Shared skip tokens for text rituals
 *
 * Split out so morning GM and period review can share skip detection without
 * circular imports between apply-ritual and apply-morning-gm.
 */
const SKIP_WORDS = new Set([
  "skip",
  "pass",
  "next",
  "blank",
  "empty",
  "n/a",
  "na",
  "-",
  ".",
  "—",
])

export function isRitualSkip(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return true
  return SKIP_WORDS.has(t)
}
