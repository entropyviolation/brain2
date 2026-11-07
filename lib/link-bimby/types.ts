/**
 * lib/link-bimby/types.ts — The Link BIMBY's shapes
 */

/** What the link said about itself (`GET /api/link-peek`). Empty when the Mac could not read it. */
export interface LinkPeek {
  title: string
  description: string
  author: string
  site: string
  image?: string
  keywords?: string
  /** From the video itself (`scripts/reel-watch.mjs`), when it could be fetched. */
  watched?: boolean
  /** What is said (whisper). May be song lyrics. */
  transcript?: string
  /** Text shown on screen (OCR of a frame every 3 s). */
  onScreen?: string
  /** Why the video could not be watched. */
  watchError?: string
}

/** One place in Brain2 the link could feed. */
export interface Candidate {
  /** Short handle the model answers with: `L3` (a list) or `I7` (an item). */
  ref: string
  kind: "list" | "item"
  id: string
  name: string
  /** List names for an item; a few item names for a list. */
  context: string
  score: number
}

/** A link saved before, with the note the person gave it and where it went. */
export interface PastLink {
  url: string
  note: string
  /** List names it was filed to, or "" while it still sits in the Inbox. */
  wentTo: string
  /** Names of items it was tied to (`resource-for`). */
  tiedTo: string
}

export interface LinkGuess {
  kind: "list" | "item"
  id: string
  name: string
  /** Why this place, in a short sentence. */
  why: string
  /** How the link would be used there. */
  use: string
  /** 0–1. */
  sure: number
}

export interface LinkReading {
  taskId: string
  url: string
  at: string
  /** One line on what the link is. */
  gist: string
  guesses: LinkGuess[]
  by: "model" | "rules"
  model?: string
  fallback?: string
  /** True when the page was read. */
  peeked: boolean
  /** True when the video itself was watched (speech and on-screen text). */
  watched?: boolean
  watchError?: string
  /** The link's note when it was read, so a review still makes sense after the link is filed. */
  note?: string
  /** The person's verdicts and comment on this reading. */
  review?: LinkReview
}

export type GuessVerdict = "approved" | "rejected"

/** Keyed by `guessKey` (`list:<id>` / `item:<id>`). */
export interface LinkReview {
  verdicts: Record<string, GuessVerdict>
  /** Free text: what was wrong, what it should have said. Fed back into later prompts. */
  comment?: string
  at: string
}
