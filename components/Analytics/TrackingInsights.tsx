/**
 * components/Analytics/TrackingInsights.tsx — Added Tracking plates (2026-10-23)
 *
 * Purely additive, after Information is Beautiful moves
 * (`docs/analytics/viz-inspiration.md`): sized squares with a one-day anchor,
 * a pace "rate clock", a mirror split of the up/down rows, a block-length
 * threshold, and day edges. Also `TrackFold`, the remembered collapsible the
 * composition plate uses. Math in `tracking-insights.ts`.
 * Docs: `docs/analytics/time-tracking.md`.
 */
"use client"

import { memo, useEffect, useMemo, useState, type ReactNode } from "react"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { NativeSelect } from "@/components/ui/native-select"
import { StudioHelp, StudioReadout, inkOnFill } from "./studio-kit"
import { formatSignedDuration, type PeriodDeltaRow } from "./period-delta"
import {
  dayEdges,
  lengthStats,
  mirrorRows,
  paceOf,
  sizedSquares,
  squareSide,
  type MirrorSort,
} from "./tracking-insights"
import "./tracking-insights.css"

type Slice = { id: string; name: string; color: string; minutes: number }

const FOLD_KEY = "brain2.an.track.fold."

function readFold(id: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(FOLD_KEY + id)
    return raw == null ? fallback : raw === "1"
  } catch {
    return fallback
  }
}

/** A titled `<details>` that remembers open / closed per viewer. */
export function TrackFold({
  id,
  title,
  note,
  defaultOpen = true,
  children,
}: {
  id: string
  title: string
  note?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => setOpen(readFold(id, defaultOpen)), [id, defaultOpen])
  return (
    <details
      className="an-fold"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open
        setOpen(next)
        try {
          window.localStorage.setItem(FOLD_KEY + id, next ? "1" : "0")
        } catch {
          /* storage off: still toggles */
        }
      }}
    >
      <summary className="an-fold-summary">
        <span className="an-fold-title">{title}</span>
        {note ? <span className="an-fold-note">{note}</span> : null}
      </summary>
      {open ? <div className="an-fold-body">{children}</div> : null}
    </details>
  )
}

/** Clock label; the day's end (1440) reads as midnight, not 12:00 AM. */
const clockLabel = (minute: number) => (Math.round(minute) >= 1440 ? "midnight" : minutesToLabel(Math.round(minute)))

const pct = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`

/** Sized squares: area = minutes, beside a one-day (24h) anchor square. */
export const SizedSquaresPlate = memo(function SizedSquaresPlate({
  slices,
  dayCount,
  onSelect,
}: {
  slices: readonly Slice[]
  dayCount: number
  onSelect: (id: string) => void
}) {
  const [mode, setMode] = useState<"day" | "window">("day")
  const squares = useMemo(() => sizedSquares(slices, dayCount, mode), [slices, dayCount, mode])
  if (squares.length === 0) return null
  // Fit the biggest square in ~240px; the anchor (one day) stays 60–200px.
  const anchor = Math.max(60, Math.min(200, 240 / Math.sqrt(Math.max(squares[0].days, 0.25))))
  return (
    <section className="an-plate" data-testid="sized-squares">
      <p className="an-canvas-title">
        Sized squares
        <StudioHelp text="Each pen is a square whose area is its minutes. The dashed square is one whole day (24h) for scale. Per day divides by the days in the window. Click a square to drill." />
      </p>
      <div className="an-ins-tools" role="group" aria-label="Square size basis">
        {(["day", "window"] as const).map((m) => (
          <button key={m} type="button" className="an-chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "day" ? "Per average day" : "Whole window"}
          </button>
        ))}
      </div>
      <div className="an-squares">
        <div className="an-square is-anchor" style={{ width: anchor, height: anchor }} title="One day = 24h = 1440 min">
          <span>1 day</span>
        </div>
        {squares.map((sq) => {
          const side = Math.max(6, squareSide(sq.days, anchor))
          const label = formatDuration(sq.shown)
          const inside = side >= 56
          return (
            <figure key={sq.id} className="an-square-fig">
              <button
                type="button"
                className="an-square"
                style={{ width: side, height: side, background: sq.color, color: inkOnFill(sq.color) }}
                title={`${sq.name}: ${label}${mode === "day" ? " a day" : ""} · ${sq.days.toFixed(2)} days' worth`}
                aria-label={`${sq.name}, ${label}`}
                onClick={() => onSelect(sq.id)}
              >
                {inside ? (
                  <span>
                    {sq.name}
                    <br />
                    {label}
                  </span>
                ) : null}
              </button>
              {inside ? null : (
                <figcaption>
                  {sq.name}
                  <br />
                  {label}
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
      <p className="an-canvas-hint">
        n = {squares.length} pens. The biggest is {(squares[0].days * 100).toFixed(0)}% of a day
        {mode === "day" ? " on an average day" : ""}.
      </p>
    </section>
  )
})

