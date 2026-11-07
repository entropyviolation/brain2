/**
 * lib/rsvp.ts — rapid serial visual presentation, the pure half
 *
 * Page text in, words out. A word is flashed with one letter (the pivot, or
 * optimal recognition point) held on a fixed column so the eye never moves.
 * Timing is words-per-minute with small pauses for long words and for
 * punctuation. No DOM, no timers: `SpeedReadView` owns those.
 */

export const RSVP_MIN_WPM = 100
export const RSVP_MAX_WPM = 1200

export interface RsvpChunk {
  /** Index of the first word in the page's word list. */
  start: number
  /** How many words this flash holds. */
  count: number
  text: string
}

export interface RsvpPivot {
  before: string
  pivot: string
  after: string
}

/** Split page text on whitespace. A word keeps its punctuation (it sets the pause). */
export function tokenizeWords(text: string): string[] {
  return text
    .replace(/­/g, "")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
}

/** Letters and digits only, so quotes and brackets do not move the pivot. */
function coreOf(word: string): { lead: number; core: string } {
  const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(word)
  return { lead: m ? m[1].length : 0, core: m ? m[2] : word }
}

/** Where the eye lands: about a third into the word, a little further for long ones. */
export function pivotIndex(word: string): number {
  const { lead, core } = coreOf(word)
  const n = [...core].length
  let at: number
  if (n <= 1) at = 0
  else if (n <= 5) at = 1
  else if (n <= 9) at = 2
  else if (n <= 13) at = 3
  else at = 4
  return lead + at
}

export function splitPivot(text: string): RsvpPivot {
  const chars = [...text]
  const at = Math.min(pivotIndex(text), Math.max(0, chars.length - 1))
  return {
    before: chars.slice(0, at).join(""),
    pivot: chars[at] ?? "",
    after: chars.slice(at + 1).join(""),
  }
}

export function endsSentence(word: string): boolean {
  return /[.!?…]["'”’)\]]*$/.test(word)
}

/** Time weight of one word: 1 is a plain word at the set speed. */
export function wordWeight(word: string, pauses = true): number {
  if (!pauses) return 1
  const { core } = coreOf(word)
  const n = [...core].length
  let w = 1
  if (n > 8) w += Math.min(0.6, (n - 8) * 0.08)
  else if (n <= 2) w -= 0.15
  if (endsSentence(word)) w += 1.1
  else if (/[,;:—–-]["'”’)\]]*$/.test(word)) w += 0.5
  if (/\d/.test(word)) w += 0.25
  return w
}

/** The flash that starts at word `i`: up to `size` words, never across a sentence end. */
export function chunkAt(words: string[], i: number, size: number): RsvpChunk {
  const n = Math.max(1, Math.floor(size))
  const out: string[] = []
  let j = i
  while (j < words.length && out.length < n) {
    out.push(words[j])
    j += 1
    if (endsSentence(words[j - 1])) break
  }
  return { start: i, count: out.length, text: out.join(" ") }
}

export function chunkDelayMs(words: string[], chunk: RsvpChunk, wpm: number, pauses = true): number {
  const base = 60000 / Math.min(RSVP_MAX_WPM, Math.max(RSVP_MIN_WPM, wpm))
  let sum = 0
  for (let k = 0; k < chunk.count; k++) sum += wordWeight(words[chunk.start + k], pauses)
  return base * sum
}

/** Seconds left in `words` from word `i` at `wpm`, pauses included. */
export function secondsRemaining(words: string[], i: number, wpm: number, pauses = true): number {
  const base = 60 / Math.min(RSVP_MAX_WPM, Math.max(RSVP_MIN_WPM, wpm))
  let sum = 0
  for (let k = i; k < words.length; k++) sum += wordWeight(words[k], pauses)
  return base * sum
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

/**
 * Join pdf.js text items into reading text. A line break joins with a space,
 * and a hyphen at a line end is dropped so "read-\ning" comes back as "reading".
 */
export function joinPdfItems(items: ReadonlyArray<{ str: string; hasEOL?: boolean }>): string {
  let out = ""
  for (const it of items) {
    if (!it.str) {
      if (it.hasEOL) out += " "
      continue
    }
    if (it.hasEOL) {
      out += /[\p{L}]-$/u.test(it.str) ? it.str.slice(0, -1) : `${it.str} `
    } else {
      out += it.str
    }
  }
  return out.replace(/\s+/g, " ").trim()
}
