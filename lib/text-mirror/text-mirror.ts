/**
 * lib/text-mirror/text-mirror.ts — Mirror long typed text into a Doc (pure)
 *
 * The rule behind "Create a document in Docs called "Allietext" and add any text I
 * type by hand that is over 70 words". This file only reads the sentence, counts
 * words, and shapes one entry. The store, the doc write, and the page listener
 * live beside it (`text-mirror-store.ts`, `components/Docs/text-mirror-host.tsx`).
 */

export const DEFAULT_MIRROR_MIN_WORDS = 70

export type MirrorCommand =
  | { kind: "enable"; title: string; overWords: number }
  | { kind: "disable"; title?: string }

const QUOTED = /["“”'‘’]([^"“”'‘’]{1,80})["“”'‘’]/

/** Words are runs of non-space characters that hold a letter or digit. */
export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** True when `text` is longer than `overWords` words ("over 70" means 71 or more). */
export function isLongEnough(text: string, overWords = DEFAULT_MIRROR_MIN_WORDS): boolean {
  return countWords(text) > overWords
}

/**
 * "Create a document in Docs called "Allietext" and make it so any text I type
 * by hand over 70 words is added to it automatically" → enable.
 * "Stop auto-adding typed text to Allietext" → disable. Null for anything else.
 */
export function parseMirrorCommand(raw: string): MirrorCommand | null {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return null
  const lower = text.toLowerCase()
  const title = QUOTED.exec(text)?.[1]?.trim()

  if (
    /^(?:please\s+)?(?:stop|turn off|disable|pause|end)\b/.test(lower) &&
    /\b(?:auto[- ]?add\w*|mirror\w*|auto[- ]?cop\w*)\b/.test(lower) &&
    /\b(?:text|words|typed|writing)\b/.test(lower)
  ) {
    return { kind: "disable", ...(title ? { title } : {}) }
  }

  if (!title) return null
  if (!/\b(?:create|make|start)\b.*\b(?:doc|document)\b/.test(lower)) return null
  if (!/\b(?:automatic\w*|auto[- ]?add\w*)\b/.test(lower) && !/\b(?:added|add|copied|copy|append\w*)\b/.test(lower)) return null
  const words = /\b(?:over|more than|longer than|above|exceed\w*|at least)\s+(\d{1,5})\s+words?\b/.exec(lower)
  if (!words) return null
  const n = Number(words[1])
  const overWords = /\bat least\b/.test(words[0]) ? Math.max(0, n - 1) : n
  return { kind: "enable", title, overWords }
}

/** A readable place for the header: dialog, then field. */
export function sourceLabel(parts: { tab?: string; dialog?: string; field?: string }): string {
  const bits = [parts.tab, parts.dialog, parts.field].map((s) => (s ?? "").replace(/\s+/g, " ").trim()).filter(Boolean)
  const seen = new Set<string>()
  const unique = bits.filter((b) => (seen.has(b.toLowerCase()) ? false : (seen.add(b.toLowerCase()), true)))
  return unique.length ? unique.join(" › ") : "Unlabeled field"
}

export function timeLabel(at: Date): string {
  return at.toLocaleString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export function headerLine(source: string, at: Date): string {
  return `${source} · ${timeLabel(at)}`
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** One entry as Docs HTML: bold header, the text with its line breaks, then a blank line. */
export function entryHtml(source: string, at: Date, text: string): string {
  const body = esc(text.trim()).replace(/\n/g, "<br>")
  return `<p><strong>${esc(headerLine(source, at))}</strong></p><p>${body}</p><p><br></p>`
}

/** The doc body with `entry` added at the end; a blank new document starts with the entry. */
export function appendEntry(body: string, entry: string): string {
  const blank = !body.trim() || /^(?:<p><br\s*\/?><\/p>\s*)+$/i.test(body.trim())
  return blank ? entry : `${body}${entry}`
}

/** Cheap stable hash so the same text from the same field is never added twice. */
export function textHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length}:${(h >>> 0).toString(36)}`
}
