/**
 * lib/habit-helper/flow.ts — The Habits BIMBY's flow: five stages, the editable parts of each
 *
 *   ROUTE (code) → TAG (code) → MATCH (one model call) → COMPUTE (code) → PROPOSE (code)
 *
 * The lab (`/lab/habit-helper`) edits this object and keeps the copy per device (`habithelper-flow-v1`).
 * Only ROUTE's patterns, MATCH's prompt, examples and model ladder, and the ASK limits are meant to be
 * tuned. `HABITS_BIMBY_REV` is bumped when the shipped flow changes; a browser holding an older saved
 * copy gets the new one, and its own copy is kept under a `:backup:<rev>` key.
 */

export const HABITS_BIMBY_REV = "2026-11-01-first"

export interface MatchExample {
  /** The habit lines, as the model sees them. */
  habits: string
  /** Tagged text, as the model sees it. */
  text: string
  json: string
}

export interface HabitsBimbyFlow {
  rev: string
  route: {
    /** A request for shorthand names. */
    shorthand: string
    /** A request for the reasons recorded on a habit. */
    reasons: string
    /** "What's left today?" */
    nudge: string
    /** A question about the BIMBY itself. */
    question: string
    /** While a why-question is open: a reply that passes on it. */
    skip: string
  }
  match: {
    system: string
    /** Appended to `system`; survives a reset of `system`. */
    extra: string
    examples: MatchExample[]
    /** Models tried smallest first. Empty = the crew's extract ladder. */
    ladder: string[]
    maxTokens: number
  }
  ask: {
    /** Why-questions per chat (per day). */
    maxQuestions: number
    /** Days looked back for a habit that keeps getting missed. */
    window: number
    /** Misses in that window that make it worth asking. */
    threshold: number
  }
}

export const MATCH_SYSTEM =
  "You match a person's message to their daily habits. You never write a habit name, a number, a day or a reason: you point at ids. " +
  "The message is cut into clauses led by [C1], [C2]. Amounts are tagged like 10 pages[N1], days like yesterday[D1], negations like didn't[X1], reasons like because I was tired[B1]. " +
  "Give one item for each clause that says the person did, or did not do, one of the HABITS. " +
  "clause: the C id. habit: the habit id it reports. kind: done, or missed when the clause says it was not done. " +
  "amount: the N tag that says how much of the habit, else empty. day: the D tag in that clause, else empty. reason: the B tag that says why it was missed, else empty. " +
  "A habit's 'also counts' words count as that habit: walking counts for a habit that lists walking. " +
  "Skip clauses about anything that is not one of the habits, like food eaten or a chore with no habit. " +
  "If a clause could be two habits equally, put one in habit and the other in maybe. Otherwise maybe is empty. Do not pad the list."

export const MATCH_EXAMPLES: MatchExample[] = [
  {
    habits: "h1 = water [yes/no]\nh2 = Read 5 pages [goal 5 page]\nh3 = Exercise [goal 30 min; also counts: walking, running]",
    text: "[C1] done today[D1] [C2] read 12 pages[N1] [C3] went for a run [C4] had a coffee",
    json: JSON.stringify({
      items: [
        { clause: "C2", habit: "h2", maybe: "", kind: "done", amount: "N1", day: "", reason: "" },
        { clause: "C3", habit: "h3", maybe: "", kind: "done", amount: "", day: "", reason: "" },
      ],
    }),
  },
  {
    habits: "h1 = Meditate [yes/no]\nh2 = Journal [a note]\nh3 = Read the news [yes/no]\nh4 = Read 5 pages [goal 5 page]",
    text: "[C1] yesterday[D1] I didn't[X1] meditate because I slept through my alarm[B1] [C2] read for a bit",
    json: JSON.stringify({
      items: [
        { clause: "C1", habit: "h1", maybe: "", kind: "missed", amount: "", day: "D1", reason: "B1" },
        { clause: "C2", habit: "h4", maybe: "h3", kind: "done", amount: "", day: "", reason: "" },
      ],
    }),
  },
]

export function starterFlow(): HabitsBimbyFlow {
  return {
    rev: HABITS_BIMBY_REV,
    route: {
      shorthand: "\\bshort\\s*-?\\s*hand|\\bnick\\s*names?\\b|\\bshort(er)? (names?|labels?)\\b",
      reasons: "^\\s*(show|list|what are)?\\s*(my )?reasons\\b|\\bwhy do i (keep )?(miss|skip)",
      nudge: "^\\s*(what('?s| is) (left|open|still)|what do i (still )?(have|need)|remind me|nudge|unmet)\\b",
      question: "^\\s*(what can you|how do (i|you)|help\\b|who are you)|^\\s*\\?\\s*$",
      skip: "^\\s*(skip|pass|not now|no idea|dunno|idk|next)\\b",
    },
    match: { system: MATCH_SYSTEM, extra: "", examples: MATCH_EXAMPLES, ladder: [], maxTokens: 600 },
    ask: { maxQuestions: 3, window: 7, threshold: 3 },
  }
}

const KEY = "habithelper-flow-v1"

/** The saved flow, or the starter. A copy from an older shipped flow is replaced and kept as a backup. */
export function loadFlow(): HabitsBimbyFlow {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return starterFlow()
    const saved = JSON.parse(raw) as HabitsBimbyFlow
    if (saved.rev === HABITS_BIMBY_REV) return saved
    localStorage.setItem(`${KEY}:backup:${saved.rev}`, raw)
    localStorage.removeItem(KEY)
  } catch {}
  return starterFlow()
}

export function saveFlow(flow: HabitsBimbyFlow): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(flow))
  } catch {}
}
