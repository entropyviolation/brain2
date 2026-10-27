/**
 * components/Home/Tracking/cycle-detail-dialog.tsx — Cycle detail
 *
 * Four equal months, Monday weeks. A marked day is a solid wash of
 * `phaseForDate`. An estimated day is hatched in the phase the guess shows,
 * and the reading states the reason and confidence. Today keeps a dot; the
 * outline is only the selected day. Bleeding is a bar, not a phase. The
 * reading is the selected lens, headed when that record has titles. Those
 * four sections use their own sans. Clinical keeps them and, under Extra
 * detail (closed until opened), a clinical reference that does not follow
 * the selected day. Chinese medicine keeps its four sections and, under the
 * same control, the paper encyclopedia, herbs included. Esoteric stays the
 * four short sections. Phase is not stored.
 * Spotting does not change it. Hide cycle closes the privacy latch and asks
 * the parent to unmount this dialog in the same action.
 * Cmd+F / Ctrl+F finds in the open reading (lens line, short sections, and
 * the encyclopedia). The find bar unmounts with the dialog.
 */
"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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
  cycleLensSections,
  type CycleLensId,
  type CycleLensSection,
} from "@/lib/cycle-lens-copy"
import { chineseEncyclopedia, tcmSources } from "@/lib/cycle-lens-chinese"
import { clinicalReference, clinicalSources } from "@/lib/cycle-lens-clinical"
import { phaseForDate, type CyclePhase } from "@/lib/cycle-phase"
import {
  assessCycleDay,
  assessCycleRange,
  summarizeCycleEstimates,
  type CycleDayAssessment,
} from "@/lib/cycle-estimate"
import { useCycleMarksStore, type CycleDayMark } from "@/lib/cycle-marks"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { CycleEncyclopedia, type EncyclopediaChapter } from "./cycle-encyclopedia"
import {
  CycleFindBar,
  CycleFindProviders,
  FindText,
  isCycleFindChord,
  stampCycleFindMarks,
} from "./cycle-reading-find"
import "./tracking-chrome.css"

