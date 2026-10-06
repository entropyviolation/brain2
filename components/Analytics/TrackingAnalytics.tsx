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
 * ## When time happens
 *
 * Composition is donut + ranked rows (legend), then a period filmstrip, day and
 * week color strips (the pen that took the most minutes), average-day ribbons,
 * tag bars, then up/down vs the previous equal window. The mosaic of random
 * rectangles is gone from Tracking only. Pen hover (`activeId`) lives on the
 * composition plate, so the filmstrip, hour×day grid, violin, and up/down table
 * do not reconcile with it.
 *
 * Find blocks calls `lib/tracking-search.ts`. A jump highlights the block on
 * the filmstrip. "Show matches" reruns these measures on that set only.
 *
 * ## Breaking a pen down
 *
 * Click any pen to drill in. Untracked opens a gap list; click a gap to log via
 * Log activity (same dialog as Home → Tracking). Click a painted block (drill
 * or filmstrip) to open EntryDialog.
 */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { formatDuration, minutesToLabel, untrackedRanges, type TimeEntry } from "@/lib/time-entries"
import { penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import {
  childPenTotals,
  combinationTotals,
  entriesAsDetails,
  entriesInRange,
  longestBlock as longestOf,
  penTotalsAtDepth,
  switchCount,
  tagTotals,
  tagWeekTrend,
  totalsFor,
  uniqueMinutesByDate,
  variantTotals,
  withPrecision,
  UNLABELED_VARIANT_ID,
  type TrackingSlice,
} from "@/lib/tracking-summary"
import { effectiveTagIds } from "@/lib/tracked-time"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeysInclusive, previousAnalyticsWindow, type AnalyticsWindowUnit } from "./analytics-range"
import { HourDayHeatmap, SlicePie, SplitBar, StudioCheck, StudioHelp, StudioReadout } from "./studio-kit"
import { HourPenSmallMultiples, StudioSpark, ViolinHistogram } from "./studio-plots"
import { buildHourDayGrid, buildHourPenRows } from "./hour-day"
import { useTaskStore } from "@/lib/task-store"
import { tasksWithTimeLogOnDays } from "@/lib/item-slices"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { LogActivityDialog } from "@/components/Home/Tracking/log-activity-dialog"
import { weekdayWeekendCut } from "./signal-stats"
import { blockLengths } from "./studio-plot-stats"
import { ANALYTICS_TAB_HELP } from "./analytics-tabs"
import { buildAverageDayBoard } from "./average-day"
import { AverageDayBoard } from "./AverageDayBoard"
import { PeriodFilmstrip } from "./PeriodFilmstrip"
import { PeriodDeltaTable } from "./PeriodDeltaTable"
import { buildFilmstripDayTicks, buildPeriodFilmstrip } from "./period-filmstrip"
import { comparePenMinutes, previousWindowHint } from "./period-delta"
import { BlockSearch } from "./BlockSearch"
import {
  SEARCH_FILTER_LIMIT,
  entriesMatching,
  findBlocks,
  placeHits,
  scopeWithMostHits,
} from "./block-search"
import { buildDayGrain, buildWeekGrain } from "./grain-strips"
import { GrainStrips } from "./GrainStrips"
import { tagMonthTrend } from "./tag-trends"
import { TagTrendBoard } from "./TagTrendBoard"
import type { TrackingSearchHit } from "@/lib/tracking-search"
import "./analytics-boards.css"

const UNTRACKED_COLOR = "#243044"
const UNTRACKED_LABEL = "Untracked"
const NO_ENTRIES: TimeEntry[] = []

const TRACKING_HINT =
  "Same minutes as Home → Tracking. Donut and rows are the same slices — click either to drill. Average-day ribbons show when pens typically sit on the clock."

function combinationKey(entry: TimeEntry, penId: string): string {
  const ids = entry.penId === penId ? [...(entry.variantIds ?? [])].sort() : []
  return ids.length ? ids.join("+") : UNLABELED_VARIANT_ID
}

