/**
 * components/Analytics/SleepAnalytics.tsx — The Sleep tab
 *
 * Reads the nightly log (`lib/sleep-store.ts`) **and the Tracking grid**,
 * reconciled by `lib/sleep-inference.ts`, through the pure rollups in
 * `lib/sleep-log.ts`. A night the user painted as Sleep but never typed into the
 * strip still counts here, marked as read off the grid — the tab describes the
 * user's sleep, not their data entry.
 *
 * Nothing here is a separate copy of the tracker: a night derived from the log is
 * painted on the grid, and editing that block corrects the log
 * (`lib/sleep-sync.ts`), so what this tab reports is always what the Tracking tab
 * shows — in both directions, without a refresh.
 *
 * Five questions, in the order people actually ask them:
 *
 *   1. How much am I sleeping?         average and median per night *tracked*
 *   2. When am I sleeping?             average bedtime and wake time
 *   3. How regular is it?              spread of each end, and its extremes
 *   4. How far do the ends swing?      earliest and latest of both, with dates
 *   5. Is it changing?                 later half of the range against the earlier
 *   6. Against the sun?                sleep vs that evening's sunset, wake vs
 *                                      that morning's sunrise (persisted per day)
 *
 * Sleep that is not a night — naps, a second stretch after an early alarm — is
 * reported under the nightly chart rather than folded into the averages, so
 * "per night" keeps meaning per night while nothing the user painted goes
 * missing (`straySleep`).
 *
 * Two deliberate refusals:
 *
 * - **Blank nights are shown, not hidden.** A 30-day average built from four
 *   nights is not a 30-day average, and the card says so rather than quietly
 *   dividing by a smaller number.
 * - **Estimated nights are labelled.** A remembered bedtime and one read off a
 *   clock make the same-looking bar; the header reports how much of the stretch
 *   was guessed so a trend is never read as firmer than its evidence.
 *
 * The nightly chart plots each night on a fixed 6 PM → noon axis, which is what
 * makes irregularity visible as a ragged left edge rather than a number.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import {
  peekOrComputeDaySun,
  sunPlaceForCity,
  useSunTimesStore,
} from "@/lib/sun-times-store"
import { describeVsSun, sleepSunSummary } from "@/lib/sleep-sun"
import { MIN_STANDALONE_NIGHT, resolveNights, straySleep } from "@/lib/sleep-inference"
import {
  DEFAULT_SLEEP_TARGET_MINUTES,
  describeShift,
  formatSleepDuration,
  offsetToLabel,
  sleepStats,
  sleepTrend,
  previousDateKey,
  type SleepNightStat,
} from "@/lib/sleep-log"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { PhosphorTrace, StudioReadout } from "./studio-kit"
import { RidgelineChart } from "./studio-plots"
import { valuesByWeekday } from "./studio-plot-stats"
import { autocorrelation, coefficientOfVariation } from "@/lib/metrics"
import {
  chronotypeWord,
  debtAt,
  nightsAfter,
  sleepRegularityIndex,
  socialJetlag,
  type SocialJetlag,
} from "./sleep-rhythm"
import "./time-rhythms.css"

/** Lists longer than this fold behind a summary. */
const FOLD_AFTER = 14

/** The chart's window: 6 PM the evening before through noon. */
const AXIS_START = -6 * 60
const AXIS_END = 12 * 60
const AXIS_SPAN = AXIS_END - AXIS_START

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <StudioReadout label={label} value={value} note={hint} />
}

/** "Wed 16" — the night's morning, for labelling a bar or an extreme. */
function nightLabel(date: string): string {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  ).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
}

/** The earliest and latest one end of the night reached, each with its date. */
function Extremes({
  label,
  earliest,
  latest,
  at,
}: {
  label: string
  earliest?: SleepNightStat
  latest?: SleepNightStat
  at: (night: SleepNightStat) => number
}) {
  if (!earliest || !latest) return null
  const spread = at(latest) - at(earliest)
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{offsetToLabel(at(earliest))}</span>{" "}
        <span className="text-muted-foreground">at the earliest ({nightLabel(earliest.date)})</span>
      </p>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{offsetToLabel(at(latest))}</span>{" "}
        <span className="text-muted-foreground">at the latest ({nightLabel(latest.date)})</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {spread === 0 ? "Same time every night." : `${formatSleepDuration(spread)} between the two.`}
      </p>
    </div>
  )
}

