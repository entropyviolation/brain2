/**
 * lib/week-log-bimby/types.ts — The Week Log BIMBY's shapes
 *
 * A week is seven `DaySummary`s (`summarize.ts`), each folded by code from that
 * day's ledger (`lib/day-log-bimby/gather.ts`) and its Day Log prose. The model
 * only writes the week's brief, feelings and questions. Pure types.
 */

import type { Amendment } from "@/lib/day-log-bimby/types"

/** One day of the week, as the Week Log reads it. Every number comes from the day's ledger. */
export interface DaySummary {
  date: string
  /** The day has not started yet. */
  future: boolean
  rows: number
  /** The Day Log's prose was written by the model. */
  narrated: boolean
  /** The Day Log's brief, or the code brief. Citations removed. */
  brief: string
  feelings: string
  /** Minutes per activity, most first. */
  activities: [string, number][]
  activityMin: number
  /** Untracked stretches of 30 min or more, in minutes. */
  gapMin: number
  places: string[]
  people: { name: string; togetherMin: number; calls: number; sent: number; received: number }[]
  calls: number
  callMin: number
  sent: number
  received: number
  macMin: number
  phoneMin: number
  kcal: number
  steps: number
  woke?: string
  slept?: string
  moods: string[]
  done: string[]
  docs: string[]
  calendar: string[]
  /** The person's own words that day: clock, where said, the words. */
  words: { when: string; where: string; text: string }[]
  /** The day's own amendments, verbatim. */
  amendments: string[]
}

/** What the model wrote about the week. Every field may be empty. */
export interface WeekNarrative {
  brief: string
  feelings: string
  questions: string[]
  model?: string
}

/** A Week Log amendment: the Day Log's shape, with `date` the week's Monday. */
export type WeekAmendment = Amendment

/** The kept record of one week's log. */
export interface WeekLogRecord {
  /** The week's Monday (`YYYY-MM-DD`). */
  id: string
  docId: string
  builtAt: string
  version: number
  bodyHash: string
  rows: number
  narrated: boolean
  model?: string
  /** The last prose, so a code-only rebuild keeps it. */
  narrative?: WeekNarrative
}
