/**
 * components/Analytics/TrackingAnalytics.tsx — Where the time actually went
 *
 * Reads the same intervals the Time Grid paints and the Activity Log lists, and
 * totals them through the same module (`lib/tracking-summary.ts`) as occupancy —
 * overlapping blocks on the same minute count once — so the three views cannot
 * report different numbers for the same week, and coverage cannot exceed 100%.
 *
 * ## Two percentages, both meant
 *
 * "Work is 40%" is ambiguous: 40% of the time you logged, or 40% of your life?
 * Both are useful and they are wildly different when half the day is untracked,
 * so the basis is a toggle rather than a guess, and coverage is shown next to it.
 *
 * ## Breaking a pen down
 *
 * Click any pen to drill in. If that slice is a category (Cleaning, Mexico), the
 * drill lists its children first. Variants still break a single pen down when
 * several labels can be true over the same minutes:
 *   - **Split** — one slice per distinct combination. Every minute lands in
 *     exactly one, so it is drawn as a pie.
 *   - **Reach** — how much of the pen included each person. Overlapping, so it
 *     can total more than 100%, and is drawn as bars that say so.
 *
 * **Show as** is this tab's own granularity — same rungs as the Time Grid, not
 * wired to it, so you can look at countries here while painting exact parks
 * there. **Include assumed** drops blocks marked estimated on the grid.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration, minutesToLabel, type TimeEntry, entryMinutes } from "@/lib/time-entries"
import { penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import {
  childPenTotals,
  combinationTotals,
  entriesInRange,
  longestBlock as longestOf,
  penTotalsAtDepth,
  switchCount,
  tagTotals,
  totalsFor,
  variantTotals,
  withPrecision,
  UNLABELED_VARIANT_ID,
  type TrackingSlice,
} from "@/lib/tracking-summary"
import { effectiveTagIds } from "@/lib/tracked-time"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { HourDayHeatmap, SliceMosaic, SlicePie, SplitBar, StudioCheck, StudioReadout } from "./studio-kit"
import { HourPenSmallMultiples, StudioSpark, ViolinHistogram } from "./studio-plots"
import { buildHourDayGrid, buildHourPenRows } from "./hour-day"
import { useTaskStore } from "@/lib/task-store"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { weekdayWeekendCut } from "./signal-stats"
import { blockLengths } from "./studio-plot-stats"

const UNTRACKED_COLOR = "#243044"
const UNTRACKED_LABEL = "Untracked"

function combinationKey(entry: TimeEntry, penId: string): string {
  const ids = entry.penId === penId ? [...(entry.variantIds ?? [])].sort() : []
  return ids.length ? ids.join("+") : UNLABELED_VARIANT_ID
}

function SliceRows({
  slices,
  basis,
  onSelect,
  emptyNote,
}: {
  slices: TrackingSlice[]
  basis: "tracked" | "period"
  onSelect?: (slice: TrackingSlice) => void
  emptyNote?: string
}) {
  if (slices.length === 0) return <p className="an-canvas-hint">{emptyNote}</p>
  const max = Math.max(...slices.map((s) => s.minutes), 1)
  return (
    <div className="space-y-1">
      {slices.map((slice) => {
        const pct = basis === "tracked" ? slice.percentOfTracked : slice.percentOfPeriod
        const row = (
          <>
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="shrink-0 tabular-nums">{formatDuration(slice.minutes)}</span>
            <span className="w-12 shrink-0 text-right font-medium tabular-nums">{pct.toFixed(1)}%</span>
          </>
        )
        return onSelect ? (
          <button
            key={slice.id}
            onClick={() => onSelect(slice)}
            aria-label={`Break down ${slice.name}`}
            className="relative flex w-full items-center gap-2 overflow-hidden px-2 py-1 text-left text-sm hover:bg-black/5"
          >
            <span
              className="absolute inset-y-0 left-0 -z-10 opacity-15"
              style={{ width: `${(slice.minutes / max) * 100}%`, background: slice.color }}
              aria-hidden
            />
            {row}
          </button>
        ) : (
          <div
            key={slice.id}
            className="relative flex w-full items-center gap-2 overflow-hidden rounded px-2 py-1 text-sm"
          >
            <span
              className="absolute inset-y-0 left-0 -z-10 opacity-15"
              style={{ width: `${(slice.minutes / max) * 100}%`, background: slice.color }}
              aria-hidden
            />
            {row}
          </div>
        )
      })}
    </div>
  )
}

export function TrackingAnalytics() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const { dateKeys, keySet, label: rangeLabel } = useAnalyticsRange()
  const tasks = useTaskStore((s) => s.tasks)
  const [showUntracked, setShowUntracked] = useState(false)
  const [basis, setBasis] = useState<"tracked" | "period">("tracked")
  const [drillPenId, setDrillPenId] = useState<string | null>(null)
  const [drillTagId, setDrillTagId] = useState<string | null>(null)
  const [drillMode, setDrillMode] = useState<"split" | "reach">("split")
  const [drillSliceId, setDrillSliceId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [includeSpeculative, setIncludeSpeculative] = useState(true)
  const [depth, setDepth] = useState<DisplayDepth>(null)

  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]
  useEffect(() => {
    setDepth(scope?.displayDepth ?? null)
  }, [scope?.id])

  const observed = useMemo(() => withPrecision(entries, includeSpeculative), [entries, includeSpeculative])
  const scoped = useMemo(
    () => (scope ? entriesInRange(observed, dateKeys, scope.id) : []),
    [observed, dateKeys, scope],
  )
  const allScopes = useMemo(() => {
    const wanted = new Set(dateKeys)
    return observed.filter((e) => wanted.has(e.date))
  }, [observed, dateKeys])

  const totals = useMemo(() => totalsFor(scoped, dateKeys), [scoped, dateKeys])
  const pens = useMemo(
    () => penTotalsAtDepth(scoped, scope, dateKeys, depth),
    [scoped, scope, dateKeys, depth],
  )
  const tagRows = useMemo(
    () => tagTotals(allScopes, scopes, tags, dateKeys),
    [allScopes, scopes, tags, dateKeys],
  )

  const pieSlices = useMemo(() => {
    if (!showUntracked || totals.untracked <= 0) return pens
    return [
      ...pens,
      {
        id: UNTRACKED_LABEL,
        name: UNTRACKED_LABEL,
        color: UNTRACKED_COLOR,
        minutes: totals.untracked,
        percentOfTracked: 0,
        percentOfPeriod: (totals.untracked / (dateKeys.length * 1440)) * 100,
      },
    ]
  }, [pens, showUntracked, totals.untracked, dateKeys.length])

  const longest = useMemo(() => longestOf(scoped), [scoped])
  const averageSwitches = useMemo(() => {
    const active = dateKeys.filter((key) => scoped.some((e) => e.date === key))
    if (active.length === 0 || !scope) return 0
    return active.reduce((sum, key) => sum + switchCount(scoped, key, scope.id), 0) / active.length
  }, [scoped, dateKeys, scope])

  const drillTag = tags.find((t) => t.id === drillTagId)
  /**
   * Which pens contributed a tag's minutes, and from which scope. Overlapping
   * scopes are *not* de-duplicated here on purpose: the point is to show that
   * "San Diego Zoo (Location)" is where the exercise came from.
   */
  const tagSources = useMemo(() => {
    if (!drillTag) return []
    const byPen = new Map<string, { name: string; color: string; minutes: number }>()
    for (const entry of allScopes) {
      if (!effectiveTagIds(entry, scopes).includes(drillTag.id)) continue
      const owner = scopes.find((s) => s.id === entry.scopeId)
      const pen = owner?.pens.find((p) => p.id === entry.penId)
      if (!pen) continue
      const bucket = byPen.get(pen.id) ?? {
        name: `${pen.name} · ${owner?.name ?? "?"}`,
        color: pen.color,
        minutes: 0,
      }
      bucket.minutes += entry.endMin - entry.startMin
      byPen.set(pen.id, bucket)
    }
    const total = [...byPen.values()].reduce((sum, b) => sum + b.minutes, 0)
    return [...byPen.entries()]
      .map(([id, b]) => ({
        id,
        name: b.name,
        color: b.color,
        minutes: b.minutes,
        percentOfTracked: total > 0 ? (b.minutes / total) * 100 : 0,
        percentOfPeriod: 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [drillTag, allScopes, scopes])

  const drillPen = scope?.pens.find((p) => p.id === drillPenId)
  const drillShare = pens.find((p) => p.id === drillPenId)
  const childSlices = useMemo(
    () => (drillPenId && scope ? childPenTotals(scoped, scope, dateKeys, drillPenId) : []),
    [scoped, scope, dateKeys, drillPenId],
  )
  const hasChildBreakdown = childSlices.some((slice) => slice.id !== drillPenId)
  const drillEntries = useMemo(() => {
    if (!drillPen || !scope) return []
    return scoped.filter((e) => {
      if (e.penId === drillPen.id) return true
      return penAtDepth(scope.pens, e.penId, depth)?.id === drillPen.id
    })
  }, [scoped, drillPen, scope, depth])
  const exactEntries = useMemo(
    () => (drillPen ? scoped.filter((e) => e.penId === drillPen.id) : []),
    [scoped, drillPen],
  )
  const splitSlices = useMemo(() => combinationTotals(exactEntries, drillPen), [exactEntries, drillPen])
  const reachSlices = useMemo(() => variantTotals(exactEntries, drillPen), [exactEntries, drillPen])
  const drillMinutes = drillShare?.minutes ?? drillEntries.reduce((sum, e) => sum + (e.endMin - e.startMin), 0)

  const listedBlocks = useMemo(() => {
    const rows = (() => {
      if (!drillSliceId || !drillPen) return drillEntries
      if (drillMode === "reach") {
        if (drillSliceId === UNLABELED_VARIANT_ID) {
          return drillEntries.filter((e) => e.penId !== drillPen.id || (e.variantIds ?? []).length === 0)
        }
        return drillEntries.filter((e) => (e.variantIds ?? []).includes(drillSliceId))
      }
      return drillEntries.filter((e) => combinationKey(e, drillPen.id) === drillSliceId)
    })()
    return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  }, [drillEntries, drillSliceId, drillPen, drillMode])

  const weekend = useMemo(() => weekdayWeekendCut(scoped, dateKeys), [scoped, dateKeys])

  const lengths = useMemo(() => blockLengths(scoped), [scoped])
  const dailyMins = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const e of scoped) byDate.set(e.date, (byDate.get(e.date) ?? 0) + entryMinutes(e))
    return dateKeys.map((key) => byDate.get(key) ?? 0)
  }, [scoped, dateKeys])
  const hourPens = useMemo(
    () => (scope ? buildHourPenRows(scoped, dateKeys, scope.id, scope.pens) : { rows: [], max: 0 }),
    [scoped, dateKeys, scope],
  )

  const grid = useMemo(
    () => (scope ? buildHourDayGrid(scoped, dateKeys, scope.id) : null),
    [scoped, dateKeys, scope],
  )
  const instants = useMemo(() => scoped.filter((e) => e.kind === "instant"), [scoped])
  const loggedIds = useMemo(
    () =>
      tasks
        .filter((t) => (t.timeLogs ?? []).some((log) => keySet.has(log.date)))
        .map((t) => t.id),
    [tasks, keySet],
  )

  if (!scope) return <p className="an-canvas-kicker">No tracking scopes yet.</p>

  return (
    <div className="an-canvas an-stack">
      <div className="an-studio-tools">
        <select
          value={scope.id}
          onChange={(e) => setScopeId(e.target.value)}
          aria-label="Tracking scope"
        >
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex">
          {(["tracked", "period"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBasis(option)}
              aria-pressed={basis === option}
              title={
                option === "tracked"
                  ? "Percentages out of the time you actually logged"
                  : "Percentages out of the whole period, all 24 hours a day"
              }
              className="an-chip"
            >
              {option === "tracked" ? "% of tracked" : "% of day"}
            </button>
          ))}
        </div>
        <StudioCheck
          id="show-untracked"
          checked={showUntracked}
          onChange={setShowUntracked}
          title="Add an Untracked slice so the pie is 24h × days, not only logged minutes."
        >
          Show untracked
        </StudioCheck>
        <StudioCheck
          id="include-assumed"
          checked={includeSpeculative}
          onChange={setIncludeSpeculative}
          title="Include blocks marked estimated on the Time Grid. Off = observed only."
        >
          Include assumed
        </StudioCheck>
      </div>
      {scope && (
        <DepthControl
          pens={scope.pens}
          labels={scope.depthLabels}
          value={depth}
          onChange={setDepth}
          ariaLabel={`${scope.name} analytics detail`}
        />
      )}

      {pens.length === 0 ? null : (
        <div className="an-readouts">
          <StudioReadout label="Tracked" value={formatDuration(totals.tracked)} note={`over ${totals.days} days`} />
          <StudioReadout
            label="Coverage"
            value={`${totals.coverage.toFixed(1)}%`}
            note={`${totals.daysWithData} day${totals.daysWithData === 1 ? "" : "s"} with data`}
          />
          <StudioReadout label="Average / day" value={formatDuration(totals.averagePerDay)} note={rangeLabel} />
          <StudioReadout
            label="Longest block"
            value={longest ? formatDuration(longest.endMin - longest.startMin) : "—"}
            note={longest ? (scope.pens.find((p) => p.id === longest.penId)?.name ?? "") : "nothing tracked"}
          />
        </div>
      )}
      {dailyMins.some((v) => v > 0) && (
        <div>
          <p className="an-canvas-hint">Daily tracked minutes · sparkline of this window</p>
          <StudioSpark values={dailyMins} title="Daily tracked minutes" />
        </div>
      )}

      <div>
        <p className="an-canvas-title">
          {scope.name} · where the time went
          <span className="an-canvas-kicker" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
            {basis === "tracked"
              ? `out of ${formatDuration(totals.tracked)} logged`
              : `out of all ${totals.days} × 24h`}
          </span>
        </p>
        {pens.length === 0 ? (
          <ChartFrame
            empty
            emptySentence={`Nothing tracked in ${scope.name} in the ${rangeLabel}. Paint your day in Home → Tracking.`}
          />
        ) : (
          <>
            <SlicePie
              slices={pieSlices.map((s) => ({
                id: s.id,
                name: s.name,
                color: s.color,
                minutes: s.minutes,
                label: formatDuration(s.minutes),
              }))}
              onSelect={(id) => {
                if (id === UNTRACKED_LABEL) return
                setDrillSliceId(null)
                setDrillPenId(id)
              }}
            />
            <SliceMosaic
              slices={pieSlices.map((s) => ({
                id: s.id,
                name: s.name,
                color: s.color,
                minutes: s.minutes,
                label: formatDuration(s.minutes),
              }))}
              max={Math.max(...pieSlices.map((s) => s.minutes), 1)}
              onSelect={(id) => {
                if (id === UNTRACKED_LABEL) return
                setDrillSliceId(null)
                setDrillPenId(id)
              }}
            />
            <SliceRows
              slices={pieSlices}
              basis={basis}
              onSelect={(slice) => {
                if (slice.id === UNTRACKED_LABEL) return
                setDrillSliceId(null)
                setDrillPenId(slice.id)
              }}
            />
            {tagRows.length > 0 && (
              <>
                <p className="an-canvas-kicker" style={{ paddingTop: 8 }}>
                  By tag · all scopes
                </p>
                <SliceRows slices={tagRows} basis={basis} onSelect={(slice) => setDrillTagId(slice.id)} />
              </>
            )}
            <p className="an-canvas-hint">
              Click a pen or a tag to drill. Fragmentation: {averageSwitches.toFixed(1)} pen changes on an average
              tracked day.
              {grid && grid.secondaryMinutes > 0
                ? ` Secondary pens cover ${formatDuration(grid.secondaryMinutes)}.`
                : ""}
            </p>
          </>
        )}
      </div>

      {grid && grid.observedDays > 0 && (
        <div style={{ ["--an-cols" as string]: String(Math.max(dateKeys.length, 1)) }}>
          <p className="an-canvas-title">Hour × day</p>
          <HourDayHeatmap grid={grid} />
        </div>
      )}

      {scoped.length > 0 && (
        <div>
          <p className="an-canvas-title">Weekday vs weekend</p>
          <div className="an-readouts">
            <StudioReadout
              label="Weekday / day"
              value={formatDuration(weekend.weekdayPerDay)}
              note={`${weekend.weekdayDays} weekdays`}
              tip="Mean painted minutes Mon–Fri, including blank weekdays in the denominator."
            />
            <StudioReadout
              label="Weekend / day"
              value={formatDuration(weekend.weekendPerDay)}
              note={`${weekend.weekendDays} weekend days`}
              tip="Mean painted minutes Sat–Sun. A quiet Saturday still counts as a day."
            />
          </div>
        </div>
      )}

      {hourPens.rows.length > 0 && (
        <HourPenSmallMultiples
          rows={hourPens.rows}
          title="Hour × pen"
          help="Small multiples of hour-of-day occupancy for the pens that took the most minutes. Same 24 columns as Circadian; empty hours stay gray. Classical small-multiple (Tufte) — compare shape, not just totals."
          empty={`No lasting blocks in ${scope.name} in the ${rangeLabel}.`}
        />
      )}

      {lengths.length > 0 ? (
        <ViolinHistogram
          values={lengths}
          unit="m"
          title="Block length"
          help="Distribution of painted block durations (end − start). Violin is a Gaussian KDE (Silverman bandwidth); bars are Freedman–Diaconis bins; the vertical line is the median. Instants have no duration and stay out. Thin n can look smoother than the sample."
          empty={`No lasting blocks in ${scope.name} in the ${rangeLabel}. Paint a span on the Time Grid.`}
        />
      ) : pens.length > 0 ? (
        <ViolinHistogram
          values={[]}
          title="Block length"
          help="Distribution of painted block durations (end − start)."
          empty={`No lasting blocks in ${scope.name} in the ${rangeLabel} — only instants, which have no duration.`}
        />
      ) : null}

      {instants.length > 0 && (
        <p className="an-canvas-hint">
          {instants.length} instant{instants.length === 1 ? "" : "s"} (no duration) in this window.
        </p>
      )}
      <OpenInListsButton taskIds={loggedIds} />

      {/* ---- tag drill-down: where a tag's minutes actually came from ---- */}
      {drillTag && (
        <Dialog open onOpenChange={() => setDrillTagId(null)}>
          <DialogContent className="an-drill max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle style={{ color: drillTag.color }}>{drillTag.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {formatDuration(tagRows.find((t) => t.id === drillTag.id)?.minutes ?? 0)} over {totals.days} days.
                Tagged time is counted once per minute however many scopes agree on it, so these sources can add up to
                more than the total.
              </p>
              <SliceRows
                slices={tagSources}
                basis="tracked"
                emptyNote={`Nothing carries ${drillTag.name} in this range.`}
              />
              <p className="text-xs text-muted-foreground">
                A pen listed here either always carries {drillTag.name}, or a single block of it was tagged on its own —
                four hours at the zoo counting as exercise without every zoo visit doing so.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ---- drill-down ---- */}
      {drillPen && (
        <Dialog
          open
          onOpenChange={() => {
            setDrillPenId(null)
            setDrillSliceId(null)
          }}
        >
          <DialogContent className="an-drill max-h-[92vh] overflow-y-auto sm:max-w-3xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle style={{ color: drillPen.color }}>{drillPen.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm" title="% of tracked is out of logged minutes; % of day is out of 24h × days.">
                {formatDuration(drillMinutes)} over {totals.days} days ·{" "}
                <span className="font-medium">
                  {(basis === "tracked" ? drillShare?.percentOfTracked ?? 0 : drillShare?.percentOfPeriod ?? 0).toFixed(
                    1,
                  )}
                  %
                </span>{" "}
                of {basis === "tracked" ? "tracked time" : "the period"}. Click a slice to list its blocks. Click a
                block to open the same editor as Home → Tracking.
              </p>

              {hasChildBreakdown && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">Inside {drillPen.name}</p>
                  <SliceRows
                    slices={childSlices}
                    basis="tracked"
                    onSelect={(slice) => {
                      if (slice.id === drillPen.id) return
                      setDrillSliceId(null)
                      setDrillPenId(slice.id)
                    }}
                  />
                </div>
              )}

              {(drillPen.variants?.length ?? 0) === 0 ? (
                !hasChildBreakdown && (
                <p className="rounded border p-3 text-sm">
                  {drillPen.name} has no breakdown yet. Nest pens under it in settings, or add detail options — then
                  tick them on a block. Several options can apply at once. Blocks for this pen are listed below.
                </p>
                )
              ) : (
                <>
                  <div className="flex">
                    {(["split", "reach"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDrillMode(mode)}
                        title={
                          mode === "split"
                            ? "Each combination is its own slice; the pie adds to 100%."
                            : "Each option's reach can overlap, so bars can exceed 100%."
                        }
                        className={`h-8 border px-3 text-xs first:rounded-l last:rounded-r ${
                          drillMode === mode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                        }`}
                      >
                        {mode === "split" ? "Split" : "Reach"}
                      </button>
                    ))}
                  </div>

                  {drillMode === "split" ? (
                    <>
                      <p className="text-xs">
                        Every minute counted once, so combinations get their own slice and the whole adds to 100%.
                        Click a slice to list those blocks.
                      </p>
                      <SlicePie
                        large
                        slices={splitSlices.map((s) => ({
                          id: s.id,
                          name: s.name,
                          color: s.color,
                          minutes: s.minutes,
                          label: formatDuration(s.minutes),
                        }))}
                        onSelect={(id) => setDrillSliceId(id)}
                      />
                      <SplitBar
                        slices={splitSlices.map((s) => ({
                          id: s.id,
                          name: s.name,
                          color: s.color,
                          minutes: s.minutes,
                          label: formatDuration(s.minutes),
                        }))}
                        activeId={drillSliceId}
                        onSelect={(id) => setDrillSliceId(id)}
                      />
                      <SliceRows
                        slices={splitSlices}
                        basis="tracked"
                        onSelect={(slice) => setDrillSliceId(slice.id)}
                        emptyNote="No blocks in range."
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-xs">
                        How much of {drillPen.name} included each one. Blocks carrying two are counted under both, so
                        these can add to more than 100%. Click a row to list blocks that include that option.
                      </p>
                      <SliceRows
                        slices={reachSlices}
                        basis="tracked"
                        onSelect={(slice) => setDrillSliceId(slice.id === UNLABELED_VARIANT_ID ? UNLABELED_VARIANT_ID : slice.id)}
                        emptyNote="No blocks in range."
                      />
                    </>
                  )}
                </>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium">
                  {drillSliceId
                    ? `Blocks · ${
                        splitSlices.find((s) => s.id === drillSliceId)?.name ??
                        reachSlices.find((s) => s.id === drillSliceId)?.name ??
                        "this slice"
                      } (${listedBlocks.length})`
                    : `Blocks in ${rangeLabel} (${listedBlocks.length})`}
                  {drillSliceId ? (
                    <>
                      {" "}
                      <button type="button" className="an-open-lists" onClick={() => setDrillSliceId(null)}>
                        Show all
                      </button>
                    </>
                  ) : null}
                </p>
                {listedBlocks.length === 0 ? (
                  <p className="text-sm">No blocks for this slice in the window.</p>
                ) : (
                  <ul className="an-drill-blocks">
                    {listedBlocks.map((entry) => {
                      const penName = scope.pens.find((p) => p.id === entry.penId)?.name ?? drillPen.name
                      const title = entry.title || entry.notes || penName
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className="an-drill-block"
                            title={`${entry.date} ${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)} · click to edit`}
                            onClick={() => setEditEntry(entry)}
                          >
                            <span className="an-drill-block-time">{entry.date}</span>
                            <span className="an-drill-block-time">
                              {minutesToLabel(entry.startMin)}–{minutesToLabel(entry.endMin)}
                            </span>
                            <span className="an-drill-block-title">{title}</span>
                            <span className="an-drill-block-dur">
                              {formatDuration(entry.endMin - entry.startMin)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editEntry && <EntryDialog entry={editEntry} onClose={() => setEditEntry(null)} />}
    </div>
  )
}