/** One night as a bar laid on the 6 PM → noon axis. */
function NightBar({ night, targetMinutes }: { night: SleepNightStat; targetMinutes: number }) {
  const left = ((Math.max(AXIS_START, night.sleptMin) - AXIS_START) / AXIS_SPAN) * 100
  const right = ((Math.min(AXIS_END, night.wokeMin) - AXIS_START) / AXIS_SPAN) * 100
  const short = night.minutes < targetMinutes

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-muted-foreground">{nightLabel(night.date)}</span>
      <span className="relative h-4 flex-1 rounded bg-muted/50">
        <span
          className={`absolute inset-y-0 rounded ${short ? "bg-amber-500" : "bg-indigo-500"} ${
            night.estimated ? "opacity-60" : ""
          }`}
          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }}
          title={`${offsetToLabel(night.sleptMin)} – ${offsetToLabel(night.wokeMin)}${
            night.estimated ? " (estimated)" : ""
          }${night.source !== "logged" ? " · read off the Tracking grid" : ""} · same night as Home → Tracking`}
        />
      </span>
      <span className="w-16 shrink-0 text-right tabular-nums">{formatSleepDuration(night.minutes)}</span>
      <span
        className="w-8 shrink-0 text-muted-foreground"
        title={
          night.source !== "logged"
            ? "Read off the sleep you painted in Tracking"
            : night.estimated
              ? "Estimated"
              : "Recorded"
        }
      >
        {night.estimated ? "~" : ""}
        {night.source !== "logged" ? " est." : ""}
      </span>
    </div>
  )
}

/**
 * Every night in the window as a span on the 6 PM → noon axis, oldest first,
 * over that night's dark (sunset to sunrise). Blank nights keep their row.
 * Nights asleep after the "late after" line turn orange.
 */
function SleepWindowChart({
  dateKeys,
  nights,
  dark,
  lateAfter,
}: {
  dateKeys: readonly string[]
  nights: readonly SleepNightStat[]
  dark: ReadonlyMap<string, { sunset: number; sunrise: number }>
  lateAfter: number
}) {
  const W = 600
  const PAD_L = 44
  const PAD_T = 18
  const rowH = Math.max(1, Math.min(12, 360 / Math.max(1, dateKeys.length)))
  const H = PAD_T + rowH * dateKeys.length + 4
  const byDate = new Map(nights.map((n) => [n.date, n]))
  const x = (offset: number) =>
    PAD_L + ((Math.min(AXIS_END, Math.max(AXIS_START, offset)) - AXIS_START) / AXIS_SPAN) * (W - PAD_L)
  const ticks = [-360, -180, 0, 180, 360, 540, 720]
  const labelEvery = Math.ceil(dateKeys.length / 12)
  return (
    <svg className="an-tr-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sleep window, night by night">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={PAD_T - 4} y2={H} stroke="var(--at-rule-soft)" strokeWidth={0.5} />
          <text x={x(t)} y={10} textAnchor="middle">
            {offsetToLabel(t)}
          </text>
        </g>
      ))}
      {dateKeys.map((date, i) => {
        const y = PAD_T + i * rowH
        const night = byDate.get(date)
        const sun = dark.get(date)
        return (
          <g key={date}>
            {i % labelEvery === 0 && rowH >= 1 ? (
              <text x={PAD_L - 6} y={y + rowH} textAnchor="end">
                {nightLabel(date)}
              </text>
            ) : null}
            {sun ? (
              <rect x={x(sun.sunset)} y={y} width={Math.max(0, x(sun.sunrise) - x(sun.sunset))} height={rowH} fill="var(--at-night)" opacity={0.1} />
            ) : null}
            {night ? (
              <rect
                x={x(night.sleptMin)}
                y={y + rowH * 0.15}
                width={Math.max(1, x(night.wokeMin) - x(night.sleptMin))}
                height={Math.max(1, rowH * 0.7)}
                rx={Math.min(2, rowH / 3)}
                fill={night.sleptMin > lateAfter ? "#c2410c" : "#3b3f8f"}
                opacity={night.estimated || night.source !== "logged" ? 0.55 : 1}
              >
                <title>
                  {`${nightLabel(date)} · ${offsetToLabel(night.sleptMin)} – ${offsetToLabel(night.wokeMin)} · ${formatSleepDuration(night.minutes)}${
                    night.estimated ? " · estimated" : ""
                  }`}
                </title>
              </rect>
            ) : null}
          </g>
        )
      })}
      <line x1={x(lateAfter)} x2={x(lateAfter)} y1={PAD_T - 4} y2={H} stroke="#c2410c" strokeDasharray="3 3" strokeWidth={1} />
    </svg>
  )
}

