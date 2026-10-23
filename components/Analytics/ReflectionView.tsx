/**
 * components/Analytics/ReflectionView.tsx — Completion-review trajectories
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { useGoalsStore } from "@/lib/goals-store"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"
import { parseLocalDate } from "@/lib/date-utils"
import { LATER_FEELING_SCALES, REFLECTION_SCALES, summarizeCompletionReviews } from "@/lib/completion-review"
import { mean, pearson, stddev } from "@/lib/metrics"
import { PostMortemDialog } from "@/components/Reviews/PostMortemDialog"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { CanvasTitle, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioReadout, StudioSelect } from "./studio-kit"
import { BEHAVIOR_FILL, BubblePlot, Fold, MirrorSplit, SearchField, median, round1, useShowMore } from "./behavior-kit"

type Review = NonNullable<Task["completionReview"]>
type ScoreKey = (typeof SCALES)[number]["key"]
const SCALES = [...LATER_FEELING_SCALES, ...REFLECTION_SCALES]
const scoreOf = (r: Review, key: ScoreKey): number | undefined => {
  const v = (r as unknown as Record<string, unknown>)[key]
  return typeof v === "number" ? v : undefined
}
const TRAJECTORY = [
  { key: "satisfaction", label: "Satisfaction", color: BEHAVIOR_FILL.a },
  { key: "focus", label: "Focus", color: BEHAVIOR_FILL.c },
  { key: "resistance", label: "Resistance", color: BEHAVIOR_FILL.b },
  { key: "distraction", label: "Distraction", color: BEHAVIOR_FILL.d },
] as const
import { CompletionReviewPlates } from "./CompletionReviewPlates"

export function ReflectionView() {
  const allTasks = useTaskStore((s) => s.tasks)
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const range = useAnalyticsRange()
  const [reflectTask, setReflectTask] = useState<Task | null>(null)

  const reflectedTasks = useMemo(
    () => allTasks.filter((t) => t.completionReview && inRange(t.completionReview.completedAt, range.keySet)),
    [allTasks, range.keySet],
  )
  const reflectableTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.completed && !t.completionReview)
        .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime())
        .slice(0, 20),
    [allTasks],
  )
  const postMortemSummary = useMemo(() => {
    if (reflectedTasks.length === 0) return null
    const avg = (pick: (r: NonNullable<Task["completionReview"]>) => number | undefined) => {
      const values = reflectedTasks
        .map((t) => pick(t.completionReview!))
        .filter((n): n is number => typeof n === "number")
      if (values.length === 0) return null
      return values.reduce((sum, n) => sum + n, 0) / values.length
    }
    const satisfaction = avg((r) => r.satisfaction)
    const resistance = avg((r) => r.resistance)
    const focus = avg((r) => r.focus)
    const distraction = avg((r) => r.distraction)
    const parts = [
      satisfaction != null ? `satisfaction ${satisfaction.toFixed(1)}` : null,
      resistance != null ? `resistance ${resistance.toFixed(1)}` : null,
      focus != null ? `focus ${focus.toFixed(1)}` : null,
      distraction != null ? `distraction ${distraction.toFixed(1)}` : null,
    ].filter(Boolean)
    return {
      count: reflectedTasks.length,
      sentence: parts.length ? parts.join(", ") : "no legacy 1–10 scores",
    }
  }, [reflectedTasks])

  const reviewSummary = useMemo(
    () =>
      summarizeCompletionReviews({
        tasks: allTasks,
        goals: goals.map((goal) => ({ id: goal.id, title: goal.title })),
        objectives: objectives.map((objective) => ({
          id: objective.id,
          title: objective.title,
        })),
        inWindow: (date) => inRange(date, range.keySet),
        titleOf: (row) => itemTitle(row),
      }),
    [allTasks, goals, objectives, range.keySet],
  )

  const trajectory = useMemo(
    () =>
      reflectedTasks
        .slice()
        .sort(
          (a, b) =>
            new Date(a.completionReview!.completedAt).getTime() - new Date(b.completionReview!.completedAt).getTime(),
        )
        .map((t) => {
          const r = t.completionReview!
          const d = parseLocalDate(r.completedAt) ?? new Date(r.completedAt)
          return {
            label: d.toLocaleDateString(undefined, {
              month: "numeric",
              day: "numeric",
            }),
            satisfaction: r.satisfaction ?? null,
            resistance: r.resistance ?? null,
            focus: r.focus ?? null,
            distraction: r.distraction ?? null,
          }
        }),
    [reflectedTasks],
  )

  // Score spread: mean ± sd and n per scale, only scales with data.
  const spread = useMemo(
    () =>
      SCALES.map((scale) => {
        const values = reflectedTasks
          .map((t) => scoreOf(t.completionReview!, scale.key))
          .filter((v): v is number => v != null)
        return {
          ...scale,
          n: values.length,
          mean: mean(values),
          sd: stddev(values),
        }
      }).filter((s) => s.n > 0),
    [reflectedTasks],
  )

  // Evidence bubbles: pick two scales; size = actual minutes.
  const [xKey, setXKey] = useState<ScoreKey>("resistance")
  const [yKey, setYKey] = useState<ScoreKey>("satisfaction")
  const bubbles = useMemo(() => {
    const pts = reflectedTasks.flatMap((t) => {
      const r = t.completionReview!
      const x = scoreOf(r, xKey)
      const y = scoreOf(r, yKey)
      if (x == null || y == null) return []
      return [
        {
          id: t.id,
          x,
          y,
          size: r.actualDuration ?? 15,
          label: `${itemTitle(t)} · ${xKey} ${x} · ${yKey} ${y}${r.actualDuration ? ` · ${r.actualDuration}m` : ""}`,
          color: y >= x ? BEHAVIOR_FILL.a : BEHAVIOR_FILL.b,
        },
      ]
    })
    const r =
      pts.length >= 3
        ? pearson(
            pts.map((p) => p.x),
            pts.map((p) => p.y),
          )
        : null
    return {
      pts,
      r,
      mx: median(pts.map((p) => p.x)),
      my: median(pts.map((p) => p.y)),
    }
  }, [reflectedTasks, xKey, yKey])

  // Mirror split of expected vs actual difficulty.
  const [mirrorSort, setMirrorSort] = useState<"gap" | "under" | "title">("gap")
  const mirrorRows = useMemo(() => {
    const rows = reviewSummary.difficultyPairs.map((p) => ({
      id: p.taskId,
      name: p.title,
      left: p.expected,
      right: p.actual,
    }))
    if (mirrorSort === "title") rows.sort((a, b) => a.name.localeCompare(b.name))
    else if (mirrorSort === "under") rows.sort((a, b) => b.right - b.left - (a.right - a.left))
    else rows.sort((a, b) => Math.abs(b.right - b.left) - Math.abs(a.right - a.left))
    return rows
  }, [reviewSummary.difficultyPairs, mirrorSort])
  const { shown: shownMirror, more: moreMirror } = useShowMore(mirrorRows, 10)
  const harder = mirrorRows.filter((r) => r.right > r.left).length
  const easier = mirrorRows.filter((r) => r.right < r.left).length

  const [historyQuery, setHistoryQuery] = useState("")
  const history = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    return reflectedTasks
      .filter(
        (t) =>
          !q ||
          itemTitle(t).toLowerCase().includes(q) ||
          (t.completionReview!.reflectNotes ?? "").toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.completionReview!.completedAt).getTime() - new Date(a.completionReview!.completedAt).getTime(),
      )
  }, [reflectedTasks, historyQuery])
  const { shown: shownHistory, more: moreHistory } = useShowMore(history, 10)
  const { shown: shownReflectable, more: moreReflectable } = useShowMore(reflectableTasks, 6)
  const openTask = (id: string) => setReflectTask(allTasks.find((t) => t.id === id) ?? null)

  return (
    <div className="an-canvas an-stack">
      {postMortemSummary ? (
        <p className="an-finding">
          {postMortemSummary.count} reflection
          {postMortemSummary.count === 1 ? "" : "s"} in the {range.label}: {postMortemSummary.sentence} (1–10, scored
          reviews only).
        </p>
      ) : (
        <ChartFrame empty emptySentence={`No reflections in the ${range.label}.`} />
      )}

      {reviewSummary.doneCount > 0 && <CompletionReviewPlates summary={reviewSummary} />}

      {spread.length > 0 && (
        <div className="an-readouts" data-testid="reflection-spread">
          {spread.map((sc) => (
            <StudioReadout
              key={sc.key}
              label={sc.label}
              value={round1(sc.mean)}
              note={`± ${round1(sc.sd)} · n ${sc.n}`}
              tip={`${sc.hint}. Mean ± standard deviation across reviews in the window.`}
            />
          ))}
        </div>
      )}

      {bubbles.pts.length > 0 && (
        <section className="an-plate" data-testid="reflection-bubbles">
          <CanvasTitle
            title="Evidence bubbles"
            help="One bubble per reviewed task. Pick the two scales. Size = actual minutes. Dashed lines are the medians, so each quadrant holds the tasks above or below your usual. Green sits on or above the diagonal (y ≥ x). Click a bubble to open its reflection."
          />
          <div className="an-bx-tools">
            <StudioSelect label="Across" value={xKey} onChange={(v) => setXKey(v as ScoreKey)}>
              {SCALES.map((sc) => (
                <option key={sc.key} value={sc.key}>
                  {sc.label}
                </option>
              ))}
            </StudioSelect>
            <StudioSelect label="Up" value={yKey} onChange={(v) => setYKey(v as ScoreKey)}>
              {SCALES.map((sc) => (
                <option key={sc.key} value={sc.key}>
                  {sc.label}
                </option>
              ))}
            </StudioSelect>
            <span className="an-n">
              n = {bubbles.pts.length}
              {bubbles.r != null ? ` · Pearson r = ${bubbles.r.toFixed(2)}` : ""}
            </span>
          </div>
          <BubblePlot
            points={bubbles.pts}
            xDomain={[0, 10]}
            yDomain={[0, 10]}
            xLabel={SCALES.find((sc) => sc.key === xKey)?.label ?? xKey}
            yLabel={SCALES.find((sc) => sc.key === yKey)?.label ?? yKey}
            refX={bubbles.mx}
            refY={bubbles.my}
            onSelect={openTask}
          />
          {bubbles.r != null && bubbles.pts.length < 10 && (
            <p className="an-caveat">Fewer than 10 points: r moves a lot with one task. Read it as a hint.</p>
          )}
        </section>
      )}

      {mirrorRows.length > 0 && (
        <section className="an-plate" data-testid="reflection-mirror">
          <CanvasTitle
            title="Expected vs actual, mirrored"
            help="Left bar = how hard you thought it would be. Right bar = how hard it was. The orange side is the bigger one, so harder-than-expected tasks glow on the right."
          />
          <div className="an-bx-tools">
            <StudioSelect label="Sort" value={mirrorSort} onChange={(v) => setMirrorSort(v as typeof mirrorSort)}>
              <option value="gap">Biggest miss</option>
              <option value="under">Harder than expected first</option>
              <option value="title">Title</option>
            </StudioSelect>
            <span className="an-n">
              {harder} harder · {easier} easier · {mirrorRows.length - harder - easier} as expected
            </span>
          </div>
          <MirrorSplit rows={shownMirror} leftLabel="Expected" rightLabel="Actual" max={10} onSelect={openTask} />
          {moreMirror}
        </section>
      )}

      {trajectory.length >= 2 && (
        <section className="an-plate">
          <CanvasTitle
            title="Score trajectory"
            help="Each review in time order. Gaps are reviews that skipped that score."
          />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trajectory}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis domain={[0, 10]} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              {TRAJECTORY.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="an-bx-legend">
            {TRAJECTORY.map((line) => (
              <span key={line.key}>
                <i style={{ background: line.color }} />
                {line.label}
              </span>
            ))}
          </p>
        </section>
      )}

      <Fold
        title="Reflect on completed tasks"
        count={reflectableTasks.length}
        defaultOpen={reflectedTasks.length === 0}
      >
        {reflectableTasks.length === 0 ? (
          <p className="an-canvas-kicker">
            {reflectedTasks.length > 0
              ? "All completed tasks have been reflected on."
              : "Complete tasks to capture a post-mortem reflection."}
          </p>
        ) : (
          <ul className="an-list">
            {shownReflectable.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setReflectTask(t)}>
                  <span className="truncate">{itemTitle(t)}</span>
                  <span>Reflect</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {moreReflectable}
      </Fold>

      {reflectedTasks.length > 0 && (
        <Fold title="Prompt history" count={reflectedTasks.length}>
          <div className="an-bx-tools">
            <SearchField value={historyQuery} onChange={setHistoryQuery} placeholder="Title or note…" />
            {historyQuery && (
              <span className="an-n">
                {history.length} match{history.length === 1 ? "" : "es"}
              </span>
            )}
          </div>
          <ul className="an-list">
            {shownHistory.map((t) => {
              const r = t.completionReview!
              const note = r.reflectNotes?.trim()
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setReflectTask(t)}>
                    <span>
                      <span className="block truncate">{itemTitle(t)}</span>
                      <span className="an-n">
                        {[
                          r.satisfaction != null ? `sat ${r.satisfaction}` : null,
                          r.resistance != null ? `resist ${r.resistance}` : null,
                          r.focus != null ? `focus ${r.focus}` : null,
                          r.distraction != null ? `distract ${r.distraction}` : null,
                          r.enjoyment != null ? `joy ${r.enjoyment}` : null,
                          r.actualDifficulty != null ? `hard ${r.actualDifficulty}` : null,
                          r.durationCertainty === "unknown"
                            ? "time unknown"
                            : r.durationCertainty === "estimated" && r.actualDuration
                              ? `~${r.actualDuration}m`
                              : r.actualDuration
                                ? `${r.actualDuration}m`
                                : null,
                          r.reviewPoints != null ? `${r.reviewPoints} pts` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "reflected"}
                      </span>
                    </span>
                    <span className="an-n">{new Date(r.completedAt).toLocaleDateString()}</span>
                  </button>
                  {note ? <p className="an-canvas-hint">{note}</p> : null}
                </li>
              )
            })}
          </ul>
          {moreHistory}
          <OpenInListsButton taskIds={reflectedTasks.map((t) => t.id)} />
        </Fold>
      )}

      <PostMortemDialog task={reflectTask} open={!!reflectTask} onClose={() => setReflectTask(null)} />
    </div>
  )
}
