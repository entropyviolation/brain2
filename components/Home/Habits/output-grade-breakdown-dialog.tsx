/**
 * components/Home/Habits/output-grade-breakdown-dialog.tsx — Perfect Output grade
 *
 * Click-through from the Daily toolbar Perfect output pill: raw vs curved habit
 * row scores (elapsed days), how the mean is built, and its own curve tolerance.
 * Does not change Week grade (`grade-breakdown-dialog.tsx`).
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type OutputGradeResult } from "@/lib/calculations"

interface OutputGradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: OutputGradeResult
  onToleranceChange: (value: number) => void
}

export function OutputGradeBreakdownDialog({
  open,
  onOpenChange,
  result,
  onToleranceChange,
}: OutputGradeBreakdownDialogProps) {
  const bonus = result.curveBonus
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfect output</DialogTitle>
          <DialogDescription>
            Current grade is the average of each daily habit’s week-to-date row % after
            the output curve. Row % here is paced to elapsed days (Mon → today), not
            the grid’s full-week denominator. Raw completion and Week grade are unchanged;
            the curve only affects this grade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Current grade</span>{" "}
            <strong className="text-base tabular-nums">
              {result.daysIncluded === 0 || result.habits.length === 0
                ? "—"
                : `${result.grade.toFixed(0)}%`}
            </strong>
            {result.habits.length > 0 && result.curveBonus > 0 && (
              <span className="text-muted-foreground"> (raw avg {result.rawGrade.toFixed(0)}%)</span>
            )}
          </p>
          {result.habits.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.habits.map((h) => h.curved.toFixed(0)).join(" + ")}
              {" = "}
              {result.habits.reduce((a, h) => a + h.curved, 0).toFixed(0)}
              {" / "}
              {result.habits.length}
              {" = "}
              {result.grade.toFixed(0)}%
              {result.daysIncluded > 0 ? ` · ${result.daysIncluded} day${result.daysIncluded === 1 ? "" : "s"} elapsed` : ""}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="output-grade-tolerance">Output perfect threshold (tolerance)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="output-grade-tolerance"
              type="number"
              min={1}
              max={100}
              step={1}
              value={result.tolerance}
              onChange={(e) => onToleranceChange(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">% raw = 100% on the curve</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {bonus === 0
              ? "100% tolerance means no curve: each habit’s score equals elapsed row completion."
              : `Each habit is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Habits can go above 100%. A 0% habit stays 0 — the curve does not lift empty rows.`}
          </p>
        </div>

        {result.habits.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1 font-medium">Habit</th>
                <th className="py-1 font-medium text-right">Raw</th>
                <th className="py-1 font-medium text-right">Curved</th>
              </tr>
            </thead>
            <tbody>
              {result.habits.map((h) => (
                <tr key={h.taskId} className="border-b border-border/60">
                  <td className="py-1 pr-2">{h.name}</td>
                  <td className="py-1 text-right tabular-nums">{h.raw.toFixed(0)}%</td>
                  <td className="py-1 text-right tabular-nums font-medium">{h.curved.toFixed(0)}%</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">Average</td>
                <td className="py-1.5 text-right tabular-nums">{result.rawGrade.toFixed(0)}%</td>
                <td className="py-1.5 text-right tabular-nums">{result.grade.toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No daily habits to grade yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
