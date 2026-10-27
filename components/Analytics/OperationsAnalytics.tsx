/**
 * components/Analytics/OperationsAnalytics.tsx — Stage mosaic + work/neglect heat
 *
 * Reads operation items and the after-action reports already stored on them.
 * Does not restyle the Operations module interior. Adds a neglect ranking
 * (days since last time log, stage filter, search) and a debrief quadrant
 * (morale × execution, bubble = hours). Docs: `docs/analytics/time-operations.md`.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { operationTasks } from "@/lib/item-slices"
import { itemTitle } from "@/lib/item-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { buildHeatmap, neglectedDays } from "@/lib/operations"
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
import { CanvasTitle, SliceMosaic, StudioReadout } from "./studio-kit"
import { debriefPoints, operationNeglect } from "./time-flow-stats"
import "./time-flow.css"

const CATEGORY_COLORS = ["#0f766e", "#7c3aed", "#b45309", "#be185d", "#4d7c0f", "#c2410c", "#475569", "#0369a1"]

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

  const firstKey = dateKeys[0] ?? ""
  const lastKey = dateKeys[dateKeys.length - 1] ?? ""
  const heat = useMemo(() => {
    if (!dateKeys.length) return []
    const start = parseLocalDate(firstKey) ?? new Date()
    const end = parseLocalDate(lastKey) ?? new Date()
    return buildHeatmap(ops, { start, end, days: dateKeys.length })
  }, [ops, firstKey, lastKey, dateKeys.length])
  const [stageFilter, setStageFilter] = useState("")
  const [query, setQuery] = useState("")
  const stageOf = (op: (typeof ops)[number]) => String(op.attributes?.[OPERATION_ATTR.stage] ?? "planning")
  const neglect = useMemo(() => operationNeglect(ops, keySet, lastKey), [ops, keySet, lastKey])
  const opById = useMemo(() => new Map(ops.map((op) => [op.id, op])), [ops])
  const neglectShown = neglect.filter((row) => {
    const op = opById.get(row.id)
    if (!op) return false
    if (stageFilter && stageOf(op) !== stageFilter) return false
    return !query.trim() || itemTitle(op).toLowerCase().includes(query.trim().toLowerCase())
  })
  const maxQuiet = Math.max(1, ...neglect.map((r) => r.daysSince ?? 0))
  const bubbles = useMemo(
    () => debriefPoints(operationReviews.filter((r) => inRange(r.completedAt, keySet))),
    [operationReviews, keySet],
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
    return [...counts.entries()].map(([id, minutes], i) => ({
      id,
      name: id,
      color: id === "uncategorized" ? "#94a3b8" : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
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
    <div className="an-canvas an-stack tf-view" data-testid="operations-analytics">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Operations"
            help="Operation items: how many sit in each stage and category, which days had logged work, how long each has gone without a log, and what the after-action reports said."
          />
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
            {heat.length ? (
              <p className="an-n">
                {neglectedDays(heat)} of {heat.length} days with no logged work on any operation
              </p>
            ) : null}
            <OpenInListsButton taskIds={ops.map((t) => t.id)} />
          </section>
          <section className="an-plate" aria-label="Neglect">
            <CanvasTitle
              title="Longest untouched"
              help="Days since each operation last had a time log, counted to the end of the window. Never logged sits at the top. The right column is minutes logged inside the window."
            />
            <div className="tf-tools" role="group" aria-label="Stage filter">
              <button type="button" className="an-chip" aria-pressed={stageFilter === ""} onClick={() => setStageFilter("")}>
                All
              </button>
              {stages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="an-chip"
                  aria-pressed={stageFilter === s.id}
                  onClick={() => setStageFilter(stageFilter === s.id ? "" : s.id)}
                >
                  {s.name} · {s.minutes}
                </button>
              ))}
              <input type="search" value={query} aria-label="Search operations" placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="tf-bars tf-scroll">
              {neglectShown.map((row) => {
                const op = opById.get(row.id)!
                return (
                  <FragmentRow
                    key={row.id}
                    name={itemTitle(op) || "Operation"}
                    width={row.daysSince == null ? 100 : (row.daysSince / maxQuiet) * 100}
                    color={STAGE_COLOR[stageOf(op)] ?? "#64748b"}
                    tip={row.lastDate ? `last log ${row.lastDate}` : "never logged"}
                    value={`${row.daysSince == null ? "never" : `${row.daysSince}d`} · ${row.windowMin}m`}
                  />
                )
              })}
            </div>
            {neglectShown.length === 0 ? <p className="an-canvas-hint">No operation matches.</p> : null}
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
                {bubbles.length > 0 ? (
                  <>
                    <CanvasTitle
                      title="Morale × execution"
                      help="One bubble per report that scored both morale and execution (1–10). Bubble area = stored hours logged; no hours = smallest dot. The cross is at 5.5, the middle of the scale, splitting four corners."
                    />
                    <DebriefQuadrant points={bubbles} titleOf={(id) => {
                        const op = opById.get(id)
                        return (op && itemTitle(op)) || "Operation"
                      }} />
                  </>
                ) : null}
                {debrief.texts.length === 0 ? (
                  <p className="an-canvas-hint">No written summary, what worked, what failed, or lessons in this window.</p>
                ) : (
                  <details className="tf-fold" open={debrief.texts.length <= 2}>
                    <summary>
                      Written debriefs <span className="an-n">{debrief.texts.length}</span>
                    </summary>
                  {debrief.texts.map((text) => {
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
                  })}
                  </details>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function FragmentRow({ name, width, color, tip, value }: { name: string; width: number; color: string; tip: string; value: string }) {
  return (
    <>
      <span className="tf-name" title={name}>
        {name}
      </span>
      <span className="tf-track" title={tip}>
        <i style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="tf-val">{value}</span>
    </>
  )
}

function DebriefQuadrant({
  points,
  titleOf,
}: {
  points: { id: string; operationId: string; morale: number; execution: number; hours: number | null }[]
  titleOf: (operationId: string) => string
}) {
  const pad = 26
  const size = 240
  const span = size - pad * 2
  const pos = (v: number) => pad + ((v - 1) / 9) * span
  const maxH = Math.max(1, ...points.map((p) => p.hours ?? 0))
  const corners = [
    { x: pad + 4, y: pad + 10, a: "start", t: "Grind" },
    { x: size - pad - 4, y: pad + 10, a: "end", t: "Smooth run" },
    { x: pad + 4, y: size - pad - 4, a: "start", t: "Rough" },
    { x: size - pad - 4, y: size - pad - 4, a: "end", t: "Fun mess" },
  ] as const
  return (
    <svg className="tf-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Debrief morale against execution">
      <rect className="tf-rule" x={pad} y={pad} width={span} height={span} />
      <line className="tf-rule" x1={pos(5.5)} x2={pos(5.5)} y1={pad} y2={size - pad} />
      <line className="tf-rule" y1={size - pos(5.5)} y2={size - pos(5.5)} x1={pad} x2={size - pad} />
      {corners.map((c) => (
        <text key={c.t} x={c.x} y={c.y} fontSize={9} textAnchor={c.a} className="tf-faint">
          {c.t}
        </text>
      ))}
      <text x={size / 2} y={size - 6} fontSize={9} textAnchor="middle">
        morale →
      </text>
      <text x={10} y={size / 2} fontSize={9} textAnchor="middle" transform={`rotate(-90 10 ${size / 2})`}>
        execution →
      </text>
      {points.map((p) => (
        <circle
          key={p.id}
          cx={pos(p.morale)}
          cy={size - pos(p.execution)}
          r={3 + Math.sqrt((p.hours ?? 0) / maxH) * 14}
          fill="#0f766e"
          fillOpacity={0.45}
          stroke="#0f766e"
        >
          <title>{`${titleOf(p.operationId)} · morale ${p.morale} · execution ${p.execution}${p.hours != null ? ` · ${p.hours}h` : ""}`}</title>
        </circle>
      ))}
    </svg>
  )
}
