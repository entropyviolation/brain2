/**
 * components/Analytics/ContextSwitchHeatmap.tsx — Context-switching heatmap
 *
 * A switch is a pen change: one block ending and another beginning. Shared
 * Analytics range; a sparse window is not a trend. Adds a 24-hour rate clock
 * with a waking-hours slider and a weekday profile.
 * Docs: `docs/analytics/time-context-switch.md`.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { entriesForDay } from "@/lib/time-entries"
import { parseLocalDate, formatLocalDateKey } from "@/lib/date-utils"
import { contextSwitchSeries, contextSwitchValueSeries, trend, mean } from "@/lib/metrics"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, DensityCalendar, StudioBars, StudioReadout, StudioSelect } from "./studio-kit"
import { hourLabel, switchCountsByHour } from "./hour-day"
import { hourlyRate, wakingRate, weekdayMeans } from "./time-flow-stats"
import "./time-flow.css"

const LEGEND = [0, 1, 3, 5, 8]
const LEGEND_LABEL = ["0", "1", "2–3", "4–6", "7+"]
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function switchColor(count: number): string {
  if (count <= 0) return "#b0b0b0"
  if (count === 1) return "hsl(38 50% 22%)"
  if (count < 4) return "hsl(32 62% 32%)"
  if (count < 7) return "hsl(28 72% 42%)"
  return "hsl(18 78% 52%)"
}

export function ContextSwitchHeatmap() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const tasks = useTaskStore((s) => s.tasks)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]

  const switchByDate = useMemo(() => {
    if (!scope) return new Map<string, number>()
    const dayRows = dateKeys.map((key) => ({
      date: key,
      sequence: entriesForDay(entries, key, scope.id).map((e) => e.penId),
    }))
    const series = contextSwitchSeries(dayRows)
    return new Map(series.map((p) => [p.date, p.switches]))
  }, [scope, entries, dateKeys])

  const heatmap = useMemo(() => {
    if (dateKeys.length === 0) return []
    const start = parseLocalDate(dateKeys[0]) ?? new Date()
    const weekday = (start.getDay() + 6) % 7
    const aligned = addDays(start, -weekday)
    const today = parseLocalDate(dateKeys[dateKeys.length - 1]) ?? new Date()
    const totalDays = Math.round((today.getTime() - aligned.getTime()) / 86400000) + 1
    const weeks = Math.ceil(totalDays / 7)
    const cols: { key: string; value: number; out?: boolean }[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: { key: string; value: number; out?: boolean }[] = []
      for (let day = 0; day < 7; day++) {
        const d = addDays(aligned, w * 7 + day)
        const key = formatLocalDateKey(d)
        col.push({
          key,
          value: !keySet.has(key) || d > today ? 0 : switchByDate.get(key) ?? 0,
          out: !keySet.has(key) || d > today,
        })
      }
      cols.push(col)
    }
    return cols
  }, [switchByDate, dateKeys, keySet])

  const hourCounts = useMemo(
    () => (scope ? switchCountsByHour(entries, dateKeys, scope.id) : Array(24).fill(0)),
    [scope, entries, dateKeys],
  )
  const hourRows = hourCounts.map((value, hour) => ({ name: hourLabel(hour), value }))
  const [wake, setWake] = useState(8)
  const [sleep, setSleep] = useState(24)

  const stats = useMemo(() => {
    const counts = [...switchByDate.values()].filter((v) => v > 0)
    const max = counts.length ? Math.max(...counts) : 0
    const avg = counts.length ? mean(counts) : 0
    const valueSeries = contextSwitchValueSeries(
      [...switchByDate.entries()].map(([date, switches]) => ({ date, switches, distinct: 0, active: 0 })),
    )
    const t = trend(valueSeries)
    const busiest = [...switchByDate.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const quiet = dateKeys.filter((k) => (switchByDate.get(k) ?? 0) <= 1).length
    return { max, avg, activeDays: counts.length, direction: t.direction, busiest, quiet }
  }, [switchByDate, dateKeys])

  const rates = hourlyRate(hourCounts, stats.activeDays)
  const worstHour = rates.indexOf(Math.max(...rates))
  const waking = wakingRate(hourCounts, stats.activeDays, wake, sleep % 24)
  const weekdays = useMemo(() => weekdayMeans(switchByDate, dateKeys), [switchByDate, dateKeys])

  const empty = stats.activeDays === 0
  const thin = !empty && isThinSample(stats.activeDays, SAMPLE_FLOORS.contextSwitchDays)
  const loggedIds = useMemo(
    () =>
      tasks
        .filter((t) => (t.timeLogs ?? []).some((log) => keySet.has(log.date)))
        .map((t) => t.id),
    [tasks, keySet],
  )

  return (
    <div className="an-canvas an-stack tf-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Context switching"
            help="A switch is a pen change on the Tracking grid: one block ending and a different pen beginning. Calendar shade is switches per day. The clock spreads the same switches over the hour they happened in."
          />
          <p className="an-canvas-kicker">{label} · a switch is a pen change — one block ending and another beginning.</p>
        </div>
        {scopes.length > 0 && (
          <StudioSelect label="Scope" value={scope?.id ?? ""} onChange={setScopeId}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </StudioSelect>
        )}
      </header>

      {!scope ? (
        <ChartFrame empty emptySentence="No tracking scopes yet." />
      ) : empty ? (
        <ChartFrame
          empty
          emptySentence={`No painted days for “${scope.name}” in the ${label}. A switch is a pen change on the Home → Tracking grid.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(stats.activeDays, SAMPLE_FLOORS.contextSwitchDays, label)} />
      ) : (
        <>
          <p className="an-n">
            n = {stats.activeDays} days with a switch · avg {stats.avg.toFixed(1)} / day · busiest {stats.max} · trend{" "}
            {stats.direction}
          </p>
          <div className="an-readouts">
            <StudioReadout
              label="Per waking hour"
              value={waking.perHour.toFixed(2)}
              note={`${hourLabel(wake)}–${hourLabel(sleep % 24)} · ${waking.hours} h`}
              tip="Switches in your waking hours ÷ days with a switch ÷ waking hours. Move the sliders to set your day."
            />
            <StudioReadout
              label="Worst hour"
              value={rates[worstHour] > 0 ? hourLabel(worstHour) : "—"}
              note={rates[worstHour] > 0 ? `${rates[worstHour].toFixed(2)} / day` : ""}
            />
            <StudioReadout
              label="Busiest day"
              value={stats.busiest ?? "—"}
              note={`${stats.max} switches`}
            />
            <StudioReadout
              label="Calm days"
              value={`${Math.round((stats.quiet / Math.max(1, dateKeys.length)) * 100)}%`}
              note={`${stats.quiet} of ${dateKeys.length} with ≤ 1 switch`}
            />
          </div>
          <DensityCalendar weeks={heatmap} color={switchColor} />
          <div className="an-legend">
            {LEGEND.map((v, i) => (
              <span key={v}>
                <i style={{ background: switchColor(v) }} />
                {LEGEND_LABEL[i]}
                {i === 0 ? " focused" : i === LEGEND.length - 1 ? " fragmented" : ""}
              </span>
            ))}
          </div>
          {hourCounts.some((v) => v > 0) && (
            <section className="an-plate" aria-label="Rate clock">
              <CanvasTitle
                title="Rate clock"
                help="24-hour dial, midnight at top. Wedge length = mean switches in that hour per day with any switch. Darker wedges are your waking hours from the sliders; the brightest is the worst hour."
              />
              <div className="tf-pair">
                <RateClock rates={rates} wake={wake} sleep={sleep % 24} worst={worstHour} />
                <div className="an-stack">
                  <label className="an-studio-field">
                    <span>Wake {hourLabel(wake)}</span>
                    <input type="range" min={0} max={23} value={wake} aria-label="Wake hour" onChange={(e) => setWake(Number(e.target.value))} />
                  </label>
                  <label className="an-studio-field">
                    <span>Sleep {hourLabel(sleep % 24)}</span>
                    <input type="range" min={1} max={24} value={sleep} aria-label="Sleep hour" onChange={(e) => setSleep(Number(e.target.value))} />
                  </label>
                  <p className="an-canvas-title">By weekday</p>
                  <StudioBars
                    rows={weekdays.map((value, i) => ({ name: WEEKDAYS[i], value: Math.round(value * 10) / 10 }))}
                    max={Math.max(...weekdays, 1)}
                    unit=""
                  />
                  <p className="an-n">mean switches per calendar day, quiet days count as 0</p>
                </div>
              </div>
              <details className="tf-fold">
                <summary>
                  Hour of day <span className="an-n">raw counts, all 24 hours</span>
                </summary>
                <StudioBars rows={hourRows} max={Math.max(...hourCounts, 1)} unit="" />
              </details>
            </section>
          )}
        </>
      )}
      <OpenInListsButton taskIds={loggedIds} />
    </div>
  )
}

export default ContextSwitchHeatmap

function RateClock({ rates, wake, sleep, worst }: { rates: number[]; wake: number; sleep: number; worst: number }) {
  const max = Math.max(...rates, 0.01)
  const c = 110
  const r0 = 30
  const r1 = 92
  const pt = (hour: number, r: number) => {
    const a = (hour / 24) * 2 * Math.PI - Math.PI / 2
    return [c + r * Math.cos(a), c + r * Math.sin(a)]
  }
  const awake = (h: number) => (wake <= sleep ? h >= wake && h < sleep : h >= wake || h < sleep)
  return (
    <svg className="tf-svg" viewBox="0 0 220 220" role="img" aria-label="Switches per hour, 24-hour clock">
      <circle className="tf-rule" cx={c} cy={c} r={r1} />
      <circle className="tf-rule" cx={c} cy={c} r={r0} />
      {rates.map((v, h) => {
        const r = r0 + (v / max) * (r1 - r0)
        const [x1, y1] = pt(h + 0.08, r0)
        const [x2, y2] = pt(h + 0.08, r)
        const [x3, y3] = pt(h + 0.92, r)
        const [x4, y4] = pt(h + 0.92, r0)
        return (
          <path
            key={h}
            d={`M${x1},${y1} L${x2},${y2} A${r},${r} 0 0 1 ${x3},${y3} L${x4},${y4} A${r0},${r0} 0 0 0 ${x1},${y1}Z`}
            fill={h === worst ? switchColor(8) : awake(h) ? switchColor(4) : switchColor(1)}
            opacity={v > 0 ? 1 : 0.15}
          >
            <title>{`${hourLabel(h)}: ${v.toFixed(2)} switches / day`}</title>
          </path>
        )
      })}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = pt(h, r1 + 11)
        return (
          <text key={h} x={x} y={y + 3} fontSize={9} textAnchor="middle" className="tf-faint">
            {hourLabel(h)}
          </text>
        )
      })}
      <text x={c} y={c - 2} fontSize={12} textAnchor="middle" fontWeight={600}>
        {rates[worst] > 0 ? hourLabel(worst) : "—"}
      </text>
      <text x={c} y={c + 11} fontSize={8} textAnchor="middle" className="tf-faint">
        worst hour
      </text>
    </svg>
  )
}
