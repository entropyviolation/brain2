/**
 * components/Analytics/ScreenTimeView.tsx — ActivityWatch-painted Screen Time
 *
 * Active vs untracked occupancy, top apps / categories from the same pens as
 * Tracking, last-sync from prefs, and a simple alignment strip against human
 * Activity occupancy. Does not dual-write. Circadian Activity default stays put.
 *
 * Added (docs/analytics/time-screentime.md): day strip, hour profile, and a
 * ranked app list with familiar anchors, search, sort and a per-day toggle.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { entriesInRange, penTotalsAtDepth, totalsFor, uniqueMinutes, uniqueMinutesByDate } from "@/lib/tracking-summary"
import { loadScreenTimePrefs } from "@/lib/screentime/prefs"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SliceMosaic, StudioReadout } from "./studio-kit"
import { buildHourDayGrid, hourLabel } from "./hour-day"
import { anchorsFor, hourProfile, overlapSplit, rankWithAnchors, type RankRow } from "./screen-time-stats"
import "./time-rhythms.css"

const SPLIT_COLORS = ["#0369a1", "#5b6b8c", "#059669"] as const

/** Minutes per day as bars. Days with no paint are a hollow tick, not a zero bar. */
function DayStrip({ dateKeys, byDay }: { dateKeys: readonly string[]; byDay: Readonly<Record<string, number>> }) {
  const W = 600
  const H = 90
  const values = dateKeys.map((k) => byDay[k] ?? 0)
  const max = Math.max(1, ...values)
  const painted = values.filter((v) => v > 0)
  const mean = painted.length ? painted.reduce((a, b) => a + b, 0) / painted.length : 0
  const bw = W / Math.max(1, dateKeys.length)
  const y = (v: number) => H - 14 - (v / max) * (H - 24)
  return (
    <svg className="an-tr-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Screen Time per day">
      {values.map((v, i) =>
        v > 0 ? (
          <rect key={dateKeys[i]} x={i * bw + bw * 0.1} y={y(v)} width={Math.max(1, bw * 0.8)} height={H - 14 - y(v)} fill="#0369a1">
            <title>{`${dateKeys[i]} · ${formatDuration(v)}`}</title>
          </rect>
        ) : (
          <rect key={dateKeys[i]} x={i * bw + bw * 0.1} y={H - 16} width={Math.max(1, bw * 0.8)} height={2} fill="var(--at-rule-soft)">
            <title>{`${dateKeys[i]} · no paint`}</title>
          </rect>
        ),
      )}
      {mean > 0 ? (
        <>
          <line x1={0} x2={W} y1={y(mean)} y2={y(mean)} stroke="var(--at-ink)" strokeDasharray="4 3" strokeWidth={1} />
          <text x={W} y={y(mean) - 3} textAnchor="end">{`mean ${formatDuration(Math.round(mean))} on painted days`}</text>
        </>
      ) : null}
      <text x={0} y={H - 2}>{dateKeys[0]?.slice(5)}</text>
      <text x={W} y={H - 2} textAnchor="end">{dateKeys[dateKeys.length - 1]?.slice(5)}</text>
    </svg>
  )
}

/** Mean screen minutes in each clock hour, 0–60. */
function HourProfile({ mean, peakHour }: { mean: readonly number[]; peakHour: number | null }) {
  const W = 600
  const H = 90
  const bw = W / 24
  const y = (v: number) => H - 14 - (v / 60) * (H - 20)
  return (
    <svg className="an-tr-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Screen Time by hour of day">
      {mean.map((v, h) => (
        <rect key={h} x={h * bw + 2} y={y(v)} width={bw - 4} height={H - 14 - y(v)} fill={h === peakHour ? "#c2410c" : "#0369a1"}>
          <title>{`${hourLabel(h)} · ${Math.round(v)} min of the hour on an average painted day`}</title>
        </rect>
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={h * bw + bw / 2} y={H - 2} textAnchor="middle">
          {hourLabel(h)}
        </text>
      ))}
    </svg>
  )
}

type Sort = "time" | "name"

