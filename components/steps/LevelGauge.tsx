/**
 * components/steps/LevelGauge.tsx — How far a task or step is, by level (Phase 10, R15/R16)
 *
 * On a tree with step tiers: three thin bars, B · G · E, each the weighted
 * percent of that level's view; an empty level reads `—`, never 0%. Without
 * tiers: one bar, the weighted percent. Counts stay beside it as `3/6`.
 * The numbers come from `lib/step-progress.ts`.
 */
"use client"

import type { StepTier, Subtask } from "@/lib/types"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT, hasStepTiers } from "@/lib/step-tiers"
import { formatPercent, levelProgress, weightedPercent } from "@/lib/step-progress"
import { internalStepProgress } from "@/lib/todo-steps"
import "./step-tree.css"

function Bar({ value, label, short, focus }: { value: number | null; label: string; short?: string; focus?: boolean }) {
  return (
    <span className={`level-gauge-cell${value == null ? " is-empty" : ""}${focus ? " is-focus" : ""}`} title={`${label}: ${formatPercent(value)}`}>
      {short ? <span className="level-gauge-short">{short}</span> : null}
      <span className="level-gauge-track" aria-hidden>
        <span className="level-gauge-fill" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      </span>
      <span className="level-gauge-pct">{formatPercent(value)}</span>
    </span>
  )
}

export function LevelGauge({
  steps,
  stepId,
  focus,
  counts = true,
}: {
  /** The task's whole step tree. */
  steps: readonly Subtask[] | undefined
  /** Read one step's subtree instead of the task. */
  stepId?: string
  /** The Tier filter's level, drawn a little stronger. */
  focus?: StepTier
  /** Show `3/6` before the bars (default on). */
  counts?: boolean
}) {
  const list = [...(steps ?? [])]
  if (list.length === 0) return null
  const tally = counts && !stepId ? internalStepProgress(list) : null
  const tiered = hasStepTiers(list)
  const levels = tiered ? levelProgress({ subtasks: list }, stepId) : null
  return (
    <span className="level-gauge" aria-label="Progress">
      {tally ? (
        <span className="level-gauge-count">
          {tally.completed}/{tally.total}
        </span>
      ) : null}
      {levels ? (
        STEP_TIERS.map((tier) => (
          <Bar key={tier} value={levels[tier]} label={STEP_TIER_LABEL[tier]} short={STEP_TIER_SHORT[tier]} focus={focus === tier} />
        ))
      ) : (
        <Bar value={weightedPercent(list)} label="Done, weighted" />
      )}
    </span>
  )
}
