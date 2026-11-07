/**
 * lib/inbox-bimby/types.ts — The Inbox Helper BIMBY's shapes
 */

/** One place in Brain2 an Inbox idea could go, or sit beside. */
export interface Candidate {
  /** Short handle the model answers with: `L3` (list), `I7` (open item), `S2` (another Inbox idea). */
  ref: string
  kind: "list" | "item"
  id: string
  name: string
  /** `inbox` for another idea still in the Inbox; `vault` for an item already filed. Items only. */
  where?: "inbox" | "vault"
  /** List names for an item; a few item names for a list. */
  context: string
  score: number
}

/** A list the idea would fit. */
export interface FileGuess {
  listId: string
  name: string
  why: string
  /** 0–1. */
  sure: number
}

/** An item the idea repeats or sits close to. */
export interface MatchGuess {
  id: string
  name: string
  where: "inbox" | "vault"
  /** `duplicate` is the same thing twice; `similar` is related, and worth merging or linking. */
  relation: "duplicate" | "similar"
  why: string
  sure: number
}

export interface HelperSuggestion {
  taskId: string
  /** The idea's name when asked, so a changed title shows. */
  title: string
  at: string
  files: FileGuess[]
  matches: MatchGuess[]
  /** Questions that would make the idea clear enough to file. */
  questions: string[]
  by: "model" | "rules"
  model?: string
  /** Why the rules answered instead of a model. */
  fallback?: string
}