/** Apps ranked against familiar anchors, with search, sort and per-day. */
function AnchoredApps({ apps, days }: { apps: readonly RankRow[]; days: number }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("time")
  const [perDay, setPerDay] = useState(false)
  const [showAnchors, setShowAnchors] = useState(true)
  const scale = perDay ? 1 / Math.max(1, days) : 1
  const q = query.trim().toLowerCase()
  const shown = apps
    .filter((a) => !q || a.name.toLowerCase().includes(q))
    .map((a) => ({ ...a, minutes: a.minutes * scale }))
  const top = Math.max(1, ...shown.map((a) => a.minutes))
  let rows = showAnchors && !perDay ? rankWithAnchors(shown, anchorsFor(top)) : [...shown].sort((a, b) => b.minutes - a.minutes)
  if (sort === "name") rows = rows.filter((r) => !r.anchor).sort((a, b) => a.name.localeCompare(b.name))
  const max = Math.max(1, ...rows.map((r) => r.minutes))
  return (
    <>
      <div className="an-tr-controls">
        <input
          className="an-tr-search"
          type="search"
          placeholder="Search apps"
          aria-label="Search apps"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="an-chip" aria-pressed={sort === "time"} onClick={() => setSort("time")}>
          By time
        </button>
        <button type="button" className="an-chip" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
          A–Z
        </button>
        <button type="button" className="an-chip" aria-pressed={perDay} onClick={() => setPerDay((v) => !v)}>
          Per day
        </button>
        <button
          type="button"
          className="an-chip"
          aria-pressed={showAnchors && !perDay}
          disabled={perDay}
          onClick={() => setShowAnchors((v) => !v)}
        >
          Anchors
        </button>
        <span>{`${shown.length} of ${apps.length} apps`}</span>
      </div>
      <div className="an-tr-rank" data-testid="screentime-anchored">
        {rows.map((r) => (
          <div key={r.id} style={{ display: "contents" }}>
            <span className={r.anchor ? "is-anchor" : undefined} title={r.name}>
              {r.name}
            </span>
            <span>
              <span
                className={`an-tr-bar${r.anchor ? " is-anchor" : ""}`}
                style={{ display: "block", width: `${(r.minutes / max) * 100}%`, background: r.anchor ? undefined : r.color ?? "#0369a1" }}
              />
            </span>
            <span className={r.anchor ? "is-anchor" : undefined}>{formatDuration(Math.round(r.minutes))}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function overlapMinutes(a: ReturnType<typeof entriesInRange>, b: ReturnType<typeof entriesInRange>, days: string[]): number {
  const ua = uniqueMinutes(a, days)
  const ub = uniqueMinutes(b, days)
  const union = uniqueMinutes([...a, ...b], days)
  return Math.max(0, ua + ub - union)
}

export function ScreenTimeView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const screen = scopes.find((s) => s.id === "screentime" || s.name.trim().toLowerCase() === "screen time")
  const activity = scopes.find((s) => s.name === "Activity") ?? scopes[0]
  const prefs = useMemo(() => loadScreenTimePrefs(), [])

  const scoped = useMemo(
    () => (screen ? entriesInRange(entries, dateKeys, screen.id) : []),
    [screen, entries, dateKeys],
  )
  const totals = useMemo(() => totalsFor(scoped, dateKeys), [scoped, dateKeys])
  const apps = useMemo(
    () => (screen ? penTotalsAtDepth(scoped, screen, dateKeys, null) : []),
    [screen, scoped, dateKeys],
  )
  const categories = useMemo(
    () => (screen ? penTotalsAtDepth(scoped, screen, dateKeys, 0) : []),
    [screen, scoped, dateKeys],
  )
  const activityEntries = useMemo(
    () => (activity ? entriesInRange(entries, dateKeys, activity.id) : []),
    [activity, entries, dateKeys],
  )
  const activityMin = uniqueMinutes(activityEntries, dateKeys)
  const screenMin = uniqueMinutes(scoped, dateKeys)
  const overlap = overlapMinutes(activityEntries, scoped, dateKeys)
  const overlapPct = activityMin > 0 ? Math.round((overlap / activityMin) * 100) : 0
  const split = overlapSplit(screenMin, activityMin, overlap)
  const byDay = useMemo(() => uniqueMinutesByDate(scoped), [scoped])
  const profile = useMemo(
    () => (screen ? hourProfile(buildHourDayGrid(entries, dateKeys, screen.id)) : null),
    [screen, entries, dateKeys],
  )
  const paintedDays = profile?.days ?? 0

  return (
    <div className="an-canvas an-stack" data-testid="screentime-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Screen Time</p>
          <p className="an-canvas-kicker">
            {label} · painted by ActivityWatch. AFK counts as untracked.
          </p>
        </div>
      </header>
      {!screen || totals.tracked === 0 ? (
        <ChartFrame empty emptySentence={`Nothing painted in Screen Time in the ${label}. ActivityWatch only records from when its watchers run. Sync from Settings → Screen Time after using the Mac.`} />
      ) : (
        <>
          <section className="an-plate">
            <div className="an-readouts">
              <StudioReadout label="Active" value={formatDuration(totals.tracked)} note={`${totals.coverage.toFixed(0)}% of the window`} />
              <StudioReadout label="Untracked" value={formatDuration(totals.untracked)} note="AFK and idle sit here" />
              <StudioReadout
                label="Last sync"
                value={
                  prefs.lastSuccessAt
                    ? new Date(prefs.lastSuccessAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "never"
                }
              />
              <StudioReadout
                label="Per painted day"
                value={formatDuration(Math.round(paintedDays ? screenMin / paintedDays : 0))}
                note={`${paintedDays} of ${dateKeys.length} days have paint`}
              />
              <StudioReadout
                label="Peak hour"
                value={profile?.peakHour != null ? hourLabel(profile.peakHour) : "—"}
                note={
                  profile?.peakHour != null
                    ? `${Math.round(profile.mean[profile.peakHour]!)} of its 60 min on screen, on average`
                    : "no paint"
                }
              />
            </div>
          </section>
          <section className="an-plate" data-testid="screentime-days">
            <p className="an-canvas-title">Day by day</p>
            <p className="an-canvas-kicker">Screen minutes each day. A flat grey tick is a day with no paint, not a zero-screen day.</p>
            <DayStrip dateKeys={dateKeys} byDay={byDay} />
          </section>
          {profile ? (
            <section className="an-plate" data-testid="screentime-hours">
              <p className="an-canvas-title">When the screen is on</p>
              <p className="an-canvas-kicker">
                Average minutes of each clock hour on screen, over {profile.days} painted day{profile.days === 1 ? "" : "s"}. The
                orange bar is the peak.
              </p>
              <HourProfile mean={profile.mean} peakHour={profile.peakHour} />
            </section>
          ) : null}
          <section className="an-plate">
            <p className="an-canvas-title">Alignment vs Activity occupancy</p>
            <div className="an-plot-well">
              <p className="an-canvas-hint">
                Activity {formatDuration(activityMin)} · Screen Time {formatDuration(screenMin)} · overlap{" "}
                {formatDuration(overlap)} ({overlapPct}% of Activity)
              </p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-sm" style={{ boxShadow: "inset 0 0 0 1px var(--at-rule-soft)" }}>
                {(["Screen Time only", "Both", "Activity only"] as const).map((name, i) => (
                  <span
                    key={name}
                    style={{ width: `${split.shares[i] * 100}%`, background: SPLIT_COLORS[i] }}
                    title={`${name} · ${formatDuration([split.screenOnly, split.both, split.activityOnly][i]!)}`}
                  />
                ))}
              </div>
              <div className="an-tr-legend mt-2">
                <span><i style={{ background: SPLIT_COLORS[0] }} />Screen Time only {formatDuration(split.screenOnly)}</span>
                <span><i style={{ background: SPLIT_COLORS[1] }} />both {formatDuration(split.both)}</span>
                <span><i style={{ background: SPLIT_COLORS[2] }} />Activity only {formatDuration(split.activityOnly)}</span>
              </div>
            </div>
          </section>
          {apps.length > 0 && (
            <section className="an-plate">
              <p className="an-canvas-title">Apps against familiar things</p>
              <p className="an-canvas-kicker">
                Every app, ranked. Hatched rows are anchors, so &quot;3h&quot; has something to stand next to.
              </p>
              <AnchoredApps
                apps={apps.map((a) => ({ id: a.id, name: a.name, minutes: a.minutes, color: a.color }))}
                days={Math.max(1, paintedDays)}
              />
            </section>
          )}
          {apps.length > 0 && (
            <section className="an-plate">
              <p className="an-canvas-title">Top apps (exact pens)</p>
              <SliceMosaic
                slices={apps.slice(0, 12).map((s) => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  minutes: s.minutes,
                  label: formatDuration(s.minutes),
                }))}
                max={Math.max(...apps.map((s) => s.minutes), 1)}
              />
            </section>
          )}
          {categories.length > 0 && (
            <section className="an-plate">
              <p className="an-canvas-title">Top categories (depth 0)</p>
              <SliceMosaic
                slices={categories.slice(0, 12).map((s) => ({
                  id: s.id,
                  name: s.name,
                  color: s.color,
                  minutes: s.minutes,
                  label: formatDuration(s.minutes),
                }))}
                max={Math.max(...categories.map((s) => s.minutes), 1)}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
