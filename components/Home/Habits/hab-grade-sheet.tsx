"use client"

/**
 * components/Home/Habits/hab-grade-sheet.tsx — Shared grade sheet chrome
 *
 * One path: CRT figure, proof (rows + pinned average), Curve and the priority
 * switch, then Plasma in its own bay. The glass holds only the grade.
 * Tube color / tolerance / priority store keys stay in the thin dialog wrappers.
 */

/**
 * Gap between two grades already rounded the way the sheet prints them.
 * Up when current is above the reference, down when below, no mark when equal.
 * `ordinary` is the priority blend against the pre-blend figure.
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
          : `Priority blend, same ${referenceWhole}%`,
    }
  }
  const points = Math.abs(gap)
  return {
    mark: gap > 0 ? "up" : "down",
    phrase:
      reference === "weeks"
        ? `${points} from avg ${referenceWhole}% across weeks`
        : `Priority blend, from ${referenceWhole}%`,
  }
}

import type { CSSProperties, ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"

export interface HabGradeProofRow {
  key: string
  name: string
  /** Ink on the metal row. Exempt weeks pass "exempt". */
  rawText: string
  /** Phosphor chip. Exempt weeks pass "—". */
  curvedText: string
  /** Curved score in the equation. Null leaves the row out of the sum. */
  curvedValue: number | null
  mute?: boolean
}

export function HabGradeProof({
  ariaLabel,
  nameHeader,
  rows,
  averageRaw,
  averageCurved,
  equationNote,
}: {
  ariaLabel: string
  nameHeader: string
  rows: HabGradeProofRow[]
  averageRaw: string
  averageCurved: string
  equationNote?: string
}) {
  const scored = rows.filter((row) => row.curvedValue != null)
  const sum = scored.reduce((acc, row) => acc + (row.curvedValue as number), 0)

  return (
    <div className="hab-grade-sheet-proof" role="table" aria-label={ariaLabel}>
      <div className="hab-grade-sheet-proof-head" role="row">
        <span role="columnheader">{nameHeader}</span>
        <span role="columnheader">Raw</span>
        <span aria-hidden="true" />
        <span role="columnheader">Curved</span>
      </div>
      <div className="hab-grade-sheet-proof-scroll">
        {rows.map((row) => (
          <div key={row.key} className="hab-grade-sheet-row" role="row">
            <span className="hab-grade-sheet-row-name" role="cell">
              {row.name}
            </span>
            <span
              className={`hab-grade-sheet-row-readout is-raw${row.mute ? " is-mute" : ""}`}
              role="cell"
            >
              {row.rawText}
            </span>
            <span className="hab-grade-sheet-row-tick" aria-hidden="true">
              {row.mute ? "" : "→"}
            </span>
            <span
              className={`hab-grade-sheet-row-readout is-curved${row.mute ? " is-mute" : ""}`}
              role="cell"
            >
              {row.curvedText}
            </span>
          </div>
        ))}
      </div>
      <div className="hab-grade-sheet-row is-avg" role="row">
        <span className="hab-grade-sheet-row-name" role="cell">
          Average
        </span>
        <span className="hab-grade-sheet-row-readout is-raw" role="cell">
          {averageRaw}
        </span>
        <span className="hab-grade-sheet-row-tick" aria-hidden="true">
          →
        </span>
        <span className="hab-grade-sheet-row-readout is-curved" role="cell">
          {averageCurved}
        </span>
      </div>
      {scored.length > 0 && (
        <div className="hab-grade-sheet-eq">
          <span className="hab-grade-sheet-bay-legend">Curved</span>
          <p>
            {scored.map((row, index) => (
              <span key={row.key}>
                {index > 0 ? " + " : null}
                <span className="hab-grade-sheet-eq-term">
                  {row.name} {(row.curvedValue as number).toFixed(0)}
                </span>
              </span>
            ))}
            {" = "}
            {sum.toFixed(0)}
            {" / "}
            {scored.length}
            {" = "}
            {averageCurved}
            {equationNote ? ` ${equationNote}` : ""}
          </p>
        </div>
      )}
    </div>
  )
}

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
  /** One line under the glass. */
  heroLine?: ReactNode
  heroLineTitle?: string
  /** Priority blend, under the hero line. Omitted while the switch is off. */
  blendText?: string | null
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
  /** Day/week lift notes — settings, not a caption of the proof. */
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
  heroLine,
  heroLineTitle,
  blendText,
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
          <div className="hab-grade-sheet-crt">
            <span className="hab-grade-sheet-crt-value">{hero}</span>
          </div>
          {heroLine != null && (
            <p className="hab-grade-sheet-hero-line" title={heroLineTitle}>
              {heroLine}
            </p>
          )}
          {blendText ? <p className="hab-grade-sheet-blend">{blendText}</p> : null}
        </div>

        {children}

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
              <span className="hab-grade-sheet-hint is-inline">{tolerance} → 100% on the curve</span>
            </div>
            <p className="hab-grade-sheet-hint">{curveHint}</p>
          </div>

          {notes}

          {priority && (
            <PriorityMathPanel
              enabled={priority.enabled}
              onEnabledChange={priority.onEnabledChange}
              overall={priority.overall}
              priority={priority.priority}
              label={priority.label}
              explainLabel="How the 50% floor works"
            />
          )}
        </div>

        <div className="hab-grade-sheet-bay">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
