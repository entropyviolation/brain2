/**
 * components/Analytics/sources/HealthView.tsx — Data → Sources → Health
 *
 * The Apple Health report, read from what the iPhone import already wrote:
 * daily totals (`health-store.ts`), workouts on the Activity grid, and the
 * sleep log. It writes nothing. Days Health had nothing for are left out of
 * every mean. The shared date range applies.
 */
"use client"

import { useMemo, useState } from "react"
import { useHealthImportStore } from "@/lib/phone-sync/health-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { formatSleepDuration } from "@/lib/sleep-log"
import {
  HEALTH_FLOORS,
  HEALTH_METRICS,
  metricLink,
  metricSeries,
  metricTrend,
  shareAtOrAbove,
  summarize,
  weekdayMeans,
  workoutRows,
  type HealthMetric,
} from "@/lib/health-report"
import { ChartFrame } from "../studio/chart-frame"
import { useAnalyticsRange } from "../chrome/analytics-range-store"
import { weekdayIndex } from "../chrome/analytics-range"
import { CanvasTitle, FindingBlock, PhosphorTrace, StudioBars, StudioReadout, StudioSelect } from "../studio/studio-kit"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const STEP_GOAL = 8000

function fmt(v: number, digits = 0): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function HealthView() {
  const days = useHealthImportStore((s) => s.days)
  const entries = useTimeTrackingStore((s) => s.entries)
  const sleepLog = useSleepStore((s) => s.nights)
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const [metric, setMetric] = useState<HealthMetric>("steps")
  const spec = HEALTH_METRICS.find((m) => m.id === metric) ?? HEALTH_METRICS[0]
  const dp = metric === "distanceM" ? 1 : 0

  const steps = useMemo(() => summarize(days, dateKeys, "steps"), [days, dateKeys])
  const kcal = useMemo(() => summarize(days, dateKeys, "activeKcal"), [days, dateKeys])
  const heart = useMemo(() => summarize(days, dateKeys, "heartAvg"), [days, dateKeys])
  const dist = useMemo(() => summarize(days, dateKeys, "distanceM"), [days, dateKeys])
  const picked = useMemo(() => summarize(days, dateKeys, metric), [days, dateKeys, metric])
  const series = useMemo(() => metricSeries(days, dateKeys, metric), [days, dateKeys, metric])
  const trend = useMemo(() => metricTrend(days, dateKeys, metric), [days, dateKeys, metric])
  const goal = useMemo(() => shareAtOrAbove(days, dateKeys, STEP_GOAL), [days, dateKeys])
  const weekly = useMemo(() => weekdayMeans(days, dateKeys, metric, weekdayIndex), [days, dateKeys, metric])
  const workouts = useMemo(() => workoutRows(entries, keySet), [entries, keySet])

  const sleepMin = useMemo(() => {
    const out: Record<string, number> = {}
    for (const key of dateKeys) {
      const n = sleepLog[key]
      if (n && typeof n.sleptMin === "number" && typeof n.wokeMin === "number" && n.wokeMin > n.sleptMin) {
        out[key] = n.wokeMin - n.sleptMin
      }
    }
    return out
  }, [sleepLog, dateKeys])
  const sleepLink = useMemo(() => metricLink(days, dateKeys, "steps", sleepMin), [days, dateKeys, sleepMin])
  const heartLink = useMemo(() => metricLink(days, dateKeys, "heartAvg", sleepMin), [days, dateKeys, sleepMin])

  const everyDay = Object.keys(days).length
  const inWindow = steps.n || kcal.n || heart.n ? Math.max(steps.n, kcal.n, heart.n, dist.n) : 0
  const weekMax = Math.max(0, ...weekly.map((w) => w.mean ?? 0))
  const totalWorkoutMin = workouts.reduce((a, w) => a + w.minutes, 0)
  const totalWorkouts = workouts.reduce((a, w) => a + w.count, 0)

  return (
    <div className="an-canvas an-stack">
      <p className="an-canvas-kicker">
        {inWindow} of {dateKeys.length} days with Health data in the {label} · {everyDay} days imported in all · read from
        the iPhone import, nothing written back
      </p>

      {everyDay === 0 ? (
        <ChartFrame
          empty
          emptySentence="No Health data on this device yet. Open Brain2 on the iPhone, go to /mobile/, and tap Import all history. Days appear here once the import has run."
        />
      ) : inWindow === 0 ? (
        <ChartFrame empty emptySentence={`Health has no days in the ${label}. Widen the range, or run the import again on the iPhone.`} />
      ) : (
        <>
          <section className="an-plate">
            <CanvasTitle
              title="The window"
              help="Means are over days Health recorded. A day with nothing is left out, not counted as zero. Distance is walking plus running."
            />
            <div className="an-readouts">
              <StudioReadout label="Steps a day" value={fmt(steps.mean)} note={`median ${fmt(steps.median)} · n = ${steps.n}`} />
              <StudioReadout label="Distance a day" value={`${fmt(dist.mean, 1)} km`} note={`n = ${dist.n}`} />
              <StudioReadout label="Active energy" value={`${fmt(kcal.mean)} kcal`} note={`per day · n = ${kcal.n}`} />
              <StudioReadout label="Heart rate" value={`${fmt(heart.mean)} bpm`} note={`day average · n = ${heart.n}`} />
              <StudioReadout
                label={`Days over ${fmt(STEP_GOAL)} steps`}
                value={goal.n ? `${goal.hit} of ${goal.n}` : "—"}
                note="of days with steps"
              />
              <StudioReadout
                label="Workouts"
                value={totalWorkouts}
                note={totalWorkouts ? `${formatSleepDuration(totalWorkouts ? totalWorkoutMin : 0)} in all` : "none in this window"}
              />
            </div>
          </section>

          <section className="an-plate">
            <CanvasTitle
              title="One series by day"
              help="Pick a measure. The trace runs day by day over the range; days Health left blank are skipped, so the line joins across them."
            />
            <StudioSelect label="Measure" value={metric} onChange={(v) => setMetric(v as HealthMetric)}>
              {HEALTH_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </StudioSelect>
            <PhosphorTrace points={series} title={`${spec.label} by day`} unit={spec.unit.trim() ? spec.unit : undefined} />
            {picked.best && (
              <FindingBlock
                sentence={`Highest day: ${fmt(picked.best.value, dp)}${spec.unit} on ${picked.best.date}. Mean ${fmt(picked.mean, dp)}${spec.unit}, median ${fmt(picked.median, dp)}${spec.unit}.`}
                n={`n = ${picked.n} days`}
              />
            )}
            {trend ? (
              <FindingBlock
                sentence={`The later half of the window averaged ${fmt(trend.laterMean, dp)}${spec.unit} against ${fmt(trend.earlierMean, dp)}${spec.unit} in the earlier half (${trend.change >= 0 ? "+" : "−"}${Math.abs(trend.change * 100).toFixed(0)}%).`}
                n={`n = ${trend.earlierN} + ${trend.laterN} days`}
                caveat="Two halves of one window. It describes these days and does not forecast."
              />
            ) : (
              <p className="an-n">
                Trend withheld: it needs {HEALTH_FLOORS.trend} days with data and 3 in each half.
              </p>
            )}
          </section>

          <section className="an-plate">
            <CanvasTitle
              title="By weekday"
              help="Mean of the chosen measure on each weekday, over days with data. A weekday with no days shows a dash."
            />
            {picked.n < HEALTH_FLOORS.weekday ? (
              <p className="an-n">Weekday means withheld: n = {picked.n}, need {HEALTH_FLOORS.weekday}.</p>
            ) : (
              <StudioBars
                rows={weekly.map((w, i) => ({ name: w.n ? `${WEEKDAYS[i]} (${w.n})` : `${WEEKDAYS[i]} (no days)`, value: Math.round((w.mean ?? 0) * 10) / 10 }))}
                max={weekMax}
                unit={spec.unit}
              />
            )}
          </section>

          <section className="an-plate">
            <CanvasTitle
              title="Workouts"
              help="Workouts the import painted on Activity → Exercise, rolled up by kind. Time is the painted span, cut at midnight."
            />
            {workouts.length === 0 ? (
              <p className="an-n">No Health workouts in this window.</p>
            ) : (
              <StudioBars
                rows={workouts.map((w) => ({ name: `${w.activity} ×${w.count}`, value: w.minutes }))}
                max={workouts[0].minutes}
                unit=" min"
              />
            )}
          </section>

          <section className="an-plate">
            <CanvasTitle
              title="Beside sleep"
              help="Pearson r between a day's Health total and the sleep logged for the same morning, on days that have both. It describes these days; it is not a cause."
            />
            {sleepLink ? (
              <>
                <FindingBlock
                  sentence={`Steps and the sleep logged that morning: r = ${sleepLink.r.toFixed(2)}.`}
                  n={`n = ${sleepLink.n} days with both`}
                  caveat="Correlation is not causation."
                />
                {heartLink && (
                  <FindingBlock
                    sentence={`Day-average heart rate and that morning's sleep: r = ${heartLink.r.toFixed(2)}.`}
                    n={`n = ${heartLink.n} days with both`}
                  />
                )}
              </>
            ) : (
              <p className="an-n">Withheld: fewer than {HEALTH_FLOORS.link} days have both Health data and a logged night.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
