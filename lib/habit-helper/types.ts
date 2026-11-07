/**
 * lib/habit-helper/types.ts — Shapes shared by the Habits BIMBY's stages
 *
 * A message is cut into `Clause`s and its numbers, days, negations and "because" parts become `Tag`s (code).
 * One small model call returns a `Matching`: per clause, which habit and which tags. Code turns that into
 * `Proposal`s. The model never writes a habit name, a number or a reason: it points at ids.
 */

export type TagKind = "amount" | "day" | "neg" | "because"

/** One thing code found in the text, marked as `10 pages[N1]`, `yesterday[D1]`, `didn't[X1]`, `because …[B1]`. */
export interface Tag {
  /** `N1` amount, `D1` day, `X1` negation, `B1` reason. */
  id: string
  kind: TagKind
  /** The words as written. */
  raw: string
  /** Offset in the original text. */
  at: number
  /** amount: the number, already in the unit below (an hour is 60 min). */
  amount?: number
  /** amount: normalized unit (`min`, `page`, `glass`, …), or "" for a bare number. */
  unit?: string
  /** amount: "more", "another", "extra" sat before it, so it adds to the cell. */
  adds?: boolean
  /** day: `YYYY-MM-DD`. */
  day?: string
  /** because: the reason words after the connector, exactly as written. */
  reason?: string
}

/** A piece of the message that can report one habit. */
export interface Clause {
  id: string
  text: string
  at: number
  /** Tag ids inside this clause. */
  tags: string[]
  /** A negation sits before any "because" in this clause. */
  negated: boolean
  /** The day in force here: this clause's own day word, else the last one before it. */
  day?: string
  /** The whole sentence it came from, for a reason with no "because". */
  sentence: string
}

/** Kept per habit so code can match words, compute values and read history. */
export interface HabitBrief {
  id: string
  name: string
  shorthand?: string
  kind: "yesno" | "goal" | "text"
  goal?: number
  /** Normalized unit: from the habit's unit, else read from its name ("read 5 pages" → `page`). */
  unit?: string
  /** Base units per habit unit: 60 when the habit counts hours (its `unit` is then `min`). */
  per?: number
  /** Extra words that count for this habit: keyword phrases and Tracking tag names. */
  words: string[]
  /** `YYYY-MM-DD` the habit was made, so older days are not misses. */
  since?: string
  /** Paused spans (contract field from session A). */
  pauses?: { from: string; to?: string }[]
  /** Daily cells, by `YYYY-MM-DD`. */
  days: Record<string, CellBrief>
}

export interface CellBrief {
  met: boolean
  completed?: boolean
  value?: number
  text?: string
  missed?: boolean
  reason?: string
  /** Notes on the cell's change log (contract `HabitCellChange.note`). */
  notes?: string[]
  /** Last write, epoch ms (`TaskCompletion.updatedAt`). */
  at?: number
}

export interface BimbyContext {
  now: Date
  habits: HabitBrief[]
}

/** What the model returns for one clause. Every field is an id that exists, or "". */
export interface MatchItem {
  clause: string
  habit: string
  /** A second habit the clause could equally be. Set means: ask. */
  maybe: string
  kind: "done" | "missed"
  amount: string
  day: string
  reason: string
}

export interface Matching {
  items: MatchItem[]
}

export type ProposalKind = "set" | "missed" | "reason" | "shorthand" | "rule"

/** The write a proposal makes when approved. */
export interface CellWrite {
  completed?: boolean
  value?: number
  text?: string
  missedOpportunity?: boolean
  missReason?: string
}

/** A session to paint on the Activity grid when the proposal is accepted. */
export interface SpanWrite {
  startMin: number
  endMin: number
  /** The person guessed the other end. Painted and credited as estimated. */
  estimated: boolean
  /** The log line it came from. */
  notes: string
}

export interface Proposal {
  id: string
  kind: ProposalKind
  habitId: string
  /** Display name: shorthand, else name. */
  habit: string
  /** `YYYY-MM-DD`; absent for a shorthand. */
  day?: string
  /** Old and new, as the card shows them ("undone" → "done", "5 pages" → "10 pages"). */
  from: string
  to: string
  write?: CellWrite
  shorthand?: string
  /** For a `rule`: the document-words feed to save on the habit when approved. */
  rule?: { docTitle: string; wordsPer: number; amount: number }
  /** Also paint this session (a walk found in the BIM log). */
  span?: SpanWrite
  /** The words it came from. */
  words: string
  /** How code got there, one line ("1 hour = 60 min", "matched by the model, not by a word"). */
  why?: string
  /** More the habit needs from the person ("How much (pages)?"). Shown on the row until it is typed. */
  needs?: string
}

/** A clause that could be two habits. The person picks; code then computes the proposal. */
export interface Ask {
  id: string
  words: string
  options: { id: string; name: string }[]
  /** The match minus the habit, so a pick can be computed later. */
  item: MatchItem
}

export interface TraceStage {
  stage: "route" | "tag" | "match" | "compute" | "propose"
  ms: number
  note: string
  prompt?: string
  output?: unknown
  model?: string
}

export type HabitRoute = "rule" | "log" | "answer" | "span" | "shorthand" | "reasons" | "nudge" | "question"
