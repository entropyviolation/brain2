/**
 * components/Analytics/SpectrumView.tsx — Autocorrelation + periodogram + sleep CV
 *
 * Lag-1 and lag-7 Pearson autocorrelation of daily habit % and of sleep
 * duration. Naive DFT periodogram of habit % (peak period in days). Coefficient
 * of variation of sleep duration and bedtime. Classical only; thin windows
 * watermarked. SAMPLE_FLOORS.spectrum = 14 overlapping points.
 */
"use client"

import { useMemo, useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { parseLocalDate } from "@/lib/date-utils"
import { resolveNights } from "@/lib/sleep-inference"
import { offsetToLabel, sleepStats } from "@/lib/sleep-log"
import {
  autocorrelation,
  coefficientOfVariation,
  dominantPeriod,
  periodogram,
} from "@/lib/metrics"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, PhosphorTrace, StudioBars, StudioReadout } from "./studio-kit"
import { uniqueMinutesByDate } from "@/lib/tracking-summary"
import { acf, spreadMinutes, whiteNoiseBand } from "./meta-math"
import { Correlogram, LogPeriodogram } from "./meta-plots"

type RhythmSeries = "habits" | "sleep" | "tracking"

const RHYTHM_LABEL: Record<RhythmSeries, string> = {
  habits: "Habit %",
  sleep: "Sleep minutes",
  tracking: "Tracked minutes",
}

