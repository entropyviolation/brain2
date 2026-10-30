/**
 * components/Reviews/morning/types.ts — Shapes for the desktop morning ritual.
 *
 * `MorningSlice` is the saved `PeriodReview.morning` record. `MorningDraft` is
 * the form in the dialog and in session storage. Key order on `MorningDraft`
 * is part of the dirty check, because that check is `JSON.stringify`.
 */
import type { TodoWalkFormFields } from "@/lib/morning-todo-walk"
import type { PeriodReview } from "@/lib/types"

export type MorningSlice = NonNullable<PeriodReview["morning"]>

export type MorningDraft = {
  allNighter: boolean
  wakeTime: string
  bedTime: string
  dream: string
  affirmations: string[]
  newTodoLines: string[]
  priorityIds: string[]
  priorityHabitIds: string[]
  todoWalkById: Record<string, TodoWalkFormFields>
  dayPlan: string
  circumstance: { mustDo: boolean; mustNotDo: boolean; newEvents: boolean; excited: boolean }
  mustDo: string
  mustNotDo: string
  newEvents: string
  excitedAbout: string
  bestDayWhy: string
  gratitude: string[]
}
