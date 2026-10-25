/**
 * components/Analytics/TextPipelineView.tsx — Text-pipeline Tracking entries
 *
 * Phone / Telegram ingest stamps `generatedBy.kind === "text"`. Instants are
 * discrete events and switch markers; non-instants are currently / stopped /
 * switched intervals. Always labeled “from text pipeline.” Events get a unit
 * grid (one square per instant, by pen); spans get era bars on a 24-hour track.
 * Lists fold and filter. Not the Texts report.
 * Docs: `docs/analytics/time-text-pipeline.md`.
 */
"use client"

import { Fragment, useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { isLoggedSpanStamp } from "@/lib/habit-keyword-source"
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
import { spanStats } from "./time-flow-stats"
import "./time-flow.css"

const EVENT_FILL = "#1a6b5c"
const SPAN_FILL = "#1a6b5c"
const SWITCH_FILL = "#c2410c"

function usePens() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  return useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, { name: pen.name, color: pen.color })
    }
    return map
  }, [scopes])
}

function matches(entry: TimeEntry, query: string, penName?: string): boolean {
  if (!query) return true
  return `${entry.title ?? ""} ${penName ?? ""} ${entry.date}`.toLowerCase().includes(query)
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="tf-tools">
      <input type="search" value={value} aria-label={label} placeholder="Filter by title, pen or date" onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

const PIPELINE_LABEL = "from text pipeline"

function isTextPipeline(entry: TimeEntry): boolean {
  if (isLoggedSpanStamp(entry.generatedBy?.id)) return false
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
  const pens = usePens()
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

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
  const shown = events.filter((e) => matches(e, q, pens.get(e.penId)?.name))
  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of shown) {
      const key = isSwitchInstant(e) ? "switch" : pens.get(e.penId)?.name ?? entryTitle(e)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [shown, pens])
  const busiestDay = [...byDay].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="an-canvas an-stack tf-view" data-testid="text-events-view">
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
            <StudioReadout
              label="Per day"
              value={(events.length / Math.max(1, dateKeys.length)).toFixed(1)}
              note={busiestDay?.count ? `busiest ${busiestDay.label} · ${busiestDay.count}` : ""}
            />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} minTickGap={12} />
              <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="count" name="Events" fill={EVENT_FILL} />
            </BarChart>
          </ResponsiveContainer>
          <section className="an-plate" aria-label="Every event">
            <CanvasTitle
              title="Every event, one square"
              help="Unit grid: one square per text-pipeline instant, grouped by pen (switches on their own row), oldest first. Hover a square for its title and time. The filter narrows the grid and the list."
            />
            <SearchBox value={query} onChange={setQuery} label="Filter text events" />
            <div className="tf-units">
              {groups.map(([name, rows]) => (
                <Fragment key={name}>
                  <span className="tf-name" title={name}>
                    {name} <span className="an-n">{rows.length}</span>
                  </span>
                  <span className="tf-unit-row">
                    {rows.map((e) => (
                      <i
                        key={e.id}
                        className="tf-unit"
                        title={`${entryTitle(e, pens.get(e.penId)?.name)} · ${e.date} ${minutesToTimeString(e.startMin)}`}
                        style={{ background: isSwitchInstant(e) ? SWITCH_FILL : pens.get(e.penId)?.color ?? EVENT_FILL }}
                      />
                    ))}
                  </span>
                </Fragment>
              ))}
            </div>
            {groups.length === 0 ? <p className="an-canvas-hint">Nothing matches “{query.trim()}”.</p> : null}
          </section>
          <details className="tf-fold">
            <summary>
              Event list <span className="an-n">{shown.length} rows</span>
            </summary>
            <ul className="an-list tf-scroll" aria-label="Text events by day">
              {shown.map((e) => (
                <li key={e.id} className="an-list-row">
                  <span className="truncate">{entryTitle(e, pens.get(e.penId)?.name)}</span>
                  <span className="an-n">
                    {e.date} · {minutesToTimeString(e.startMin)} · {PIPELINE_LABEL}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  )
}

export function TextSpansView() {
  const entries = useTimeTrackingStore((s) => s.entries)
  const pens = usePens()
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

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

  const stats = useMemo(() => spanStats(spans.map(entryMinutes)), [spans])
  const totalMin = stats.total
  const shown = spans.filter((e) => matches(e, q, pens.get(e.penId)?.name))
  const eraDays = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of shown) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()]
  }, [shown])

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
    <div className="an-canvas an-stack tf-view" data-testid="text-spans-view">
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
            <StudioReadout
              label="Median span"
              value={stats.median == null ? "—" : formatDuration(Math.round(stats.median))}
              note={stats.longest ? `longest ${formatDuration(stats.longest)}` : ""}
            />
          </div>
          {byDay.some((d) => d.minutes > 0 || d.switches > 0) && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byDay}>
                <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
                <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} minTickGap={12} />
                <YAxis yAxisId="min" allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
                <YAxis yAxisId="sw" orientation="right" allowDecimals={false} fontSize={11} stroke={SWITCH_FILL} />
                <Tooltip contentStyle={STUDIO_TOOLTIP} />
                <Bar yAxisId="min" dataKey="minutes" name="Minutes" fill={SPAN_FILL} />
                <Bar yAxisId="sw" dataKey="switches" name="Switches" fill={SWITCH_FILL} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {spans.length === 0 ? (
            <ChartFrame empty emptySentence={`Switches only — no open/closed intervals in the ${label}.`} />
          ) : (
            <>
              <section className="an-plate" aria-label="Spans on the clock">
                <CanvasTitle
                  title="Spans on the clock"
                  help="Era bars: one row per day, midnight to midnight. Each bar is a text-pipeline span from its start to its end, in its pen's color. Gridlines every 6 hours."
                />
                <SearchBox value={query} onChange={setQuery} label="Filter text spans" />
                <div className="tf-era">
                  <span />
                  <span className="tf-era-axis">
                    <span>0:00</span>
                    <span>6:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>24:00</span>
                  </span>
                  {eraDays.map(([date, rows]) => (
                    <Fragment key={date}>
                      <span>{dayLabel(date)}</span>
                      <span className="tf-era-track">
                        {rows.map((e) => (
                          <i
                            key={e.id}
                            title={`${entryTitle(e, pens.get(e.penId)?.name)} · ${minutesToTimeString(e.startMin)}–${minutesToTimeString(e.endMin)} · ${formatDuration(entryMinutes(e))}`}
                            style={{
                              left: `${(e.startMin / 1440) * 100}%`,
                              width: `${(Math.max(0, Math.min(1440, e.endMin) - e.startMin) / 1440) * 100}%`,
                              background: pens.get(e.penId)?.color ?? SPAN_FILL,
                            }}
                          />
                        ))}
                      </span>
                    </Fragment>
                  ))}
                </div>
                {eraDays.length === 0 ? <p className="an-canvas-hint">Nothing matches “{query.trim()}”.</p> : null}
              </section>
              <details className="tf-fold">
                <summary>
                  Span list <span className="an-n">{shown.length} rows</span>
                </summary>
                <ul className="an-list tf-scroll" aria-label="Text spans">
                  {shown.map((e) => (
                    <li key={e.id} className="an-list-row">
                      <span className="truncate">{entryTitle(e, pens.get(e.penId)?.name)}</span>
                      <span className="an-n">
                        {e.date} · {minutesToTimeString(e.startMin)}–{minutesToTimeString(e.endMin)} ·{" "}
                        {formatDuration(entryMinutes(e))} · {PIPELINE_LABEL}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </>
      )}
    </div>
  )
}