/** Deep clinical library. Stable across the selected day. No herbs. */
const clinicalEncyclopediaChapters: readonly EncyclopediaChapter[] = clinicalReference.map((chapter) => ({
  id: chapter.id,
  title: chapter.title,
  entries: chapter.topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    paragraphs: topic.paragraphs,
    sourceIds: topic.sourceIds,
  })),
}))

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
  const setDetailsOpen = useTimeTrackingStore((s) => s.setCycleDetailsOpen)
  const marks = useCycleMarksStore((s) => s.marks)
  const [selected, setSelected] = useState(date)
  const [lens, setLens] = useState<CycleLensId>("clinical")
  const [extraOpen, setExtraOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [count, setCount] = useState(0)
  const [focusNonce, setFocusNonce] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(0)
  activeRef.current = active
  const mark = marks[selected]
  const months = recentMonths(date)
  const todayKey = formatLocalDateKey(new Date())
  const assessed = new Map(
    assessCycleRange(
      months.flatMap((month) => monthCells(month).flatMap((cell) => (cell ? [cell.key] : []))),
      marks,
    ).map((row) => [row.date, row]),
  )
  const selectedAssessment = assessCycleDay(selected, marks)
  const phase = selectedAssessment.phase
  const sections = cycleLensSections(phase, lens)
  const basisNote = summarizeCycleEstimates(marks).basisNote

  const openFind = useCallback(() => {
    setFindOpen(true)
    setFocusNonce((n) => n + 1)
  }, [])

  const restamp = useCallback((scroll = false) => {
    const n = stampCycleFindMarks(bodyRef.current, activeRef.current, scroll)
    setCount((prev) => (prev === n ? prev : n))
    if (n > 0 && activeRef.current >= n) setActive(n - 1)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isCycleFindChord(event)) return
      event.preventDefault()
      openFind()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openFind])

  useEffect(() => {
    if (!findOpen) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [findOpen, focusNonce])

  useLayoutEffect(() => {
    restamp(false)
  })

  useLayoutEffect(() => {
    restamp(true)
  }, [restamp, query, active, lens, selected, findOpen, extraOpen, phase, mark])

  useEffect(() => {
    if (!findOpen || !query.trim() || lens === "esoteric") return
    setExtraOpen(true)
  }, [findOpen, query, lens])

  function step(delta: number) {
    setActive((current) => {
      if (count <= 0) return 0
      return (current + delta + count) % count
    })
  }

  const encyclopedia =
    lens === "clinical" ? (
      <CycleEncyclopedia
        tone="clinical"
        chapters={clinicalEncyclopediaChapters}
        sources={clinicalSources}
        lensLabel="Clinical"
      />
    ) : lens === "chinese" ? (
      <CycleEncyclopedia
        tone="tcm"
        chapters={chineseEncyclopedia}
        sources={tcmSources}
        lensLabel="Chinese medicine"
      />
    ) : null

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className="trk95 trk-dialog trk-cycle-detail max-w-none"
        data-ui-name="Cycle detail"
        data-ui-docs="components/Home/Tracking/README.md"
        onEscapeKeyDown={(event) => {
          if (!findOpen) return
          event.preventDefault()
          setFindOpen(false)
        }}
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Cycle</DialogTitle>
          <div className="trk-cycle-head-actions">
            <button
              type="button"
              className="trk-cycle-privacy trk-cycle-find-toggle"
              aria-pressed={findOpen}
              onClick={openFind}
            >
              Find
            </button>
            <button
              type="button"
              className="trk-cycle-privacy"
              aria-expanded={true}
              onClick={() => {
                setDetailsOpen(false)
                onClose()
              }}
            >
              Hide cycle
            </button>
          </div>
        </DialogHeader>
        {findOpen ? (
          <CycleFindBar
            query={query}
            count={count}
            active={active}
            inputRef={inputRef}
            onQuery={(value) => {
              setQuery(value)
              setActive(0)
            }}
            onNext={() => step(1)}
            onPrev={() => step(-1)}
          />
        ) : null}
        <CycleFindProviders query={findOpen ? query : ""} restamp={restamp}>
        <div className="trk-dialog-body" ref={bodyRef} data-cycle-find-root="">
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
            <FindText text={lensLine(lens)} />
          </DialogDescription>

          <div className="trk-cycle-months" aria-label="Recent months">
            {months.map((month) => (
              <MonthGrid
                key={formatLocalDateKey(month)}
                month={month}
                marks={marks}
                selected={selected}
                todayKey={todayKey}
                assessed={assessed}
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
            <span data-basis="estimated">Estimated</span>
          </p>
          <p className="trk-cycle-quiet" data-testid="cycle-basis-note">{basisNote}</p>

          <article className="trk-cycle-reading" aria-label={`${dayLabel(selected)}, ${CYCLE_PHASE_TITLE[phase]}`}>
            <header className="trk-cycle-dayhead">
              <h3 className="trk-cycle-date"><FindText text={dayLabel(selected)} /></h3>
              <p className="trk-cycle-phase" data-testid="cycle-detail-phase" data-phase={phase}>
                <FindText text={CYCLE_PHASE_TITLE[phase]} />
              </p>
            </header>
            <DayMarks bleeding={mark?.bleeding === true} spotting={mark?.spotting === true} ovulation={mark?.ovulation === true} />
            <EstimateLine assessment={selectedAssessment} />
            <LensReading sections={sections} />
          </article>
          {encyclopedia ? (
            <div className="trk-cycle-extra">
              <button
                type="button"
                className="trk-cycle-extra-toggle"
                aria-expanded={extraOpen}
                onClick={() => setExtraOpen((open) => !open)}
              >
                {extraOpen ? "Hide extra detail" : "Extra detail"}
              </button>
              {extraOpen ? encyclopedia : null}
            </div>
          ) : null}
        </div>
        </CycleFindProviders>
      </DialogContent>
    </Dialog>
  )
}

function EstimateLine({ assessment }: { assessment: CycleDayAssessment }) {
  if (assessment.basis !== "estimated") return null
  const lead = /^estimated\b/i.test(assessment.reason) ? "" : "Estimated. "
  const marksDiffer =
    assessment.markedPhase !== assessment.phase
      ? ` Marks say ${CYCLE_PHASE_TITLE[assessment.markedPhase]}.`
      : ""
  const hint = assessment.hint ? ` ${assessment.hint}` : ""
  const sentence = `${lead}${assessment.reason} Confidence ${assessment.confidence}.${marksDiffer}${hint}`
  return (
    <p className="trk-cycle-estimate" data-testid="cycle-estimate">
      <FindText text={sentence} />
    </p>
  )
}

function LensReading({ sections }: { sections: readonly CycleLensSection[] }) {
  return (
    <div className="trk-cycle-overview" data-testid="cycle-lens-body">
      {sections.map((section, index) => {
        const paragraphs = section.paragraphs.map((paragraph) => (
          <p key={paragraph}><FindText text={paragraph} /></p>
        ))
        if (!section.title) return <Fragment key={`open-${index}`}>{paragraphs}</Fragment>
        return (
          <section key={`${section.title}-${index}`} className="trk-cycle-section">
            <h4 className="trk-cycle-section-title"><FindText text={section.title} /></h4>
            {paragraphs}
          </section>
        )
      })}
    </div>
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
  const sentence = flags.length === 0
    ? "No bleed, spotting, or ovulation mark on this day."
    : `Marked: ${flags.join(", ")}. Spotting does not change the phase.`
  return (
    <p className="trk-logbook-note">
      <FindText text={sentence} />
    </p>
  )
}

function MonthGrid({
  month,
  marks,
  selected,
  todayKey,
  assessed,
  onSelect,
}: {
  month: Date
  marks: Record<string, CycleDayMark>
  selected: string
  todayKey: string
  assessed: Map<string, CycleDayAssessment>
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
          const row = assessed.get(cell.key)
          const phase: CyclePhase = row?.phase ?? phaseForDate(cell.key, marks)
          const estimated = row?.basis === "estimated"
          const bleeding = marks[cell.key]?.bleeding === true
          const today = cell.key === todayKey
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className="trk-cycle-day"
              data-phase={phase}
              data-bleeding={bleeding ? "true" : "false"}
              data-basis={estimated ? "estimated" : undefined}
              data-today={today ? "true" : undefined}
              data-testid={`cycle-day-${cell.key}`}
              aria-pressed={cell.key === selected}
              aria-label={`${cell.key}, ${CYCLE_PHASE_TITLE[phase]}${bleeding ? ", bleeding" : ""}${estimated ? ", estimated" : ""}${today ? ", today" : ""}`}
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