export function SpectrumView() {
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const logged = useSleepStore((s) => s.nights)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()

  const habitSeries = useMemo(() => {
    if (habitTasks.length === 0) return []
    return dateKeys.map((key) => {
      const d = parseLocalDate(key)
      const dow = d ? (d.getDay() + 6) % 7 : 0
      const pct = calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, dow, exemptionTest(habitExemptions, "daily"))
      return { date: key, value: pct }
    })
  }, [habitTasks, weeklyData, habitExemptions, dateKeys, logged])

  const nights = useMemo(
    () => resolveNights(logged, { scopes, entries }, dateKeys),
    [logged, scopes, entries, dateKeys],
  )
  const stats = useMemo(() => sleepStats(nights, dateKeys, 480), [nights, dateKeys])
  const sleepDurations = stats.nights.map((n) => n.minutes)
  const bedtimes = stats.nights.map((n) => n.sleptMin)
  const habitValues = habitSeries.map((p) => p.value)
  const habitN = habitSeries.filter((p) => p.value > 0 || habitTasks.length > 0).length
  const r1 = autocorrelation(habitValues, 1)
  const r7 = autocorrelation(habitValues, 7)
  const sleepR1 = autocorrelation(sleepDurations, 1)
  const peak = dominantPeriod(habitValues)
  const bins = periodogram(habitValues)
  const cvDur = coefficientOfVariation(sleepDurations)
  const cvBed = coefficientOfVariation(bedtimes)
  const thinHabits = habitTasks.length === 0 || isThinSample(habitValues.length, SAMPLE_FLOORS.spectrum)
  const thinSleep = isThinSample(sleepDurations.length, 7)
  const bedSpread = spreadMinutes(bedtimes)

  const [pick, setPick] = useState<RhythmSeries>("habits")
  const [maxLag, setMaxLag] = useState(21)
  const trackedByDay = useMemo(() => uniqueMinutesByDate(entries), [entries])
  const rhythmValues = useMemo(() => {
    if (pick === "habits") return habitValues
    if (pick === "sleep") return sleepDurations
    // A day with no paint is a gap here, not zero: a blank grid would fake a rhythm.
    return dateKeys.map((k) => trackedByDay[k]).filter((v): v is number => typeof v === "number" && v > 0)
  }, [pick, habitValues, sleepDurations, dateKeys, trackedByDay])
  const rhythmThin = isThinSample(rhythmValues.length, SAMPLE_FLOORS.spectrum)
  const lagCap = Math.max(1, Math.min(maxLag, Math.floor(rhythmValues.length / 2)))
  const rhythmAcf = useMemo(() => acf(rhythmValues, lagCap), [rhythmValues, lagCap])
  const rhythmBins = useMemo(() => periodogram(rhythmValues), [rhythmValues])
  const band = whiteNoiseBand(rhythmValues.length)
  const outside = rhythmAcf.filter((b) => Math.abs(b.r) > band)

  return (
    <div className="an-canvas an-stack" data-testid="spectrum-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Spectrum"
            help="Autocorrelation r(k) is Pearson of the series against itself shifted k days. Periodogram is a naive DFT: power at harmonic k is |X(k)|²/n on the mean-centered series. CV = σ/|μ| of sleep duration and bedtime. Not a forecast."
          />
          <p className="an-canvas-kicker">{label} · habit % and sleep nights already in the vault</p>
        </div>
      </header>

      <div className="an-readouts">
        <StudioReadout
          label="Habit r(1)"
          value={thinHabits ? "—" : r1.toFixed(2)}
          note="next-day lag"
          tip="Pearson of today's habit % vs yesterday's. Near 1 = sticky days. Need 14+ days."
        />
        <StudioReadout
          label="Habit r(7)"
          value={thinHabits ? "—" : r7.toFixed(2)}
          note="week lag"
          tip="Same series vs itself a week later. A weekly ritual shows up here."
        />
        <StudioReadout
          label="Peak period"
          value={thinHabits || !peak ? "—" : `${peak.period.toFixed(1)} d`}
          note={peak ? `k=${peak.k}` : "need 14 days"}
          tip="Harmonic with the most DFT power. A 7-day peak is a weekly rhythm, not a diagnosis."
        />
        <StudioReadout
          label="Sleep r(1)"
          value={thinSleep ? "—" : sleepR1.toFixed(2)}
          note={`${sleepDurations.length} nights`}
          tip="Duration tonight vs last night. Regular sleep is sticky; a 0 is 'no linear memory'."
        />
      </div>

      <section className="an-plate" data-testid="spectrum-rhythm">
        <p className="an-canvas-title">Rhythm finder</p>
        <p className="an-canvas-hint">
          Bars are r(k): the series against itself k days later. The shaded band is ±1.96/√n, where pure noise would sit 95%
          of the time. Bars past it are memory or a beat. Below, the periodogram on a log period axis with the week and month
          named.
        </p>
        <div className="an-meta-tools">
          {(Object.keys(RHYTHM_LABEL) as RhythmSeries[]).map((key) => (
            <button key={key} type="button" className="an-meta-chip" aria-pressed={pick === key} onClick={() => setPick(key)}>
              {RHYTHM_LABEL[key]}
            </button>
          ))}
          <label>
            Lags
            <input type="range" min={7} max={60} value={maxLag} onChange={(e) => setMaxLag(Number(e.target.value))} aria-label="Most lags to draw" />
            {lagCap} d
          </label>
        </div>
        {rhythmThin ? (
          <ChartFrame thin thinSentence={thinWindowSentence(rhythmValues.length, SAMPLE_FLOORS.spectrum, label)} />
        ) : (
          <>
            <Correlogram bars={rhythmAcf} band={band} />
            <p className="an-n">
              n = {rhythmValues.length} days · band ±{band.toFixed(2)} ·{" "}
              {outside.length === 0
                ? "no lag clears the band"
                : `outside the band at ${outside.slice(0, 6).map((b) => `${b.k} d`).join(", ")}`}
            </p>
            <LogPeriodogram bins={rhythmBins} />
            <p className="an-caveat">
              Bars are not independent: one real beat at 7 d also lifts 14 d and 21 d. Gaps are dropped, so days close up.
            </p>
          </>
        )}
      </section>

      <p className="an-canvas-title">Habit % autocorrelation</p>
      {habitTasks.length === 0 ? (
        <ChartFrame empty emptySentence="No habits yet — nothing to autocorrelate." />
      ) : thinHabits ? (
        <ChartFrame thin thinSentence={thinWindowSentence(habitValues.length, SAMPLE_FLOORS.spectrum, label)} />
      ) : (
        <>
          <PhosphorTrace
            title="Daily habit completion percent"
            points={habitSeries.map((p) => ({ x: p.date.slice(5), y: p.value }))}
            unit="%"
          />
          <p className="an-canvas-hint">
            n = {habitN} days. r(1) = {r1.toFixed(2)}, r(7) = {r7.toFixed(2)}. Correlation is not a weekly grade.
          </p>
        </>
      )}

      <p className="an-canvas-title">Periodogram · habit %</p>
      {habitTasks.length === 0 || bins.length === 0 ? (
        <ChartFrame empty emptySentence="Need at least 4 habit days for a periodogram." />
      ) : thinHabits ? (
        <ChartFrame thin thinSentence={thinWindowSentence(habitValues.length, SAMPLE_FLOORS.spectrum, label)} />
      ) : (
        <>
          <PhosphorTrace
            title="DFT power by period"
            points={bins.map((b) => ({ x: `${b.period.toFixed(1)}d`, y: b.power }))}
          />
          <StudioBars
            rows={bins
              .slice()
              .sort((a, b) => b.power - a.power)
              .slice(0, 6)
              .map((b) => ({ name: `${b.period.toFixed(1)} d`, value: Number(b.power.toFixed(1)) }))}
            max={Math.max(...bins.map((b) => b.power), 1)}
            unit=""
          />
          <p className="an-canvas-hint">
            Power is |X(k)|² / n on the mean-centered series. A tall 7-day bin is a weekly beat, not a cause.
          </p>
        </>
      )}

      <p className="an-canvas-title">Sleep coefficient of variation</p>
      {sleepDurations.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={`No nights in ${label}. CV is σ/mean of duration and of bedtime offset.`}
        />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout
              label="Duration CV"
              value={cvDur.toFixed(2)}
              note={`${sleepDurations.length} nights`}
              tip="σ / mean of night length. 0.1 is tight; 0.4 is a wide spread. Blank nights are excluded, not zero."
            />
            <StudioReadout
              label="Bedtime CV"
              value={cvBed.toFixed(2)}
              note={stats.nights[0] ? `asleep ~ ${offsetToLabel(stats.averageBedtime ?? 0)}` : ""}
              tip="σ / |mean| of bedtime as minutes from midnight (negative = before). Independent of duration CV."
            />
            <StudioReadout
              label="Bedtime spread"
              value={`± ${Math.round(bedSpread)} m`}
              note="σ of asleep time"
              tip="Standard deviation of bedtime in minutes. Easier to read than bedtime CV, which blows up when the mean bedtime sits near midnight."
            />
          </div>
          <PhosphorTrace
            title="Night duration"
            points={stats.nights.map((n) => ({ x: n.date.slice(5), y: n.minutes }))}
            unit="m"
          />
        </>
      )}
    </div>
  )
}
