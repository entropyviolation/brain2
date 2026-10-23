/**
 * components/Analytics/PlanVsReality.tsx — Plan-vs-reality dashboard
 *
 * Shared Analytics window. Grain (day/week/month/season) is how a period is scored,
 * not a second date picker. A thin sample is not a variance finding. The
 * comparison is a visual, not two lists.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useEventStore } from "@/lib/event-store"
import { computePlanVsReality, type PlanPeriod } from "@/lib/plan-vs-reality"
import { getPlanBodies } from "@/lib/plan-text"
import { formatCapacityLine, plannedMinutesForDay, wakingWindowMinutes } from "@/components/Home/Plan/plan-capacity"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { parseLocalDate } from "@/lib/date-utils"
import {
  parseWeekString,
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
} from "@/lib/date-utils"
import { quarterLabel, taskTouchesQuarter } from "@/lib/seasons"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, periodKeysFromDateKeys, thinWindowSentence } from "./analytics-range"
import { NativeSelect } from "@/components/ui/native-select"
import { openItemsInLists } from "./open-in-lists"
import { itemTitle } from "@/lib/item-utils"
import { quantile } from "./accuracy-stats"
import "./accuracy-views.css"

const GRAINS: { value: PlanPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Season" },
]

function periodKeyLabel(period: PlanPeriod, key: string): string {
  if (period === "day") {
    const d = new Date(`${key}T00:00:00`)
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  }
  if (period === "week") {
    const r = parseWeekString(key)
    return r ? `Week of ${r.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : key
  }
  if (period === "quarter") return quarterLabel(key)
  const d = new Date(`${key}-01T00:00:00`)
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

export function PlanVsReality() {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const events = useEventStore((s) => s.events)
  const { dateKeys, label } = useAnalyticsRange()

  const [period, setPeriod] = useState<PlanPeriod>("day")
  const keys = useMemo(() => periodKeysFromDateKeys(period, dateKeys), [period, dateKeys])
  const [periodKey, setPeriodKey] = useState<string>("")
  const [ribbonOrder, setRibbonOrder] = useState<"time" | "aligned">("time")
  const activeKey = keys.includes(periodKey) ? periodKey : (keys[keys.length - 1] ?? "")

  const planText = useMemo(() => getPlanBodies(period, activeKey), [period, activeKey])

  const comparison = useMemo(
    () => computePlanVsReality(period, activeKey, tasks, pointsHistory, planText),
    [period, activeKey, tasks, pointsHistory, planText],
  )

  const windowRibbon = useMemo(
    () =>
      keys.map((key) => {
        const text = getPlanBodies(period, key)
        const c = computePlanVsReality(period, key, tasks, pointsHistory, text)
        return { key, hasPlan: c.hasPlan, alignment: c.alignmentScore, n: Math.max(c.plannedTaskCount, c.intentionCount) }
      }),
    [keys, period, tasks, pointsHistory],
  )
  const plannedPeriods = windowRibbon.filter((c) => c.hasPlan).length
  const ribbonShown = useMemo(
    () =>
      ribbonOrder === "time"
        ? windowRibbon
        : [...windowRibbon].sort((a, b) => (b.hasPlan ? b.alignment : -1) - (a.hasPlan ? a.alignment : -1)),
    [windowRibbon, ribbonOrder],
  )
  const ribbonStats = useMemo(() => {
    const planned = windowRibbon.filter((c) => c.hasPlan)
    if (planned.length === 0) return null
    const values = planned.map((c) => c.alignment)
    const best = planned.reduce((a, b) => (b.alignment > a.alignment ? b : a))
    const worst = planned.reduce((a, b) => (b.alignment < a.alignment ? b : a))
    let run = 0
    let longest = 0
    for (const c of windowRibbon) {
      run = c.hasPlan && c.alignment >= 70 ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    return { median: Math.round(quantile(values, 0.5)), best, worst, longest }
  }, [windowRibbon])

  const itemIds = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (!activeKey) return false
          if (period === "day") return taskScheduledOnDay(t, activeKey)
          if (period === "week") return taskScheduledInWeek(t, activeKey)
          if (period === "quarter") return taskTouchesQuarter(t, activeKey)
          return taskScheduledInMonth(t, activeKey)
        })
        .map((t) => t.id),
    [tasks, period, activeKey],
  )

  const plannedItems = useMemo(() => {
    const ids = new Set(itemIds)
    return tasks
      .filter((t) => ids.has(t.id))
      .map((t) => ({
        id: t.id,
        name: itemTitle(t),
        state: t.completed ? "kept" : (t.daysPushed ?? 0) > 0 ? "moved" : "open",
      }))
      .sort((a, b) => ["kept", "moved", "open"].indexOf(a.state) - ["kept", "moved", "open"].indexOf(b.state))
  }, [tasks, itemIds])
  const keptCount = plannedItems.filter((i) => i.state === "kept").length
  const movedCount = plannedItems.filter((i) => i.state === "moved").length

  const capacityLine = useMemo(() => {
    if (period !== "day" || !activeKey) return null
    const date = parseLocalDate(activeKey)
    if (!date) return null
    const planned = plannedMinutesForDay(date, tasks, events)
    const awake = awakeWindowFor(activeKey)
    const window = wakingWindowMinutes(awake)
    return { text: formatCapacityLine(planned, window), inferred: awake?.source === "typical" }
  }, [period, activeKey, tasks, events])

  const sampleN = Math.max(comparison.plannedTaskCount, comparison.intentionCount)
  const empty = !comparison.hasPlan
  const thin = !empty && isThinSample(sampleN, SAMPLE_FLOORS.planVsReality)

  return (
    <div className="an-canvas an-stack">
      <div className="an-studio-tools">
        <NativeSelect
          className="an-chip"
          value={period}
          aria-label="Plan grain"
          onChange={(e) => {
            const next = e.target.value as PlanPeriod
            setPeriod(next)
            const nextKeys = periodKeysFromDateKeys(next, dateKeys)
            setPeriodKey(nextKeys[nextKeys.length - 1] ?? "")
          }}
        >
          {GRAINS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="an-chip"
          value={activeKey}
          aria-label="Plan period"
          onChange={(e) => setPeriodKey(e.target.value)}
        >
          {keys
            .slice()
            .reverse()
            .map((k) => (
              <option key={k} value={k}>
                {periodKeyLabel(period, k)}
              </option>
            ))}
        </NativeSelect>
        <span className="an-canvas-kicker">inside the {label}</span>
        <span className="an-n">
          n = {plannedPeriods} planned {period}
          {plannedPeriods === 1 ? "" : "s"} of {keys.length}
        </span>
      </div>

      {plannedPeriods > 1 && (
        <div className="an-acc-tools">
          <span className="an-n">Ribbon order</span>
          <button
            type="button"
            className="an-chip"
            aria-pressed={ribbonOrder === "time"}
            onClick={() => setRibbonOrder("time")}
          >
            By date
          </button>
          <button
            type="button"
            className="an-chip"
            aria-pressed={ribbonOrder === "aligned"}
            onClick={() => setRibbonOrder("aligned")}
          >
            Best aligned first
          </button>
          {ribbonStats && (
            <span className="an-n">
              median {ribbonStats.median}% aligned · best {periodKeyLabel(period, ribbonStats.best.key)} (
              {ribbonStats.best.alignment}%) · worst {periodKeyLabel(period, ribbonStats.worst.key)} (
              {ribbonStats.worst.alignment}%) · longest run ≥ 70%: {ribbonStats.longest}
            </span>
          )}
        </div>
      )}

      {keys.length > 0 && (
        <div className="an-pvr-ribbon" role="list" aria-label="Plan vs reality across the window">
          {ribbonShown.map((cell) => {
            const selected = cell.key === activeKey
            const height = cell.hasPlan ? Math.max(8, cell.alignment) : 0
            return (
              <button
                key={cell.key}
                type="button"
                role="listitem"
                className={`an-pvr-cell${selected ? " is-active" : ""}${cell.hasPlan ? "" : " is-empty"}`}
                style={{ ["--an-align" as string]: `${height}%` }}
                title={
                  cell.hasPlan
                    ? `${periodKeyLabel(period, cell.key)}: ${cell.alignment}% aligned · n=${cell.n}`
                    : `${periodKeyLabel(period, cell.key)}: nothing planned`
                }
                onClick={() => setPeriodKey(cell.key)}
              >
                <span className="an-pvr-cell-bar" />
                <span className="an-pvr-cell-label">{period === "day" ? cell.key.slice(8) : cell.key}</span>
              </button>
            )
          })}
        </div>
      )}

      {capacityLine && (
        <p className="an-n">
          {capacityLine.inferred ? "~ " : ""}
          {capacityLine.text}
          {capacityLine.inferred ? " est." : ""}
        </p>
      )}

      <div>
        <p className="an-canvas-title">Planned vs actual</p>
          {empty ? (
            <ChartFrame
              empty
              emptySentence={`Nothing was planned for this ${period} in the ${label}. Write a plan or schedule tasks to compare.`}
            />
          ) : thin ? (
            <ChartFrame thin thinSentence={thinWindowSentence(sampleN, SAMPLE_FLOORS.planVsReality, label)} />
          ) : (
            <>
              <p className="an-finding">
                Variance {comparison.varianceScore} (0 = matched the plan · 100 = total divergence) ·{" "}
                {comparison.alignmentScore}% aligned
              </p>
              <p className="an-n">
                n = {comparison.plannedTaskCount} planned task{comparison.plannedTaskCount === 1 ? "" : "s"} ·{" "}
                {comparison.intentionCount} written intention{comparison.intentionCount === 1 ? "" : "s"}
              </p>
              <p className="an-caveat">
                Attainment is capped; a dimension with nothing planned does not count toward the score.
              </p>
              <div className="mt-3">
                {comparison.metrics.map((m) => {
                  const max = Math.max(m.planned, m.actual, 1)
                  return (
                    <div key={m.key} className="an-pvr-row">
                      <span>{m.label}</span>
                      <div className="an-pvr-track" title={`planned ${m.planned} / actual ${m.actual}`}>
                        <span className="an-pvr-planned" style={{ width: `${(m.planned / max) * 100}%` }} />
                        <span className="an-pvr-actual" style={{ width: `${(m.actual / max) * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-xs">
                        {m.actual}
                        {m.unit ? ` ${m.unit}` : ""} / {m.planned}
                        {m.unit ? ` ${m.unit}` : ""}
                      </span>
                    </div>
                  )
                })}
                <div className="an-legend">
                  <span>
                    <i className="an-pvr-planned" />
                    Planned (wide)
                  </span>
                  <span>
                    <i className="an-pvr-actual" />
                    Actual (thin)
                  </span>
                </div>
              </div>

              <div className="an-acc-plate">
                <p className="an-canvas-title">Plan ← mirror → reality</p>
                <div className="an-acc-mirror">
                  {comparison.metrics.map((m) => {
                    const max = Math.max(m.planned, m.actual, 1)
                    return (
                      <div key={m.key} className="an-acc-mirror-row">
                        <div className="an-acc-mirror-side is-plan" title={`planned ${m.planned} ${m.unit}`}>
                          <span style={{ width: `${(m.planned / max) * 100}%` }} />
                        </div>
                        <span className="an-acc-mirror-label">
                          {m.label}
                          <br />
                          <span className="an-acc-mirror-val">
                            {m.planned} | {m.actual}
                          </span>
                        </span>
                        <div className="an-acc-mirror-side is-real" title={`actual ${m.actual} ${m.unit}`}>
                          <span style={{ width: `${(m.actual / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="an-acc-math">
                  Attainment per row: tasks = done ÷ planned, points = earned ÷ planned (both capped at 100%), time =
                  min(plan, actual) ÷ max(plan, actual), so running over costs as much as running short. Alignment is
                  the mean over rows that had a plan.
                </p>
              </div>

              {plannedItems.length > 0 && (
                <div className="an-acc-plate">
                  <p className="an-canvas-title">Truth barcode: what happened to each planned item</p>
                  <div className="an-acc-cells" role="list">
                    {plannedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="listitem"
                        className={`an-acc-cell ${item.state === "kept" ? "is-on" : item.state === "moved" ? "is-over" : "is-open"}`}
                        style={{ width: 12 }}
                        title={`${item.name}: ${item.state}`}
                        onClick={() => openItemsInLists({ taskIds: [item.id] })}
                      />
                    ))}
                  </div>
                  <div className="an-acc-key">
                    <span><i className="is-on" />Done ({keptCount})</span>
                    <span><i className="is-over" />Pushed at least once, still open ({movedCount})</span>
                    <span><i className="is-open" />Open ({plannedItems.length - keptCount - movedCount})</span>
                  </div>
                </div>
              )}
              {comparison.intentions.length > 0 && (
                <p className="an-canvas-kicker">{comparison.intentions.join(" · ")}</p>
              )}
              <OpenInListsButton taskIds={itemIds} />
            </>
          )}
      </div>
    </div>
  )
}

export default PlanVsReality
