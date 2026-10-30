/**
 * tracker/habits-scratch-pad.tsx — Habits scratch pad under every Habits tab.
 *
 * One undated `PlanTextLog` (the Plan tab's composer) on `HABITS_SCRATCH_KEY`.
 * Desktop mounts it below the desk; the phone page puts it in the plan slot.
 */
"use client"

import { PlanTextLog, PLAN_DOCS } from "@/components/Home/Plan/plan-text-log"
import { HABITS_SCRATCH_KEY, HABITS_SCRATCH_PERIOD } from "@/lib/plan-text"
import type { UiNameStamp } from "@/components/append-log"

export const HABITS_SCRATCH_STAMP: UiNameStamp = {
  name: "Habits scratch pad",
  help: "Loose notes for the Habits tab. Submit stamps an entry. Not tied to a day, week, or habit.",
  docs: "components/Home/Habits/README.md",
}

export function HabitsScratchPad() {
  return (
    <fieldset
      className="hab-period-plan hab-plan-frame hab-scratch-pad"
      data-ui-name={HABITS_SCRATCH_STAMP.name}
      data-ui-help={HABITS_SCRATCH_STAMP.help}
      data-ui-docs={HABITS_SCRATCH_STAMP.docs ?? PLAN_DOCS}
    >
      <legend>Habits scratch pad</legend>
      <PlanTextLog
        period={HABITS_SCRATCH_PERIOD}
        periodKey={HABITS_SCRATCH_KEY}
        placeholder="Scratch notes about your habits — ideas, tweaks, what's working..."
        size="period"
        stamp={HABITS_SCRATCH_STAMP}
      />
    </fieldset>
  )
}
