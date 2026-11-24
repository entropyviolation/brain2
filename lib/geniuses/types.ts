/**
 * lib/geniuses/types.ts — The shapes of a genius, its memory, and the council
 *
 * A genius is a baby animal friend bound to one area of your life (`docs/GENIUSES.md`). It keeps three kinds of memory:
 * notes (what you told it, kept on purpose), talks (the exchanges you had with it, capped), and council minutes (what
 * it asked for in a meeting and who got the time). All three are read back into its prompt by `memory.ts`.
 */

export const GENIUS_ORIGINS = ["starter", "goal", "project"] as const
export type GeniusOrigin = (typeof GENIUS_ORIGINS)[number]

export const GENIUS_STATUSES = ["active", "resting", "retired"] as const
export type GeniusStatus = (typeof GENIUS_STATUSES)[number]

export type GeniusBindings = {
  /** Goals tab objectives (an objective is already an "area of life"). */
  objectiveIds: string[]
  goalIds: string[]
  listIds: string[]
  habitIds: string[]
  /** A project's root items; their children count too. */
  rootItemIds: string[]
}

export const NOTE_ABOUT_KINDS = ["item", "goal", "habit", "list"] as const
export type GeniusNoteAbout = { kind: (typeof NOTE_ABOUT_KINDS)[number]; id: string } | null

export type GeniusNote = {
  id: string
  at: string
  /** Your words, or a short quote of them. */
  said: string
  about: GeniusNoteAbout
  /** `picked-up` = the model offered to keep it from a reply and you accepted. Shown marked. */
  source: "you" | "picked-up"
}

export type Genius = {
  id: string
  name: string
  /** The face. Personality comes from `personalityFor(animalId)`. */
  animalId: string
  area: string
  /** What it wants for you, in your words, ≤ 280 chars. */
  charter: string
  bindings: GeniusBindings
  /** Long-term memory: what you told it, kept on purpose. */
  notes: GeniusNote[]
  origin: GeniusOrigin
  status: GeniusStatus
  createdAt: string
}

export const GENIUS_STANCES = ["press", "soften", "split", "reschedule", "concede"] as const
export type GeniusStance = (typeof GENIUS_STANCES)[number]

/** What the model must return for one talk turn. Checked by `reply.ts`. */
export type GeniusReply = {
  line: string
  stance: GeniusStance
  /** When stance is split: one smaller step. */
  smaller?: string
  /** When stance is reschedule: a date or time you named. */
  when?: string
  /** A note it would like to remember. Kept only when you accept. */
  keep?: { said: string; about: GeniusNoteAbout }
}

export type TalkLine = {
  at: string
  who: "you" | "genius"
  text: string
  stance?: GeniusStance
  /** `model`, or `script` when the model was down or its answer failed the checks. */
  by?: "model" | "script"
}

/** One conversation about one task: short-term memory. Capped at `MAX_TALK_LINES` lines. */
export type GeniusTalk = {
  id: string
  geniusId: string
  startedAt: string
  /** The assignment being argued. Never changed by the model. */
  task: string
  taskId: string | null
  lines: TalkLine[]
  /** How it ended, once it ended. */
  outcome: "open" | "accepted" | "declined" | "conceded" | "rescheduled"
}

export type CouncilAsk = {
  geniusId: string
  ask: string
  why: string
  by: "model" | "script"
}

export type CouncilReply = {
  geniusId: string
  /** To the ego, after hearing the other asks. */
  line: string
  /** Gives way to another genius, or holds. */
  yieldsTo: string | null
  by: "model" | "script"
}

/** One council meeting. Each genius later remembers its own ask and who got the time. */
export type CouncilMeeting = {
  id: string
  at: string
  /** "Tonight, 7 to 10", "This Saturday", or a question you put to the council. */
  topic: string
  geniusIds: string[]
  asks: CouncilAsk[]
  replies: CouncilReply[]
  /** The ego's pick: a genius id, or null while undecided. */
  pickedId: string | null
  /** Why you picked, in your words. */
  pickNote: string
}

export const PROMPT_IDS = ["voice", "councilAsk", "councilReply"] as const
export type PromptId = (typeof PROMPT_IDS)[number]
