/**
 * lib/day-log-bimby/types.ts — The Day Log BIMBY's shapes
 *
 * A day's sources (`DaySources`, read from the stores by `sources.ts`) become
 * one ledger of numbered evidence rows (`Evidence`, `gather.ts`). The document
 * (`render.ts`) is built from those rows by code; the model only writes the
 * narrative, and cites rows as [E12]. Pure types.
 */

/** Where a row came from. Each has one label in the doc (`SOURCE_LABEL`). */
export type EvidenceSource =
  | "activity"
  | "place"
  | "company"
  | "mood"
  | "screen-mac"
  | "screen-phone"
  | "call"
  | "text"
  | "food"
  | "intake"
  | "tracking"
  | "sleep"
  | "health"
  | "bim"
  | "telegram"
  | "log"
  | "day-note"
  | "doc"
  | "done"
  | "plan"
  | "event"
  | "photo"
  | "amendment"

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  activity: "Activity",
  place: "Location",
  company: "Company",
  mood: "Mood",
  "screen-mac": "Mac screen time",
  "screen-phone": "iPhone screen time",
  call: "Phone call",
  text: "Text",
  food: "Food",
  intake: "Intake",
  tracking: "Tracking",
  sleep: "Sleep",
  health: "Apple Health",
  bim: "BIM chat",
  telegram: "Telegram",
  log: "Log item",
  "day-note": "Day note",
  doc: "Doc",
  done: "Done",
  plan: "Plan",
  event: "Calendar",
  photo: "Photos",
  amendment: "Amendment",
}

/** One fact about the day. `n` is its number in the ledger ([E12]). */
export interface Evidence {
  n: number
  source: EvidenceSource
  /** Minute of the day it started, 0–1439. Null when the source gives no clock. */
  startMin: number | null
  /** Exclusive end minute for a span. Absent on an instant. */
  endMin?: number
  /** What happened, worded short ("Work · Brain2 day logs", "Home", "Call with Mom, 12 min"). */
  what: string
  /** The person's own words, verbatim, when the row holds them. */
  ownWords?: string
  /** The clock was estimated or guessed. */
  estimated?: boolean
  /** A machine wrote it (phone sync, Screen Time, Health, sleep import). */
  machine?: boolean
  /** A person this row is about (company, a call, a text). */
  person?: string
  /** Text direction, for a text row. */
  dir?: "in" | "out"
  /** Calories, for a food row with a plate. */
  kcal?: number
}

/** A tracking row, as the gatherer needs it. The store's `TimeEntry` fits. */
export interface SourceEntry {
  id: string
  date: string
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  variantIds?: string[]
  talkingPenIds?: string[]
  kind?: string
  startMin: number
  endMin: number
  title?: string
  notes?: string
  precision?: string
  clockCertainty?: string
  generatedBy?: { kind?: string; id?: string }
  intakeClass?: string
  secret?: boolean
}

export interface SourceScope {
  id: string
  name: string
  pens: { id: string; name: string; variants?: { id: string; name: string }[] }[]
}

/** A correction, addition or note the person gave about a day. Their words win over every other row. */
export interface Amendment {
  id: string
  /** The day it is about, local `YYYY-MM-DD`. */
  date: string
  /** ISO, when it was said. */
  at: string
  /** Verbatim. */
  text: string
  kind: "correction" | "addition" | "note"
  /** A clock read out of the words, minute of the day. */
  atMin?: number
  /** Where it was said. */
  via: "docs" | "bim"
}

/** Everything known about one day, read from the stores. Pure data. */
export interface DaySources {
  date: string
  scopes: SourceScope[]
  /** Tracking rows on this date (every view). */
  entries: SourceEntry[]
  /** Calories per tracking row id, from the Food book's plates. */
  plateKcal?: Record<string, number>
  dayNote?: string
  /** This morning's night (woke today) and tonight's (went to bed tonight, on tomorrow's key). */
  sleep?: { woke?: SleepEnd; tonight?: SleepEnd }
  health?: { steps?: number; distanceM?: number; flights?: number; activeKcal?: number; heartAvg?: number; heartMin?: number; heartMax?: number }
  /** BIM chat lines on this date. */
  bim: { at: string; who: "you" | "bim"; text: string }[]
  /** Telegram messages BIM received on this date. */
  telegram: { at: string; text: string }[]
  /** Log items made on this date. */
  logs: { at: string; text: string }[]
  /** Docs created or edited on this date (day logs left out). */
  docs: { id: string; title: string; at: string; created: boolean; text: string }[]
  /** Items completed on this date. */
  done: { at: string; title: string }[]
  /** Calendar events on this date. */
  events: { title: string; time?: string; allDay?: boolean }[]
  /** Day plans made on this date in BIM chat. */
  plans: { at: string; text: string; items: string[] }[]
  /** Photos filed on this day. */
  photos?: number
  amendments: Amendment[]
}

export interface SleepEnd {
  /** Bedtime, signed minutes from midnight of the morning's date (negative = the evening before). */
  sleptMin?: number
  wokeMin?: number
  note?: string
  allNighter?: boolean
}

/** What the model wrote. Every field may be empty: the doc stands without it. */
export interface DayNarrative {
  /** A paragraph per window, keyed by the window's first minute. */
  windows: { fromMin: number; toMin: number; text: string }[]
  brief: string
  feelings: string
  questions: string[]
  model?: string
}

/** The kept record of one day's log. */
export interface DayLogRecord {
  /** The date (`YYYY-MM-DD`). */
  id: string
  docId: string
  builtAt: string
  version: number
  /** Hash of the body last written, to tell a hand edit from our own write. */
  bodyHash: string
  model?: string
  rows: number
  /** True when the model wrote the narrative. */
  narrated: boolean
}
