/**
 * components/Analytics/CycleView.tsx — Stall, pushes, estimate confirmation
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isEstimated } from "@/lib/estimated-values"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { StudioBars, StudioReadout, PhosphorTrace } from "./studio-kit"
import { BeeswarmChart } from "./studio-plots"
import { openItemAges } from "./signal-stats"

export function CycleView() {
  const tasks = useTaskStore((s) => s.tasks)
  const { keySet, label } = useAnalyticsRange()

  const open = useMemo(
    () => tasks.filter((t) => !t.completed && (t.importance ?? 0) >= 3),
    [tasks],
  )
  const pushed = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.daysPushed ?? 0) > 0 || (t.weeksPushed ?? 0) > 0 || (t.monthsPushed ?? 0) > 0,
      ),
    [tasks],
  )
  const inWindowPushes = useMemo(
    () => pushed.filter((t) => inRange(t.scheduledDate ?? t.completedDate ?? t.createdAt, keySet)),
    [pushed, keySet],
  )

  const dist = useMemo(() => {
    const buckets = [
      { name: "0", value: 0 },
      { name: "1–2", value: 0 },
      { name: "3–6", value: 0 },
      { name: "7+", value: 0 },
    ]
    for (const t of tasks) {
      const n = t.daysPushed ?? 0
      if (n <= 0) buckets[0].value++
      else if (n <= 2) buckets[1].value++
      else if (n <= 6) buckets[2].value++
      else buckets[3].value++
    }
    return buckets
  }, [tasks])

  const confirmed = useMemo(() => {
    let estimated = 0
    let total = 0
    for (const t of tasks) {
      if (!t.completed || !inRange(t.completedDate, keySet)) continue
      if (!t.estimates?.length) continue
      total++
      if (
        isEstimated(t.estimates, "actualDuration") ||
        isEstimated(t.estimates, "completedDate") ||
        isEstimated(t.estimates, "startedAt")
      ) {
        estimated++
      }
    }
    return { total, estimated, confirmed: total - estimated }
  }, [tasks, keySet])

  const weeks = tasks.filter((t) => (t.weeksPushed ?? 0) > 0).length
  const months = tasks.filter((t) => (t.monthsPushed ?? 0) > 0).length
  const empty = tasks.length === 0
  const survival = useMemo(() => openItemAges(open), [open])
  const medianAge =
    survival.ages.length === 0
      ? null
      : [...survival.ages].sort((a, b) => a - b)[Math.floor(survival.ages.length / 2)]

  return (
    <div className="an-canvas an-stack" data-testid="cycle-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Cycle / stall</p>
          <p className="an-canvas-kicker">{label} · pushes, open important items, estimate confirmation.</p>
        </div>
      </header>
      {empty ? (
        <ChartFrame empty emptySentence="No items yet to measure stall." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Open important" value={open.length} note="importance ≥ 3" />
            <StudioReadout label="Pushed in window" value={inWindowPushes.length} />
            <StudioReadout label="Week / month pushes" value={`${weeks} / ${months}`} />
            <StudioReadout
              label="Estimates still assumed"
              value={confirmed.total === 0 ? "—" : `${confirmed.estimated}/${confirmed.total}`}
              note={confirmed.total === 0 ? `none in ${label}` : "~ until confirmed"}
            />
          </div>
          <p className="an-canvas-title">daysPushed distribution</p>
          <StudioBars rows={dist} max={Math.max(...dist.map((d) => d.value), 1)} unit="" />
          <p className="an-canvas-title">Age of open important items</p>
          {survival.ages.length === 0 ? (
            <ChartFrame empty emptySentence="No open items with importance ≥ 3 to age." />
          ) : (
            <>
              <div className="an-readouts">
                <StudioReadout
                  label="Median age"
                  value={`${medianAge}d`}
                  note={`${survival.ages.length} still open`}
                  tip="Days since create for currently open items with importance ≥ 3. Not a Kaplan–Meier with censoring — everyone here is still open."
                />
                <StudioReadout
                  label="Oldest"
                  value={`${Math.max(...survival.ages)}d`}
                  note="days since created"
                />
              </div>
              <PhosphorTrace
                title="Share still open at age t"
                points={survival.curve.map((p) => ({ x: `${p.age}d`, y: p.surviving * 100 }))}
                unit="%"
              />
              <BeeswarmChart
                values={survival.ages}
                unit="d"
                title="Age beeswarm"
                help="Each dot is one currently open item with importance ≥ 3. Y is days since create. Horizontal offset is a 1-D beeswarm so dots do not overlap. Not a Kaplan–Meier — completions have already left this cohort."
                empty="No open items with importance ≥ 3 to age."
              />
              <p className="an-canvas-hint">
                S(t) = share of this open stock whose age is at least t days. Completions leave the cohort; this is
                not a fitted survival model.
              </p>
            </>
          )}
          <OpenInListsButton taskIds={open.map((t) => t.id)} label={`Open ${open.length} important item(s) in Lists`} />
        </>
      )}
    </div>
  )
}
