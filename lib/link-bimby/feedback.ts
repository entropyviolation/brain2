/**
 * lib/link-bimby/feedback.ts — The person's verdicts, fed back (pure)
 *
 * Every reviewed reading (current, or archived when Again replaced it) is a lesson:
 * which guesses were approved or rejected, and the comment. `feedbackLines` picks the
 * lessons closest to the link being read and words them for the prompt, so the next
 * guess repeats what was approved and avoids what was rejected.
 */

import { words } from "./context"
import type { LinkGuess, LinkReading, LinkReview } from "./types"

export const guessKey = (g: Pick<LinkGuess, "kind" | "id">): string => `${g.kind}:${g.id}`

export function isReviewed(r: LinkReading): boolean {
  return Boolean(r.review && (Object.keys(r.review.verdicts).length || r.review.comment?.trim()))
}

/** Set or clear one verdict. */
export function withVerdict(review: LinkReview | undefined, key: string, verdict: "approved" | "rejected" | null, at: string): LinkReview {
  const verdicts = { ...(review?.verdicts ?? {}) }
  if (verdict) verdicts[key] = verdict
  else delete verdicts[key]
  return { ...(review ?? {}), verdicts, at }
}

export function withComment(review: LinkReview | undefined, comment: string, at: string): LinkReview {
  const text = comment.trim().slice(0, 600)
  const { comment: _old, ...rest } = review ?? { verdicts: {} }
  return { ...rest, verdicts: rest.verdicts ?? {}, ...(text ? { comment: text } : {}), at }
}

function lesson(r: LinkReading): string {
  const v = r.review!.verdicts
  const marks = r.guesses
    .filter((g) => v[guessKey(g)])
    .map((g) => `${v[guessKey(g)] === "approved" ? "RIGHT" : "WRONG"}: ${g.name}`)
  const about = [r.gist && `"${r.gist.slice(0, 120)}"`, r.note && `note "${r.note.slice(0, 80)}"`].filter(Boolean).join(", ") || r.url
  const comment = r.review!.comment ? ` — they said: "${r.review!.comment.slice(0, 220)}"` : ""
  return `- ${about}: ${marks.join("; ") || "no verdicts"}${comment}`
}

/** The reviewed readings closest to `query`, newest first on a tie, as prompt lines. */
export function feedbackLines(reviewed: readonly LinkReading[], query: string, skipTaskId: string, limit = 6): string[] {
  const q = new Set(words(query))
  return reviewed
    .filter((r) => r.taskId !== skipTaskId && isReviewed(r))
    .map((r) => {
      const have = new Set(words(`${r.gist} ${r.note ?? ""} ${r.review?.comment ?? ""} ${r.guesses.map((g) => g.name).join(" ")}`))
      let hits = 0
      for (const w of q) if (have.has(w)) hits += 1
      // A comment is the strongest lesson; keep one even with no shared words.
      return { r, score: hits + (r.review?.comment ? 0.5 : 0) }
    })
    .sort((a, b) => b.score - a.score || b.r.review!.at.localeCompare(a.r.review!.at))
    .slice(0, limit)
    .map((x) => lesson(x.r))
}

export interface ReviewTally {
  read: number
  reviewed: number
  approved: number
  rejected: number
  comments: number
}

export function tally(readings: readonly LinkReading[]): ReviewTally {
  const t: ReviewTally = { read: readings.length, reviewed: 0, approved: 0, rejected: 0, comments: 0 }
  for (const r of readings) {
    if (!isReviewed(r)) continue
    t.reviewed += 1
    for (const v of Object.values(r.review!.verdicts)) v === "approved" ? (t.approved += 1) : (t.rejected += 1)
    if (r.review!.comment) t.comments += 1
  }
  return t
}
