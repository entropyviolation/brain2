/**
 * components/Analytics/MoodFieldView.tsx — Painted names and the stretches opened
 *
 * The mosaic is whatever pens exist. Same word, the water, and marks read only
 * the stretches that were opened. A color with no card stays out of the averages.
 * Logged wellbeing metrics stay a separate store.
 */
"use client"

import { useMemo, useState } from "react"
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
import "./analytics-boards.css"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { CanvasTitle, HourDayHeatmap, SliceMosaic, StudioReadout, inkOnFill } from "./studio-kit"
import { buildHourDayGrid } from "./hour-day"
import { penTiles, weekPenGrid } from "./time-views-stats"

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
  const wheel = useMemo(() => weekPenGrid(moodEntries, dateKeys, 12), [moodEntries, dateKeys])
  const tiles = useMemo(() => penTiles(moodEntries), [moodEntries])
  const penById = useMemo(() => new Map((mood?.pens ?? []).map((p) => [p.id, p])), [mood])
  const [wordFind, setWordFind] = useState("")
  const shownGroups = wordGroups.filter((g) => !wordFind.trim() || g.label.toLowerCase().includes(wordFind.trim().toLowerCase()))

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
      <details className="an-mood-how" data-testid="mood-how-to-read">
        <summary className="an-mood-how-summary">How to read this</summary>
        <p className="an-canvas-kicker">
          These plates read the stretches you opened and filled. A painted name with no card is still a color, and it
          stays out of the averages.
        </p>
        <p className="an-canvas-kicker">Same word: one label, many dates. They are not one mood.</p>
        <p className="an-canvas-kicker">The water: the vibe phrases and the leanings (cast, sociability, initiative).</p>
        <p className="an-canvas-kicker">Marks: means and counts, each with n. Missing marks are left out.</p>
        <p className="an-canvas-kicker">Open a block from Tracking to add what a color cannot hold.</p>
      </details>
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
          {wheel.pens.length > 0 && (
            <MoodWheel wheel={wheel} penById={penById} />
          )}
          {tiles.length > 0 && <MoodTaxonomy tiles={tiles} penById={penById} />}
          <section className="an-plate" data-testid="mood-same-word">
            <CanvasTitle title="Same word" help="One label, many dates. They are not one mood." />
            {wordGroups.length > 4 ? (
              <label className="an-studio-field an-find-inline">
                <span>Find a word</span>
                <input value={wordFind} onChange={(e) => setWordFind(e.target.value)} placeholder="Type a word" aria-label="Find a word" />
              </label>
            ) : null}
            {wordGroups.length === 0 ? (
              <p className="an-canvas-kicker">No word was set in this window.</p>
            ) : (
              shownGroups.map((group) => (
                <details key={group.key} className="an-mood-word" open={group.rows.length <= 3}>
                  <summary className="an-canvas-kicker">
                    “{group.label}” · {group.rows.length} {group.rows.length === 1 ? "stretch" : "stretches"}
                  </summary>
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
                </details>
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

type PenLook = Map<string, { id: string; name: string; color: string; parentId?: string }>

/**
 * Mood wheel (IIB "Colours in Cultures"): rings = 7-day slices of the window,
 * oldest inside; wedges = the top mood pens; each cell is the pen's own color,
 * stronger with more minutes. Search lights one word's wedge.
 */
function MoodWheel({ wheel, penById }: { wheel: ReturnType<typeof weekPenGrid>; penById: PenLook }) {
  const [find, setFind] = useState("")
  const size = 300
  const c = size / 2
  const inner = 30
  const outer = 128
  const ringW = (outer - inner) / Math.max(1, wheel.weeks.length)
  const step = (Math.PI * 2) / wheel.pens.length
  const q = find.trim().toLowerCase()
  const arc = (r0: number, r1: number, a0: number, a1: number) => {
    const p = (r: number, a: number) => `${c + Math.cos(a) * r} ${c + Math.sin(a) * r}`
    const large = a1 - a0 > Math.PI ? 1 : 0
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`
  }
  return (
    <section className="an-plate" data-testid="mood-wheel">
      <CanvasTitle
        title="Mood wheel"
        help="Rings are 7-day slices of this window, oldest in the middle. Wedges are your top mood pens. A cell takes the pen's own color, stronger the more minutes it held that week. Type a word to light its wedge."
      />
      <label className="an-studio-field an-find-inline">
        <span>Light a word</span>
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a mood" aria-label="Light a mood word" />
      </label>
      <div className="an-mood-wheel-wrap">
        <svg viewBox={`0 0 ${size} ${size}`} className="an-mood-wheel" role="img" aria-label="Mood minutes by week and pen">
          {wheel.pens.map((pen, j) => {
            const look = penById.get(pen.id)
            const name = look?.name ?? pen.id
            const color = look?.color ?? "#64748b"
            const lit = !q || name.toLowerCase().includes(q)
            const a0 = -Math.PI / 2 + j * step
            const a1 = a0 + step
            const mid = (a0 + a1) / 2
            return (
              <g key={pen.id} opacity={lit ? 1 : 0.12}>
                {wheel.weeks.map((week, w) => {
                  const m = wheel.cells[w][j]
                  return (
                    <path
                      key={week}
                      d={arc(inner + w * ringW, inner + (w + 1) * ringW - 0.6, a0 + 0.01, a1 - 0.01)}
                      fill={color}
                      fillOpacity={m ? 0.2 + 0.8 * (m / Math.max(1, wheel.max)) : 0.04}
                    >
                      <title>{`${name} · week of ${week} · ${formatDuration(m)}`}</title>
                    </path>
                  )
                })}
                <text
                  x={c + Math.cos(mid) * (outer + 8)}
                  y={c + Math.sin(mid) * (outer + 8) + 3}
                  textAnchor={Math.abs(Math.cos(mid)) < 0.2 ? "middle" : Math.cos(mid) > 0 ? "start" : "end"}
                  className="an-mood-wheel-label"
                >
                  {name.length > 12 ? `${name.slice(0, 11)}…` : name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="an-n">
        {wheel.weeks.length} {wheel.weeks.length === 1 ? "ring" : "rings"} · top {wheel.pens.length} pens
      </p>
    </section>
  )
}

type TileSort = "minutes" | "last" | "blocks"

/**
 * Periodic taxonomy (IIB "Rhetological Fallacies"): one tile per mood pen,
 * grouped by its parent pen, with minutes, stretches, days and last date.
 */
function MoodTaxonomy({ tiles, penById }: { tiles: ReturnType<typeof penTiles>; penById: PenLook }) {
  const [sort, setSort] = useState<TileSort>("minutes")
  const groups = useMemo(() => {
    const sorted = [...tiles].sort((a, b) =>
      sort === "last" ? b.last.localeCompare(a.last) : sort === "blocks" ? b.blocks - a.blocks : b.minutes - a.minutes,
    )
    const map = new Map<string, typeof tiles>()
    for (const t of sorted) {
      const parent = penById.get(t.penId)?.parentId
      const family = (parent && penById.get(parent)?.name) || "Top level"
      map.set(family, [...(map.get(family) ?? []), t])
    }
    return [...map.entries()]
  }, [tiles, sort, penById])
  return (
    <section className="an-plate" data-testid="mood-taxonomy">
      <CanvasTitle
        title="Mood table"
        help="Every mood pen painted in this window as a tile, grouped by the pen it counts as. Each tile: minutes, stretches painted, distinct days, and the last date."
      />
      <div className="an-mood-tiles-head">
        {(["minutes", "last", "blocks"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className="an-open-lists"
            aria-pressed={sort === key}
            onClick={() => setSort(key)}
          >
            {key === "minutes" ? "Most time" : key === "last" ? "Most recent" : "Most stretches"}
          </button>
        ))}
      </div>
      {groups.map(([family, list]) => (
        <div key={family} className="an-mood-family">
          <p className="an-mood-family-name">{family}</p>
          <ul className="an-mood-tiles">
            {list.map((t) => {
              const look = penById.get(t.penId)
              const color = look?.color ?? "#64748b"
              return (
                <li key={t.penId} style={{ borderTopColor: color }}>
                  <span className="an-mood-tile-sym" style={{ background: color, color: inkOnFill(color) }}>
                    {(look?.name ?? "?").slice(0, 2)}
                  </span>
                  <span className="an-mood-tile-name">{look?.name ?? t.penId}</span>
                  <span className="an-mood-tile-meta">
                    {formatDuration(t.minutes)} · {t.blocks}× · {t.days}d
                  </span>
                  <span className="an-mood-tile-meta">last {t.last.slice(5)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
