/**
 * lib/ritual-points.ts — Points for finishing a period ritual
 *
 * Submitting a ritual as done awards `sectionPoints` (default 10) for each
 * section the person actually completed, plus `completionBonus` (default 30)
 * for submitting the whole ritual. Closing the dialog saves a draft and
 * awards nothing.
 *
 * A section counts when it was meaningfully filled or confirmed:
 * - Unfinished / assumed times: the period had nothing to settle, or the
 *   person resolved at least one row (done, push, blocked reason, or a
 *   time confirmation). Leaving rows untouched does not count.
 * - Summary, gratitude, plan reflection, each reflection question, wake-up
 *   reminder, what matters most, time note: non-empty text.
 * - Tomorrow's plan: a plan-text entry for the next day.
 * - Goals to focus: at least one goal picked.
 * - Longer rituals (week, month, season, year): each answered arc question.
 *   Inspiration counts with a photo and no caption. Fear and its reframe are
 *   one section. Blank prompts are skipped. The stats panel is not a question.
 * Optional sections left blank are skipped. Vacuous sections (nothing
 * unfinished, nothing assumed) count — the ritual included them and they
 * were already settled.
 */
import type { PeriodArcReflection, PeriodReview, ReviewPeriod } from "@/lib/types"
import { filledArcSectionIds } from "@/lib/period-arc"

export const DEFAULT_RITUAL_SECTION_POINTS = 10
export const DEFAULT_RITUAL_COMPLETION_BONUS = 30

export interface RitualPointSettings {
  sectionPoints: number
  completionBonus: number
}

export interface RitualSectionInput {
  period: ReviewPeriod
  unfinishedCount: number
  /** Done, pushed, or given a blocked reason during this ritual. */
  unfinishedTouched: number
  /** Unconfirmed assumed-time rows still waiting. */
  assumedPending: number
  /** Confirmations or corrections made, or zero when nothing was pending. */
  assumedTouched: boolean
  summary?: string
  gratitude?: string[]
  /** Present only when the period had a stored plan to reflect on. */
  planShown: boolean
  planReflection?: string
  reflections?: Record<string, string>
  /** Day rituals: the next day's plan text. Other periods: `nextPlans`. */
  nextPlanText?: string
  wakeReminder?: string
  tomorrowMatters?: string
  timeReflection?: string
  focusGoalCount?: number
  /** Week / month / season / year reflection. Ignored on a day ritual. */
  arc?: PeriodArcReflection
}

const REFLECTION_IDS = ["wentWell", "improve", "learned"] as const

function filled(value: string | undefined): boolean {
  return !!value?.trim()
}

/** Section ids that earned points for this submit. Order is the ritual's order. */
export function completedRitualSections(input: RitualSectionInput): string[] {
  const sections: string[] = []
  if (input.unfinishedCount === 0 || input.unfinishedTouched > 0) sections.push("unfinished")
  if (input.assumedPending === 0 || input.assumedTouched) sections.push("assumed")
  if (filled(input.summary)) sections.push("summary")
  if ((input.gratitude ?? []).some((line) => filled(line))) sections.push("gratitude")
  if (input.planShown && filled(input.planReflection)) sections.push("planReflection")
  for (const id of REFLECTION_IDS) {
    if (filled(input.reflections?.[id])) sections.push(id)
  }
  if (filled(input.nextPlanText)) sections.push("nextPlans")
  if (input.period === "day") {
    if (filled(input.wakeReminder)) sections.push("wakeReminder")
    if (filled(input.tomorrowMatters)) sections.push("tomorrowMatters")
    if (filled(input.timeReflection)) sections.push("timeReflection")
    if ((input.focusGoalCount ?? 0) > 0) sections.push("focusGoals")
  } else {
    sections.push(...filledArcSectionIds(input.arc))
  }
  return sections
}

export function clampPointAmount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

/** Points for a submitted ritual. Drafts pass `submitted: false` and earn 0. */
export function ritualAwardPoints(
  input: RitualSectionInput,
  settings: RitualPointSettings,
  submitted: boolean,
): number {
  if (!submitted) return 0
  const sectionPoints = clampPointAmount(settings.sectionPoints, DEFAULT_RITUAL_SECTION_POINTS)
  const bonus = clampPointAmount(settings.completionBonus, DEFAULT_RITUAL_COMPLETION_BONUS)
  return completedRitualSections(input).length * sectionPoints + bonus
}

export function ritualPointsTaskId(period: ReviewPeriod, periodKey: string): string {
  return `ritual:${period}:${periodKey}`
}

export function ritualPointsLabel(review: Pick<PeriodReview, "period">, sections: number, bonus: number): string {
  const name = review.period === "day" ? "Night ritual" : `${review.period} review`
  return `${name} · ${sections} section${sections === 1 ? "" : "s"} + ${bonus} bonus`
}
