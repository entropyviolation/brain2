"use client"

/**
 * components/Home/Habits/hab-grade-sheet.tsx — Shared grade sheet chrome
 *
 * Presentational CRT hero + Curve bay + Plasma bay + optional priority.
 * The hero figure shares its line with a stock triangle and the whole-point gap.
 * Tube color / tolerance / priority store keys stay in the thin dialog wrappers.
 */

/**
 * Gap between two grades already rounded the way the sheet prints them.
 * Up when current is above the reference, down when below, no mark when equal.
 */
export function gradeHeroDelta(
  currentWhole: number,
  referenceWhole: number,
  reference: "weeks" | "ordinary",
): { mark: "up" | "down" | null; phrase: string } {
  const gap = currentWhole - referenceWhole
  if (gap === 0) {
    return {
      mark: null,
      phrase:
        reference === "weeks"
          ? `same as avg ${referenceWhole}% across weeks`
          : `same as ordinary ${referenceWhole}%`,
    }
  }
  const points = Math.abs(gap)
  return {
    mark: gap > 0 ? "up" : "down",
    phrase:
      reference === "weeks"
        ? `${points} from avg ${referenceWhole}% across weeks`
        : `${points} from ordinary ${referenceWhole}%`,
  }
}

import type { CSSProperties, ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"

export interface HabGradeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  /** Extra classes on DialogContent (e.g. `is-output`). */
  contentClassName?: string
  tubeColor: string
  onTubeColorChange: (hex: string) => void
  tubeColorId: string
  tubeColorAriaLabel: string
  tubeColorDisabled?: boolean
  hero: string
  showOrdinary?: boolean
  ordinaryText?: string
  /** Stock tick beside the hero. Omitted when the grade matches the reference. */
  ordinaryMark?: "up" | "down" | null
  /** Hover note for the small CRT figure (for example the all-weeks average). */
  ordinaryTitle?: string
  equation?: ReactNode
  toleranceId: string
  toleranceLabel: string
  tolerance: number
  onToleranceChange: (value: number) => void
  curveHint: ReactNode
  priority?: {
    enabled: boolean
    onEnabledChange: (value: boolean) => void
    overall: number
    priority: number | null
    label: string
  }
  /** Day/week lift notes, accomplishment blurb — wrapper-specific. */
  notes?: ReactNode
  children: ReactNode
}

export function HabGradeSheet({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  tubeColor,
  onTubeColorChange,
  tubeColorId,
  tubeColorAriaLabel,
  tubeColorDisabled = false,
  hero,
  showOrdinary = false,
  ordinaryText,
  ordinaryMark = null,
  ordinaryTitle,
  equation,
  toleranceId,
  toleranceLabel,
  tolerance,
  onToleranceChange,
  curveHint,
  priority,
  notes,
  children,
}: HabGradeSheetProps) {
  const sheetStyle = { "--hab-grade-tube": tubeColor } as CSSProperties

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={["hab-grade-sheet sm:max-w-md max-h-[90vh] overflow-y-auto", contentClassName]
          .filter(Boolean)
          .join(" ")}
        style={sheetStyle}
      >
        <DialogHeader className="hab-grade-sheet-caption">
          <span className="hab-grade-sheet-power" aria-hidden="true" />
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="hab-grade-sheet-lead">{description}</DialogDescription>
        </DialogHeader>

        <div className="hab-grade-sheet-hero">
          <span className="hab-grade-sheet-hero-label">Current grade</span>
          <div className="hab-grade-sheet-crt">
            <span className="hab-grade-sheet-crt-value">{hero}</span>
            {showOrdinary && ordinaryText != null && (
              <span className="hab-grade-sheet-crt-ordinary" title={ordinaryTitle}>
                {ordinaryMark === "up" ? "▲ " : ordinaryMark === "down" ? "▼ " : ""}
                {ordinaryText}
              </span>
            )}
          </div>
          {equation != null && <p className="hab-grade-sheet-eq">{equation}</p>}
        </div>

        <div className="hab-grade-sheet-bay">
          <span className="hab-grade-sheet-bay-legend">Curve</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor={toleranceId} className="hab-grade-sheet-field-label">
              {toleranceLabel}
            </Label>
            <div className="hab-grade-sheet-control-row">
              <Input
                id={toleranceId}
                type="number"
                min={1}
                max={100}
                step={1}
                value={tolerance}
                onChange={(e) => onToleranceChange(Number(e.target.value))}
                className="hab-grade-sheet-field w-24"
              />
              <span className="hab-grade-sheet-hint is-inline">% raw = 100% on the curve</span>
            </div>
            <p className="hab-grade-sheet-hint">{curveHint}</p>
          </div>

          <span className="hab-grade-sheet-bay-legend">Plasma</span>
          <div className="hab-grade-sheet-control">
            <Label htmlFor={tubeColorId} className="hab-grade-sheet-field-label">
              Plasma color
            </Label>
            <div className="hab-grade-sheet-control-row">
              <ColorSwatch
                id={tubeColorId}
                value={tubeColor}
                onChange={onTubeColorChange}
                aria-label={tubeColorAriaLabel}
                size="md"
                disabled={tubeColorDisabled}
              />
              <span className="hab-grade-sheet-swatch-hex">{tubeColor}</span>
            </div>
            <p className="hab-grade-sheet-hint">Hue of the plasma column. Glass and vacuum stay clear.</p>
          </div>

          {priority && (
            <PriorityMathPanel
              enabled={priority.enabled}
              onEnabledChange={priority.onEnabledChange}
              overall={priority.overall}
              priority={priority.priority}
              label={priority.label}
            />
          )}
        </div>

        {notes}

        {children}
      </DialogContent>
    </Dialog>
  )
}
