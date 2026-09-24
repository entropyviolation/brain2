/**
 * components/Analytics/ReviewsView.tsx — Period reviews + morning reader + blocked mosaic
 */
"use client"

import { useMemo, useState } from "react"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { PeriodReview } from "@/lib/types"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { SliceMosaic } from "./studio-kit"

const REASON_LABELS: Record<string, string> = {
  "no-energy": "No energy",
  "missing-input": "Missing input",
  procrastination: "Procrastination",
  "no-time": "No time",
  "blocked-by-other": "Blocked by other",
  other: "Other",
}

const REASON_COLOR: Record<string, string> = {
  "no-energy": "#f59e0b",
  "missing-input": "#60a5fa",
  procrastination: "#f87171",
  "no-time": "#a78bfa",
  "blocked-by-other": "#34d399",
  other: "#64748b",
}

function MorningBlock({
  morning,
  taskTitle,
  habitTitle,
}: {
  morning: NonNullable<PeriodReview["morning"]>
  taskTitle: (id: string) => string
  habitTitle: (id: string) => string
}) {
  const sourceLabel =
    morning.source === "telegram"
      ? "from text pipeline (BIM)"
      : morning.source === "desktop"
        ? "desktop morning review"
        : null

  return (
    <div className="an-morning-block space-y-3 rounded-md border border-dashed p-3">
      <p className="an-canvas-title" style={{ margin: 0 }}>
        Morning review
        {sourceLabel ? <span className="an-n"> · {sourceLabel}</span> : null}
      </p>
      {morning.allNighter && (
        <p>
          <strong>All nighter</strong> — no sleep clocks for this day.
        </p>
      )}
      {!morning.allNighter && morning.wakeTime && (
        <p>
          <strong>Wake</strong> · {morning.wakeTime}
        </p>
      )}
      {!morning.allNighter && morning.dream && (
        <div>
          <p className="an-canvas-title">Dream</p>
          <p className="whitespace-pre-wrap">{morning.dream}</p>
        </div>
      )}
      {(morning.affirmations?.length ?? 0) > 0 && (
        <div>
          <p className="an-canvas-title">Affirmations</p>
          <ol className="list-decimal pl-5">
            {morning.affirmations!.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}
      {(morning.todosAddedIds?.length ?? 0) > 0 && (
        <div>
          <p className="an-canvas-title">To-dos added</p>
          <ul>
            {morning.todosAddedIds!.map((id) => (
              <li key={id}>{taskTitle(id)}</li>
            ))}
          </ul>
        </div>
      )}
      {(morning.priorityTaskIds?.length ?? 0) > 0 && (
        <div>
          <p className="an-canvas-title">3–5 highest priorities</p>
          <ol className="list-decimal pl-5">
            {morning.priorityTaskIds!.map((id) => (
              <li key={id}>{taskTitle(id)}</li>
            ))}
          </ol>
        </div>
      )}
      {(morning.priorityHabitIds?.length ?? 0) > 0 && (
        <div>
          <p className="an-canvas-title">Habit priorities (1–3)</p>
          <ol className="list-decimal pl-5">
            {morning.priorityHabitIds!.map((id) => (
              <li key={id}>{habitTitle(id)}</li>
            ))}
          </ol>
        </div>
      )}
      {morning.dayPlanLogged && (
        <p>
          <strong>Day plan</strong> — logged on the Plan tab
          {morning.source === "telegram" ? " (from text)" : morning.source === "desktop" ? " (desktop)" : ""}.
        </p>
      )}
      {(morning.mustDo || morning.mustNotDo || morning.newEvents || morning.excitedAbout) && (
        <div className="space-y-2">
          <p className="an-canvas-title">Circumstances</p>
          {morning.mustDo && (
            <p>
              <strong>Must do</strong> — {morning.mustDo}
            </p>
          )}
          {morning.mustNotDo && (
            <p>
              <strong>Must not</strong> — {morning.mustNotDo}
            </p>
          )}
          {morning.newEvents && (
            <p>
              <strong>New events</strong> — {morning.newEvents}
            </p>
          )}
          {morning.excitedAbout && (
            <p>
              <strong>Excited about</strong> — {morning.excitedAbout}
            </p>
          )}
        </div>
      )}
      {morning.bestDayWhy && (
        <div>
          <p className="an-canvas-title">Best day ever because</p>
          <p className="whitespace-pre-wrap">{morning.bestDayWhy}</p>
        </div>
      )}
      {(morning.gratitude?.length ?? 0) > 0 && (
        <div>
          <p className="an-canvas-title">Grateful for</p>
          <ol className="list-decimal pl-5">
            {morning.gratitude!.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function ReviewsView() {
  const reviews = useReviewsStore((s) => s.reviews)
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitsStore((s) => s.tasks)
  const range = useAnalyticsRange()
  const [openReviewId, setOpenReviewId] = useState<string | null>(null)

  const taskTitle = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    return t ? itemTitleOrUntitled(t) : `(item ${id.slice(0, 8)})`
  }

  const habitTitle = (id: string) => {
    const h = habits.find((x) => x.id === id)
    return h?.name ?? `(habit ${id.slice(0, 8)})`
  }

  const reviewsInRange = useMemo(
    () => reviews.filter((r) => inRange(r.completedAt, range.keySet) || range.keySet.has(r.periodKey)),
    [reviews, range.keySet],
  )

  const morningDays = useMemo(
    () =>
      reviewsInRange
        .filter((r) => r.period === "day" && r.morning)
        .slice()
        .sort((a, b) => b.periodKey.localeCompare(a.periodKey)),
    [reviewsInRange],
  )

  const reasons = useMemo(() => {
    const counts = new Map<string, number>()
    const taskIds: string[] = []
    for (const r of reviewsInRange) {
      for (const [taskId, reason] of Object.entries(r.blockedReasons ?? {})) {
        counts.set(reason, (counts.get(reason) ?? 0) + 1)
        taskIds.push(taskId)
      }
    }
    const slices = [...counts.entries()].map(([id, minutes]) => ({
      id,
      name: REASON_LABELS[id] ?? id,
      color: REASON_COLOR[id] ?? "#64748b",
      minutes,
      label: String(minutes),
    }))
    return { slices, taskIds, max: Math.max(...slices.map((s) => s.minutes), 1) }
  }, [reviewsInRange])

  return (
    <div className="an-canvas an-stack">
      {reviewsInRange.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={
            reviews.length === 0
              ? "No reviews saved yet. Use the Review button in the header, or text gm to BIM."
              : `No reviews in the ${range.label}.`
          }
        />
      ) : (
        <>
          <p className="an-n">
            n = {reviewsInRange.length} review{reviewsInRange.length === 1 ? "" : "s"} in the {range.label}
            {morningDays.length > 0 ? ` · ${morningDays.length} morning` : ""}
          </p>

          {morningDays.length > 0 && (
            <>
              <p className="an-canvas-title">Morning reviews</p>
              <p className="an-n">Cute read-outs of what you answered at the start of the day.</p>
              {morningDays.map((r) => (
                <article key={`morning-${r.id}`} className="an-review-card">
                  <header>
                    <span>Morning</span>
                    <span>· {r.periodKey}</span>
                  </header>
                  <div className="an-review-body">
                    <MorningBlock morning={r.morning!} taskTitle={taskTitle} habitTitle={habitTitle} />
                  </div>
                </article>
              ))}
            </>
          )}

          {reasons.slices.length > 0 && (
            <>
              <p className="an-canvas-title">Blocked reasons</p>
              <SliceMosaic slices={reasons.slices} max={reasons.max} />
              <OpenInListsButton taskIds={reasons.taskIds} />
            </>
          )}
          {reviewsInRange
            .slice()
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            .map((r) => {
              const open = openReviewId === r.id
              return (
                <article key={r.id} className="an-review-card">
                  <header onClick={() => setOpenReviewId(open ? null : r.id)}>
                    <span className="capitalize">{r.period}</span>
                    <span>· {r.periodKey}</span>
                    <span className="an-n" style={{ marginLeft: "auto" }}>
                      {new Date(r.completedAt).toLocaleDateString()}
                    </span>
                  </header>
                  {open && (
                    <div className="an-review-body space-y-3">
                      {r.morning && <MorningBlock morning={r.morning} taskTitle={taskTitle} habitTitle={habitTitle} />}
                      {r.summary && (
                        <div>
                          <p className="an-canvas-title">Summary</p>
                          <p className="whitespace-pre-wrap">{r.summary}</p>
                        </div>
                      )}
                      {r.gratitude?.filter(Boolean).length > 0 && (
                        <div>
                          <p className="an-canvas-title">Gratitude</p>
                          <ul>
                            {r.gratitude.filter(Boolean).map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.nextPlans && (
                        <div>
                          <p className="an-canvas-title">Plans for next {r.period}</p>
                          <p className="whitespace-pre-wrap">{r.nextPlans}</p>
                        </div>
                      )}
                      <p className="an-n">
                        {r.resolvedTaskIds?.length || 0} resolved · {r.pushedTaskIds?.length || 0} pushed forward
                      </p>
                    </div>
                  )}
                </article>
              )
            })}
        </>
      )}
    </div>
  )
}