/** Rate clock: the window's pace as day / week / year, projected over a horizon. */
export const PacePlate = memo(function PacePlate({
  slices,
  dayCount,
}: {
  slices: readonly Slice[]
  dayCount: number
}) {
  const options = useMemo(() => slices.filter((s) => s.minutes > 0), [slices])
  const [penId, setPenId] = useState<string>("")
  const [awake, setAwake] = useState(16)
  const [years, setYears] = useState(10)
  if (options.length === 0) return null
  const pen = options.find((s) => s.id === penId) ?? options[0]
  const pace = paceOf(pen.minutes, dayCount, awake, years)
  return (
    <section className="an-plate" data-testid="pace-plate">
      <p className="an-canvas-title">
        At this pace
        <StudioHelp text="A rate clock. Per day = window minutes ÷ days in the window (blank days count). Per year × 365.25. Share of waking day uses the hours awake you set. The horizon assumes nothing changes, which it will." />
      </p>
      <div className="an-ins-tools">
        <NativeSelect value={pen.id} onChange={(e) => setPenId(e.target.value)} aria-label="Pen for pace">
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <label className="an-ins-field">
          <span>Hours awake</span>
          <input
            type="number"
            min={4}
            max={24}
            step={0.5}
            value={awake}
            onChange={(e) => setAwake(Math.min(24, Math.max(4, Number(e.target.value) || 16)))}
          />
        </label>
        <label className="an-ins-field">
          <span>Over {years} year{years === 1 ? "" : "s"}</span>
          <input type="range" min={1} max={50} value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </label>
      </div>
      <div className="an-readouts">
        <StudioReadout label="Per day" value={formatDuration(pace.perDay)} note={`${pct(pace.awakeShare)} of waking day`} />
        <StudioReadout label="Per week" value={formatDuration(pace.perWeek)} note="per day × 7" />
        <StudioReadout label="Per year" value={`${Math.round(pace.perYear / 60)}h`} note={`${pace.yearDays.toFixed(1)} full days`} />
        <StudioReadout
          label={`In ${years} years`}
          value={`${Math.round(pace.horizonMinutes / 60).toLocaleString()}h`}
          note={`${pace.horizonAwakeYears.toFixed(1)} waking years`}
        />
      </div>
      <p className="an-canvas-hint">
        {pen.name}: {formatDuration(pen.minutes)} ÷ {dayCount} days = {formatDuration(pace.perDay)} a day.
      </p>
    </section>
  )
})

/** Mirror split: before on the left, now on the right, same rows. */
export const MirrorSplitPlate = memo(function MirrorSplitPlate({ rows }: { rows: readonly PeriodDeltaRow[] }) {
  const [sort, setSort] = useState<MirrorSort>("delta")
  const [limit, setLimit] = useState(12)
  const [query, setQuery] = useState("")
  const shown = useMemo(() => mirrorRows(rows, { sort, limit, query }), [rows, sort, limit, query])
  if (rows.length === 0) return null
  const max = Math.max(1, ...rows.map((r) => Math.max(r.currentMinutes, r.previousMinutes)))
  const before = rows.reduce((s, r) => s + r.previousMinutes, 0)
  const now = rows.reduce((s, r) => s + r.currentMinutes, 0)
  return (
    <section className="an-plate" data-testid="mirror-split">
      <p className="an-canvas-title">
        Before | now
        <StudioHelp text="Mirror split of the Up / down rows. Left bar is the previous equal window, right bar is this one, on one shared scale. The middle column is the change." />
      </p>
      <div className="an-ins-tools">
        <input
          type="search"
          className="an-ins-search"
          placeholder="Filter pens"
          aria-label="Filter pens"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as MirrorSort)} aria-label="Sort rows">
          <option value="delta">Biggest change</option>
          <option value="now">Most now</option>
          <option value="before">Most before</option>
          <option value="name">Name</option>
        </NativeSelect>
        <label className="an-ins-field">
          <span>Top {Math.min(limit, rows.length)}</span>
          <input
            type="range"
            min={3}
            max={Math.max(3, rows.length)}
            value={Math.min(limit, Math.max(3, rows.length))}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="an-mirror" role="table" aria-label="Before and now by pen">
        <div className="an-mirror-row is-head" role="row">
          <span role="columnheader">Before · {formatDuration(before)}</span>
          <span role="columnheader">Pen · change</span>
          <span role="columnheader">Now · {formatDuration(now)}</span>
        </div>
        {shown.map((r) => (
          <div key={r.id} className="an-mirror-row" role="row">
            <span className="an-mirror-side is-left" role="cell" title={formatDuration(r.previousMinutes)}>
              <i style={{ width: `${(r.previousMinutes / max) * 100}%`, background: r.color }} />
            </span>
            <span className="an-mirror-mid" role="cell">
              <b>{r.name}</b> {formatSignedDuration(r.deltaMinutes)}
            </span>
            <span className="an-mirror-side" role="cell" title={formatDuration(r.currentMinutes)}>
              <i style={{ width: `${(r.currentMinutes / max) * 100}%`, background: r.color }} />
            </span>
          </div>
        ))}
        {shown.length === 0 ? <p className="an-canvas-hint">No pen matches “{query}”.</p> : null}
      </div>
    </section>
  )
})

