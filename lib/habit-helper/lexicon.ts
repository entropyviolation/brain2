/**
 * lib/habit-helper/lexicon.ts — Which habits a clause's words point to, scored in code
 *
 * A habit's words are its name, its shorthand, its keyword phrases and the names of the Tracking tags that
 * fill it (`HabitBrief.words`). A clause scores 1 per distinct name, keyword or tag stem it shares with a
 * habit, 2 for the shorthand, and 0.5 for a shared unit word ("pages"). The rules reader uses the top score;
 * the model's pick is checked against it, so a clause two habits score the same on is asked, never guessed.
 */

import type { HabitBrief } from "./types"
import { contentStems, contentWords, stem, unitOf } from "./words"

export interface Scored {
  id: string
  score: number
  /** The stems that matched, for the card's "why". */
  hits: string[]
}

function termsOf(h: HabitBrief): Map<string, number> {
  const terms = new Map<string, number>()
  const put = (s: string, w: number) => terms.set(s, Math.max(terms.get(s) ?? 0, w))
  for (const w of contentWords(h.name)) put(stem(w), unitOf(w) ? 0.5 : 1)
  for (const phrase of h.words) for (const s of contentStems(phrase)) put(s, 1)
  if (h.shorthand?.trim()) for (const s of contentStems(h.shorthand)) put(s, 2)
  return terms
}

/** Every habit with a score above zero for these words, best first. */
export function scoreClause(text: string, habits: HabitBrief[]): Scored[] {
  const stems = new Set(contentStems(text))
  // A unit written after a number ("10 pages") counts toward a habit measured in it.
  for (const w of text.split(/\s+/)) {
    const u = unitOf(w)
    if (u) stems.add(stem(w))
  }
  const out: Scored[] = []
  for (const h of habits) {
    let score = 0
    const hits: string[] = []
    for (const [term, w] of termsOf(h)) {
      if (stems.has(term)) {
        score += w
        hits.push(term)
      }
    }
    if (score > 0) out.push({ id: h.id, score, hits })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** The habits tied at the top, when more than one is. Empty when one habit wins or none scores. */
export function tiedAtTop(scored: Scored[]): string[] {
  if (scored.length < 2 || scored[0]!.score !== scored[1]!.score) return []
  return scored.filter((s) => s.score === scored[0]!.score).map((s) => s.id)
}
