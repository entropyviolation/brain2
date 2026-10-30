/**
 * components/Home/ToDo/desk/todo-desk-constants.ts — Desk constants
 *
 * Span keys, B/G/E section titles, and the stable empty morning-priority
 * snapshot. One module-level array: a fresh `[]` in the Zustand selector loops.
 */
import { getPeriodNavLabel } from "../todo-utils"
import { seasonOfDate } from "@/lib/seasons"
import type { StepTier } from "@/lib/types"

export const TODO_TABS = ["day", "week", "month", "quarter", "other"] as const
export type TodoTab = (typeof TODO_TABS)[number]

/** Assumed length for work logged after the fact, until the user says otherwise. */
export const DEFAULT_LOGGED_DONE_MINUTES = 30

/** Stable empty snapshot for Zustand — `?? []` would allocate every getSnapshot and loop. */
export const EMPTY_PRIORITY_IDS: string[] = []

/** Span keys (Tek time-base keys): the word, and under it the span it covers. */
export const SPAN_KEYS: { value: TodoTab; word: string }[] = [
  { value: "day", word: "Day" },
  { value: "week", word: "Week" },
  { value: "month", word: "Month" },
  { value: "quarter", word: "Season" },
  { value: "other", word: "Other" },
]

export function spanSubLabel(tab: TodoTab, date: Date): string {
  if (tab === "day") return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
  if (tab === "week") return getPeriodNavLabel("week", date)
  if (tab === "month") return date.toLocaleDateString("en-US", { month: "long" })
  if (tab === "quarter") return seasonOfDate(date).replace(/^./, (c) => c.toUpperCase())
  return "named ranges"
}

export const BGE_SECTIONS: { tier: StepTier; title: string }[] = [
  { tier: "min", title: "Bare minimum" },
  { tier: "goal", title: "Goal" },
  { tier: "exceptional", title: "Exceptional" },
]