/** Block-length threshold: how much of the time sits in long, unbroken blocks. */
export const BlockLengthCut = memo(function BlockLengthCut({ lengths }: { lengths: readonly number[] }) {
  const [threshold, setThreshold] = useState(60)
  const stats = useMemo(() => lengthStats(lengths, threshold), [lengths, threshold])
  if (stats.n === 0) return null
  return (
    <div className="an-ins-cut" data-testid="block-length-cut">
      <div className="an-ins-tools">
        <label className="an-ins-field">
          <span>Long block ≥ {formatDuration(threshold)}</span>
          <input type="range" min={5} max={240} step={5} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </label>
      </div>
      <div className="an-readouts">
        <StudioReadout label="Blocks" value={stats.n} note={`mean ${formatDuration(stats.mean)}`} />
        <StudioReadout label="Median" value={formatDuration(stats.median)} note={`90th pct ${formatDuration(stats.p90)}`} />
        <StudioReadout
          label="Long blocks"
          value={`${stats.longCount}`}
          note={`${pct(stats.longBlockShare)} of blocks`}
          tip="Blocks at least as long as the slider."
        />
        <StudioReadout
          label="Time in long"
          value={pct(stats.longMinuteShare)}
          note={`${formatDuration(stats.longMinutes)} of ${formatDuration(stats.total)}`}
          tip="Share of painted minutes that sit in blocks at least as long as the slider."
        />
      </div>
    </div>
  )
})

/** Day edges: median first start and last end of lasting blocks. */
export const DayEdgesReadouts = memo(function DayEdgesReadouts({
  entries,
  dateKeys,
  pens,
  shownPenOf,
}: {
  entries: readonly { date: string; startMin: number; endMin: number; kind?: string; penId: string }[]
  dateKeys: readonly string[]
  /** Pens as shown at the chosen depth, for Leave out. */
  pens: readonly { id: string; name: string }[]
  /** The shown pen a block rolls up to at the chosen depth. */
  shownPenOf: (penId: string) => string
}) {
  const sleepId = pens.find((p) => /sleep|bed/i.test(p.name))?.id ?? ""
  const [leaveOut, setLeaveOut] = useState<string | null>(null)
  const skip = leaveOut ?? sleepId
  const kept = useMemo(
    () => (skip ? entries.filter((e) => shownPenOf(e.penId) !== skip) : entries),
    [entries, skip, shownPenOf],
  )
  const edges = useMemo(() => dayEdges(kept, dateKeys), [kept, dateKeys])
  if (edges.days === 0 || edges.medianFirst == null || edges.medianLast == null) return null
  return (
    <>
      <p className="an-canvas-title">
        Day edges
        <StudioHelp text="On each day with lasting blocks: the first start and the last end, then the median across days. Blocks that cross midnight are cut at the day edge, so leave out Sleep (the default when a pen is named Sleep) to see when your waking day starts and ends." />
      </p>
      <div className="an-ins-tools">
        <label className="an-ins-field">
          <span>Leave out</span>
          <NativeSelect value={skip} onChange={(e) => setLeaveOut(e.target.value)} aria-label="Leave out pen">
            <option value="">Nothing</option>
            {pens.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <div className="an-readouts" data-testid="day-edges">
        <StudioReadout
          label="First block"
          value={clockLabel(edges.medianFirst)}
          note={`median · earliest ${clockLabel(edges.earliestFirst ?? 0)}`}
        />
        <StudioReadout
          label="Last block ends"
          value={clockLabel(edges.medianLast)}
          note={`median · latest ${clockLabel(edges.latestLast ?? 0)}`}
        />
        <StudioReadout
          label="Tracked span"
          value={formatDuration(edges.medianSpan ?? 0)}
          note={`median over ${edges.days} days`}
          tip="Last end minus first start on each day with lasting blocks. Gaps inside count."
        />
      </div>
    </>
  )
})
