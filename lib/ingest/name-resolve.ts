/**
 * lib/ingest/name-resolve.ts — Fuzzy name match for habits, pens, operations
 *
 * Exact / prefix / includes / word overlap. A unique winner above the threshold
 * is returned; close ties become `ambiguous` so the bot can ask.
 * Glue words (`store`, `list`, `to`, …) never carry a fuzzy hit alone.
 * A unique fuzzy hit is refused when the query and the name each have a
 * content word the other does not. A longer line that contains every content
 * word of the name still matches.
 */
import type { NameCandidate } from "./types"

export interface Named {
  id: string
  name: string
}

export type ResolveResult =
  | { status: "match"; candidate: NameCandidate }
  | { status: "ambiguous"; candidates: NameCandidate[]; query: string }
  | { status: "none"; query: string }

const MIN_SCORE = 0.55
const GAP = 0.12
const MAX_LIST = 5

/**
 * Words too common to be evidence on their own. "Dump iphone notes to brain2"
 * once matched five unrelated lists because every one of them contained "to".
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "etc",
  "for",
  "from",
  "i",
  "in",
  "item",
  "items",
  "list",
  "misc",
  "my",
  "of",
  "on",
  "or",
  "store",
  "stuff",
  "the",
  "thing",
  "things",
  "to",
  "up",
  "with",
])

export function normalizeName(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function queryWords(text: string): string[] {
  return normalizeName(text).split(" ").filter(Boolean)
}

function contentWords(text: string): string[] {
  return queryWords(text).filter((word) => !STOPWORDS.has(word))
}

function wordIn(word: string, words: string[]): boolean {
  return words.some((other) => other === word || (other.startsWith(word) && word.length >= 3))
}

/**
 * True when both sides have a content word the other lacks.
 * A longer line that still contains every content word of the name
 * (a receipt line "milk 2 gal" for "milk") is not this.
 * "outfit store" vs "grocery store" is: outfit and grocery do not meet.
 */
export function hasUnmatchedContent(query: string, name: string): boolean {
  const q = contentWords(query)
  const n = contentWords(name)
  const queryOnly = q.some((word) => !wordIn(word, n))
  const nameOnly = n.some((word) => !wordIn(word, q))
  return queryOnly && nameOnly
}

export function scoreName(query: string, name: string): number {
  const q = normalizeName(query)
  const n = normalizeName(name)
  if (!q || !n) return 0
  if (q === n) return 1
  const qWords = queryWords(q)
  const glueOnly = qWords.length > 0 && qWords.every((word) => STOPWORDS.has(word))
  // A glue word alone ("store", "list", "to") is not a fuzzy hit on a longer name.
  if (!glueOnly) {
    if (n.startsWith(q)) return 0.92
    if (` ${n} `.includes(` ${q} `)) return 0.88
    if (n.includes(q)) return 0.8
  }
  if (qWords.length === 0) return 0
  const nWords = new Set(queryWords(n))
  const hits = qWords.filter((w) => nWords.has(w) || [...nWords].some((nw) => nw.startsWith(w) && w.length >= 3))
  if (hits.length === 0 || hits.every((w) => STOPWORDS.has(w))) return 0
  if (hits.length === qWords.length) return 0.75
  return 0.5 + 0.2 * (hits.length / qWords.length)
}

export function resolveName(query: string, items: Named[]): ResolveResult {
  const q = query.trim()
  if (!q) return { status: "none", query: q }

  const ranked: NameCandidate[] = items
    .map((item) => ({ id: item.id, name: item.name, score: scoreName(q, item.name) }))
    .filter((c) => c.score >= MIN_SCORE)
    // A unique fuzzy hit still fails when the query has content words the name does not.
    .filter((c) => c.score === 1 || !hasUnmatchedContent(q, c.name))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  if (ranked.length === 0) return { status: "none", query: q }

  const best = ranked[0]
  const second = ranked[1]
  if (!second || best.score - second.score >= GAP || best.score === 1) {
    return { status: "match", candidate: best }
  }

  const close = ranked.filter((c) => best.score - c.score < GAP).slice(0, MAX_LIST)
  if (close.length === 1) return { status: "match", candidate: close[0] }
  return { status: "ambiguous", candidates: close, query: q }
}

/** Split a leading name from a trailing payload using known names (longest first). */
export function splitNameAndRest(payload: string, items: Named[]): { query: string; rest: string } {
  const text = payload.trim()
  if (!text) return { query: "", rest: "" }

  const sorted = [...items].sort((a, b) => b.name.length - a.name.length)
  const lower = text.toLowerCase()
  for (const item of sorted) {
    const n = item.name.toLowerCase()
    if (lower === n) return { query: item.name, rest: "" }
    if (lower.startsWith(`${n} `) || lower.startsWith(`${n}:`)) {
      return { query: item.name, rest: text.slice(item.name.length).replace(/^[:\s]+/, "").trim() }
    }
  }

  // First token(s) until a number / duration / clock-looking bit.
  const m = text.match(/^(.*?)(?:\s+)(\d|\d+(?:\.\d+)?\s*(?:h|m|min)|done|yes|no|undo|from\s+\d).*$/i)
  if (m && m[1].trim()) return { query: m[1].trim(), rest: text.slice(m[1].length).trim() }

  const parts = text.split(/\s+/)
  if (parts.length === 1) return { query: text, rest: "" }
  return { query: parts[0], rest: parts.slice(1).join(" ") }
}
