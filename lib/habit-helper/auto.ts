/**
 * lib/habit-helper/auto.ts — Does a plain BIM chat line read as a daily-habit log?
 *
 * BIM chat asks this before it files a line, so "did skincare, stretched, drank water" reaches the Habits
 * BIMBY without the person naming it. Code only, the BIMBY's own tags and lexicon, no model. It is strict
 * on purpose: a line taken here is not filed anywhere else, so a doubtful line is left for the other lanes.
 *
 * A clause **names** a habit when the habit's words cover at least half of the clause's content words
 * ("drank water" names Drink water; "bought water at the store" does not). The line is a habit log when
 * two or more clauses name habits and they are at least half of the clauses, or when its one clause names
 * a habit, covers every content word, carries an amount and is not negated ("read 10 pages").
 */

import { scoreClause } from "./lexicon"
import { headOf } from "./match"
import { tagText } from "./tags"
import type { BimbyContext } from "./types"
import { contentStems } from "./words"

const CLOCK = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(am|pm)\b/i

export interface HabitLogRead {
  /** Clauses that say something. */
  clauses: number
  /** Clauses whose words name a daily habit. */
  named: number
  /** The habits named, best match per clause. */
  habits: string[]
}

/**
 * The read behind `readsAsHabitLog`, or null when the line is not a habit log. `multiOnly` refuses a
 * one-clause line (BIM's own `did <habit>` command keeps those).
 */
export function readHabitLog(text: string, ctx: BimbyContext, opts: { multiOnly?: boolean } = {}): HabitLogRead | null {
  const t = text.trim()
  // One line, no question, no command or label (a colon), no clock: those belong to other lanes.
  if (!t || t.length > 400 || /[\n:?]/.test(t) || CLOCK.test(t) || !ctx.habits.length) return null
  const tagged = tagText(t, ctx.now)
  const kindOf = new Map(tagged.tags.map((x) => [x.id, x.kind]))
  let clauses = 0
  let soloOk = false
  const habits: string[] = []
  for (const c of tagged.clauses) {
    const head = headOf(c, tagged.tags)
    const stems = new Set(contentStems(head))
    if (!stems.size) continue
    clauses++
    const best = scoreClause(head, ctx.habits)[0]
    if (!best || best.score < 1 || best.hits.length * 2 < stems.size) continue
    habits.push(best.id)
    soloOk = !c.negated && best.hits.length >= stems.size && c.tags.some((id) => kindOf.get(id) === "amount")
  }
  const named = habits.length
  const many = named >= 2 && named * 2 >= clauses
  const solo = !opts.multiOnly && clauses === 1 && named === 1 && soloOk
  return many || solo ? { clauses, named, habits } : null
}

export const readsAsHabitLog = (text: string, ctx: BimbyContext, opts: { multiOnly?: boolean } = {}): boolean => !!readHabitLog(text, ctx, opts)
