/**
 * lib/dump-bimby/match.ts — A plan said now, against what is already stored (pure)
 *
 * `matchTask` finds the open task a plan is about ("book arkansas tickets" → "Arkansas tickets"),
 * so BIM proposes an amendment to that task instead of a twin. `priorMentions` finds the earlier
 * days you said the same plan in BIM chat or Telegram, which is the evidence for a recurring
 * intention. Content words only: step verbs and filler are not what a plan is about.
 */

import { factTokens } from "@/lib/ingest/bim-facts"

const VERB_WORDS = new Set(
  "book call text send mail email write make get buy order pick up return cancel clean wash pay finish schedule plan pack figure out fix clear file submit apply print renew sign post ship wrap reply respond follow reach check go drop off need gotta have again also everyone entire".split(" "),
)

export function planTokens(text: string): string[] {
  return factTokens(text).filter((t) => !VERB_WORDS.has(t) && t.length > 1)
}

function overlap(a: string[], b: Set<string>): number {
  return a.filter((t) => b.has(t)).length
}

/** A plan's words are "about" a text when most of them are in it: all of one or two, else at least 60%. */
export function aboutSame(plan: string[], other: string[]): boolean {
  if (!plan.length) return false
  const hit = overlap(plan, new Set(other))
  return plan.length <= 2 ? hit === plan.length : hit >= 2 && hit / plan.length >= 0.6
}

export interface NamedTask {
  id: string
  name: string
}

/** The open task the plan is about, best overlap first. Null when none, or when two tie. */
export function matchTask(plan: string, tasks: NamedTask[]): NamedTask | null {
  const pt = planTokens(plan)
  if (!pt.length) return null
  const scored = tasks
    .map((t) => ({ t, tok: planTokens(t.name) }))
    .filter(({ tok }) => tok.length > 0 && (aboutSame(pt, tok) || aboutSame(tok, pt)))
    .map(({ t, tok }) => ({ t, score: overlap(pt, new Set(tok)) / Math.max(pt.length, tok.length) }))
    .sort((a, b) => b.score - a.score)
  if (!scored.length) return null
  if (scored[1] && scored[1].score === scored[0]!.score) return null
  return scored[0]!.t
}

export interface Said {
  text: string
  at: string
}

/** Earlier days the plan was said, oldest first, one per day. The message itself (last 2 minutes) is left out. */
export function priorMentions(plan: string, logs: Said[], now: Date): string[] {
  const pt = planTokens(plan)
  if (!pt.length) return []
  const days = new Set<string>()
  for (const l of logs) {
    const ms = Date.parse(l.at)
    if (!Number.isFinite(ms) || ms > now.getTime() - 120_000) continue
    if (aboutSame(pt, factTokens(l.text))) days.add(l.at.slice(0, 10))
  }
  return [...days].sort()
}
