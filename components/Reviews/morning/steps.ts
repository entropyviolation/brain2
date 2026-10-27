/**
 * components/Reviews/morning/steps.ts — The twelve morning steps, in order.
 *
 * `RESUME_TO_STEP` maps a saved `resumeStep` gap name onto one of these ids.
 * The walk and the three look-ahead steps are not gap names.
 */
export const MORNING_STEPS = [
  { id: "night", label: "Last night" },
  { id: "affirmations", label: "Affirmations" },
  { id: "todos", label: "To do for today" },
  { id: "ahead", label: "Week and month" },
  { id: "due", label: "Due within a week" },
  { id: "overdue", label: "Overdue" },
  { id: "habits", label: "Daily habit priorities" },
  { id: "walk", label: "Go through to do list" },
  { id: "plan", label: "Day plan" },
  { id: "circumstances", label: "Circumstances" },
  { id: "best", label: "Best day ever" },
  { id: "gratitude", label: "Gratitude" },
] as const

export type MorningStepId = (typeof MORNING_STEPS)[number]["id"]

/** `resumeStep` gap names (desktop and `gm`) to the step that asks it. */
export const RESUME_TO_STEP: Record<string, string> = {
  bed: "night",
  wake: "night",
  dream: "night",
  affirmation: "affirmations",
  "todo-show": "todos",
  "todo-priorities": "todos",
  "habit-priorities": "habits",
  walk: "walk",
  "day-plan": "plan",
  circumstances: "circumstances",
  "best-day": "best",
  gratitude: "gratitude",
}