function clockSigned(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+"
  return `${sign}${formatSleepDuration(Math.round(Math.abs(minutes)))}`
}

/** Social jetlag, chronotype and regularity. Each says "not yet" under its floor. */
function BodyClock({ jetlag, sri }: { jetlag: SocialJetlag | null; sri: { sri: number; pairs: number } | null }) {
  return (
    <section className="an-plate" data-testid="sleep-body-clock">
      <p className="an-canvas-title">Body clock</p>
      {jetlag ? (
        <p className="an-tr-lede">
          {Math.abs(jetlag.jetlag) < 30
            ? "Your weekend nights sit within half an hour of your weeknights. Little social jetlag."
            : `On weekend nights the middle of your sleep moves ${formatSleepDuration(Math.round(Math.abs(jetlag.jetlag)))} ${
                jetlag.jetlag > 0 ? "later" : "earlier"
              }. That is like crossing ${Math.round(Math.abs(jetlag.jetlag) / 60)} time zone${
                Math.round(Math.abs(jetlag.jetlag) / 60) === 1 ? "" : "s"
              } every weekend and back.`}
        </p>
      ) : null}
      <div className="an-readouts">
        <StudioReadout
          label="Social jetlag"
          value={jetlag ? clockSigned(jetlag.jetlag) : "not yet"}
          note={
            jetlag
              ? `weekend minus weekday mid-sleep · ${jetlag.nFree} free, ${jetlag.nWork} work nights`
              : "needs 2 weekend and 2 weekday nights"
          }
          tip="Wittmann et al. 2006. Mid-sleep on Fri/Sat nights minus mid-sleep on the other nights. Over 2h is linked to worse mood and metabolic markers in population studies."
        />
        <StudioReadout
          label="Chronotype (MSFsc)"
          value={jetlag ? offsetToLabel(Math.round(jetlag.msfsc)) : "not yet"}
          note={jetlag ? chronotypeWord(jetlag.msfsc) : "free-night mid-sleep, corrected"}
          tip="Munich ChronoType Questionnaire (Roenneberg et al. 2004): free-day mid-sleep minus half the extra sleep on free days. Population median is about 4–5 AM."
        />
        <StudioReadout
          label="Regularity (SRI)"
          value={sri ? Math.round(sri.sri) : "not yet"}
          note={sri ? `${sri.pairs} back-to-back pairs · 100 = same every day` : "needs 2 back-to-back night pairs"}
          tip="Sleep Regularity Index (Phillips et al. 2017): chance you are in the same state (asleep or awake) at the same minute on consecutive days, scaled −100 to 100. Computed on the 6 PM → noon window only, so naps are not in it."
        />
      </div>
      <p className="an-n">Free nights are Friday and Saturday. These are your logs set against published methods, not a diagnosis.</p>
    </section>
  )
}