function SliceRows({
  slices,
  basis,
  onSelect,
  onOpenPen,
  emptyNote,
  activeId,
  onActiveChange,
}: {
  slices: TrackingSlice[]
  basis: "tracked" | "period"
  onSelect?: (slice: TrackingSlice) => void
  /** Double-click the color swatch. */
  onOpenPen?: (slice: TrackingSlice) => void
  emptyNote?: string
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
}) {
  if (slices.length === 0) return <p className="an-canvas-hint">{emptyNote}</p>
  const max = Math.max(...slices.map((s) => s.minutes), 1)
  return (
    <div className="an-slice-rows">
      {slices.map((slice) => {
        const pct = basis === "tracked" ? slice.percentOfTracked : slice.percentOfPeriod
        const active = activeId === slice.id
        const row = (
          <>
            <span
              className="an-slice-row-bar"
              style={{ width: `calc(${(slice.minutes / max) * 100}% - 10px)`, background: slice.color }}
              aria-hidden
            />
            <span
              className="an-slice-swatch"
              style={{ background: slice.color }}
              title={onOpenPen ? "Double-click to open pen settings" : undefined}
            />
            <span className="min-w-0 truncate">{slice.name}</span>
            <span aria-hidden />
            <span className="shrink-0 tabular-nums">{formatDuration(slice.minutes)}</span>
            <span className="shrink-0 text-right font-medium tabular-nums">{pct.toFixed(1)}%</span>
          </>
        )
        const hover = {
          onMouseEnter: () => onActiveChange?.(slice.id),
          onMouseLeave: () => onActiveChange?.(null),
          onFocus: () => onActiveChange?.(slice.id),
          onBlur: () => onActiveChange?.(null),
        }
        return onSelect ? (
          <button
            key={slice.id}
            type="button"
            onClick={() => onSelect(slice)}
            onDoubleClick={(event) => {
              if (!(event.target as HTMLElement).closest(".an-slice-swatch")) return
              event.preventDefault()
              event.stopPropagation()
              onOpenPen?.(slice)
            }}
            aria-label={`Break down ${slice.name}`}
            className={active ? "an-slice-row is-active" : "an-slice-row"}
            {...hover}
          >
            {row}
          </button>
        ) : (
          <div key={slice.id} className={active ? "an-slice-row is-active" : "an-slice-row"} {...hover}>
            {row}
          </div>
        )
      })}
    </div>
  )
}

type TrackingBoardInput = {
  entries: TimeEntry[]
  scope: TrackScope
  depth: DisplayDepth
  dateKeys: string[]
  fromKey: string | null
  toKey: string | null
  stepUnit: AnalyticsWindowUnit | null
  showUntracked: boolean
  includeSpeculative: boolean
}

function previousKeysFor(
  fromKey: string | null,
  toKey: string | null,
  stepUnit: AnalyticsWindowUnit | null,
): string[] {
  if (!fromKey || !toKey) return []
  const prev = previousAnalyticsWindow(fromKey, toKey, stepUnit)
  if (!prev) return []
  return dateKeysInclusive(prev.from, prev.to)
}

function boardSig(opts: TrackingBoardInput): string {
  return [
    opts.depth === null ? "exact" : String(opts.depth),
    opts.showUntracked ? "1" : "0",
    opts.includeSpeculative ? "1" : "0",
    opts.stepUnit ?? "",
    opts.fromKey ?? "",
    opts.toKey ?? "",
    opts.dateKeys.join(","),
  ].join("\0")
}

