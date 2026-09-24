/**
 * components/Analytics/TextPipelineView.tsx — Text-pipeline Tracking entries
 *
 * Phone / Telegram ingest stamps `generatedBy.kind === "text"`. Instants are
 * discrete events and switch markers; non-instants are currently / stopped /
 * switched intervals. Always labeled “from text pipeline.”
 */
"use client"

import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  entryMinutes,
  formatDuration,
  isInstant,
  minutesToTimeString,
  type TimeEntry,
} from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { CanvasTitle, StudioReadout, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

const PIPELINE_LABEL = "from text pipeline"

function isTextPipeline(entry: TimeEntry): boolean {
  return entry.generatedBy?.kind === "text"
}

function dayLabel(key: string): string {
  const d = parseLocalDate(key) ?? new Date()
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
}

function entryTitle(entry: TimeEntry, penName?: string): string {
  const t = entry.title?.trim()
  if (t) return t
  return penName?.trim() || "untitled"
}

function isSwitchInstant(entry: TimeEntry): boolean {
  return isInstant(entry) && /^switch\b/i.test(entry.title ?? "")
}

export function TextEventsView() {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  const events = useMemo(
    () =>
      entries
        .filter((e) => isTextPipeline(e) && isInstant(e) && keySet.has(e.date))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin),
    [entries, keySet],
  )

  const byDay = useMemo(
    () =>
      dateKeys.map((key) => ({
        key,
        label: dayLabel(key),
        count: events.filter((e) => e.date === key).length,
      })),
    [dateKeys, events],
  )

  const switchCount = events.filter(isSwitchInstant).length
  const discreteCount = events.length - switchCount

  return (
    <div className="an-canvas an-stack" data-testid="text-events-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Text events"
            help="Activity instants stamped by the phone text pipeline (log:, discrete triggers, switches). Always labeled from text pipeline — not hand-painted blocks."
          />
          <p className="an-canvas-kicker">
            {label} · {PIPELINE_LABEL}
          </p>
        </div>
      </header>

      {events.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={`No text-pipeline instants in the ${label}. Discrete triggers, log:, and switches land here.`}
        />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Events" value={events.length} note={PIPELINE_LABEL} />
            <StudioReadout label="Discrete" value={discreteCount} note="log / triggers" />
            <StudioReadout label="Switches" value={switchCount} note="switch → …" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="count" name="Events" fill="#5b8def" />
            </BarChart>
          </ResponsiveContainer>
          <ul className="an-list" aria-label="Text events by day">
            {events.map((e) => (
              <li key={e.id} className="an-list-row">
                <span className="truncate">{entryTitle(e, penName.get(e.penId))}</span>
                <span className="an-n">
                  {e.date} · {minutesToTimeString(e.startMin)} · {PIPELINE_LABEL}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function TextSpansView() {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  const spans = useMemo(
    () =>
      entries
        .filter((e) => isTextPipeline(e) && !isInstant(e) && keySet.has(e.date))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin),
    [entries, keySet],
  )

  const switchCount = useMemo(
    () =>
      entries.filter((e) => isTextPipeline(e) && isSwitchInstant(e) && keySet.has(e.date)).length,
    [entries, keySet],
  )

  const totalMin = useMemo(() => spans.reduce((sum, e) => sum + entryMinutes(e), 0), [spans])

  const byDay = useMemo(
    () =>
      dateKeys.map((key) => {
        const daySpans = spans.filter((e) => e.date === key)
        return {
          key,
          label: dayLabel(key),
          minutes: daySpans.reduce((sum, e) => sum + entryMinutes(e), 0),
          switches: entries.filter(
            (e) => e.date === key && isTextPipeline(e) && isSwitchInstant(e),
          ).length,
        }
      }),
    [dateKeys, spans, entries],
  )

  return (
    <div className="an-canvas an-stack" data-testid="text-spans-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Text spans"
            help="currently / stopped / switched Activity intervals stamped by the text pipeline. Durations are painted minutes; switch count is text-pipeline switch instants in the same window."
          />
          <p className="an-canvas-kicker">
            {label} · {PIPELINE_LABEL}
          </p>
        </div>
      </header>

      {spans.length === 0 && switchCount === 0 ? (
        <ChartFrame
          empty
          emptySentence={`No text-pipeline intervals in the ${label}. currently / stopped / switched to paint spans here.`}
        />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Spans" value={spans.length} note={PIPELINE_LABEL} />
            <StudioReadout label="Duration" value={formatDuration(totalMin)} note="painted minutes" />
            <StudioReadout label="Switches" value={switchCount} note="switch instants" />
          </div>
          {byDay.some((d) => d.minutes > 0 || d.switches > 0) && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byDay}>
                <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
                <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
                <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
                <Tooltip contentStyle={STUDIO_TOOLTIP} />
                <Bar dataKey="minutes" name="Minutes" fill="#34a853" />
                <Bar dataKey="switches" name="Switches" fill="#f4a261" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {spans.length === 0 ? (
            <ChartFrame empty emptySentence={`Switches only — no open/closed intervals in the ${label}.`} />
          ) : (
            <ul className="an-list" aria-label="Text spans">
              {spans.map((e) => (
                <li key={e.id} className="an-list-row">
                  <span className="truncate">{entryTitle(e, penName.get(e.penId))}</span>
                  <span className="an-n">
                    {e.date} · {minutesToTimeString(e.startMin)}–{minutesToTimeString(e.endMin)} ·{" "}
                    {formatDuration(entryMinutes(e))} · {PIPELINE_LABEL}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
