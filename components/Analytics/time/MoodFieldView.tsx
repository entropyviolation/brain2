/**
 * components/Analytics/MoodFieldView.tsx — Painted names and the stretches opened
 *
 * The mosaic is whatever pens exist. Same word, the water, and marks read only
 * the stretches that were opened. A color with no card stays out of the averages.
 * Logged wellbeing metrics stay a separate store.
 */
"use client"

import { useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useMetricsStore, METRIC_DEFINITIONS } from "@/lib/metrics-store"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { entriesInRange, penTotalsAtDepth } from "@/lib/tracking-summary"
import {
  SAME_WORD_NOTE,
  groupSameWord,
  marksOf,
  toneLabel,
  waterOf,
  type RankMean,
} from "@/lib/mood-reading"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { CanvasTitle, HourDayHeatmap, SliceMosaic, StudioReadout } from "./studio-kit"
import { buildHourDayGrid } from "./hour-day"

function formatMean(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function MeanReadout({ mean }: { mean: RankMean }) {
  return <StudioReadout label={mean.label} value={formatMean(mean.mean)} note={`n = ${mean.n}`} />
}

export function MoodFieldView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const mood = scopes.find((s) => s.name === "Mood")

  const moodEntries = useMemo(() => {
    if (!mood) return []
    return entriesInRange(entries, dateKeys, mood.id)
  }, [mood, entries, dateKeys])

  const slices = useMemo(() => {
    if (!mood) return []
    return penTotalsAtDepth(moodEntries, mood, dateKeys, mood.displayDepth ?? null)
  }, [mood, moodEntries, dateKeys])

  const grid = useMemo(
    () => (mood ? buildHourDayGrid(entries, dateKeys, mood.id) : null),
    [mood, entries, dateKeys],
  )

  const wordGroups = useMemo(() => groupSameWord(moodEntries), [moodEntries])
  const water = useMemo(() => waterOf(moodEntries), [moodEntries])
  const marks = useMemo(() => marksOf(moodEntries), [moodEntries])

  const metricReadings = useMemo(() => {
    return METRIC_DEFINITIONS.map((def) => {
      const values = datapoints
        .filter((dp) => dp.values[def.key] !== undefined && keySet.has(dateKeyOf(dp.at) ?? ""))
        .map((dp) => dp.values[def.key] as number)
      const avg = values.length ? values.reduce((s, n) => s + n, 0) / values.length : null
      return { name: def.name, n: values.length, avg }
    })
  }, [datapoints, keySet])

  const painted = slices.length > 0 || (grid?.observedDays ?? 0) > 0
  const showGraspingContrast = marks.graspingWithAbout !== null && marks.graspingWithoutAbout !== null

  return (
    <div className="an-canvas an-stack" data-testid="mood-field">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Mood field</p>
          <p className="an-canvas-kicker">{label} · any painted name. Averages use only the stretches you opened.</p>
        </div>
      </header>
      <div data-testid="mood-how-to-read">
        <p className="an-canvas-title">How to read this</p>
        <p className="an-canvas-kicker">
          These plates read the stretches you opened and filled. A painted name with no card is still a color, and it
          stays out of the averages.
        </p>
        <p className="an-canvas-kicker">Same word: one label, many dates. They are not one mood.</p>
        <p className="an-canvas-kicker">The water: the vibe phrases and the leanings (cast, sociability, initiative).</p>
        <p className="an-canvas-kicker">Marks: means and counts, each with n. Missing marks are left out.</p>
        <p className="an-canvas-kicker">Open a block from Tracking to add what a color cannot hold.</p>
      </div>
      {!mood ? (
        <ChartFrame empty emptySentence="No Mood scope yet." />
      ) : !painted ? (
        <ChartFrame empty emptySentence={`Nothing painted in Mood in the ${label}.`} />
      ) : (
        <>
          <section className="an-plate">
            <CanvasTitle
              title="Mood pens"
              help="Colors in this window, whatever the name. A color with no card stays out of the averages."
            />
            <SliceMosaic
              slices={slices.map((s) => ({
                id: s.id,
                name: s.name,
                color: s.color,
                minutes: s.minutes,
                label: formatDuration(s.minutes),
              }))}
              max={Math.max(...slices.map((s) => s.minutes), 1)}
            />
          </section>
          {grid && grid.observedDays > 0 && (
            <section className="an-plate">
              <p className="an-canvas-title">Hour × day</p>
              <div className="an-plot-well">
                <HourDayHeatmap grid={grid} hue={312} />
              </div>
            </section>
          )}
          <section className="an-plate" data-testid="mood-same-word">
            <CanvasTitle title="Same word" help="One label, many dates. They are not one mood." />
            {wordGroups.length === 0 ? (
              <p className="an-canvas-kicker">No word was set in this window.</p>
            ) : (
              wordGroups.map((group) => (
                <div key={group.key}>
                  <p className="an-canvas-kicker">“{group.label}”</p>
                  {group.rows.length >= 2 ? <p className="an-canvas-kicker">{SAME_WORD_NOTE}</p> : null}
                  {group.rows.map((row) => (
                    <p key={row.id} className="an-canvas-kicker">
                      {row.date} · {minutesToLabel(row.startMin)}–{minutesToLabel(row.endMin)} · “{row.word}”
                      {row.sensation ? ` · ${row.sensation}` : ""}
                      {row.tone ? ` · ${toneLabel(row.tone)}` : ""}
                      {row.marks.length
                        ? ` · ${row.marks.map((mark) => `${mark.label} ${mark.value}`).join(", ")}`
                        : ""}
                      {row.vibe ? ` · ${row.vibe}` : ""}
                    </p>
                  ))}
                </div>
              ))
            )}
          </section>
          <section className="an-plate" data-testid="mood-water">
            <CanvasTitle
              title="The water"
              help="The vibe phrases and the leanings (cast, sociability, initiative)."
            />
            {water.phrases.length === 0 && water.means.length === 0 ? (
              <p className="an-canvas-kicker">No water was written in this window.</p>
            ) : (
              <>
                {water.phrases.map((phrase) => (
                  <p key={phrase.vibe} className="an-canvas-kicker">
                    “{phrase.vibe}” · {phrase.dates.join(", ")}
                  </p>
                ))}
                {water.means.length > 0 && (
                  <div className="an-readouts">
                    {water.means.map((mean) => (
                      <MeanReadout key={mean.key} mean={mean} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
          <section className="an-plate" data-testid="mood-marks">
            <CanvasTitle title="Marks" help="Means and counts, each with n. Missing marks are left out." />
            {marks.means.length === 0 && marks.tones.length === 0 && !showGraspingContrast ? (
              <p className="an-canvas-kicker">No marks were set in this window.</p>
            ) : (
              <>
                {marks.means.length > 0 && (
                  <div className="an-readouts">
                    {marks.means.map((mean) => (
                      <MeanReadout key={mean.key} mean={mean} />
                    ))}
                  </div>
                )}
                {marks.tones.length > 0 && (
                  <p className="an-canvas-kicker">
                    {marks.tones.map((tone) => `${tone.label} ${tone.n}`).join(" · ")}
                  </p>
                )}
                {showGraspingContrast && marks.graspingWithAbout && marks.graspingWithoutAbout && (
                  <p className="an-canvas-kicker">
                    About that written: grasping {formatMean(marks.graspingWithAbout.mean)} (n ={" "}
                    {marks.graspingWithAbout.n}). Not written: grasping {formatMean(marks.graspingWithoutAbout.mean)} (n
                    = {marks.graspingWithoutAbout.n}).
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
      <section className="an-plate">
        <p className="an-canvas-title">Logged metrics</p>
        <div className="an-readouts">
          {metricReadings.map((m) => (
            <StudioReadout
              key={m.name}
              label={m.name}
              value={m.avg === null ? "—" : Math.round(m.avg)}
              note={m.n === 0 ? "no readings" : `n = ${m.n}`}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
