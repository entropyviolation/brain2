/**
 * components/Home/Tracking/entry-dialog/entry-clocks.tsx — Start and end clocks
 *
 * When, Fell asleep / Woke up, or Start / End, then certainty and one Date key.
 * No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { OptionalClock } from "@/components/Home/Tracking/log-activity-dialog"
import { CertaintyToggle } from "@/components/Home/Tracking/entry-edges"
import { sleepClockEstimateBasis } from "@/lib/estimated-values"
import { isInstant, type SpanLock, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import { SpanLockButton } from "./span-lock-button"

export function EntryClocks({
  entry,
  sleep,
  from,
  to,
  fromDate,
  toDate,
  showDates,
  spanLock,
  durationApplies,
  assumed,
  startC,
  endC,
  startOff,
  endOff,
  onStartTime,
  onEndTime,
  onStartDate,
  onEndDate,
  onToggleDates,
  onLockStart,
  onLockEnd,
  onStartCertainty,
  onEndCertainty,
}: {
  entry: TimeEntry
  sleep: boolean
  from: string
  to: string
  fromDate: string
  toDate: string
  showDates: boolean
  spanLock: SpanLock
  durationApplies: boolean
  assumed: boolean
  startC: TrackingClockCertainty
  endC: TrackingClockCertainty
  startOff: boolean
  endOff: boolean
  onStartTime: (time: string) => void
  onEndTime: (time: string) => void
  onStartDate: (date: string) => void
  onEndDate: (date: string) => void
  onToggleDates: () => void
  onLockStart: () => void
  onLockEnd: () => void
  onStartCertainty: (value: TrackingClockCertainty | null) => void
  onEndCertainty: (value: TrackingClockCertainty | null) => void
}) {
  return (
    <div className="trk-section trk-entry-clocks">
      <div className={`trk-clock-grid${isInstant(entry) ? " is-one" : ""}`}>
        <OptionalClock
          id="entry-from"
          label={isInstant(entry) ? "When" : sleep ? "Fell asleep" : "Start"}
          time={from}
          date={fromDate}
          showDate={false}
          hideDateToggle
          labelAdornment={
            durationApplies ? (
              <SpanLockButton edge="start" locked={spanLock === "start"} onLock={onLockStart} />
            ) : undefined
          }
          onTime={onStartTime}
          onDate={onStartDate}
          onToggleDate={onToggleDates}
          estimateBasis={
            sleep && assumed
              ? sleepClockEstimateBasis(
                  entry.generatedBy?.kind === "sleep" ? "remembered" : "painted",
                  "asleep",
                )
              : undefined
          }
        />
        {!isInstant(entry) && (
          <OptionalClock
            id="entry-to"
            label={sleep ? "Woke up" : "End"}
            time={to}
            date={toDate}
            showDate={false}
            hideDateToggle
            labelAdornment={
              durationApplies ? (
                <SpanLockButton edge="end" locked={spanLock === "end"} onLock={onLockEnd} />
              ) : undefined
            }
            onTime={onEndTime}
            onDate={onEndDate}
            onToggleDate={onToggleDates}
            estimateBasis={
              sleep && assumed
                ? sleepClockEstimateBasis(
                    entry.generatedBy?.kind === "sleep" ? "remembered" : "painted",
                    "awake",
                  )
                : undefined
            }
          />
        )}
      </div>
      <div className={`trk-edge-row trk-cert-row${isInstant(entry) ? " is-one" : ""}`}>
        <CertaintyToggle edge="start" value={startOff ? null : startC} onChange={onStartCertainty} />
        {!isInstant(entry) ? <CertaintyToggle edge="end" value={endOff ? null : endC} onChange={onEndCertainty} /> : null}
      </div>
      <div className="trk-entry-clock-foot">
        <button
          type="button"
          className="trk-entry-key is-compact"
          data-no95=""
          aria-pressed={showDates}
          onClick={onToggleDates}
        >
          {showDates ? "Hide date" : "Date"}
        </button>
        {showDates ? (
          <div className={`trk-clock-dates${isInstant(entry) ? " is-one" : ""}`}>
            <Input
              id="entry-from-date"
              className="trk-clock-date"
              type="date"
              value={fromDate}
              onChange={(e) => onStartDate(e.target.value)}
              aria-label={`${isInstant(entry) ? "When" : sleep ? "Fell asleep" : "Start"} date`}
            />
            {!isInstant(entry) ? (
              <Input
                id="entry-to-date"
                className="trk-clock-date"
                type="date"
                value={toDate}
                onChange={(e) => onEndDate(e.target.value)}
                aria-label={`${sleep ? "Woke up" : "End"} date`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
