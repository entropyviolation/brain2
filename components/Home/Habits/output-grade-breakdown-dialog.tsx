/**
 * components/Home/Habits/output-grade-breakdown-dialog.tsx — Perfect Output grade
 *
 * Click-through from the Habits Tab Control Panel Perfect output tube: milled
 * sheet with CRT percent, elapsed habit row readouts, curve tolerance, and
 * discharge hue. Does not change Week grade (`grade-breakdown-dialog.tsx`).
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { type OutputGradeResult } from "@/lib/calculations"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"
import { blendPriorityScore } from "@/lib/habit-priority"
import { useHabitsStore } from "@/lib/habits-store"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import type { CSSProperties } from "react"

type PeriodUnit = "day" | "week" | "month"

interface OutputGradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: OutputGradeResult
  onToleranceChange: (value: number) => void
  periodUnit?: PeriodUnit
  usePriority?: boolean
  onUsePriorityChange?: (value: boolean) => void
  priorityScore?: number | null
}

export function OutputGradeBreakdownDialog({
  open,
  onOpenChange,
  result,
  onToleranceChange,
  periodUnit = "day",
  usePriority = false,
  onUsePriorityChange,
  priorityScore = null,
}: OutputGradeBreakdownDialogProps) {
  const bonus = result.curveBonus
  const noun = periodUnit
  const habitScope = periodUnit === "day" ? "daily" : periodUnit === "week" ? "weekly" : "monthly"
  const shown = blendPriorityScore(result.grade, priorityScore, usePriority)
  const tubeColor = useHabitsStore((s) => s.outputGradeTubeColor)
  const setOutputGradeTubeColor = useHabitsStore((s) => s.setOutputGradeTubeColor)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const hero =
    result.daysIncluded === 0 || result.habits.length === 0
      ? "—"
      : `${shown.toFixed(0)}%`
  const sheetStyle = { "--hab-grade-tube": tubeColor } as CSSProperties

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hab-grade-sheet is-output sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={sheetStyle}
      >
        <DialogHeader className="hab-grade-sheet-caption">
          <span className="hab-grade-sheet-power" aria-hidden="true" />
          <DialogTitle>Perfect output</DialogTitle>
          <DialogDescription className="hab-grade-sheet-lead">
            Current grade is the average of each {habitScope} habit’s elapsed row % after
            the output curve. Row % here is paced to elapsed {noun}s, not
            the grid’s full-window denominator. Raw completion and the span grade are unchanged;
            the curve only affects this grade.
          </DialogDescription>
        </DialogHeader>

        <div className="hab-grade-sheet-hero">
          <span className="hab-grade-sheet-hero-label">Current grade</span>
          <div className="hab-grade-sheet-crt">
            <span className="hab-grade-sheet-crt-value">{hero}</span>
            {result.habits.length > 0 && (result.curveBonus > 0 || usePriority) && (
              <span className="hab-grade-sheet-crt-ordinary">
                ordinary {result.rawGrade.toFixed(0)}%
              </span>
            )}
          </div>
          {result.habits.length > 0 && (
            <p className="hab-grade-sheet-eq">
              {result.habits.map((h) => h.curved.toFixed(0)).join(" + ")}
              {" = "}
              {result.habits.reduce((a, h) => a + h.curved, 0).toFixed(0)}
              {" / "}
              {result.habits.length}
              {" = "}
              {result.grade.toFixed(0)}%
              {result.daysIncluded > 0
                ? ` · ${result.daysIncluded} ${noun}${result.daysIncluded === 1 ? "" : "s"} elapsed`
                : ""}
            </p>
          )}
        </div>

        <div className="hab-grade-sheet-bay">
          <span className="hab-grade-sheet-bay-legend">Curve</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor="output-grade-tolerance" className="hab-grade-sheet-field-label">
              Output perfect threshold (tolerance)
            </Label>
            <div className="hab-grade-sheet-control-row">
              <Input
                id="output-grade-tolerance"
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
                ? "100% tolerance means no curve: each habit’s score equals elapsed row completion."
                : `Each habit is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Habits can go above 100%. A 0% habit stays 0 — the curve does not lift empty rows.`}
            </p>
          </div>

          <span className="hab-grade-sheet-bay-legend">Discharge</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor="output-grade-tube-color" className="hab-grade-sheet-field-label">
              Discharge color
            </Label>
            <div className="hab-grade-sheet-control-row">
              <ColorSwatch
                id="output-grade-tube-color"
                value={tubeColor}
                onChange={setOutputGradeTubeColor}
                aria-label="Perfect output tube color"
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
              label="prioritized output"
            />
          )}
        </div>

        {result.habits.length > 0 ? (
          <div className="hab-grade-sheet-proof" role="table" aria-label="Perfect output breakdown">
            <div className="hab-grade-sheet-proof-head" role="row">
              <span role="columnheader">Habit</span>
              <span role="columnheader">Raw</span>
              <span role="columnheader">Curved</span>
            </div>
            {result.habits.map((h) => (
              <div key={h.taskId} className="hab-grade-sheet-row" role="row">
                <span className="hab-grade-sheet-row-name" role="cell">
                  {h.name}
                </span>
                <span className="hab-grade-sheet-row-readout" role="cell">
                  {h.raw.toFixed(0)}%
                </span>
                <span className="hab-grade-sheet-row-readout" role="cell">
                  {h.curved.toFixed(0)}%
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
          <p className="hab-grade-sheet-empty">No {habitScope} habits to grade yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
