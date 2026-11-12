/**
 * lib/bim-flow/suggestion-verdicts.ts — What the person said about each LLM suggestion, and why
 *
 * Accept and Reject in BIM's LLM tab each leave a verdict: the suggestion as it was shown, the run
 * that showed it, and the person's own words (why it is wrong, or a note on an accept). Kept on this
 * device (`bimsuggest-verdicts-v1`) and appended to the disk archive (`archive.ts`, kind
 * `suggestion-verdict`), so mistakes can be read back when the flow is improved. A suggestion with a
 * verdict is not shown again. An accept made with the Neutral key has `grade: "ok"` (`lib/accept-grade.ts`):
 * it was written, but `goodAccepts` leaves it out, so it is never fed back as a good example.
 * **Planned:** feed rejected reasons and good accepts back to the flow as examples.
 */

import { teaches, type AcceptGrade } from "@/lib/accept-grade"
import { archive } from "./archive"
import type { Suggestion } from "./suggestions"

export interface Verdict {
  suggestionId: string
  verdict: "accepted" | "rejected"
  /** The person's words. On a reject: why it is wrong. On an accept: a note kept on the block. */
  reason: string
  at: string
  /** The Suggest pass that showed it (`run-history.ts`), when there was one. */
  runId?: string
  suggestion: Suggestion
  /** On an accept: "ok" when the Neutral key was used. Missing is the plain Accept. */
  grade?: AcceptGrade
}

const KEY = "bimsuggest-verdicts-v1"
/** Dismissals from before verdicts: hidden ids with no reason. */
const OLD_DISMISS_KEY = "bimsuggest-dismissed-v1"

export function loadVerdicts(): Verdict[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Verdict[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

/** Accepts a learner may use as good examples: plain Accepts only, never Neutral ones. */
export function goodAccepts(verdicts: Verdict[]): Verdict[] {
  return verdicts.filter((v) => v.verdict === "accepted" && teaches(v.grade))
}

/** Ids that should not be shown again: any verdict, plus old dismissals. */
export function decidedIds(verdicts: Verdict[]): Set<string> {
  const ids = new Set(verdicts.map((v) => v.suggestionId))
  try {
    for (const id of JSON.parse(localStorage.getItem(OLD_DISMISS_KEY) ?? "[]") as string[]) ids.add(id)
  } catch {}
  return ids
}

/** Adds one verdict (newest first) and returns the list. A later verdict on the same suggestion replaces the earlier one. */
export function recordVerdict(v: Verdict): Verdict[] {
  const next = [v, ...loadVerdicts().filter((x) => x.suggestionId !== v.suggestionId)]
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  archive("suggestion-verdict", v)
  return next
}
