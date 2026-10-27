/**
 * components/Home/Tracking/phone-day-timeline.tsx — One day, hours down the page
 *
 * The desktop day plot lays minutes left to right inside each hour. A thumb
 * cannot paint that. This timeline is the same minutes: drag paints, a tap
 * opens the block, scissors splits, erase clears a step. The hour gutter
 * scrolls. The plot captures the finger while Draw, Erase, or Scissors is
 * the tool, so that drag does not move the page.
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { deferSyncs } from "@/lib/defer-sync"
import { parseLocalDate } from "@/lib/date-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  MINUTES_PER_DAY,
  entriesForDay,
  entriesOnDate,
  entryDisplayName,
  formatDuration,
  isInstant,
  minuteMap,
  minutesToLabel,
} from "@/lib/time-entries"
import {
  displayedPen,
  penCellStyle,
  useTimeTrackingStore,
  type TimeEntry,
} from "@/lib/time-tracking-store"
import { penTotals, tagTotals, totalsFor } from "@/lib/tracking-summary"
import { acceptSuggestion, isSuggestion, overlaySuggestions } from "@/lib/transit-suggest"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { useTransitSuggestions } from "@/components/Home/Tracking/use-transit-suggestions"
import { ghostAttr, useGhostScopes } from "@/components/Home/Tracking/ghost-layers"
import {
  penNameById,
  scopeTicksWithDiscreteLogs,
  tickPen,
  withoutDiscreteLogs,
} from "@/components/Home/Tracking/discrete-log-instants"
import { ERASE, SCISSORS, noPaint } from "@/components/Home/Tracking/tracking-tool-mode"
import { focusTrackingPlot } from "@/components/Home/Tracking/tracking-undo"
import { playTrkMotion } from "@/components/Home/Tracking/trk-motion"
import { setRibbonPercent, useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { inkOnFill, TrkRibbon, TrkTagStrip } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers } from "@/components/Home/Tracking/trk-time-markers"
import {
  clearTimegridReveal,
  peekTimegridReveal,
  subscribeTimegridReveal,
} from "@/components/Home/Tracking/timegrid-reveal"

/** One hour on the phone timeline. The plot's hour rules use this same length. */
export const PHONE_HOUR_PX = 56

const TOTAL_PX = 24 * PHONE_HOUR_PX

function snapMinute(raw: number, step: number): number {
  const size = Math.max(1, step)
  const snapped = Math.floor(raw / size) * size
  return Math.max(0, Math.min(MINUTES_PER_DAY - size, snapped))
}

function minuteFromY(clientY: number, plot: HTMLElement, step: number): number | null {
  const rect = plot.getBoundingClientRect()
  if (rect.height <= 0) return null
  const ratio = (clientY - rect.top) / rect.height
  const raw = Math.round(Math.min(1, Math.max(0, ratio)) * MINUTES_PER_DAY)
  return snapMinute(raw, step)
}

function blockBox(start: number, end: number): { top: number; height: number } {
  const top = (start / MINUTES_PER_DAY) * TOTAL_PX
  const height = Math.max(44, ((Math.max(start, end) - start) / MINUTES_PER_DAY) * TOTAL_PX)
  return { top: Math.min(top, Math.max(0, TOTAL_PX - height)), height }
}

type Drag = { anchor: number; head: number; moved: boolean }

