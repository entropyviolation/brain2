/**
 * lib/tracking-helper/types.ts — Shapes shared by the Tracking Helper's stages
 *
 * A message becomes `Token`s (code), a `Wiring` (one small model call), then
 * `ProposedBlock`s (code). The model never writes a time: it only points at tokens.
 */

export type TokenKind = "clock" | "day" | "dur"

/** One time expression found in the message, tagged in the text as `4:30[T1]`. */
export interface Token {
  /** `T1` clock, `D1` day, `U1` duration. */
  id: string
  kind: TokenKind
  /** The words as written. */
  raw: string
  /** Offset of the match in the original text. */
  at: number
  /** clock: hour 0–23 or 1–12 as written, minute, and am/pm when written. */
  hour?: number
  minute?: number
  ampm?: "am" | "pm"
  /** clock: the sentence said morning or evening, so an unmarked hour is placed accordingly. */
  period?: "am" | "pm"
  /** clock: code's read of how firmly it was said. A strong cue ("for sure") beats the model; a hedge ("ish") is final. */
  cue: "strong" | "hedge" | "plain"
  /** dur: minutes. */
  minutes?: number
}

export type Cert = "exact" | "estimated"

/** What the model returns for one thing the person did. Every time is a token id or empty. */
export interface WiredSegment {
  activity: string
  place: string
  day: string
  start: string
  end: string
  /** A later time the text gives as a possible end ("maybe until 5:30"). Kept in the notes, not used as the end. */
  maybeEnd: string
  /** How long, when the text gives a length instead of an end. */
  length: string
  startVague: boolean
  endVague: boolean
  /** Short facts worth keeping that the words imply ("overcame resistance", "good deed"). */
  notes: string
  /** Who was there, as written ("patricia", "elijah and jake"). */
  with?: string
  /** How they felt, in a word or two ("happy"). */
  mood?: string
}

export interface Wiring {
  segments: WiredSegment[]
}

export type PlaceSource = "stated" | "learned" | "assumed"

export interface ProposedBlock {
  id: string
  /** Local YYYY-MM-DD. */
  day: string
  activity: string
  place?: { name: string; source: PlaceSource; isNew: boolean }
  startMin: number | null
  endMin: number | null
  startCert: Cert
  endCert: Cert
  /** The edge came from a neighbouring block, not from the words. */
  startChained?: boolean
  endChained?: boolean
  /** The text never gave an end. `endMin` is a stand-in until the person sets it. */
  openEnd?: boolean
  /** The text never gave a start. `startMin` is a stand-in until the person sets it. */
  openStart?: boolean
  notes: string
  /** Who was there. */
  with?: string
  /** How they felt. */
  mood?: string
  /** Tracking tags to put on the block (names; made if new). */
  tags?: string[]
  /** A daily habit this block counts for. `linked` is false when the habit has no Tracking link yet and Add will make one. */
  habit?: { id: string; name: string; linked: boolean }
  /** The words this block was read from. */
  from: string
}

export interface HelperContext {
  now: Date
  /** Existing pens, so a name finds the pen already in use. */
  activityPens: { id: string; name: string }[]
  locationPens: { id: string; name: string }[]
  /** Saved Activity and Location entries, so a place can be learned from what usually happens there. */
  history: HistoryRow[]
  /** Daily habits, so "count for the daily habit" can find one (`count.ts`). */
  habits?: import("./count").CountHabit[]
}

export interface HistoryRow {
  date: string
  scopeId: string
  /** Pen name. */
  pen: string
  startMin: number
  endMin: number
}

export interface TraceStage {
  stage: "route" | "tokenize" | "wire" | "place" | "where"
  ms: number
  note: string
  /** The prompt the model saw (wire only). */
  prompt?: string
  output?: unknown
  model?: string
}

export type HelperRoute = "log" | "revise" | "question"
