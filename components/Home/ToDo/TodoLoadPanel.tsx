/**
 * components/Home/ToDo/TodoLoadPanel.tsx — Period load strip
 *
 * Equal-cell weather station: Casio LCDs for days (hidden on the day lens) /
 * hours / remaining estimate, an analog comfort needle (Hofstadter ×2 ÷
 * working hours), scope latch lamps, a Tek POWER lamp for the in-progress
 * soft cap, and a Habits-style via channel for estimated hours against
 * working hours.
 */
"use client"

import { PercentLedBar } from "@/components/Home/Habits/percent-led-bar"
import {
  ESTIMATE_SCOPE_LABELS,
  type ComfortBand,
  type EstimateScope,
} from "@/lib/todo-commitment"

const SCOPES: EstimateScope[] = ["all", "required", "required-prioritized"]

const BAND_LABEL: Record<ComfortBand, string> = {
  manageable: "manageable",
  overfilled: "overfilled",
  behind: "behind",
}

/** Map Hofstadter comfort ratio onto a −90°…+90° needle (1.0 sits at center). */
function comfortNeedleDeg(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return -90
  // 0 → −90°, 1 → 0°, ≥10 → +90°
  const t = Math.min(1, Math.max(0, Math.log10(1 + ratio * 9) / 1))
  return -90 + t * 180
}

export function TodoLoadPanel({
  showDaysLeft = true,
  daysLeft,
  estimate,
  estimateMinutes,
  unestimated,
  included,
  scope,
  onScopeChange,
  hoursLeft,
  workingHours,
  workingHoursValue,
  comfortRatioText,
  comfortRatioValue,
  band,
  inProgress,
  wipLimit,
  onUnestimatedClick,
}: {
  /** Day lens hides this cell. Week, month, and season still show it. */
  showDaysLeft?: boolean
  daysLeft: string
  estimate: string
  estimateMinutes: number
  unestimated: number
  included: number
  scope: EstimateScope
  onScopeChange: (scope: EstimateScope) => void
  hoursLeft: string
  workingHours: string
  workingHoursValue: number
  comfortRatioText: string
  comfortRatioValue: number
  band: ComfortBand
  inProgress: number
  wipLimit: number
  onUnestimatedClick?: () => void
}) {
  const loadPct =
    workingHoursValue > 0
      ? Math.min(100, Math.round((estimateMinutes / 60 / workingHoursValue) * 100))
      : estimateMinutes > 0
        ? 100
        : 0
  const overCap = inProgress > wipLimit
  const needle = comfortNeedleDeg(comfortRatioValue)
  const comfortTitle = `Estimated hours × 2 (Hofstadter's Law) ÷ working hours left. Under 1 is manageable. From 1 through 10 is overfilled. Above 10 is behind. Clock hours left: ${hoursLeft}.`

  return (
    <div
      className="todo-load"
      aria-label="Period load"
      data-ui-name="Period load"
      data-ui-help="Working hours, estimate of work remaining, comfort, scope, and in progress. Days left on week, month, and season."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="period-load"
    >
      {showDaysLeft ? (
        <div className="todo-load-cell">
          <div className="todo-load-label">Days left</div>
          <div className="todo-casio" aria-live="polite">
            {daysLeft}
          </div>
        </div>
      ) : null}

      <div className="todo-load-cell">
        <div className="todo-load-label">Working hours left</div>
        <div
          className="todo-casio"
          title={`Working hours: future days × 10 plus hours left today before 11pm. Clock hours left (not used by comfort): ${hoursLeft}.`}
        >
          {workingHours}
        </div>
      </div>

      <div className="todo-load-cell todo-load-estimate">
        <div className="todo-load-label">Est hours of work remaining</div>
        <div className="todo-casio">
          {estimate}
          <span className="todo-casio-sub">
            {" "}
            · {included} {included === 1 ? "task" : "tasks"}
          </span>
        </div>
        {unestimated > 0 ? (
          <button
            type="button"
            className="todo-unest-link"
            onClick={onUnestimatedClick}
            title="Open tasks with no estimate"
          >
            {unestimated} without an estimate
          </button>
        ) : null}
        <div className="todo-load-channel" title="Estimated hours against working hours left">
          <PercentLedBar value={loadPct} label="Period load" density="compact" />
        </div>
      </div>

      <div className="todo-load-cell todo-load-comfort" title={comfortTitle}>
        <div className="todo-load-label">Comfort</div>
        <div className={`todo-meter is-${band}`} aria-label={`Comfort ${comfortRatioText} · ${BAND_LABEL[band]}`}>
          <svg className="todo-meter-face" viewBox="0 0 100 58" aria-hidden="true">
            <path
              className="todo-meter-arc is-manageable"
              d="M 12 48 A 38 38 0 0 1 38 14"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              className="todo-meter-arc is-overfilled"
              d="M 38 14 A 38 38 0 0 1 62 14"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              className="todo-meter-arc is-behind"
              d="M 62 14 A 38 38 0 0 1 88 48"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <g className="todo-meter-needle" style={{ transform: `rotate(${needle}deg)` }}>
              <line x1="50" y1="48" x2="50" y2="16" strokeWidth="2" strokeLinecap="round" />
              <circle cx="50" cy="48" r="3.5" />
            </g>
          </svg>
          <div className="todo-meter-hub">{comfortRatioText}</div>
          <div className="todo-meter-band">{BAND_LABEL[band]}</div>
        </div>
      </div>

      <div className="todo-load-cell todo-load-scope">
        <div className="todo-load-label">Scope</div>
        <div className="todo-scope-lamps" role="group" aria-label="Estimated time filter">
          {SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              className={`todo-scope-lamp${scope === value ? " is-lit" : ""}`}
              aria-pressed={scope === value}
              aria-label={ESTIMATE_SCOPE_LABELS[value]}
              onClick={() => onScopeChange(value)}
              title={ESTIMATE_SCOPE_LABELS[value]}
            >
              <span className="todo-scope-pip" aria-hidden />
              {ESTIMATE_SCOPE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className={`todo-load-cell todo-load-wip${overCap ? " is-hot" : ""}`}>
        <div className="todo-load-label">In progress</div>
        <div className="todo-wip-face">
          <span
            className={`todo-power-lamp${overCap ? " is-warm" : ""}`}
            aria-hidden
            title={overCap ? "Over the soft cap" : "Under the soft cap"}
          />
          <span className="todo-casio todo-casio-inline">
            {inProgress} in progress (cap {wipLimit})
          </span>
        </div>
      </div>
    </div>
  )
}
