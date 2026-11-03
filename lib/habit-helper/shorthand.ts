/**
 * lib/habit-helper/shorthand.ts — Shorthand names in code: one or two plain words, unique across habits
 *
 * "clean for 15 minutes" → "clean", "read 5 pages" → "read", "drink water" → "water", "go outside" →
 * "outside". Numbers, units, times and filler go; a light verb ("drink", "take", "go") gives way to the
 * word after it. A name another habit already uses (shorthand or the one picked earlier in the list)
 * takes its first two words; failing that, a number. No model: this is cheaper and exact in code.
 */

import type { HabitBrief, Proposal } from "./types"
import { STOP, unitOf } from "./words"

const FILLER = new Set([...STOP, "least", "minimum", "every", "each", "per", "day", "night", "morning", "evening", "before", "after", "pm", "am", "min", "mins"])
const LIGHT = new Set(["drink", "eat", "take", "do", "go", "have", "make", "get", "practice", "practise", "spend", "log", "track", "use", "keep"])

/** The plain words of a habit name, in order, without numbers, units, times or filler. */
export function plainWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\d{1,2}(:\d{2})?\s*(am|pm)\b/g, " ")
    .split(/[^a-z']+/)
    .filter((w) => w && !FILLER.has(w) && !unitOf(w))
}

/** Candidate shorthands for one name, best first. */
export function candidates(name: string): string[] {
  const words = plainWords(name)
  if (!words.length) return [name.trim().toLowerCase().slice(0, 12)]
  const lead = LIGHT.has(words[0]!) && words[1] ? 1 : 0
  const one = words[lead]!
  const two = words.slice(0, 2).join(" ")
  return [...new Set([one, two, words.slice(lead, lead + 2).join(" ")])].filter(Boolean)
}

export interface ShorthandOptions {
  /** Include habits that already have a shorthand ("redo all"). */
  redo?: boolean
}

/** One proposal per daily habit that needs a shorthand, unique against every other habit's. */
export function suggestShorthands(habits: HabitBrief[], opts: ShorthandOptions = {}): Proposal[] {
  const want = habits.filter((h) => opts.redo || !h.shorthand?.trim())
  const used = new Set(habits.filter((h) => !want.includes(h)).map((h) => h.shorthand!.trim().toLowerCase()))
  const out: Proposal[] = []
  for (const h of want) {
    const list = candidates(h.name)
    let pick = list.find((c) => !used.has(c))
    for (let n = 2; !pick; n++) if (!used.has(`${list[0]} ${n}`)) pick = `${list[0]} ${n}`
    used.add(pick)
    if (pick === h.shorthand?.trim().toLowerCase()) continue
    out.push({ id: `p-${h.id}-shorthand`, kind: "shorthand", habitId: h.id, habit: h.name, from: h.shorthand?.trim() || "none", to: pick, shorthand: pick, words: h.name })
  }
  return out
}
