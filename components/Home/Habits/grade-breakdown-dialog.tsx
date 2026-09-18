/**
 * components/Home/Habits/grade-breakdown-dialog.tsx — Week grade breakdown
 *
 * Click-through from the Daily toolbar grade: raw vs curved day scores,
 * how the mean is built, and the editable daily-curve tolerance.
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type WeekGradeResult } from "@/lib/calculations"
import { format } from "date-fns"

interface GradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: WeekGradeResult
  onToleranceChange: (value: number) => void
}

export function GradeBreakdownDialog({ open, onOpenChange, result, onToleranceChange }: GradeBreakdownDialogProps) {
  const bonus = result.curveBonus
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Week grade</DialogTitle>
          <DialogDescription>
            Current grade is the average of each elapsed day’s score after the daily curve.
            Raw completion is unchanged; the curve only affects this grade. Zero stays zero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Current grade</span>{" "}
            <strong className="text-base tabular-nums">{result.daysIncluded === 0 ? "—" : `${result.grade.toFixed(0)}%`}</strong>
            {result.daysIncluded > 0 && result.curveBonus > 0 && (
              <span className="text-muted-foreground"> (raw avg {result.rawGrade.toFixed(0)}%)</span>
            )}
          </p>
          {result.daysIncluded > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.days.map((d) => d.curved.toFixed(0)).join(" + ")}
              {" = "}
              {result.days.reduce((a, d) => a + d.curved, 0).toFixed(0)}
              {" / "}
              {result.daysIncluded}
              {" = "}
              {result.grade.toFixed(0)}%
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="grade-tolerance">Daily perfect threshold (tolerance)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="grade-tolerance"
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
              ? "100% tolerance means no curve: each day’s score equals raw completion."
              : `Each day is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Days can go above 100%. A 0% day stays 0 — the curve does not lift empty days.`}
          </p>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          Points: each daily habit is worth 50 (partial completion counts, e.g. 5/10 pages = 25).
          Each day: +50 if that day’s raw score is above 80%; +100 if either Week grade or Perfect
          output is 75%+ after its curve; +300 if both grades are.
        </p>

        {result.days.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 font-medium text-right">Raw</th>
                <th className="py-1 font-medium text-right">Curved</th>
              </tr>
            </thead>
            <tbody>
              {result.days.map((d) => (
                <tr key={d.dateKey} className="border-b border-border/60">
                  <td className="py-1">{format(d.date, "EEE M/d")}</td>
                  <td className="py-1 text-right tabular-nums">{d.raw.toFixed(0)}%</td>
                  <td className="py-1 text-right tabular-nums font-medium">{d.curved.toFixed(0)}%</td>
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
          <p className="text-sm text-muted-foreground">No elapsed days in this week yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
