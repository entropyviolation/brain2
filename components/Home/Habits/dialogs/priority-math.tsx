/**
 * components/Home/Habits/priority-math.tsx — Collapsible 50% floor explanation
 */
"use client"

import { useState } from "react"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { PRIORITY_GRADE_FLOOR, priorityMathLine } from "@/lib/habit-priority"

export function PriorityMathPanel({
  enabled,
  onEnabledChange,
  overall,
  priority,
  label = "Prioritized habits",
  /** Grade sheet uses a milled control. Good days keeps the ledger link. */
  explainLabel,
}: {
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  overall: number
  priority: number | null
  label?: string
  explainLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const blended =
    enabled && priority !== null
      ? PRIORITY_GRADE_FLOOR * 0.01 * priority + (1 - PRIORITY_GRADE_FLOOR * 0.01) * overall
      : overall

  return (
    <div className="habit-priority-math">
      <CockpitSwitch
        id={`${label}-prio`}
        checked={enabled}
        onCheckedChange={onEnabledChange}
        label={`Count ${label.toLowerCase()} at a 50% floor`}
      />
      <button
        type="button"
        className="habit-priority-math-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {explainLabel ?? `${open ? "Hide" : "Show"} the ledger`}
      </button>
      {open && (
        <div className="habit-priority-ledger">
          <p>
            Completing every prioritized habit is worth half the grade on its own. The other half is
            still the ordinary score of every habit. Empty days stay empty; this never lifts a 0.
          </p>
          <p className="habit-priority-ledger-eq">
            {priority === null
              ? "No habits carry priority this period — the ordinary score stands."
              : `${priorityMathLine(overall, priority)} = ${blended.toFixed(0)}%`}
          </p>
          <p className="text-xs text-muted-foreground">
            Pin a habit in its settings. Miss a whole week (or week/month for those tabs) and it
            auto-prioritizes next period, compounding until you complete it. Mute it to stop the
            auto term without clearing a pin.
          </p>
        </div>
      )}
    </div>
  )
}