export function PhoneDayTimeline({
  date,
  setDate,
}: {
  date: Date
  setDate: (date: Date) => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)
  const gridStep = useTimeTrackingStore((s) => s.gridStep)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const prefs = useTrackingViewPrefs()
  const setDateRef = useRef(setDate)
  setDateRef.current = setDate

  const dk = formatLocalDateKey(date)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const rootRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const skipClick = useRef(false)
  const landed = useRef("")
  const [stroke, setStroke] = useState<{ lo: number; hi: number } | null>(null)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [revealNonce, setRevealNonce] = useState(0)

  useEffect(() => subscribeTimegridReveal(() => setRevealNonce((n) => n + 1)), [])

  const dayEntries = useMemo(
    () => (scope ? entriesForDay(entries, dk, scope.id) : []),
    [entries, dk, scope],
  )
  const map = useMemo(
    () => (scope ? minuteMap(entries, dk, scope.id) : new Array(MINUTES_PER_DAY).fill(null)),
    [entries, dk, scope],
  )
  const transit = useTransitSuggestions(entries, dk, scope)
  const shownMap = useMemo(() => overlaySuggestions(map, transit), [map, transit])
  const ghosts = useGhostScopes(scope, scopes)
  const penNames = useMemo(() => penNameById(scopes), [scopes])
  const instants = useMemo(() => {
    const ticks = scope ? scopeTicksWithDiscreteLogs(entries, dk, scope.id, penNames) : []
    return prefs.hideLogFlags ? withoutDiscreteLogs(ticks, penNames) : ticks
  }, [entries, dk, scope, penNames, prefs.hideLogFlags])
  const blocks = useMemo(() => dayEntries.filter((entry) => !isInstant(entry)), [dayEntries])
  const pens = useMemo(() => penTotals(dayEntries, scope, [dk]), [dayEntries, scope, dk])
  const totals = useMemo(() => totalsFor(dayEntries, [dk]), [dayEntries, dk])
  const dayTagTotals = useMemo(
    () => tagTotals(entriesOnDate(entries, dk), scopes, tags, [dk]),
    [entries, dk, scopes, tags],
  )
  const { nowMinute, sun } = useTrackingDayMarkers(date)
  const awake = awakeWindowFor(dk, date)
  const startHour = firstUnpaintedWakingHour({ map, wakeMin: awake?.wake, bedMin: awake?.bed })
  const painting = !noPaint(selectedPenId) && selectedPenId !== SCISSORS
  const capturing = !noPaint(selectedPenId) || selectedPenId === SCISSORS

  const openEntry = openEntryId ? entries.find((entry) => entry.id === openEntryId) : undefined

  const commitPaint = useCallback(
    (from: number, to: number) => {
      if (!scope || noPaint(selectedPenId)) return
      const lo = Math.min(from, to)
      const hi = Math.min(MINUTES_PER_DAY, Math.max(from, to))
      deferSyncs(() =>
        paintMinutes(dk, scope.id, lo, hi, selectedPenId === ERASE ? null : selectedPenId, selectedVariantIds),
      )
      const kind = selectedPenId === ERASE ? "erase" : "paint"
      requestAnimationFrame(() => playTrkMotion(rootRef.current, kind, lo, hi, { axis: "y", color: undefined }))
    },
    [scope, selectedPenId, selectedVariantIds, paintMinutes, dk],
  )

  const endDrag = useCallback(() => {
    const state = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (!state || !scope) return
    const minute = state.anchor
    if (selectedPenId === SCISSORS) {
      const existing = map[minute]
      if (existing && !isSuggestion(existing)) {
        splitEntryAt(existing.id, minute)
        requestAnimationFrame(() =>
          playTrkMotion(rootRef.current, "cut", minute, Math.min(MINUTES_PER_DAY, minute + gridStep), { axis: "y" }),
        )
      }
      return
    }
    const suggestion = shownMap[minute]
    if (!state.moved && isSuggestion(suggestion) && !map[minute]) {
      acceptSuggestion(suggestion, paintMinutes)
      return
    }
    const lo = Math.min(state.anchor, state.head)
    const hi = Math.min(MINUTES_PER_DAY, Math.max(state.anchor, state.head) + gridStep)
    if (state.moved) {
      commitPaint(lo, hi)
      return
    }
    const existing = map[minute]
    if (existing && selectedPenId !== ERASE && !isSuggestion(existing)) {
      setOpenEntryId(existing.id)
      return
    }
    if (selectedPenId !== null && !noPaint(selectedPenId)) {
      commitPaint(minute, Math.min(MINUTES_PER_DAY, minute + gridStep))
    }
  }, [scope, selectedPenId, map, shownMap, gridStep, splitEntryAt, paintMinutes, commitPaint])

  const onPlotPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("[data-instant]")) return
    const minute = minuteFromY(event.clientY, event.currentTarget, gridStep)
    if (minute === null) return
    focusTrackingPlot(rootRef.current)
    if (capturing) event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* jsdom has no capture */
    }
    dragRef.current = { anchor: minute, head: minute, moved: false }
    if (painting) setStroke({ lo: minute, hi: Math.min(MINUTES_PER_DAY, minute + gridStep) })
  }

  const onPlotPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state) return
    const minute = minuteFromY(event.clientY, event.currentTarget, gridStep)
    if (minute === null || minute === state.head) return
    dragRef.current = { ...state, head: minute, moved: true }
    if (!painting) return
    const lo = Math.min(state.anchor, minute)
    const hi = Math.min(MINUTES_PER_DAY, Math.max(state.anchor, minute) + gridStep)
    setStroke({ lo, hi })
  }

  const onPlotPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) skipClick.current = true
    endDrag()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  useLayoutEffect(() => {
    const pending = peekTimegridReveal()
    if (!pending || !scope || pending.scopeId !== scope.id) return
    setOpenEntryId(pending.entryId)
    if (pending.date !== dk) {
      const next = parseLocalDate(pending.date)
      if (next) setDateRef.current(next)
      else clearTimegridReveal(pending.entryId)
      return
    }
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(pending.entryId) : pending.entryId
    const block = rootRef.current?.querySelector(`[data-entry-id="${escaped}"]`)
    if (block instanceof HTMLElement && typeof block.scrollIntoView === "function") {
      block.scrollIntoView({ block: "center", inline: "nearest" })
    }
    clearTimegridReveal(pending.entryId)
  }, [dk, scope, revealNonce])

  useLayoutEffect(() => {
    if (landed.current === dk || peekTimegridReveal()) return
    landed.current = dk
    const row = rootRef.current?.querySelector(`[data-hour="${startHour}"]`)
    if (row instanceof HTMLElement && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "start" })
    }
  }, [dk, startHour])

  if (!scope) return <p className="trk-phone-empty">No tracking scopes.</p>

  const strokeBox = stroke ? blockBox(stroke.lo, stroke.hi) : null
  const selectedPen = scope.pens.find((pen) => pen.id === selectedPenId) ?? null

  return (
    <div ref={rootRef} className="trk-phone-day" data-superimpose={ghostAttr(ghosts)}>
      {totals.tracked === 0 ? <ScreenTimeEmptyHint date={dk} scopeId={scope.id} /> : null}
      <div className="trk-phone-timeline" style={{ height: TOTAL_PX }}>
        <div className="trk-phone-hours" aria-hidden>
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} data-hour={hour} style={{ height: PHONE_HOUR_PX }}>
              {minutesToLabel(hour * 60).replace(":00 ", " ")}
            </div>
          ))}
        </div>
        <div
          ref={plotRef}
          className="trk-phone-plot"
          data-testid="phone-day-plot"
          data-paint={capturing ? "true" : "false"}
          role="group"
          aria-label="Day timeline"
          onPointerDown={onPlotPointerDown}
          onPointerMove={onPlotPointerMove}
          onPointerUp={onPlotPointerUp}
          onPointerCancel={onPlotPointerUp}
        >
          {ghosts.map((ghost) =>
            entriesForDay(entries, dk, ghost.scope.id)
              .filter((entry) => !isInstant(entry))
              .map((entry) => {
                const pen = displayedPen(ghost.scope, entry.penId)
                const box = blockBox(entry.startMin, entry.endMin)
                return (
                  <div
                    key={`${ghost.scope.id}-${entry.id}`}
                    className="trk-phone-block is-ghost"
                    style={{
                      top: box.top,
                      height: box.height,
                      opacity: ghost.opacity ?? 0.32,
                      ...penCellStyle(pen, entry.precision, entry.startMin),
                    }}
                    aria-hidden
                  />
                )
              }),
          )}
          {transit.map((entry) => {
            if (map[entry.startMin]) return null
            const box = blockBox(entry.startMin, entry.endMin)
            return (
              <div
                key={entry.id}
                className="trk-phone-block is-suggestion"
                style={{ top: box.top, height: box.height }}
                aria-hidden
              >
                {entry.title}
              </div>
            )
          })}
          {blocks.map((entry) => (
            <TimelineBlock
              key={entry.id}
              entry={entry}
              scopeId={scope.id}
              scopes={scopes}
              onOpen={() => {
                if (skipClick.current) {
                  skipClick.current = false
                  return
                }
                setOpenEntryId(entry.id)
              }}
            />
          ))}
          {instants.map((entry) => {
            const pen = tickPen(scopes, scope, entry.penId)
            const box = blockBox(entry.startMin, entry.startMin + gridStep)
            return (
              <button
                key={entry.id}
                type="button"
                data-instant=""
                data-entry-id={entry.id}
                data-minute={entry.startMin}
                className="trk-phone-instant"
                style={{ top: box.top, background: pen?.color }}
                onClick={() => setOpenEntryId(entry.id)}
              >
                {minutesToLabel(entry.startMin)} {entryDisplayName(entry, pen?.name)}
              </button>
            )
          })}
          {stroke && strokeBox ? (
            <div
              className="trk-phone-stroke"
              style={{
                top: strokeBox.top,
                height: strokeBox.height,
                background: selectedPenId === ERASE ? "transparent" : selectedPen?.color,
              }}
              aria-hidden
            />
          ) : null}
          <div className="trk-phone-markers" aria-hidden>
            <TrkPlotMarkers origin={0} span={MINUTES_PER_DAY} axis="y" nowMinute={nowMinute} sun={sun} showNowLabel />
          </div>
        </div>
      </div>
      <TrkRibbon
        pens={pens}
        untracked={totals.untracked}
        coverage={totals.coverage}
        percentBasis={prefs.ribbonPercent.day}
        periodLabel="day"
        onPercentBasis={(basis) => setRibbonPercent("day", basis)}
      />
      <TrkTagStrip tags={dayTagTotals} />
      <p className="trk-phone-tracked">
        {formatDuration(totals.tracked)} tracked · {Math.round(totals.coverage)}% of the day
      </p>
      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </div>
  )
}

function TimelineBlock({
  entry,
  scopeId,
  scopes,
  onOpen,
}: {
  entry: TimeEntry
  scopeId: string
  scopes: ReturnType<typeof useTimeTrackingStore.getState>["scopes"]
  onOpen: () => void
}) {
  const scope = scopes.find((item) => item.id === scopeId)
  const pen = displayedPen(scope, entry.penId)
  const box = blockBox(entry.startMin, entry.endMin)
  const name = entryDisplayName(entry, pen?.name)
  const when = `${minutesToLabel(entry.startMin)} – ${minutesToLabel(entry.endMin)}`
  return (
    <button
      type="button"
      className="trk-phone-block"
      data-entry-id={entry.id}
      data-minute={entry.startMin}
      style={{
        top: box.top,
        height: box.height,
        color: inkOnFill(pen?.color || "#cccccc"),
        ...penCellStyle(pen, entry.precision, entry.startMin),
      }}
      aria-label={`${name}, ${when}`}
      onClick={onOpen}
    >
      <span className="trk-phone-block-name">{name}</span>
      <span className="trk-phone-block-when">{when}</span>
    </button>
  )
}
