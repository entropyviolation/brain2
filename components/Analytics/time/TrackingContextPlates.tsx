/**
 * components/Analytics/TrackingContextPlates.tsx — Level ladder and company headcount
 *
 * Two plates for Data → Tracking, both read-only over the tracking store.
 *
 * - **Level ladder** (`LevelLadderPlate`): when the chosen view names level
 *   categories (`lib/pen-levels.ts`) and pens sit on them, one row per level,
 *   broadest first — Country, State, City, Neighborhood — each a 100% split of
 *   the window's minutes rolled up to the pen at that level. A chain with no pen
 *   at a level is its own grey "No {level}" slice, never borrowed from a
 *   broader or finer pen. Click a slice to drill into that pen (same drill as
 *   the composition plate).
 * - **Who you were with** (`CompanyHeadcountPlate`): Company minutes split by
 *   headcount — Alone, 1, 2, 3, 4+, and "with someone, count unknown" — from
 *   `lib/company-headcount.ts`. Readouts give share alone, share with others,
 *   mean company when the count is known, and minutes not recorded in Company
 *   (painted elsewhere, not counted either way). Under the bar, the top
 *   Activity pens per headcount, and who you spent the most minutes with.
 */
"use client"

import { useMemo } from "react"
import { formatDuration, type TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { NO_LEVEL_ID, levelTotals, scopeLevels, scopeUsesLevels } from "@/lib/pen-levels"
import { HEADCOUNT_BUCKETS, companyHeadcount } from "@/lib/company-headcount"
import { penAtDepth } from "@/lib/pen-tree"
import { SplitBar, StudioHelp, StudioReadout } from "./studio-kit"

const NO_LEVEL_COLOR = "#d4d6d8"

export function LevelLadderPlate({
  scope,
  entries,
  onSelectPen,
}: {
  scope: TrackScope
  /** Blocks already narrowed to the window (and the search filter, when one is on). */
  entries: TimeEntry[]
  onSelectPen?: (penId: string) => void
}) {
  const rows = useMemo(() => {
    if (!scopeUsesLevels(scope)) return []
    return scopeLevels(scope).map((level) => {
      const totals = levelTotals(entries, scope, level.id)
      return {
        level,
        total: totals.reduce((sum, row) => sum + row.minutes, 0),
        distinct: totals.filter((row) => row.penId !== NO_LEVEL_ID).length,
        slices: totals.map((row) => {
          const pen = scope.pens.find((p) => p.id === row.penId)
          return {
            id: row.penId,
            name: row.penId === NO_LEVEL_ID ? `No ${level.name.toLowerCase()}` : (pen?.name ?? row.penId),
            color: row.penId === NO_LEVEL_ID ? NO_LEVEL_COLOR : (pen?.color ?? "#888888"),
            minutes: row.minutes,
            label: formatDuration(row.minutes),
          }
        }),
      }
    })
  }, [scope, entries])

  if (!rows.length) return null
  return (
    <section className="an-plate an-level-ladder" aria-label="By level category" data-testid="level-ladder">
      <p className="an-canvas-title">
        By level · {scope.name}
        <StudioHelp text="Each row rolls this view's minutes up to the pen at that named level (pen settings → Counts as → Level category). A block whose counts-as chain has no pen at a level lands in the grey 'No …' slice — it is never moved onto a broader or finer pen. A block under two pens at one level splits its minutes, so each row sums to the block time." />
      </p>
      <div className="an-level-rows">
        {rows.map((row) => (
          <div key={row.level.id} className="an-level-row">
            <div className="an-level-head">
              <span className="an-level-name">{row.level.name}</span>
              <span className="an-level-meta">
                {row.distinct} {row.distinct === 1 ? "pen" : "pens"} · {formatDuration(row.total)}
              </span>
            </div>
            {row.slices.length ? (
              <SplitBar
                slices={row.slices}
                onSelect={(id) => (id !== NO_LEVEL_ID ? onSelectPen?.(id) : undefined)}
              />
            ) : (
              <p className="an-level-empty">No time in this window.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function CompanyHeadcountPlate({
  entries,
  scopes,
  dateKeys,
  rangeLabel,
}: {
  entries: TimeEntry[]
  scopes: TrackScope[]
  dateKeys: string[]
  rangeLabel: string
}) {
  const activityScope = scopes.find((s) => s.id === "activity")
  const companyScope = scopes.find((s) => s.id === "company")
  const result = useMemo(
    () =>
      companyHeadcount(entries, scopes, dateKeys, {
        activityPenFor: (penId) =>
          activityScope ? (penAtDepth(activityScope.pens, penId, activityScope.displayDepth ?? null)?.id ?? penId) : penId,
      }),
    [entries, scopes, dateKeys, activityScope],
  )
  if (!companyScope || result.recorded === 0) return null

  const share = (minutes: number) => (result.recorded ? Math.round((minutes / result.recorded) * 100) : 0)
  const withOthers = result.recorded - result.minutes.alone
  const penName = (scope: TrackScope | undefined, id: string) => scope?.pens.find((p) => p.id === id)?.name ?? id
  const penColor = (scope: TrackScope | undefined, id: string) => scope?.pens.find((p) => p.id === id)?.color ?? "#888"
  const slices = HEADCOUNT_BUCKETS.filter((b) => result.minutes[b.id] > 0).map((b) => ({
    id: b.id,
    name: b.label,
    color: b.color,
    minutes: result.minutes[b.id],
    label: formatDuration(result.minutes[b.id]),
  }))

  return (
    <section className="an-plate an-headcount" aria-label="Who you were with" data-testid="company-headcount">
      <p className="an-canvas-title">
        Who you were with
        <StudioHelp text="Company minutes by headcount. People are the pens a Company block names — its pen, extra pens, and ticked details; a group with no one ticked counts its members. Together or In conversation with no one named is 'count unknown', not one person. Minutes with no Company block are not recorded and count as neither alone nor with anyone." />
      </p>
      <div className="an-readouts">
        <StudioReadout
          label="Alone"
          value={`${share(result.minutes.alone)}%`}
          note={formatDuration(result.minutes.alone)}
          tip="Share of recorded Company minutes on Alone."
        />
        <StudioReadout
          label="With others"
          value={`${share(withOthers)}%`}
          note={formatDuration(withOthers)}
          tip="Share of recorded Company minutes with at least one person, counted or not."
        />
        <StudioReadout
          label="Mean company"
          value={result.meanCompany ? `${result.meanCompany}` : "—"}
          note="people, when named"
          tip="Average number of named people per minute, over minutes where someone was named."
        />
        <StudioReadout
          label="Not recorded"
          value={formatDuration(result.notRecorded)}
          note={`painted elsewhere · ${rangeLabel}`}
          tip="Minutes another view painted that Company left blank. Not counted as alone or with anyone."
        />
      </div>
      <SplitBar slices={slices} />
      <div className="an-headcount-grid">
        {HEADCOUNT_BUCKETS.filter((b) => result.minutes[b.id] > 0).map((bucket) => (
          <div key={bucket.id} className="an-headcount-cell">
            <p className="an-headcount-label">
              <span className="an-headcount-dot" style={{ background: bucket.color }} aria-hidden />
              {bucket.label}
              <span className="an-headcount-min">{formatDuration(result.minutes[bucket.id])}</span>
            </p>
            {result.activities[bucket.id].length ? (
              <ul>
                {result.activities[bucket.id].map((row) => (
                  <li key={row.penId}>
                    <span className="an-headcount-dot" style={{ background: penColor(activityScope, row.penId) }} aria-hidden />
                    {penName(activityScope, row.penId)}
                    <span className="an-headcount-min">{formatDuration(row.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="an-headcount-none">No Activity painted alongside.</p>
            )}
          </div>
        ))}
      </div>
      {result.people.length ? (
        <div className="an-headcount-people">
          <p className="an-headcount-label">Most time with</p>
          <ul>
            {result.people.slice(0, 8).map((row) => (
              <li key={row.penId}>
                <span className="an-headcount-dot" style={{ background: penColor(companyScope, row.penId) }} aria-hidden />
                {penName(companyScope, row.penId)}
                <span className="an-headcount-min">{formatDuration(row.minutes)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
