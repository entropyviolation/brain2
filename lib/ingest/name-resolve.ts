/**
 * lib/ingest/name-resolve.ts — Fuzzy name match for habits, pens, operations
 *
 * Exact / prefix / includes / word overlap. A unique winner above the threshold
 * is returned; close ties become `ambiguous` so the bot can ask.
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
  "for",
  "from",
  "i",
  "in",
  "my",
  "of",
  "on",
  "or",
  "the",
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

export function scoreName(query: string, name: string): number {
  const q = normalizeName(query)
  const n = normalizeName(name)
  if (!q || !n) return 0
  if (q === n) return 1
  if (n.startsWith(q)) return 0.92
  if (` ${n} `.includes(` ${q} `)) return 0.88
  if (n.includes(q)) return 0.8
  const qWords = q.split(" ").filter(Boolean)
  const nWords = new Set(n.split(" ").filter(Boolean))
  if (qWords.length === 0) return 0
  const hits = qWords.filter((w) => nWords.has(w) || [...nWords].some((nw) => nw.startsWith(w) && w.length >= 3))
  if (hits.length === qWords.length) return 0.75
  // A partial hit only counts when at least one matched word carries meaning.
  if (hits.some((w) => !STOPWORDS.has(w))) return 0.5 + 0.2 * (hits.length / qWords.length)
  return 0
}

export function resolveName(query: string, items: Named[]): ResolveResult {
  const q = query.trim()
  if (!q) return { status: "none", query: q }

  const ranked: NameCandidate[] = items
    .map((item) => ({ id: item.id, name: item.name, score: scoreName(q, item.name) }))
    .filter((c) => c.score >= MIN_SCORE)
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
