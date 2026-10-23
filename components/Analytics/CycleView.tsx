/**
 * components/Analytics/CycleView.tsx — Stall, pushes, estimate confirmation
 *
 * Docs: docs/analytics/accuracy-cycle.md.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isEstimated } from "@/lib/estimated-values"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { StudioBars, StudioReadout, PhosphorTrace } from "./studio-kit"
import { BeeswarmChart } from "./studio-plots"
import { openItemAges } from "./signal-stats"
import { openItemsInLists } from "./open-in-lists"
import { itemTitle } from "@/lib/item-utils"
import { AGE_BANDS, ageBandIndex, doneRateByPushes } from "./accuracy-stats"
import "./accuracy-views.css"

const AGE_FILLS = ["#9cc3a8", "#e2c06b", "#d9893e", "#a8432c"]

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

  const [peakCount, setPeakCount] = useState(10)
  const [minImportance, setMinImportance] = useState(3)
  const peaks = useMemo(
    () =>
      tasks
        .filter((t) => (t.daysPushed ?? 0) > 0)
        .sort((a, b) => (b.daysPushed ?? 0) - (a.daysPushed ?? 0))
        .slice(0, peakCount),
    [tasks, peakCount],
  )
  const peakMax = peaks[0]?.daysPushed ?? 1
  const doneByPushes = useMemo(() => doneRateByPushes(tasks), [tasks])
  const unitStock = useMemo(() => {
    const today = new Date()
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    return tasks
      .filter((t) => !t.completed && (t.importance ?? 0) >= minImportance)
      .map((t) => {
        const created = t.createdAt instanceof Date ? t.createdAt : new Date(String(t.createdAt ?? ""))
        const age = Number.isNaN(created.getTime()) ? 0 : Math.max(0, Math.round((t0 - created.getTime()) / 86_400_000))
        return { id: t.id, name: itemTitle(t), age, band: ageBandIndex(age) }
      })
      .sort((a, b) => a.age - b.age)
  }, [tasks, minImportance])

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
          <p className="an-canvas-title">Stall and pushes</p>
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
          <p className="an-canvas-title">Items by days pushed</p>
          <StudioBars rows={dist} max={Math.max(...dist.map((d) => d.value), 1)} unit="" />

          <div className="an-acc-plate">
            <p className="an-canvas-title">Does a push still get done?</p>
            <StudioBars
              rows={doneByPushes
                .filter((b) => b.rate !== null)
                .map((b) => ({ name: `${b.label} pushes (n=${b.n})`, value: Math.round((b.rate ?? 0) * 100) }))}
              max={100}
            />
            <p className="an-acc-math">
              Share done = completed ÷ all items with that many day pushes, all time. If the share drops as pushes
              climb, a push is a quiet drop, not a delay.
            </p>
          </div>

          {peaks.length > 0 && (
            <div className="an-acc-plate">
              <p className="an-canvas-title">Most-pushed items</p>
              <div className="an-acc-tools">
                <label>
                  Show {peakCount}
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={peakCount}
                    aria-label="How many peaks"
                    onChange={(e) => setPeakCount(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="an-acc-peaks" role="list">
                {peaks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="listitem"
                    className="an-acc-peak"
                    title={`${itemTitle(t)}: pushed ${t.daysPushed} days${t.completed ? " (done)" : ""}`}
                    onClick={() => openItemsInLists({ taskIds: [t.id] })}
                  >
                    <span className="an-n">{t.daysPushed}</span>
                    <span
                      className="an-acc-peak-shape"
                      style={{
                        height: `${Math.max(6, ((t.daysPushed ?? 0) / peakMax) * 100)}px`,
                        opacity: t.completed ? 0.45 : 1,
                      }}
                    />
                    <span className="an-acc-peak-name">{itemTitle(t)}</span>
                  </button>
                ))}
              </div>
              <p className="an-acc-math">Peak height = day pushes. Faded peaks are done.</p>
            </div>
          )}
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
          <div className="an-acc-plate">
            <p className="an-canvas-title">Open stock, one square per item</p>
            <div className="an-acc-tools">
              <label>
                Importance ≥ {minImportance}
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={minImportance}
                  aria-label="Minimum importance"
                  onChange={(e) => setMinImportance(Number(e.target.value))}
                />
              </label>
              <span className="an-n">{unitStock.length} open</span>
            </div>
            <div className="an-acc-units" role="list">
              {unitStock.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="listitem"
                  className="an-acc-unit"
                  style={{ background: AGE_FILLS[u.band] }}
                  title={`${u.name}: ${u.age}d old`}
                  onClick={() => openItemsInLists({ taskIds: [u.id] })}
                />
              ))}
            </div>
            <div className="an-acc-key">
              {AGE_BANDS.map((b, i) => (
                <span key={b.label}>
                  <i style={{ background: AGE_FILLS[i] }} />
                  {b.label} ({unitStock.filter((u) => u.band === i).length})
                </span>
              ))}
            </div>
          </div>
          <OpenInListsButton taskIds={open.map((t) => t.id)} label={`Open ${open.length} important item(s) in Lists`} />
        </>
      )}
    </div>
  )
}
