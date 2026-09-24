/**
 * components/Home/Habits/grade-breakdown-dialog.tsx — Week grade breakdown
 *
 * Click-through from the Habits Tab Control Panel grade tube: milled sheet with
 * CRT percent, raw vs curved day readouts, curve tolerance, and discharge hue.
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { type WeekGradeDay, type WeekGradeResult } from "@/lib/calculations"
import {
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
} from "@/lib/habit-accomplishment"
import { format } from "date-fns"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"
import { blendPriorityScore } from "@/lib/habit-priority"
import { useHabitsStore } from "@/lib/habits-store"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import type { CSSProperties } from "react"

type PeriodUnit = "day" | "week" | "month"

interface GradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: WeekGradeResult
  onToleranceChange: (value: number) => void
  accomplishmentThreshold?: number
  accomplishmentBonus?: number
  periodUnit?: PeriodUnit
  usePriority?: boolean
  onUsePriorityChange?: (value: boolean) => void
  priorityScore?: number | null
}

function formatPeriodRow(d: WeekGradeDay, unit: PeriodUnit): string {
  if (unit === "month") return format(d.date, "MMM yyyy")
  if (unit === "week") return `w/c ${format(d.date, "M/d")}`
  return format(d.date, "EEE M/d")
}

export function GradeBreakdownDialog({
  open,
  onOpenChange,
  result,
  onToleranceChange,
  accomplishmentThreshold = DEFAULT_ACCOMPLISHMENT_THRESHOLD,
  accomplishmentBonus = DEFAULT_ACCOMPLISHMENT_BONUS,
  periodUnit = "day",
  usePriority = false,
  onUsePriorityChange,
  priorityScore = null,
}: GradeBreakdownDialogProps) {
  const bonus = result.curveBonus
  const noun = periodUnit
  const title = periodUnit === "month" ? "Month grade" : periodUnit === "week" ? "Span grade" : "Week grade"
  const shown = blendPriorityScore(result.grade, priorityScore, usePriority)
  const tubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const setGradeTubeColor = useHabitsStore((s) => s.setGradeTubeColor)
  const dayLift = useHabitsStore((s) => s.dayGradeLiftBonus)
  const weekLift = useHabitsStore((s) => s.weeklyGradeLiftBonus)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const periodLabel = periodUnit === "day" ? "Day" : periodUnit === "week" ? "Week" : "Month"
  const hero =
    result.daysIncluded === 0 ? "—" : `${shown.toFixed(0)}%`
  const sheetStyle = { "--hab-grade-tube": tubeColor } as CSSProperties

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hab-grade-sheet sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={sheetStyle}
      >
        <DialogHeader className="hab-grade-sheet-caption">
          <span className="hab-grade-sheet-power" aria-hidden="true" />
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="hab-grade-sheet-lead">
            Current grade is the average of each elapsed {noun}’s score after the {noun}ly curve.
            Raw completion is unchanged; the curve only affects this grade. Zero stays zero.
          </DialogDescription>
        </DialogHeader>

        <div className="hab-grade-sheet-hero">
          <span className="hab-grade-sheet-hero-label">Current grade</span>
          <div className="hab-grade-sheet-crt">
            <span className="hab-grade-sheet-crt-value">{hero}</span>
            {result.daysIncluded > 0 && (result.curveBonus > 0 || usePriority) && (
              <span className="hab-grade-sheet-crt-ordinary">
                ordinary {result.grade.toFixed(0)}%
              </span>
            )}
          </div>
          {result.daysIncluded > 0 && (
            <p className="hab-grade-sheet-eq">
              {result.days.filter((d) => !d.vacant).map((d) => d.curved.toFixed(0)).join(" + ")}
              {" = "}
              {result.days.filter((d) => !d.vacant).reduce((a, d) => a + d.curved, 0).toFixed(0)}
              {" / "}
              {result.days.filter((d) => !d.vacant).length}
              {" = "}
              {result.grade.toFixed(0)}%
            </p>
          )}
        </div>

        <div className="hab-grade-sheet-bay">
          <span className="hab-grade-sheet-bay-legend">Curve</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor="grade-tolerance" className="hab-grade-sheet-field-label">
              {periodUnit === "day" ? "Daily" : periodUnit === "week" ? "Weekly" : "Monthly"} perfect
              threshold (tolerance)
            </Label>
            <div className="hab-grade-sheet-control-row">
              <Input
                id="grade-tolerance"
                type="number"
                min={1}
                max={100}
                step={1}
                value={result.tolerance}
                onChange={(e) => onToleranceChange(Number(e.target.value))}
                className="hab-grade-sheet-field w-24"
              />
              <span className="hab-grade-sheet-hint is-inline">
                % raw = 100% on the curve
              </span>
            </div>
            <p className="hab-grade-sheet-hint">
              {bonus === 0
                ? `100% tolerance means no curve: each ${noun}’s score equals raw completion.`
                : `Each ${noun} is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Scores can go above 100%. A 0% ${noun} stays 0 — the curve does not lift empty ${noun}s.`}
            </p>
          </div>

          <span className="hab-grade-sheet-bay-legend">Discharge</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor="grade-tube-color" className="hab-grade-sheet-field-label">
              Discharge color
            </Label>
            <div className="hab-grade-sheet-control-row">
              <ColorSwatch
                id="grade-tube-color"
                value={tubeColor}
                onChange={setGradeTubeColor}
                aria-label={`${title} tube color`}
                size="md"
                disabled={!hydrated}
              />
              <span className="hab-grade-sheet-swatch-hex">{tubeColor}</span>
            </div>
            <p className="hab-grade-sheet-hint">
              Hue of the plasma column. Glass and vacuum stay clear.
            </p>
          </div>

          {onUsePriorityChange && (
            <PriorityMathPanel
              enabled={usePriority}
              onEnabledChange={onUsePriorityChange}
              overall={result.grade}
              priority={priorityScore}
              label="prioritized habits"
            />
          )}
        </div>

        {periodUnit === "week" && (
          <p className="hab-grade-sheet-note">
            +{weekLift} for each of this week’s weekly-habit grade and output that is higher than last week
            (Settings).
          </p>
        )}

        {periodUnit === "day" && (
          <p className="hab-grade-sheet-note">
            Points: each daily habit is worth 50 (partial completion counts, e.g. 5/10 pages = 25).
            Each day: +{accomplishmentBonus} if that day’s raw score is at or above {accomplishmentThreshold}%
            (Good day, set in Settings); +100 if either Week grade or Perfect
            output is 75%+ after its curve; +300 if both grades are. +{dayLift} for each of
            those grades that is higher than yesterday (Settings).
          </p>
        )}

        {result.days.length > 0 ? (
          <div className="hab-grade-sheet-proof" role="table" aria-label={`${title} breakdown`}>
            <div className="hab-grade-sheet-proof-head" role="row">
              <span role="columnheader">{periodLabel}</span>
              <span role="columnheader">Raw</span>
              <span role="columnheader">Curved</span>
            </div>
            {result.days.map((d) => (
              <div key={d.dateKey} className="hab-grade-sheet-row" role="row">
                <span className="hab-grade-sheet-row-name" role="cell">
                  {formatPeriodRow(d, periodUnit)}
                </span>
                <span
                  className={`hab-grade-sheet-row-readout${d.vacant ? " is-mute" : ""}`}
                  role="cell"
                >
                  {d.vacant ? "exempt" : `${d.raw.toFixed(0)}%`}
                </span>
                <span
                  className={`hab-grade-sheet-row-readout${d.vacant ? " is-mute" : ""}`}
                  role="cell"
                >
                  {d.vacant ? "—" : `${d.curved.toFixed(0)}%`}
                </span>
              </div>
            ))}
            <div className="hab-grade-sheet-row is-avg" role="row">
              <span className="hab-grade-sheet-row-name" role="cell">
                Average
              </span>
              <span className="hab-grade-sheet-row-readout" role="cell">
                {result.rawGrade.toFixed(0)}%
              </span>
              <span className="hab-grade-sheet-row-readout" role="cell">
                {result.grade.toFixed(0)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="hab-grade-sheet-empty">No elapsed {noun}s in this window yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
