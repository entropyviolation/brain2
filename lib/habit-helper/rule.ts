/**
 * lib/habit-helper/rule.ts — Read a "count words in a document as a habit amount" rule (code, no model)
 *
 * "Make it so that for every 300 words writing in the document called "pages writing" that are added in
 * a day, it counts for 1 page written for that daily habit (write 3 pages)"
 *   → { docTitle: "pages writing", wordsPer: 300, amount: 1, unit: "pages", habitHint: "write 3 pages" }
 *
 * The habit is then picked from the person's daily habits by the same word scoring as a log line, and a
 * tie is asked, never guessed. Pure.
 */

import { scoreClause, tiedAtTop } from "./lexicon"
import type { HabitBrief } from "./types"

export interface WordRule {
  docTitle: string
  wordsPer: number
  amount: number
  /** What the amount is in ("pages"), as said. */
  unit?: string
  habitHint: string
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 }

const toNum = (s: string) => {
  const n = Number(s.replace(/,/g, ""))
  return Number.isFinite(n) ? n : NUM[s.toLowerCase()]
}

/** True when the text looks like a words-in-a-document rule. Cheap, for routing. */
export function looksLikeWordRule(text: string): boolean {
  return /\b(every|each|per)\s+[\d,]+\s+words?\b/i.test(text) && /\b(doc(ument)?|note|file)\b/i.test(text) && /\bcount/i.test(text)
}

export function parseWordRule(raw: string): WordRule | null {
  const text = raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim()
  if (!looksLikeWordRule(text)) return null
  const per = /\b(?:every|each|per)\s+([\d,]+)\s+words?\b/i.exec(text)
  const wordsPer = per ? toNum(per[1]!) : undefined
  if (!wordsPer || wordsPer <= 0) return null
  const quoted = /(?:called|named|titled)\s+"([^"]{1,80})"/i.exec(text) ?? /"([^"]{1,80})"/.exec(text)
  const bare = /(?:document|doc|note|file)\s+(?:called|named|titled)\s+(.+?)(?:\s+(?:that|which|and|so)\b|,|$)/i.exec(text)
  const docTitle = (quoted?.[1] ?? bare?.[1] ?? "").trim()
  if (!docTitle) return null
  const counts = /\bcount(?:s|ing)?\s+(?:(?:for|as|towards?)\s+)?(\d+(?:\.\d+)?|an?|one|two|three|four|five|ten)\s*([a-z]+)?/i.exec(text)
  const amount = counts ? toNum(counts[1]!) : undefined
  if (!amount || amount <= 0) return null
  const unit = counts?.[2] && !/^(for|of|in|on|toward|towards|written|read|that|the|this|my)$/i.test(counts[2]) ? counts[2].toLowerCase() : undefined
  const paren = /\(([^)]{2,60})\)/.exec(text)
  const after = /\bhabit\b\s*(.*)$/i.exec(text)
  const habitHint = (paren?.[1] ?? after?.[1] ?? text.replace(/"[^"]*"/g, " ")).trim()
  return { docTitle, wordsPer, amount, ...(unit ? { unit } : {}), habitHint }
}

/** The one habit the hint names, or the ids tied for it, or none. */
export function pickHabitForRule(rule: WordRule, habits: HabitBrief[]): { id?: string; tied: string[] } {
  const scored = scoreClause(`${rule.habitHint} ${rule.unit ?? ""}`, habits)
  const tied = tiedAtTop(scored)
  if (tied.length) return { tied }
  return scored[0] ? { id: scored[0].id, tied: [] } : { tied: [] }
}

/** "300 words a day in “pages writing” → 1 page". */
export function ruleText(rule: Pick<WordRule, "docTitle" | "wordsPer" | "amount" | "unit">): string {
  const unit = rule.unit ?? (rule.amount === 1 ? "unit" : "units")
  const u = rule.amount === 1 ? unit.replace(/s$/, "") : /s$/.test(unit) ? unit : `${unit}s`
  return `every ${rule.wordsPer} words added a day in “${rule.docTitle}” = ${rule.amount} ${u}`
}