function computeTrackingBoard(opts: TrackingBoardInput) {
  const { entries, scope, depth, dateKeys, showUntracked } = opts
  const observed = withPrecision(entries, opts.includeSpeculative)
  const scoped = entriesInRange(observed, dateKeys, scope.id)
  const previousKeys = previousKeysFor(opts.fromKey, opts.toKey, opts.stepUnit)
  const previousScoped = entriesInRange(observed, previousKeys, scope.id)

  const totals = totalsFor(scoped, dateKeys)
  const pens = penTotalsAtDepth(scoped, scope, dateKeys, depth)
  // Occupancy total is already in totalsFor — don't walk the previous window again.
  const previousTotals = totalsFor(previousScoped, previousKeys)
  const previousPens = penTotalsAtDepth(
    previousScoped,
    scope,
    previousKeys,
    depth,
    previousTotals.tracked,
  )

  const pieSlices =
    !showUntracked || totals.untracked <= 0
      ? pens
      : [
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

  const previousPieSlices =
    !showUntracked || previousTotals.untracked <= 0
      ? previousPens
      : [
          ...previousPens,
          {
            id: UNTRACKED_LABEL,
            name: UNTRACKED_LABEL,
            color: UNTRACKED_COLOR,
            minutes: previousTotals.untracked,
            percentOfTracked: 0,
            percentOfPeriod: previousKeys.length
              ? (previousTotals.untracked / (previousKeys.length * 1440)) * 100
              : 0,
          },
        ]

  const penOrder = pieSlices.map((s) => s.id)
  const penMeta = pieSlices.map((s) => ({ id: s.id, name: s.name, color: s.color }))
  const untrackedGaps: { date: string; startMin: number; endMin: number }[] = []
  for (const date of dateKeys) {
    for (const gap of untrackedRanges(scoped, date, scope.id)) {
      if (gap.endMin > gap.startMin) untrackedGaps.push({ date, ...gap })
    }
  }
  const activeDays = dateKeys.filter((key) => scoped.some((e) => e.date === key))
  const byDate = uniqueMinutesByDate(scoped)

  return {
    scoped,
    previousKeys,
    totals,
    pens,
    previousPens,
    pieSlices,
    deltaRows: comparePenMinutes(pieSlices, previousPieSlices),
    penMeta,
    averageRibbons: buildAverageDayBoard({
      dateKeys,
      entries: scoped,
      pens: scope.pens,
      depth,
      scopeId: scope.id,
      showUntracked,
      untrackedId: UNTRACKED_LABEL,
      penOrder,
    }),
    filmSegments: buildPeriodFilmstrip({
      dateKeys,
      entries: scoped,
      pens: scope.pens,
      depth,
      scopeId: scope.id,
      showUntracked,
      untrackedColor: UNTRACKED_COLOR,
      untrackedLabel: UNTRACKED_LABEL,
    }),
    filmTicks: buildFilmstripDayTicks(dateKeys),
    untrackedGaps,
    longest: longestOf(scoped) ?? null,
    averageSwitches:
      activeDays.length === 0
        ? 0
        : activeDays.reduce((sum, key) => sum + switchCount(scoped, key, scope.id), 0) / activeDays.length,
    weekend: weekdayWeekendCut(scoped, dateKeys),
    lengths: blockLengths(scoped),
    dailyMins: dateKeys.map((key) => byDate[key] ?? 0),
    hourPens: buildHourPenRows(scoped, dateKeys, scope.id, scope.pens),
    grid: buildHourDayGrid(scoped, dateKeys, scope.id),
    instants: scoped.filter((e) => e.kind === "instant"),
  }
}

type TrackingBoard = ReturnType<typeof computeTrackingBoard>

/** One board. A replaced entries array or scope object misses; leaving Tracking and coming back hits. */
let trackingBoardCache: { entries: TimeEntry[]; scope: TrackScope; sig: string; board: TrackingBoard } | null =
  null

function deriveTrackingBoard(opts: TrackingBoardInput): TrackingBoard {
  const sig = boardSig(opts)
  if (
    trackingBoardCache &&
    trackingBoardCache.entries === opts.entries &&
    trackingBoardCache.scope === opts.scope &&
    trackingBoardCache.sig === sig
  ) {
    return trackingBoardCache.board
  }
  const board = computeTrackingBoard(opts)
  trackingBoardCache = { entries: opts.entries, scope: opts.scope, sig, board }
  return board
}

function TrackingComposition({
  scopeName,
  basis,
  totals,
  rangeLabel,
  fullHelp,
  hasPens,
  pieSlices,
  filmSegments,
  filmTicks,
  totalMinutes,
  averageRibbons,
  penMeta,
  averageSwitches,
  secondaryMinutes,
  tagRows,
  tagTrends,
  tagMonths,
  dayGrain,
  weekGrain,
  highlightEntryId,
  matchNote,
  onOpenSlice,
  onOpenPen,
  onSelectBlock,
  onSelectGap,
  onSelectTag,
}: {
  scopeName: string
  basis: "tracked" | "period"
  totals: TrackingBoard["totals"]
  rangeLabel: string
  fullHelp: string
  hasPens: boolean
  pieSlices: TrackingBoard["pieSlices"]
  filmSegments: TrackingBoard["filmSegments"]
  filmTicks: TrackingBoard["filmTicks"]
  totalMinutes: number
  averageRibbons: TrackingBoard["averageRibbons"]
  penMeta: TrackingBoard["penMeta"]
  averageSwitches: number
  secondaryMinutes: number
  tagRows: TrackingSlice[]
  tagTrends: ReturnType<typeof tagWeekTrend>
  tagMonths: ReturnType<typeof tagMonthTrend>
  dayGrain: ReturnType<typeof buildDayGrain>
  weekGrain: ReturnType<typeof buildWeekGrain>
  highlightEntryId: string | null
  matchNote: string | null
  onOpenSlice: (slice: TrackingSlice) => void
  onOpenPen: (slice: TrackingSlice) => void
  onSelectBlock: (entryId: string) => void
  onSelectGap: (date: string, startMin: number, endMin: number) => void
  onSelectTag: (slice: TrackingSlice) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const onActiveChange = useCallback((id: string | null) => {
    setActiveId(id)
  }, [])
  const clearActive = useCallback(() => setActiveId(null), [])
  const pieModel = useMemo(
    () =>
      pieSlices.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        minutes: s.minutes,
        label: formatDuration(s.minutes),
      })),
    [pieSlices],
  )
  const onPieSelect = useCallback(
    (id: string) => {
      const slice = pieSlices.find((s) => s.id === id)
      if (slice) onOpenSlice(slice)
    },
    [pieSlices, onOpenSlice],
  )

  return (
    <section
      className={activeId ? "an-plate an-track-comp is-hovering" : "an-plate an-track-comp"}
      onMouseLeave={clearActive}
    >
      <p className="an-canvas-title">
        {scopeName} · where the time went
        <span className="an-canvas-kicker" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
          {basis === "tracked"
            ? `out of ${formatDuration(totals.tracked)} logged`
            : `out of all ${totals.days} × 24h`}
        </span>
        <StudioHelp text={fullHelp} />
      </p>
      {!hasPens ? (
        <ChartFrame
          empty
          emptySentence={`Nothing tracked in ${scopeName} in the ${rangeLabel}. Paint your day in Home → Tracking.`}
        />
      ) : (
        <>
          <div className="an-track-comp-band">
            <div className="an-plot-well an-track-donut">
              <SlicePie
                large
                slices={pieModel}
                holeTotal={
                  basis === "tracked" ? formatDuration(totals.tracked) : formatDuration(totals.days * 1440)
                }
                holeBasis={
                  basis === "tracked"
                    ? `out of ${formatDuration(totals.tracked)} logged`
                    : `out of all ${totals.days} × 24h`
                }
                activeId={activeId}
                onActiveChange={onActiveChange}
                onSelect={onPieSelect}
              />
            </div>
            <SliceRows
              slices={pieSlices}
              basis={basis}
              activeId={activeId}
              onActiveChange={onActiveChange}
              onSelect={onOpenSlice}
              onOpenPen={onOpenPen}
            />
          </div>

          <PeriodFilmstrip
            segments={filmSegments}
            ticks={filmTicks}
            totalMinutes={totalMinutes}
            onSelectBlock={onSelectBlock}
            onSelectGap={onSelectGap}
            highlightEntryId={highlightEntryId}
          />

          <GrainStrips days={dayGrain} weeks={weekGrain} />

          <AverageDayBoard
            ribbons={averageRibbons}
            pens={penMeta}
            activeId={activeId}
            onActiveChange={onActiveChange}
          />

          <p className="an-canvas-hint">
            Click a pen or a tag to drill. Fragmentation: {averageSwitches.toFixed(1)} pen changes on an average
            tracked day.
            {secondaryMinutes > 0 ? ` Secondary pens cover ${formatDuration(secondaryMinutes)}.` : ""}
          </p>
          {matchNote && <p className="an-canvas-hint">{matchNote}</p>}
          {tagRows.length > 0 && (
            <>
              <p className="an-canvas-kicker">By tag · all scopes</p>
              <SliceRows slices={tagRows} basis={basis} onSelect={onSelectTag} />
            </>
          )}
          <TagTrendBoard weeks={tagTrends} months={tagMonths} />
        </>
      )}
    </section>
  )
}

