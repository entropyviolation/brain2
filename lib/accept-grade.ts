/**
 * lib/accept-grade.ts — Accept, or accept neutrally
 *
 * A proposal card has two accepts. Both apply the same change the same way, and both are remembered.
 * The plain **Accept** (`good`) says the output was right, so a loop that learns from accepts may use it
 * as a good example. The **Neutral** accept (`ok`) says it was fine to apply, not that it was right:
 * it is kept with the other decisions, but no loop counts it as a success, credits a skill for it, or
 * shows it to a model as an example. A record with no grade is `good` (everything from before).
 */

export type AcceptGrade = "good" | "ok"

/** The key's word, next to Accept. */
export const NEUTRAL_LABEL = "Neutral"
/** The key's title and the line a card shows after it. */
export const NEUTRAL_HINT = "Apply it without learning from it: kept on record, never used as a good example"

/** True when an accept may teach. A missing grade is the plain Accept. */
export const teaches = (grade?: AcceptGrade): boolean => grade !== "ok"
