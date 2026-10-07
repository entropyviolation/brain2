/**
 * components/Home/Tracking/cycle-detail-dialog.tsx — Cycle detail
 *
 * A compact local calendar of recent months, each day tinted by the phase
 * `phaseForDate` derives, with bleeding marked apart from the wash. The
 * selected day is read through Clinical, Chinese medicine, or Esoteric.
 * Phase is not stored. Spotting does not change it.
 */
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CHINESE_LENS_LINE,
  CLINICAL_EDUCATION_LINE,
  CYCLE_LENSES,
  CYCLE_PHASE_TITLE,
  ESOTERIC_LENS_LINE,
  cycleLensParagraphs,
  type CycleLensId,
} from "@/lib/cycle-lens-copy"
import { phaseForDate, type CyclePhase } from "@/lib/cycle-phase"
import { useCycleMarksStore, type CycleDayMark } from "@/lib/cycle-marks"
import { formatLocalDateKey } from "@/lib/date-utils"
import "./tracking-chrome.css"

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function monthLabel(anchor: Date): string {
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

function dayLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

/** Four months ending on the month of `anchorKey`. Monday weeks. */
function recentMonths(anchorKey: string): Date[] {
  const anchor = parseDayKey(anchorKey)
  const start = new Date(anchor.getFullYear(), anchor.getMonth() - 3, 1)
  return [0, 1, 2, 3].map((step) => new Date(start.getFullYear(), start.getMonth() + step, 1))
}

function monthCells(month: Date): Array<{ key: string; day: number } | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<{ key: string; day: number } | null> = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= count; day++) {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    cells.push({ key: formatLocalDateKey(date), day })
  }
  return cells
}

function lensLine(lens: CycleLensId): string {
  if (lens === "clinical") return CLINICAL_EDUCATION_LINE
  if (lens === "chinese") return CHINESE_LENS_LINE
  return ESOTERIC_LENS_LINE
}

export function CycleDetailDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const marks = useCycleMarksStore((s) => s.marks)
  const [selected, setSelected] = useState(date)
  const [lens, setLens] = useState<CycleLensId>("clinical")
  const phase = phaseForDate(selected, marks)
  const mark = marks[selected]
  const paragraphs = cycleLensParagraphs(phase, lens)
  const months = recentMonths(date)

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className="trk95 trk-dialog trk-cycle-detail max-w-none"
        data-ui-name="Cycle detail"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Cycle</DialogTitle>
        </DialogHeader>
        <div className="trk-dialog-body">
          <div className="trk-cycle-lenses" role="group" aria-label="Cycle lenses">
            {CYCLE_LENSES.map((row) => (
              <button
                key={row.id}
                type="button"
                aria-pressed={lens === row.id}
                onClick={() => setLens(row.id)}
              >
                {row.label}
              </button>
            ))}
          </div>
          <DialogDescription className="trk-cycle-lens-line" data-testid="cycle-lens-line">
            {lensLine(lens)}
          </DialogDescription>

          <div className="trk-cycle-months" aria-label="Recent months">
            {months.map((month) => (
              <MonthGrid
                key={formatLocalDateKey(month)}
                month={month}
                marks={marks}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
          <p className="trk-cycle-legend" aria-hidden>
            <span data-phase="menstrual">Menstrual</span>
            <span data-phase="follicular">Follicular</span>
            <span data-phase="ovulatory">Ovulatory</span>
            <span data-phase="luteal">Luteal</span>
            <span data-phase="unknown">Unknown</span>
            <span data-bleeding="true">Bleeding</span>
          </p>

          <article className="trk-cycle-reading" aria-label={`${dayLabel(selected)}, ${CYCLE_PHASE_TITLE[phase]}`}>
            <h3 className="trk-logbook-heading">{dayLabel(selected)}</h3>
            <p className="trk-cycle-phase" data-testid="cycle-detail-phase">
              {CYCLE_PHASE_TITLE[phase]}
            </p>
            <DayMarks bleeding={mark?.bleeding === true} spotting={mark?.spotting === true} ovulation={mark?.ovulation === true} />
            <div data-testid="cycle-lens-body">
              {paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DayMarks({
  bleeding,
  spotting,
  ovulation,
}: {
  bleeding: boolean
  spotting: boolean
  ovulation: boolean
}) {
  const flags = [
    bleeding ? "Bleeding" : null,
    spotting ? "Spotting" : null,
    ovulation ? "Ovulation" : null,
  ].filter((flag): flag is string => Boolean(flag))
  if (flags.length === 0) {
    return <p className="trk-logbook-note">No bleed, spotting, or ovulation mark on this day.</p>
  }
  return <p className="trk-logbook-note">Marked: {flags.join(", ")}. Spotting does not change the phase.</p>
}

function MonthGrid({
  month,
  marks,
  selected,
  onSelect,
}: {
  month: Date
  marks: Record<string, CycleDayMark>
  selected: string
  onSelect: (key: string) => void
}) {
  const cells = monthCells(month)
  return (
    <section className="trk-cycle-month" aria-label={monthLabel(month)}>
      <h3 className="trk-logbook-heading">{monthLabel(month)}</h3>
      <div className="trk-cycle-grid" role="grid" aria-label={monthLabel(month)}>
        {WEEKDAYS.map((label, index) => (
          <span key={`${label}-${index}`} className="trk-cycle-weekday" aria-hidden>
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <span key={`empty-${index}`} className="trk-cycle-empty" />
          const phase: CyclePhase = phaseForDate(cell.key, marks)
          const bleeding = marks[cell.key]?.bleeding === true
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className="trk-cycle-day"
              data-phase={phase}
              data-bleeding={bleeding ? "true" : "false"}
              data-testid={`cycle-day-${cell.key}`}
              aria-pressed={cell.key === selected}
              aria-label={`${cell.key}, ${CYCLE_PHASE_TITLE[phase]}${bleeding ? ", bleeding" : ""}`}
              onClick={() => onSelect(cell.key)}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </section>
  )
}