export function SleepAnalytics() {
  const logged = useSleepStore((s) => s.nights)
  const targetMinutes = useSleepStore((s) => s.targetMinutes) || DEFAULT_SLEEP_TARGET_MINUTES
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label: rangeLabel } = useAnalyticsRange()
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const sunDays = useSunTimesStore((s) => s.days)
  const firstKeyByDate = useSunTimesStore((s) => s.firstKeyByDate)
  const rememberManyIfAbsent = useSunTimesStore((s) => s.rememberManyIfAbsent)
  const place = sunPlaceForCity(homeCity.trim() || DEFAULT_HOME_CITY, useSunTimesStore((s) => s.places))
  // Both stores feed this, so painting sleep on the grid updates the tab with no
  // extra step — and a stated time always beats a painted one.
  const nights = useMemo(
    () => resolveNights(logged, { scopes, entries }, dateKeys),
    [logged, scopes, entries, dateKeys],
  )
  const allNighterDays = useMemo(() => {
    return dateKeys
      .map((key) => logged[key])
      .filter((n): n is NonNullable<typeof n> => !!n?.allNighter)
  }, [logged, dateKeys])
  const stats = useMemo(() => sleepStats(nights, dateKeys, targetMinutes), [nights, dateKeys, targetMinutes])
  const trend = useMemo(() => sleepTrend(nights, dateKeys), [nights, dateKeys])
  // Naps and second stretches: a night is one interval, so these would otherwise
  // be tracked and yet invisible here.
  const stray = useMemo(() => straySleep({ scopes, entries }, nights, dateKeys), [scopes, entries, nights, dateKeys])

  const vsSun = useMemo(() => {
    const state = { days: sunDays, firstKeyByDate }
    return sleepSunSummary(stats.nights, (date) => {
      if (!place) return null
      return peekOrComputeDaySun(date, place.lat, place.lng, state)
    })
  }, [stats.nights, sunDays, firstKeyByDate, place])

  useEffect(() => {
    if (!place) return
    const state = useSunTimesStore.getState()
    const batch = []
    for (const night of stats.nights) {
      for (const date of [night.date, previousDateKey(night.date)]) {
        const sun = peekOrComputeDaySun(date, place.lat, place.lng, state)
        if (sun) batch.push(sun)
      }
    }
    rememberManyIfAbsent(batch)
  }, [stats.nights, place, rememberManyIfAbsent])

  const counted = stats.nights.length
  const [lateAfter, setLateAfter] = useState(60)
  const [whatIfTarget, setWhatIfTarget] = useState<number | null>(null)
  const target = whatIfTarget ?? targetMinutes
  const whatIf = useMemo(() => debtAt(stats.nights, target), [stats.nights, target])
  const late = useMemo(() => nightsAfter(stats.nights, lateAfter), [stats.nights, lateAfter])
  const jetlag = useMemo(() => socialJetlag(stats.nights), [stats.nights])
  const sri = useMemo(() => sleepRegularityIndex(stats.nights), [stats.nights])
  const dark = useMemo(
    () => new Map(vsSun.nights.map((row) => [row.date, { sunset: row.sunsetMinutes - 1440, sunrise: row.sunriseMinutes }])),
    [vsSun.nights],
  )
  const newestFirst = [...stats.nights].reverse()
  const cvDur = coefficientOfVariation(stats.nights.map((n) => n.minutes))
  const cvBed = coefficientOfVariation(stats.nights.map((n) => n.sleptMin))
  const sleepR1 = autocorrelation(stats.nights.map((n) => n.minutes), 1)

  return (
    <div className="an-canvas an-stack">
      <div className="flex flex-wrap items-center gap-3">
        <p className="an-canvas-kicker">
          {counted} of {dateKeys.length} nights tracked
          {stats.missing > 0 && ` · ${stats.missing} blank`}
          {stats.fromTracking > 0 && ` · ${stats.fromTracking} read off the grid`}
          {counted > 0 && stats.estimatedShare > 0 && ` · ${Math.round(stats.estimatedShare * 100)}% estimated`}
          {allNighterDays.length > 0 && ` · ${allNighterDays.length} all-nighter`}
          {" · "}
          same nights as Home → Tracking
        </p>
      </div>

      {allNighterDays.length > 0 && (
        <div className="an-stack">
          <p className="an-canvas-title">All-nighters</p>
          <p className="an-n">
            Days you marked no sleep while still starting the morning routine. Frequency and source are
            tracked so text-pipeline (BIM) marks stay labeled.
          </p>
          <div className="an-readouts">
            <Stat
              label="All-nighter days"
              value={String(allNighterDays.length)}
              hint={`in the ${rangeLabel} · ${((allNighterDays.length / Math.max(dateKeys.length, 1)) * 100).toFixed(0)}% of mornings`}
            />
            <Stat
              label="From text pipeline"
              value={String(
                allNighterDays.filter(
                  (n) => n.allNighterSource === "telegram" || n.allNighterSource === "text",
                ).length,
              )}
              hint="BIM / Simulate — labeled from text pipeline"
            />
            <Stat
              label="From desktop"
              value={String(allNighterDays.filter((n) => n.allNighterSource === "desktop").length)}
              hint="Morning Review checkbox"
            />
          </div>
          <details className="an-tr-fold" open={allNighterDays.length <= 5}>
          <summary>{allNighterDays.length} all-nighter dates</summary>
          <ul className="text-sm space-y-1">
            {allNighterDays.map((n) => (
              <li key={n.date}>
                <span className="font-medium tabular-nums">{nightLabel(n.date)}</span>
                {" · "}
                {n.allNighterAt
                  ? new Date(n.allNighterAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "time unknown"}
                {" · "}
                {n.allNighterSource === "telegram" || n.allNighterSource === "text"
                  ? "from text pipeline (BIM)"
                  : n.allNighterSource === "desktop"
                    ? "desktop"
                    : "source unknown"}
              </li>
            ))}
          </ul>
          </details>
          <p className="an-n">
            Impact: these mornings are excluded from night averages above (no bed/wake clocks). Debt and
            &quot;under target&quot; still reflect real nights only.
          </p>
        </div>
      )}

      {counted === 0 ? (
        <>
          <ChartFrame
            empty
            emptySentence={`No nights tracked in the ${rangeLabel}. Home → Tracking has a two-field strip at the top: fill in when you fell asleep and when you woke up. Painting the Sleep pen onto the grid works too.`}
          />
          {stray.minutes > 0 && (
            <p className="an-canvas-kicker">
              There is {formatSleepDuration(stray.minutes)} of sleep on the grid in this range, but none of it forms a
              night — a run has to reach midnight, or last {formatSleepDuration(MIN_STANDALONE_NIGHT)} in the small
              hours, before it counts as one.
            </p>
          )}
        </>
      ) : (
        <>
          <section className="an-plate">
            <p className="an-canvas-title">How much sleep</p>
            <div className="an-readouts">
              <Stat
                label="Average night"
                value={formatSleepDuration(stats.averageMinutes)}
                hint={`median ${formatSleepDuration(stats.medianMinutes)} · over ${counted} night${
                  counted === 1 ? "" : "s"
                } tracked`}
              />
              <Stat
                label="Usually asleep by"
                value={offsetToLabel(stats.averageBedtime)}
                hint={`give or take ${formatSleepDuration(stats.bedtimeVariation)}`}
              />
              <Stat
                label="Usually up at"
                value={offsetToLabel(stats.averageWake)}
                hint={`give or take ${formatSleepDuration(stats.wakeVariation)}`}
              />
              <Stat
                label={`Under ${formatSleepDuration(targetMinutes)}`}
                value={formatSleepDuration(stats.debtMinutes)}
                hint={`${stats.nightsAtTarget} of ${counted} nights hit the target`}
              />
            </div>
            <div className="an-tr-controls" data-testid="sleep-what-if">
              <label className="an-tr-slider">
                What if I need
                <input
                  type="range"
                  min={300}
                  max={600}
                  step={15}
                  value={target}
                  aria-label="What-if sleep need"
                  onChange={(e) => setWhatIfTarget(Number(e.target.value))}
                />
                <output>{formatSleepDuration(target)}</output>
              </label>
              <span>
                {`${whatIf.atTarget} of ${counted} nights would reach it, ${formatSleepDuration(whatIf.debt)} short in all (${formatSleepDuration(
                  Math.round(whatIf.debt / counted),
                )} a night).`}
              </span>
            </div>
          </section>

          <BodyClock jetlag={jetlag} sri={sri} />

          {/* The extremes. An average hides the 3am night that explains the week. */}
          <div>
            <p className="an-canvas-title">
              How far the ends swing
              <span className="an-canvas-kicker"> the range behind the averages above</span>
            </p>
            <div className="an-readouts">
              <Extremes
                label="Asleep"
                earliest={stats.earliestBedtime}
                latest={stats.latestBedtime}
                at={(night) => night.sleptMin}
              />
              <Extremes
                label="Awake"
                earliest={stats.earliestWake}
                latest={stats.latestWake}
                at={(night) => night.wokeMin}
              />
            </div>
          </div>

          {vsSun.nights.length > 0 && (
            <div>
              <p className="an-canvas-title">
                Against the sun
                <span className="an-canvas-kicker">
                  {" "}
                  that evening&apos;s sunset, that morning&apos;s sunrise · later: productivity and joy around the sun
                </span>
              </p>
              <div className="an-readouts">
                <Stat
                  label="Typically asleep"
                  value={describeVsSun(vsSun.medianSleepAfterSunset, "sunset")}
                  hint={`median of ${vsSun.nights.length} night${vsSun.nights.length === 1 ? "" : "s"} · stored per day`}
                />
                <Stat
                  label="Typically up"
                  value={describeVsSun(vsSun.medianWakeAfterSunrise, "sunrise")}
                  hint="wake minus that morning's sunrise"
                />
              </div>
              <details className="an-tr-fold pt-2" open={vsSun.nights.length <= 7}>
              <summary>Each night against the sun ({vsSun.nights.length})</summary>
              <div className="an-stack text-xs">
                {[...vsSun.nights].reverse().map((row) => (
                  <p key={row.date} className="text-muted-foreground">
                    <span className="tabular-nums">{nightLabel(row.date)}</span>
                    {" · "}
                    {describeVsSun(row.sleepAfterSunset, "sunset")}
                    {" · "}
                    {describeVsSun(row.wakeAfterSunrise, "sunrise")}
                  </p>
                ))}
              </div>
              </details>
            </div>
          )}

          <section className="an-plate" data-testid="sleep-window">
            <p className="an-canvas-title">Sleep window</p>
            <p className="an-canvas-kicker">
              Every night of the {rangeLabel}, oldest at the top. Shaded is that night&apos;s dark, sunset to sunrise.
              Faded bars are estimated or read off the grid. Empty rows are blank nights.
            </p>
            <div className="an-tr-controls">
              <label className="an-tr-slider">
                Late after
                <input
                  type="range"
                  min={-180}
                  max={300}
                  step={15}
                  value={lateAfter}
                  aria-label="Late after"
                  onChange={(e) => setLateAfter(Number(e.target.value))}
                />
                <output>{offsetToLabel(lateAfter)}</output>
              </label>
              <span>
                {`${late.length} of ${counted} nights (${Math.round((late.length / counted) * 100)}%) asleep after ${offsetToLabel(lateAfter)}.`}
              </span>
            </div>
            <SleepWindowChart dateKeys={dateKeys} nights={stats.nights} dark={dark} lateAfter={lateAfter} />
            <div className="an-tr-legend">
              <span><i style={{ background: "#3b3f8f" }} />asleep</span>
              <span><i style={{ background: "#c2410c" }} />asleep after the line</span>
              <span><i style={{ background: "var(--at-night)", opacity: 0.2 }} />dark</span>
            </div>
          </section>

          <div>
            <p className="an-canvas-title">
              Night by night
              <span className="an-canvas-kicker"> 6 PM to noon · amber is under target · ~ estimated · est. read off the grid</span>
            </p>
            <div className="an-stack">
              {newestFirst.slice(0, FOLD_AFTER).map((night) => (
                <NightBar key={night.date} night={night} targetMinutes={targetMinutes} />
              ))}
              {newestFirst.length > FOLD_AFTER && (
                <details className="an-tr-fold">
                  <summary>{newestFirst.length - FOLD_AFTER} earlier nights</summary>
                  <div className="an-stack">
                    {newestFirst.slice(FOLD_AFTER).map((night) => (
                      <NightBar key={night.date} night={night} targetMinutes={targetMinutes} />
                    ))}
                  </div>
                </details>
              )}
              {stray.minutes > 0 && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Plus {formatSleepDuration(stray.minutes)} of sleep painted outside these nights — a nap, or time that
                  runs past the night as logged — on {stray.days.length} day{stray.days.length === 1 ? "" : "s"} (
                  {stray.days
                    .slice(0, 3)
                    .map((day) => `${nightLabel(day.date)} ${formatSleepDuration(day.minutes)}`)
                    .join(", ")}
                  {stray.days.length > 3 ? ", …" : ""}). Kept out of the averages above so &quot;per night&quot; still means per
                  night.
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="an-canvas-title">What changed</p>
            <div className="an-stack text-sm">
              {!trend.comparable ? (
                <p className="text-muted-foreground">
                  Not enough nights on both halves of this range to compare yet — two per half is the floor, or one bad
                  night reads as a trend.
                </p>
              ) : (
                <>
                  <p>
                    Over the last half of this range you slept{" "}
                    <span className="font-medium">{describeShift(trend.durationDelta, "less")}</span> a night than over
                    the first half.
                  </p>
                  <p>
                    You went to bed <span className="font-medium">{describeShift(trend.bedtimeDelta)}</span> and woke{" "}
                    <span className="font-medium">{describeShift(trend.wakeDelta)}</span>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.bedtimeVariation > stats.wakeVariation
                      ? "Your bedtime moves around more than your wake time — the wake end is the steadier of the two."
                      : "Your wake time moves around more than your bedtime."}
                    {stats.shortest && stats.longest && (
                      <>
                        {" "}
                        Shortest night {formatSleepDuration(stats.shortest.minutes)}, longest{" "}
                        {formatSleepDuration(stats.longest.minutes)}.
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="an-canvas-title">Regularity · CV and lag-1</p>
            <div className="an-readouts">
              <Stat
                label="Duration CV"
                value={cvDur.toFixed(2)}
                hint="σ / mean of night length. Blank nights excluded."
              />
              <Stat
                label="Bedtime CV"
                value={cvBed.toFixed(2)}
                hint="σ / |mean| of bedtime offset."
              />
              <Stat
                label="Duration r(1)"
                value={sleepR1.toFixed(2)}
                hint="Tonight vs last night. Need 3+ nights."
              />
            </div>
            <PhosphorTrace
              title="Night duration"
              points={stats.nights.map((n) => ({ x: n.date.slice(5), y: n.minutes }))}
              unit="m"
            />
          </div>

          <RidgelineChart
            ridges={valuesByWeekday(stats.nights.map((n) => ({ date: n.date, value: n.minutes }))).map((r) => ({
              label: r.label,
              values: r.values,
            }))}
            unit="duration minutes"
            title="Duration by weekday"
            help="Joy/ridgeline plot: Gaussian KDE of night length for each weekday. Empty weekdays stay a flat baseline — they are missing, not zero sleep. Blank nights are already excluded from this sample."
            empty="Need nights with a duration before a ridgeline can be drawn."
          />
          <RidgelineChart
            ridges={valuesByWeekday(stats.nights.map((n) => ({ date: n.date, value: n.sleptMin }))).map((r) => ({
              label: r.label,
              values: r.values,
            }))}
            unit="bedtime offset (min; negative = before midnight)"
            title="Bedtime by weekday"
            help="Same ridgeline, now of bedtime offset (minutes from midnight; negative is the evening before). Compare the left edge of Night by night above — this is the distribution, not the calendar."
            empty="Need nights with a bedtime before a ridgeline can be drawn."
          />
        </>
      )}
    </div>
  )
}
