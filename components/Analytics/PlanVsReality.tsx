/**
 * components/Analytics/PlanVsReality.tsx — Plan-vs-reality dashboard
 *
 * Shared Analytics window. Grain (day/week/month) is how a period is scored,
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
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, periodKeysFromDateKeys, thinWindowSentence } from "./analytics-range"

const GRAINS: { value: PlanPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
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

  const itemIds = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (!activeKey) return false
          if (period === "day") return taskScheduledOnDay(t, activeKey)
          if (period === "week") return taskScheduledInWeek(t, activeKey)
          return taskScheduledInMonth(t, activeKey)
        })
        .map((t) => t.id),
    [tasks, period, activeKey],
  )

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
        <select
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
        </select>
        <select
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
        </select>
        <span className="an-canvas-kicker">inside the {label}</span>
        <span className="an-n">
          n = {plannedPeriods} planned {period}
          {plannedPeriods === 1 ? "" : "s"} of {keys.length}
        </span>
      </div>

      {keys.length > 0 && (
        <div className="an-pvr-ribbon" role="list" aria-label="Plan vs reality across the window">
          {windowRibbon.map((cell) => {
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
                    <i style={{ background: "#94a3b8" }} />
                    Planned
                  </span>
                  <span>
                    <i style={{ background: "#2563eb" }} />
                    Actual
                  </span>
                </div>
              </div>
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
