/**
 * components/Settings/DriftAxisControls.tsx — Shared drift speed, pause, and manual shift
 *
 * Window gray and Bouba/Kiki use this same family. Drift speed is how long one
 * full cycle takes (pole to opposite pole and back). A manual shift is a
 * separate one-shot: Instant applies to the whole app, or Timed plus Start
 * previews inside the settings panel until the interval ends. It does not
 * replace the drift period.
 */
"use client"

import { useId, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  DRIFT_PRESET_MS,
  DRIFT_UNIT_MS,
  matchDriftPreset,
  periodFromAmount,
  splitPeriod,
  type DriftPresetId,
  type DriftUnit,
} from "@/lib/drift-clock"

const PRESET_OPTIONS: { id: DriftPresetId; label: string }[] = [
  { id: "1w", label: "1 week" },
  { id: "1d", label: "1 day" },
  { id: "hours", label: "Hours" },
  { id: "1m", label: "1 minute" },
  { id: "30s", label: "30 seconds" },
  { id: "custom", label: "Custom" },
]

const UNITS: DriftUnit[] = ["seconds", "minutes", "hours", "days", "weeks"]

export function DriftAxisControls({
  axis,
  paused,
  periodMs,
  onPeriod,
  onPaused,
  applyMode,
  onApplyMode,
  manualPeriodMs,
  onManualPeriod,
  onStart,
  startDisabled,
  shifting = false,
}: {
  /** "Warmth" or "Corners" — keeps the two copies distinguishable. */
  axis: string
  paused: boolean
  periodMs: number
  onPeriod: (periodMs: number) => void
  onPaused: (paused: boolean) => void
  applyMode: "instant" | "timed"
  onApplyMode: (mode: "instant" | "timed") => void
  manualPeriodMs: number
  onManualPeriod: (periodMs: number) => void
  onStart: () => void
  startDisabled: boolean
  /** True while a timed shift is previewing in the settings panel. */
  shifting?: boolean
}) {
  const speedId = useId()
  const manualId = useId()
  const instantId = useId()
  const timedId = useId()

  return (
    <div className="set-drift-controls">
      <DurationControl id={speedId} label={`${axis} drift speed`} periodMs={periodMs} onChange={onPeriod} />
      <p className="set-drift-hint text-[11px] text-muted-foreground">
        One full cycle: out to the other pole and back.
      </p>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => onPaused(!paused)}
      >
        {paused ? `Resume ${axis.toLowerCase()} drift` : `Pause ${axis.toLowerCase()} drift`}
      </button>

      <fieldset className="set-drift-shift">
        <legend>{axis} manual shift</legend>
        <div className="set-drift-modes">
          <label htmlFor={instantId}>
            <input
              id={instantId}
              type="radio"
              name={manualId}
              checked={applyMode === "instant"}
              onChange={() => onApplyMode("instant")}
            />
            Instant
          </label>
          <label htmlFor={timedId}>
            <input
              id={timedId}
              type="radio"
              name={manualId}
              checked={applyMode === "timed"}
              onChange={() => onApplyMode("timed")}
            />
            Timed
          </label>
        </div>
        {applyMode === "timed" ? (
          <>
            <div className="set-drift-start">
              <DurationControl id={`${manualId}-duration`} label={`${axis} transition`} periodMs={manualPeriodMs} onChange={onManualPeriod} />
              <button type="button" onClick={onStart} disabled={startDisabled}>
                {`Start ${axis.toLowerCase()} shift`}
              </button>
            </div>
            <p className="set-drift-hint text-[11px] text-muted-foreground">
              {shifting
                ? "Previewing in this panel. The rest of the app changes when this ends."
                : "Duration, then Start. This panel previews the shift. The rest of the app keeps the previous chrome until the interval ends."}
            </p>
          </>
        ) : null}
      </fieldset>
    </div>
  )
}

function DurationControl({
  id,
  label,
  periodMs,
  onChange,
}: {
  id: string
  label: string
  periodMs: number
  onChange: (periodMs: number) => void
}) {
  const [kind, setKind] = useState<DriftPresetId>(() => matchDriftPreset(periodMs))
  const hoursId = useId()
  const amountId = useId()
  const unitId = useId()
  const split = splitPeriod(periodMs)
  const hours = periodMs / DRIFT_UNIT_MS.hours

  function choose(next: DriftPresetId) {
    setKind(next)
    if (next === "1w" || next === "1d" || next === "1m" || next === "30s") onChange(DRIFT_PRESET_MS[next])
    else if (next === "hours") onChange(periodFromAmount(Math.max(1, Math.round(hours) || 1), "hours"))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          value={kind}
          onChange={(e) => choose(e.target.value as DriftPresetId)}
          aria-label={label}
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {kind === "hours" ? (
          <input
            id={hoursId}
            type="number"
            min={DRIFT_UNIT_MS.seconds / DRIFT_UNIT_MS.hours}
            step="any"
            value={Number.isFinite(hours) ? trimNumber(hours) : ""}
            aria-label={`${label} hours`}
            className="w-24"
            onChange={(e) => {
              const next = Number(e.target.value)
              if (Number.isFinite(next) && next > 0) onChange(periodFromAmount(next, "hours"))
            }}
          />
        ) : null}
        {kind === "custom" ? (
          <>
            <input
              id={amountId}
              type="number"
              min={0}
              step="any"
              value={trimNumber(split.value)}
              aria-label={`${label} amount`}
              className="w-24"
              onChange={(e) => {
                const next = Number(e.target.value)
                if (Number.isFinite(next) && next > 0) onChange(periodFromAmount(next, split.unit))
              }}
            />
            <select
              id={unitId}
              value={split.unit}
              aria-label={`${label} unit`}
              onChange={(e) => onChange(periodFromAmount(split.value, e.target.value as DriftUnit))}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
    </div>
  )
}

function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return ""
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}
