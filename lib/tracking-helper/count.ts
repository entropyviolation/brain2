/**
 * lib/tracking-helper/count.ts — What a block should be tagged and which daily habit it counts for
 *
 * Pure, no model. The person says it in their own words: "should also be tagged music and count for the
 * daily habit", "counts as practicing an instrument". Tags are read from "tagged X". A habit is only
 * proposed when the words ask for one ("count for/as/toward …", "daily habit"); it is found by scoring
 * the words after "count as/for" (else the whole clause) against the daily habits with the Habits
 * BIMBY's lexicon. A tie or no hit proposes nothing, so a habit is never guessed.
 * `accept.ts` writes the tags and makes the habit's Tracking link carry them.
 */
import { scoreClause, tiedAtTop } from "@/lib/habit-helper/lexicon"
import type { HabitBrief } from "@/lib/habit-helper/types"
import type { ProposedBlock } from "./types"

/** A daily habit as the Tracking Helper needs it: its words, and the Tracking tags that already fill it. */
export interface CountHabit {
  brief: HabitBrief
  /** Active link tag ids (empty when the habit has no link yet). */
  tagIds: string[]
  /** The habit can take a Tracking link (Yes/No or Goal). */
  linkable: boolean
}

const TAGGED = /\btagg?(?:ed|ing)?\s+(?:(?:it|this|that|them)\s+)?(?:as\s+|with\s+)?([^.;]+)/gi
const STOP_AT = /\s+(?:and\s+(?:also\s+)?(?:it\s+)?(?:should\s+)?(?:count|add|log|mark|tick)|which|that|so)\b/i

/** Tag names asked for: "should also be tagged music and focus" → ["music", "focus"]. */
export function readTagWords(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TAGGED)) {
    const cut = m[1]!.split(STOP_AT)[0]!
    for (const part of cut.split(/\s*,\s*|\s+and\s+/i)) {
      const w = part.replace(/^(?:the|a|an)\s+/i, "").replace(/["“”']/g, "").trim().toLowerCase()
      if (w && w.length <= 30 && w.split(/\s+/).length <= 3 && !out.includes(w)) out.push(w)
    }
  }
  return out
}

const COUNT_PHRASE = /\bcount(?:s|ed|ing)?\s+(?:as|for|toward|towards|to|in)\s+([^.;]+)/gi
const ASKS_HABIT = /\bdaily habit\b|\bhabit\b|\bcount(?:s|ed|ing)?\s+(?:as|for|toward|towards)\b/i

/** True when the words ask for a habit to be credited. */
export const asksForHabit = (text: string) => ASKS_HABIT.test(text)

/** The habit the words point at, or null. Never guesses on a tie. */
export function readHabit(text: string, habits: CountHabit[]): CountHabit | null {
  if (!habits.length || !asksForHabit(text)) return null
  const targets = [...text.matchAll(COUNT_PHRASE)]
    .map((m) => m[1]!.split(STOP_AT)[0]!.replace(/\b(?:the\s+)?daily habit\b/gi, "").trim())
    .filter((t) => t.split(/\s+/).length >= 1 && t.length > 1)
  const briefs = habits.map((h) => h.brief)
  // Named habit first ("count as practicing an instrument"), then the whole clause.
  for (const t of [...targets, text]) {
    const scored = scoreClause(t, briefs)
    if (!scored.length || scored[0]!.score < 1 || tiedAtTop(scored).length) continue
    return habits.find((h) => h.brief.id === scored[0]!.id) ?? null
  }
  return null
}

/** Tags and habit for one block, from the words it was read from. Does not overwrite what the person set. */
export function readCounts(block: Pick<ProposedBlock, "from" | "notes" | "tags" | "habit">, habits: CountHabit[]): Pick<ProposedBlock, "tags" | "habit" | "notes"> {
  const tags = [...new Set([...(block.tags ?? []), ...readTagWords(block.from)])]
  const found = block.habit ? null : readHabit(block.from, habits)
  const habit = block.habit ?? (found ? { id: found.brief.id, name: found.brief.name, linked: found.tagIds.length > 0 } : undefined)
  // The small model sometimes files "music, daily habit" as a note. That is now tags and a habit.
  const dropped = new Set([...tags, "daily habit", "habit", ...(habit ? [habit.name.toLowerCase()] : [])])
  const notes = block.notes
    .split(/\s*[;,]\s*/)
    .filter((p) => p && !dropped.has(p.trim().toLowerCase()))
    .join("; ")
  return { tags: tags.length ? tags : undefined, habit, notes }
}
