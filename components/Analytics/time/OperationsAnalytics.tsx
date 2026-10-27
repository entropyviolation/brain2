/**
 * components/Analytics/OperationsAnalytics.tsx — Stage mosaic + work/neglect heat
 *
 * Reads operation items and the after-action reports already stored on them.
 * Does not restyle the Operations module interior.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { operationTasks } from "@/lib/item-slices"
import { itemTitle } from "@/lib/item-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { buildHeatmap } from "@/lib/operations"
import { getOperationCategories, OPERATION_ATTR } from "@/lib/operation-types"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import {
  DEBRIEF_RATING_KEYS,
  DEBRIEF_RATING_LABELS,
  formatDebriefHours,
  summarizeOperationDebriefs,
} from "./operation-debrief"
import { SliceMosaic, StudioReadout } from "./studio-kit"

const STAGE_COLOR: Record<string, string> = {
  planning: "#64748b",
  active: "#34d399",
  paused: "#fbbf24",
  done: "#60a5fa",
  abandoned: "#f87171",
}

export function OperationsAnalytics() {
  const ops = useTaskStore((s) => operationTasks(s.tasks))
  const operationReviews = useReviewsStore((s) => s.operationReviews)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const start = parseLocalDate(dateKeys[0] ?? "") ?? new Date()
  const end = parseLocalDate(dateKeys[dateKeys.length - 1] ?? "") ?? new Date()

  const heat = useMemo(
    () => (dateKeys.length ? buildHeatmap(ops, { start, end, days: dateKeys.length }) : []),
    [ops, start, end, dateKeys.length],
  )

  const stages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const op of ops) {
      const stage = String(op.attributes?.[OPERATION_ATTR.stage] ?? "planning")
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
    }
    return [...counts.entries()].map(([id, minutes]) => ({
      id,
      name: id,
      color: STAGE_COLOR[id] ?? "#64748b",
      minutes,
      label: String(minutes),
    }))
  }, [ops])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const op of ops) {
      const cats = getOperationCategories(op)
      if (cats.length === 0) counts.set("uncategorized", (counts.get("uncategorized") ?? 0) + 1)
      for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return [...counts.entries()].map(([id, minutes]) => ({
      id,
      name: id,
      color: "#5eead4",
      minutes,
      label: String(minutes),
    }))
  }, [ops])

  const rated = operationReviews.filter((r) => r.ratings && Object.keys(r.ratings).length > 0)

  const debrief = useMemo(() => {
    const titles = new Map(ops.map((op) => [op.id, itemTitle(op)]))
    return summarizeOperationDebriefs({
      reviews: operationReviews,
      inWindow: (date) => inRange(date, keySet),
      titleOf: (operationId) => titles.get(operationId) || "Operation",
    })
  }, [ops, operationReviews, keySet])

  return (
    <div className="an-canvas an-stack" data-testid="operations-analytics">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Operations</p>
          <p className="an-canvas-kicker">{label} · stage / category mosaic and work vs neglect from timeLogs.</p>
        </div>
      </header>
      {ops.length === 0 ? (
        <ChartFrame empty emptySentence="No operations yet." />
      ) : (
        <>
          <section className="an-plate">
            <div className="an-readouts">
              <StudioReadout label="Operations" value={ops.length} />
              <StudioReadout label="Reviews" value={operationReviews.length} />
              <StudioReadout label="Rated" value={rated.length} />
            </div>
          </section>
          <section className="an-plate">
            <p className="an-canvas-title">Stage</p>
            <SliceMosaic slices={stages} max={Math.max(...stages.map((s) => s.minutes), 1)} />
          </section>
          {categories.length > 0 && (
            <section className="an-plate">
              <p className="an-canvas-title">Categories</p>
              <SliceMosaic slices={categories} max={Math.max(...categories.map((s) => s.minutes), 1)} />
            </section>
          )}
          <section className="an-plate">
            <p className="an-canvas-title">Work by day</p>
            {heat.some((c) => c.minutes > 0) ? (
              <div className="an-plot-well">
                <div
                  className="an-density-cells"
                  style={{ ["--an-cols" as string]: String(Math.max(heat.length, 1)) }}
                  role="img"
                  aria-label="Operations work minutes by day"
                >
                  {heat.map((cell) => (
                    <span
                      key={cell.date}
                      className="an-density-cell"
                      title={`${cell.date}: ${cell.minutes}m`}
                      style={{
                        background:
                          cell.minutes <= 0
                            ? "#ffffff"
                            : `hsl(312 ${30 + cell.level * 12}% ${16 + cell.level * 10}%)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <ChartFrame empty emptySentence={`No operation timeLogs in the ${label}.`} />
            )}
            <OpenInListsButton taskIds={ops.map((t) => t.id)} />
          </section>
          <section className="an-plate" data-testid="operations-debrief">
            <p className="an-canvas-title">After-action debrief</p>
            <p className="an-canvas-kicker">
              Reports filed in the {label}. Means use only integer 1–10 scores that were given. A missing score is left out. Hours are the total each report already stored.
            </p>
            {debrief.reviewCount === 0 ? (
              <ChartFrame empty emptySentence={`No after-action reports in the ${label}.`} />
            ) : (
              <>
                <div className="an-readouts">
                  <StudioReadout label="Reports" value={debrief.reviewCount} note="in this window" />
                  {DEBRIEF_RATING_KEYS.map((key) => {
                    const row = debrief.ratings.find((rating) => rating.key === key)
                    return (
                      <StudioReadout
                        key={key}
                        label={DEBRIEF_RATING_LABELS[key]}
                        value={row ? row.mean.toFixed(1) : "—"}
                        note={row ? `n = ${row.n}` : "none scored"}
                        tip="Mean of the 1–10 scores that were given. A missing, blank, or out-of-range score is left out."
                      />
                    )
                  })}
                  <StudioReadout
                    label="Hours logged"
                    value={debrief.hoursCount > 0 ? formatDebriefHours(debrief.hoursSum) : "—"}
                    note={
                      debrief.hoursCount > 0
                        ? `sum of stored totals · ${debrief.hoursCount} report${debrief.hoursCount === 1 ? "" : "s"}`
                        : "none stored"
                    }
                    tip="Each report stores hoursLogged as that operation's total logged hours when it was filed. This adds those stored totals. A report with no hours is left out, not counted as zero."
                  />
                  <StudioReadout
                    label="Mean hours"
                    value={debrief.hoursMean != null ? formatDebriefHours(debrief.hoursMean) : "—"}
                    note={debrief.hoursCount > 0 ? "per report that stored hours" : "none stored"}
                    tip="Mean of the stored hoursLogged values in this window. A missing total is left out."
                  />
                </div>
                {debrief.texts.length === 0 ? (
                  <p className="an-canvas-hint">No written summary, what worked, what failed, or lessons in this window.</p>
                ) : (
                  debrief.texts.map((text) => {
                    const when = text.completedAt
                    const date = Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString()
                    return (
                      <article key={text.id} className="an-review-card" data-testid="operations-debrief-note">
                        <header>
                          <span className="truncate">{text.title}</span>
                          {date ? (
                            <span className="an-n" style={{ marginLeft: "auto" }}>
                              {date}
                            </span>
                          ) : null}
                        </header>
                        <div className="an-review-body">
                          {text.summary ? <p>{text.summary}</p> : null}
                          {text.whatWorked ? (
                            <p>
                              <span className="an-canvas-title">What worked</span> {text.whatWorked}
                            </p>
                          ) : null}
                          {text.whatFailed ? (
                            <p>
                              <span className="an-canvas-title">What failed</span> {text.whatFailed}
                            </p>
                          ) : null}
                          {text.lessons.length > 0 ? (
                            <>
                              <p className="an-canvas-title">Lessons</p>
                              <ul className="an-list">
                                {text.lessons.map((lesson, index) => (
                                  <li key={`${text.id}-${index}`} className="an-list-row">
                                    <span>{lesson}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                        </div>
                      </article>
                    )
                  })
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
