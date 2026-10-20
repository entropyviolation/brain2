/**
 * components/steps/StepTierMarks.tsx — A step's B · G · E tag and spark (Phase 10, UI-7)
 *
 * The tag shows the step's own tier, or its inherited one dimmed. Click cycles
 * B → G → E → inherit (`cycleStepTier`). The spark is a self-observation mark:
 * click sets or clears it (`toggleStepSpark`). Neither changes points or progress.
 */
"use client"

import { startTransition, useState } from "react"
import type { StepTier, Subtask } from "@/lib/types"
import {
  STEP_TIER_LABEL,
  STEP_TIER_SHORT,
  cycleStepTier,
  effectiveTier,
  isStepTier,
  nextTierInCycle,
  toggleStepSpark,
} from "@/lib/step-tiers"

export function StepTierMarks({
  step,
  steps,
  onChange,
}: {
  step: Subtask
  steps: Subtask[]
  onChange: (next: Subtask[]) => void
}) {
  // Optimistic: the tag flips on click; the tree write runs as a transition so the paint never waits on it.
  const [pending, setPending] = useState<{ from: StepTier | undefined; to: StepTier | undefined } | null>(null)
  const saved = isStepTier(step.tier) ? step.tier : undefined
  const own = pending && pending.from === saved ? pending.to : saved
  const shown = own ?? (pending && pending.from === saved ? undefined : effectiveTier(steps, step.id)) ?? "goal"
  const next = nextTierInCycle(own)
  const sparked = !!step.sparkedAt
  return (
    <span className="step-tier-marks">
      <button
        type="button"
        data-no95
        tabIndex={-1}
        className={`step-tier-tag is-${shown}${own ? "" : " is-inherited"}`}
        title={`${STEP_TIER_LABEL[shown]}${own ? "" : " (inherited)"}. Click for ${next ? STEP_TIER_LABEL[next] : "inherit"}.`}
        aria-label={`Tier of ${step.description}: ${STEP_TIER_LABEL[shown]}${own ? "" : ", inherited"}`}
        onClick={() => {
          setPending({ from: saved, to: next })
          startTransition(() => onChange(cycleStepTier(steps, step.id, own)))
        }}
      >
        {STEP_TIER_SHORT[shown]}
      </button>
      <button
        type="button"
        data-no95
        tabIndex={-1}
        className={`step-spark${sparked ? " is-on" : ""}`}
        aria-pressed={sparked}
        title={sparked ? "This step pulls you. Click to clear." : "Mark a step that pulls you"}
        aria-label={sparked ? `Clear spark on ${step.description}` : `Spark ${step.description}`}
        onClick={() => onChange(toggleStepSpark(steps, step.id))}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 .8 5.9 4.1 9.2 5 5.9 5.9 5 9.2 4.1 5.9.8 5 4.1 4.1Z" fill={sparked ? "currentColor" : "none"} stroke="currentColor" strokeWidth=".9" strokeLinejoin="round" />
        </svg>
      </button>
    </span>
  )
}