export function TrackingAnalytics() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const {
    dateKeys,
    label: rangeLabel,
    fromKey,
    toKey,
    stepUnit,
  } = useAnalyticsRange()
  const loggedTasks = useTaskStore((s) => tasksWithTimeLogOnDays(s.tasks, dateKeys))
  const [showUntracked, setShowUntracked] = useState(false)
  const [basis, setBasis] = useState<"tracked" | "period">("tracked")
  const [drillPenId, setDrillPenId] = useState<string | null>(null)
  const [drillTagId, setDrillTagId] = useState<string | null>(null)
  const [drillUntracked, setDrillUntracked] = useState(false)
  const [drillMode, setDrillMode] = useState<"split" | "reach">("split")
  const [drillSliceId, setDrillSliceId] = useState<string | null>(null)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [logGap, setLogGap] = useState<{ date: string; startMin: number; endMin: number } | null>(null)
  const [includeSpeculative, setIncludeSpeculative] = useState(true)
  const [depth, setDepth] = useState<DisplayDepth>(null)
  const [filterQuery, setFilterQuery] = useState<string | null>(null)
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null)
  const [outsideNote, setOutsideNote] = useState<string | null>(null)

  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]
  useEffect(() => {
    setDepth(scope?.displayDepth ?? null)
  }, [scope?.id])

  const filterHits = useMemo(
    () => (filterQuery ? findBlocks(filterQuery, entries, scopes, SEARCH_FILTER_LIMIT) : null),
    [filterQuery, entries, scopes],
  )
  const sourceEntries = useMemo(() => {
    if (!filterHits) return entries
    return entriesMatching(entries, filterHits)
  }, [entries, filterHits])
  const filterDetail = useMemo(() => {
    if (!filterHits || !scope) return null
    const placed = placeHits(filterHits, dateKeys, scope.id)
    const parts = [`${placed.inView} in this view`]
    if (placed.otherScope) parts.push(`${placed.otherScope} in other views`)
    if (placed.outsideWindow) parts.push(`${placed.outsideWindow} outside this window`)
    return parts.join(" · ")
  }, [filterHits, scope, dateKeys])

  const observed = useMemo(
    () => withPrecision(sourceEntries, includeSpeculative),
    [sourceEntries, includeSpeculative],
  )
  const allScopes = useMemo(() => {
    const wanted = new Set(dateKeys)
    return observed.filter((e) => wanted.has(e.date))
  }, [observed, dateKeys])
  const tagRows = useMemo(
    () => tagTotals(allScopes, scopes, tags, dateKeys),
    [allScopes, scopes, tags, dateKeys],
  )
  const tagTrends = useMemo(
    () => tagWeekTrend(allScopes, scopes, tags, dateKeys),
    [allScopes, scopes, tags, dateKeys],
  )
  const tagMonths = useMemo(
    () => tagMonthTrend(allScopes, scopes, tags, dateKeys),
    [allScopes, scopes, tags, dateKeys],
  )
  const boardShowUntracked = showUntracked && !filterQuery
  const board = useMemo(
    () =>
      scope
        ? deriveTrackingBoard({
            entries: sourceEntries,
            scope,
            depth,
            dateKeys,
            fromKey: fromKey ?? null,
            toKey: toKey ?? null,
            stepUnit,
            showUntracked: boardShowUntracked,
            includeSpeculative,
          })
        : null,
    [sourceEntries, scope, depth, dateKeys, fromKey, toKey, stepUnit, boardShowUntracked, includeSpeculative],
  )
  const scoped = board?.scoped ?? NO_ENTRIES
  const dayGrain = useMemo(
    () =>
      scope
        ? buildDayGrain({ dateKeys, entries: scoped, pens: scope.pens, depth, scopeId: scope.id })
        : [],
    [scope, dateKeys, scoped, depth],
  )
  const weekGrain = useMemo(
    () =>
      scope
        ? buildWeekGrain({ dateKeys, entries: scoped, pens: scope.pens, depth, scopeId: scope.id })
        : [],
    [scope, dateKeys, scoped, depth],
  )

  const drillTag = tags.find((t) => t.id === drillTagId)
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
  const drillShare = board?.pens.find((p) => p.id === drillPenId)
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
  const detailEntries = useMemo(
    () => (drillPen && scope ? entriesAsDetails(scoped, drillPen, scope.pens) : []),
    [scoped, drillPen, scope],
  )
  const splitSlices = useMemo(() => combinationTotals(detailEntries, drillPen), [detailEntries, drillPen])
  const reachSlices = useMemo(() => variantTotals(detailEntries, drillPen), [detailEntries, drillPen])
  const openSlicePen = useCallback(
    (slice: TrackingSlice) => {
      if (!scope) return
      if (scope.pens.some((pen) => pen.id === slice.id)) {
        openPenSettings(scope.id, slice.id)
        return
      }
      const variant = drillPen?.variants?.find((item) => item.id === slice.id)
      if (variant?.penId) openPenSettings(scope.id, variant.penId)
    },
    [scope, drillPen],
  )
  const drillMinutes = drillShare?.minutes ?? drillEntries.reduce((sum, e) => sum + (e.endMin - e.startMin), 0)

  const listedBlocks = useMemo(() => {
    const rows = (() => {
      if (!drillSliceId || !drillPen) return drillEntries
      const pool = detailEntries
      if (drillMode === "reach") {
        if (drillSliceId === UNLABELED_VARIANT_ID) {
          return pool.filter((e) => e.penId !== drillPen.id || (e.variantIds ?? []).length === 0)
        }
        return pool.filter((e) => (e.variantIds ?? []).includes(drillSliceId))
      }
      return pool.filter((e) => combinationKey(e, drillPen.id) === drillSliceId)
    })()
    return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  }, [drillEntries, detailEntries, drillSliceId, drillPen, drillMode])

  const loggedIds = useMemo(
    () => loggedTasks.map((t) => t.id),
    [loggedTasks],
  )

  const openSlice = useCallback((slice: TrackingSlice) => {
    if (slice.id === UNTRACKED_LABEL) {
      setDrillUntracked(true)
      return
    }
    setDrillSliceId(null)
    setDrillPenId(slice.id)
  }, [])

  const openGap = useCallback((date: string, startMin: number, endMin: number) => {
    setLogGap({ date, startMin, endMin })
  }, [])

  const openEntryById = useCallback(
    (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId) ?? scoped.find((e) => e.id === entryId)
      if (entry) setEditEntry(entry)
    },
    [entries, scoped],
  )

  const jumpToHit = useCallback(
    (hit: TrackingSearchHit) => {
      setScopeId(hit.scopeId)
      setHighlightEntryId(hit.entryId)
      const entry = entries.find((item) => item.id === hit.entryId)
      if (entry) setEditEntry(entry)
      if (fromKey && toKey && (hit.date < fromKey || hit.date > toKey)) {
        setOutsideNote(
          `${hit.label} is on ${hit.date}, outside ${rangeLabel}. Opened the block; the charts stay on this window.`,
        )
      } else {
        setOutsideNote(null)
      }
    },
    [entries, fromKey, toKey, rangeLabel],
  )

  const showMatches = useCallback(
    (query: string) => {
      const hits = findBlocks(query, entries, scopes, SEARCH_FILTER_LIMIT)
      if (hits.length === 0) return
      const currentId = scope?.id ?? ""
      if (placeHits(hits, dateKeys, currentId).inView === 0) {
        const inWindow = hits.filter((hit) => dateKeys.includes(hit.date))
        const next = scopeWithMostHits(inWindow.length ? inWindow : hits)
        if (next) setScopeId(next)
      }
      setFilterQuery(query)
      setOutsideNote(null)
    },
    [entries, scopes, scope?.id, dateKeys],
  )

  const clearMatches = useCallback(() => {
    setFilterQuery(null)
    setHighlightEntryId(null)
  }, [])

  const selectTag = useCallback((slice: TrackingSlice) => setDrillTagId(slice.id), [])

  if (!scope || !board) return <p className="an-canvas-kicker">No tracking scopes yet.</p>

  const {
    totals,
    pens,
    previousPens,
    pieSlices,
    deltaRows,
    penMeta,
    averageRibbons,
    filmSegments,
    filmTicks,
    untrackedGaps,
    longest,
    averageSwitches,
    weekend,
    lengths,
    dailyMins,
    hourPens,
    grid,
    instants,
    previousKeys,
  } = board

  const fullHelp = ANALYTICS_TAB_HELP.tracking

  return (
    <div className="an-canvas an-track an-stack">
      <header className="an-track-header">
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
            title={
              filterQuery
                ? "Paused while a search filter is on, so hidden paint is not called untracked."
                : "Add an Untracked slice so the pie is 24h × days, not only logged minutes."
            }
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
        <BlockSearch
          entries={entries}
          scopes={scopes}
          filterQuery={filterQuery}
          filterDetail={filterDetail}
          outsideNote={outsideNote}
          onShowMatches={showMatches}
          onClear={clearMatches}
          onJump={jumpToHit}
        />
        <DepthControl
          pens={scope.pens}
          labels={scope.depthLabels}
          value={depth}
          onChange={setDepth}
          ariaLabel={`${scope.name} analytics detail`}
        />
        <p className="an-track-hint">
          {TRACKING_HINT}
          <StudioHelp text={fullHelp} />
        </p>
      </header>

      {(pens.length > 0 || dailyMins.some((v) => v > 0)) && (
        <section className="an-plate an-track-facts">
          <p className="an-canvas-title">How much</p>
          {pens.length > 0 ? (
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
          ) : null}
          {dailyMins.some((v) => v > 0) && (
            <div className="an-track-spark">
              <p className="an-canvas-title" style={{ fontSize: 13 }}>
                Daily tracked minutes
              </p>
              <p className="an-canvas-hint">Daily tracked minutes · sparkline of this window</p>
              <StudioSpark values={dailyMins} title="Daily tracked minutes" />
            </div>
          )}
        </section>
      )}

      <TrackingComposition
        scopeName={scope.name}
        basis={basis}
        totals={totals}
        rangeLabel={rangeLabel}
        fullHelp={fullHelp}
        hasPens={pens.length > 0}
        pieSlices={pieSlices}
        filmSegments={filmSegments}
        filmTicks={filmTicks}
        totalMinutes={dateKeys.length * 1440}
        averageRibbons={averageRibbons}
        penMeta={penMeta}
        averageSwitches={averageSwitches}
        secondaryMinutes={grid && grid.secondaryMinutes > 0 ? grid.secondaryMinutes : 0}
        tagRows={tagRows}
        tagTrends={tagTrends}
        tagMonths={tagMonths}
        dayGrain={dayGrain}
        weekGrain={weekGrain}
        highlightEntryId={highlightEntryId}
        matchNote={
          filterQuery
            ? `These numbers are only blocks matching “${filterQuery}”. Minutes that do not match are left out, not counted as untracked.`
            : null
        }
        onOpenSlice={openSlice}
        onOpenPen={openSlicePen}
        onSelectBlock={openEntryById}
        onSelectGap={openGap}
        onSelectTag={selectTag}
      />

      {(pens.length > 0 || previousPens.length > 0) && (
        <PeriodDeltaTable
          rows={deltaRows}
          hint={
            filterQuery
              ? `${previousWindowHint(previousKeys)} Only blocks matching “${filterQuery}”, in both windows.`
              : previousWindowHint(previousKeys)
          }
        />
      )}

      {grid && grid.observedDays > 0 && (
        <section className="an-plate">
          <p className="an-canvas-title">Hour × day</p>
          <div className="an-plot-well">
            <HourDayHeatmap grid={grid} />
          </div>
        </section>
      )}

      {(scoped.length > 0 || hourPens.rows.length > 0) && (
        <section className="an-plate">
          {scoped.length > 0 && (
            <>
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
            </>
          )}
          {hourPens.rows.length > 0 && (
            <HourPenSmallMultiples
              rows={hourPens.rows}
              title="Hour × pen"
              help="Small multiples of hour-of-day occupancy for the pens that took the most minutes. Same 24 columns as Circadian; empty hours stay opaque white. Classical small-multiple (Tufte) — compare shape, not just totals."
              empty={`No lasting blocks in ${scope.name} in the ${rangeLabel}.`}
            />
          )}
        </section>
      )}

      <section className="an-plate">
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
      </section>

      {drillTag && (
        <Dialog open onOpenChange={() => setDrillTagId(null)}>
          <DialogContent className="an-drill max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{drillTag.name}</DialogTitle>
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

      {drillUntracked && (
        <Dialog open onOpenChange={() => setDrillUntracked(false)}>
          <DialogContent className="an-drill max-h-[92vh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Untracked</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                {formatDuration(totals.untracked)} untracked over {totals.days} days. Click a gap to open Log activity
                for that span — same dialog as Home → Tracking.
              </p>
              {untrackedGaps.length === 0 ? (
                <p className="text-sm">No untracked gaps in this window.</p>
              ) : (
                <ul className="an-drill-blocks">
                  {untrackedGaps.map((gap) => (
                    <li key={`${gap.date}-${gap.startMin}-${gap.endMin}`}>
                      <button
                        type="button"
                        className="an-drill-block"
                        title={`${gap.date} ${minutesToLabel(gap.startMin)}–${minutesToLabel(gap.endMin)} · click to log`}
                        onClick={() => {
                          setDrillUntracked(false)
                          setLogGap(gap)
                        }}
                      >
                        <span className="an-drill-block-time">{gap.date}</span>
                        <span className="an-drill-block-time">
                          {minutesToLabel(gap.startMin)}–{minutesToLabel(gap.endMin)}
                        </span>
                        <span className="an-drill-block-title">Untracked</span>
                        <span className="an-drill-block-dur">
                          {formatDuration(gap.endMin - gap.startMin)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

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
              <DialogTitle>{drillPen.name}</DialogTitle>
            </DialogHeader>
            <div className="an-drill-body">
              <p
                className="an-drill-summary"
                title="% of tracked is out of logged minutes; % of day is out of 24h × days."
              >
                {formatDuration(drillMinutes)} over {totals.days} days ·{" "}
                <span className="an-drill-summary-pct">
                  {(basis === "tracked" ? drillShare?.percentOfTracked ?? 0 : drillShare?.percentOfPeriod ?? 0).toFixed(
                    1,
                  )}
                  %
                </span>{" "}
                of {basis === "tracked" ? "tracked time" : "the period"}. Detail slices include pens that count as{" "}
                {drillPen.name}. Click a slice to list its blocks. Double-click a color for pen settings. Click a
                block to open the same editor as Home → Tracking.
              </p>

              {hasChildBreakdown && (
                <div className="an-drill-section">
                  <p className="an-drill-kicker">Inside {drillPen.name}</p>
                  <SliceRows
                    slices={childSlices}
                    basis="tracked"
                    onSelect={(slice) => {
                      if (slice.id === drillPen.id) return
                      setDrillSliceId(null)
                      setDrillPenId(slice.id)
                    }}
                    onOpenPen={openSlicePen}
                  />
                </div>
              )}

              {(drillPen.variants?.length ?? 0) === 0 ? (
                !hasChildBreakdown && (
                  <p className="an-drill-empty">
                    {drillPen.name} has no breakdown yet. Nest a pen under it, or add a detail — they are the same
                    thing. Several details can apply at once. Blocks for this pen are listed below.
                  </p>
                )
              ) : (
                <>
                  <div className="an-drill-modes" role="group" aria-label="Breakdown mode">
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
                        className={drillMode === mode ? "an-drill-mode is-active" : "an-drill-mode"}
                      >
                        {mode === "split" ? "Split" : "Reach"}
                      </button>
                    ))}
                  </div>

                  {drillMode === "split" ? (
                    <>
                      <p className="an-drill-hint">
                        Every minute counted once, so combinations get their own slice and the whole adds to 100%.
                        Click a slice or bar segment to list those blocks.
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
                    </>
                  ) : (
                    <>
                      <p className="an-drill-hint">
                        How much of {drillPen.name} included each one. Blocks carrying two are counted under both, so
                        these can add to more than 100%. Click a row to list blocks that include that option.
                      </p>
                      <SliceRows
                        slices={reachSlices}
                        basis="tracked"
                        onSelect={(slice) => setDrillSliceId(slice.id === UNLABELED_VARIANT_ID ? UNLABELED_VARIANT_ID : slice.id)}
                        onOpenPen={openSlicePen}
                        emptyNote="No blocks in range."
                      />
                    </>
                  )}
                </>
              )}

              <div className="an-drill-section">
                <p className="an-drill-kicker">
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
                  <p className="an-drill-hint">No blocks for this slice in the window.</p>
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

      {editEntry && (
        <EntryDialog entry={editEntry} onClose={() => setEditEntry(null)} contentClassName="an-popup" />
      )}
      {logGap && scope && (
        <LogActivityDialog
          dateKey={logGap.date}
          scopeId={scope.id}
          defaultStartMin={logGap.startMin}
          defaultEndMin={logGap.endMin}
          onClose={() => setLogGap(null)}
          contentClassName="an-popup"
        />
      )}
    </div>
  )
}
