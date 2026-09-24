/**
 * components/Home/Tracking/fill-range-control.tsx — Time Grid Fill well
 *
 * Start–end clocks plus Fill, extracted from `time-grid.tsx` so date-nav work
 * can land beside it without a merge fight. Defaults to the longest empty
 * (untracked) block of the viewed day; `<` `>` walk remaining gaps in clock
 * order. Double-click a clock to type / native-pick; a single click does
 * nothing. View-settings Day fill starts/ends are only the fully-untracked
 * fallback. A fully tracked day disables Fill.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  minutesToLabel,
  minutesToTimeString,
  timeStringToMinutes,
  type TimeEntry,
} from "@/lib/time-entries"
import {
  clocksToEmptyBlock,
  emptyBlocksForDay,
  longestEmptyBlockIndex,
  type EmptyBlock,
} from "@/components/Home/Tracking/empty-blocks"
import "./tracking-chrome.css"

function gapKey(blocks: EmptyBlock[]): string {
  return blocks.map((b) => `${b.startMin}-${b.endMin}-${b.wraps ? "w" : ""}`).join("|")
}

function FillClock({
  which,
  minutes,
  onMinutes,
  disabled,
}: {
  which: "start" | "end"
  minutes: number
  onMinutes: (minute: number) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const label = which === "start" ? "Fill starts" : "Fill ends"
  const clockMin = minutes % (24 * 60)
  const value = minutesToTimeString(clockMin)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    try {
      el.showPicker?.()
    } catch {
      /* jsdom / unsupported */
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={ref}
        type="time"
        className="trk-fill-clock-input"
        aria-label={label}
        value={value}
        onChange={(e) => {
          const next = timeStringToMinutes(e.target.value)
          if (next === null) return
          onMinutes(next)
        }}
        onBlur={() => setEditing(false)}
      />
    )
  }

  return (
    <button
      type="button"
      className="trk-fill-clock"
      aria-label={label}
      title="Double-click to edit the clock"
      disabled={disabled}
      onClick={(e) => e.preventDefault()}
      onDoubleClick={() => {
        if (!disabled) setEditing(true)
      }}
    >
      {minutesToLabel(clockMin)}
    </button>
  )
}

export function FillRangeControl({
  dayEntries,
  fallbackFrom,
  fallbackTo,
  selectedPenId,
  penName,
  onFill,
}: {
  dayEntries: TimeEntry[]
  fallbackFrom: string
  fallbackTo: string
  selectedPenId: string | null
  penName: string
  onFill: (startMin: number, endMin: number) => void
}) {
  const fallback = useMemo(
    () =>
      clocksToEmptyBlock(
        timeStringToMinutes(fallbackFrom) ?? 9 * 60,
        timeStringToMinutes(fallbackTo) ?? 10 * 60,
      ),
    [fallbackFrom, fallbackTo],
  )
  const blocks = useMemo(() => emptyBlocksForDay(dayEntries, fallback), [dayEntries, fallback])
  const signature = gapKey(blocks)
  const defaultIndex = longestEmptyBlockIndex(blocks)
  const fullyTracked = blocks.length === 0
  const [index, setIndex] = useState(Math.max(0, defaultIndex))
  const [fromMin, setFromMin] = useState(fallback.startMin)
  const [toMin, setToMin] = useState(fallback.endMin)

  useEffect(() => {
    const next = longestEmptyBlockIndex(blocks)
    setIndex(Math.max(0, next))
    const chosen = next >= 0 ? blocks[next] : fallback
    setFromMin(chosen.startMin)
    setToMin(chosen.endMin)
  }, [signature, blocks, fallback])

  const canPrev = !fullyTracked && index > 0
  const canNext = !fullyTracked && index < blocks.length - 1
  const fillDisabled = selectedPenId === null || fullyTracked
  const fillTitle = fullyTracked
    ? "Nothing empty to fill — this day is fully tracked"
    : selectedPenId === null
      ? "Pick a pen first"
      : undefined

  const applyGap = (next: number) => {
    const gap = blocks[next]
    if (!gap) return
    setIndex(next)
    setFromMin(gap.startMin)
    setToMin(gap.endMin)
  }

  const fromLabel = minutesToLabel(fromMin % (24 * 60))
  const toLabel = minutesToLabel(toMin % (24 * 60))

  return (
    <div className="trk-module trk-plot-fill">
      <span className="trk-silk">Fill</span>
      <div className="trk-fill-range">
        <button
          type="button"
          className="trk-fill-gap-btn"
          aria-label="Previous empty block"
          disabled={!canPrev}
          onClick={() => applyGap(index - 1)}
        >
          <ChevronLeft />
        </button>
        <FillClock which="start" minutes={fromMin} onMinutes={setFromMin} disabled={fullyTracked} />
        <span className="trk-fill-dash" aria-hidden>
          –
        </span>
        <FillClock which="end" minutes={toMin} onMinutes={setToMin} disabled={fullyTracked} />
        <button
          type="button"
          className="trk-fill-gap-btn"
          aria-label="Next empty block"
          disabled={!canNext}
          onClick={() => applyGap(index + 1)}
        >
          <ChevronRight />
        </button>
        <button
          type="button"
          title={fillTitle}
          disabled={fillDisabled}
          onClick={() => onFill(fromMin, toMin)}
        >
          {fullyTracked
            ? "Nothing empty to fill"
            : `Fill ${fromLabel}–${toLabel} with ${penName}`}
        </button>
      </div>
    </div>
  )
}
