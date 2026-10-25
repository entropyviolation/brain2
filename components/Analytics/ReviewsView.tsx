/**
 * components/Analytics/ReviewsView.tsx — Period reviews + morning reader + blocked mosaic
 */
"use client"

import { useMemo, useState } from "react"
import { periodLabel, useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { PeriodReview } from "@/lib/types"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { CanvasTitle, SliceMosaic, StudioReadout } from "./studio-kit"
import { ChipFilter, Fold, SearchField, WordTiles, round1, topWords, useShowMore } from "./behavior-kit"
import { PeriodArcReading } from "./PeriodArcReading"
import { blockedReasonLabel, blockedReasonToken } from "@/lib/blocked-reason"
import { collectMissReasonCorpus, MISS_SOURCE_LABEL, type MissReasonSource } from "@/lib/miss-reason-corpus"

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
        ? "desktop morning ritual"
        : null

  return (
    <div className="an-morning-block space-y-3 rounded-md border border-dashed p-3">
      <p className="an-canvas-title" style={{ margin: 0 }}>
        Morning ritual
        {morning.completed === false ? <span className="an-n"> · in progress</span> : null}
        {sourceLabel ? <span className="an-n"> · {sourceLabel}</span> : null}
      </p>
      {morning.allNighter && (
        <p>
          <strong>All nighter</strong> — no sleep clocks for this day.
        </p>
      )}
      {!morning.allNighter && (morning.bedTime || morning.wakeTime) && (
        <p>
          {morning.bedTime ? (
            <>
              <strong>Fell asleep</strong> · {morning.bedTime}
            </>
          ) : null}
          {morning.bedTime && morning.wakeTime ? " · " : null}
          {morning.wakeTime ? (
            <>
              <strong>Wake</strong> · {morning.wakeTime}
            </>
          ) : null}
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
  const operationReviews = useReviewsStore((s) => s.operationReviews)
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const quarterlyHabitData = useHabitsStore((s) => s.quarterlyHabitData)
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

  const corpus = useMemo(
    () =>
      collectMissReasonCorpus({
        tasks,
        habits,
        weeklyData,
        weeklyHabitData,
        monthlyHabitData,
        quarterlyHabitData,
        reviewsInRange,
        operationReviews,
        keySet: range.keySet,
      }),
    [
      tasks,
      habits,
      weeklyData,
      weeklyHabitData,
      monthlyHabitData,
      quarterlyHabitData,
      reviewsInRange,
      operationReviews,
      range.keySet,
    ],
  )

  const reasons = useMemo(() => {
    const counts = new Map<string, number>()
    const taskIds: string[] = []
    for (const r of reviewsInRange) {
      for (const [taskId, reason] of Object.entries(r.blockedReasons ?? {})) {
        const label = blockedReasonLabel(reason) || "Other"
        counts.set(label, (counts.get(label) ?? 0) + 1)
        taskIds.push(taskId)
      }
    }
    const slices = [...counts.entries()].map(([name, minutes]) => {
      const sample = reviewsInRange
        .flatMap((review) => Object.values(review.blockedReasons ?? {}))
        .find((reason) => blockedReasonLabel(reason) === name)
      const token = blockedReasonToken(sample) || "other"
      return {
        id: name,
        name,
        color: REASON_COLOR[token] ?? "#64748b",
        minutes,
        label: String(minutes),
      }
    })
    return {
      slices,
      taskIds,
      max: Math.max(...slices.map((s) => s.minutes), 1),
    }
  }, [reviewsInRange])

  // Ritual strip: one cell per day of the window.
  const strip = useMemo(() => {
    const state = new Map<string, "done" | "partial" | "review">()
    for (const r of reviewsInRange) {
      if (r.period !== "day") continue
      if (r.morning) state.set(r.periodKey, r.morning.completed === false ? "partial" : "done")
      else if (!state.has(r.periodKey)) state.set(r.periodKey, "review")
    }
    let run = 0
    let best = 0
    for (const k of range.dateKeys) {
      run = state.get(k) === "done" ? run + 1 : 0
      best = Math.max(best, run)
    }
    let current = 0
    for (let i = range.dateKeys.length - 1; i >= 0; i--) {
      const st = state.get(range.dateKeys[i])
      if (st === "done") current++
      else if (i === range.dateKeys.length - 1)
        continue // today may still be ahead
      else break
    }
    const done = range.dateKeys.filter((k) => state.get(k) === "done").length
    return { state, best, current, done }
  }, [reviewsInRange, range.dateKeys])

  const gratitudeWords = useMemo(() => {
    const texts: string[] = []
    for (const r of reviewsInRange) {
      texts.push(...(r.gratitude ?? []).filter(Boolean))
      texts.push(...(r.morning?.gratitude ?? []).filter(Boolean))
    }
    return { n: texts.length, words: topWords(texts, 36) }
  }, [reviewsInRange])

  // Why-it-didn't notes: tiles per reason token, filter by source, search.
  const [noteQuery, setNoteQuery] = useState("")
  const [noteSource, setNoteSource] = useState<MissReasonSource | null>(null)
  const [noteToken, setNoteToken] = useState<string | null>(null)
  const tokenTiles = useMemo(
    () =>
      corpus.tokenCounts.map((tc) => ({
        ...tc,
        color: REASON_COLOR[tc.id] ?? "#64748b",
        latest: corpus.notes.find((n) => n.token === tc.id && n.text.trim())?.text ?? "",
      })),
    [corpus],
  )
  const notes = useMemo(() => {
    const q = noteQuery.trim().toLowerCase()
    return corpus.notes.filter(
      (n) =>
        (!noteSource || n.source === noteSource) &&
        (!noteToken || n.token === noteToken) &&
        (!q || n.text.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q)),
    )
  }, [corpus.notes, noteQuery, noteSource, noteToken])
  const { shown: shownNotes, more: moreNotes } = useShowMore(notes, 12)
  const { shown: shownMornings, more: moreMornings } = useShowMore(morningDays, 5)

  return (
    <div className="an-canvas an-stack">
      {reviewsInRange.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={
            reviews.length === 0
              ? "No rituals saved yet. Use Rituals in the header, or text gm / gn / rituals to BIM."
              : `No rituals in the ${range.label}.`
          }
        />
      ) : (
        <>
          <p className="an-n">
            n = {reviewsInRange.length} review
            {reviewsInRange.length === 1 ? "" : "s"} in the {range.label}
            {morningDays.length > 0 ? ` · ${morningDays.length} morning` : ""}
          </p>

          <section className="an-plate" data-testid="ritual-strip">
            <CanvasTitle
              title="Ritual calendar"
              help="One square per day of the window, oldest first. Dark green = morning ritual finished, light green = started, blue = a day review without a morning ritual, grey = nothing saved."
            />
            <div className="an-readouts">
              <StudioReadout
                label="Mornings done"
                value={strip.done}
                note={`${round1((strip.done / Math.max(1, range.dateKeys.length)) * 100)}% of ${range.dateKeys.length} days`}
              />
              <StudioReadout label="Current run" value={strip.current} note="days in a row" />
              <StudioReadout label="Longest run" value={strip.best} note="in this window" />
            </div>
            <div
              className="an-strip"
              role="img"
              aria-label={`${strip.done} of ${range.dateKeys.length} days with a morning ritual`}
            >
              {range.dateKeys.map((k) => (
                <i
                  key={k}
                  data-state={strip.state.get(k) ?? "none"}
                  title={`${k} · ${strip.state.get(k) ?? "nothing saved"}`}
                />
              ))}
            </div>
          </section>

          {morningDays.length > 0 && (
            <Fold title="Morning rituals" count={morningDays.length} defaultOpen testId="morning-rituals">
              <p className="an-n">What you answered at the start of each day. Newest first; tap a day to open it.</p>
              {shownMornings.map((r, i) => (
                <Fold key={`morning-${r.id}`} title={`Morning · ${r.periodKey}`} defaultOpen={i === 0}>
                  <MorningBlock morning={r.morning!} taskTitle={taskTitle} habitTitle={habitTitle} />
                </Fold>
              ))}
              {moreMornings}
            </Fold>
          )}

          {gratitudeWords.words.length > 0 && (
            <section className="an-plate" data-testid="gratitude-words">
              <CanvasTitle
                title="What you're grateful for"
                help="Words from every gratitude line in the window (morning and period reviews). Bigger = said more often. Common filler words are dropped."
              />
              <WordTiles words={gratitudeWords.words} />
              <p className="an-n">
                n = {gratitudeWords.n} gratitude line
                {gratitudeWords.n === 1 ? "" : "s"}
              </p>
            </section>
          )}

          <PeriodArcReading reviews={reviewsInRange} />

          {reasons.slices.length > 0 && (
            <>
              <section className="an-plate">
                <CanvasTitle
                  title="Blocked reasons"
                  help="Area = how many items a ritual marked with that reason in the window."
                />
                <SliceMosaic slices={reasons.slices} max={reasons.max} />
                <p className="an-bx-legend">
                  {reasons.slices.map((sl) => (
                    <span key={sl.id}>
                      <i style={{ background: sl.color }} />
                      {sl.name} {sl.minutes}
                    </span>
                  ))}
                </p>
                <OpenInListsButton taskIds={reasons.taskIds} />
              </section>
            </>
          )}
          <Fold title="All reviews" count={reviewsInRange.length} defaultOpen={reviewsInRange.length <= 10}>
            {reviewsInRange
              .slice()
              .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
              .map((r) => {
                const open = openReviewId === r.id
                return (
                  <article key={r.id} className="an-review-card">
                    <header
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenReviewId(open ? null : r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setOpenReviewId(open ? null : r.id)
                        }
                      }}
                    >
                      <span aria-hidden>{open ? "▾" : "▸"}</span>
                      <span className="capitalize">{r.period === "quarter" ? "Season" : r.period}</span>
                      <span>· {r.period === "quarter" ? periodLabel("quarter", r.periodKey) : r.periodKey}</span>
                      <span className="an-n" style={{ marginLeft: "auto" }}>
                        {new Date(r.completedAt).toLocaleDateString()}
                      </span>
                    </header>
                    {open && (
                      <div className="an-review-body space-y-3">
                        {r.morning && (
                          <MorningBlock morning={r.morning} taskTitle={taskTitle} habitTitle={habitTitle} />
                        )}
                        {r.start && (
                          <div className="space-y-2 rounded-md border border-dashed p-3">
                            <p className="an-canvas-title" style={{ margin: 0 }}>
                              Start ritual
                              {r.start.completed === false ? <span className="an-n"> · in progress</span> : null}
                              {r.start.source === "telegram" ? (
                                <span className="an-n"> · from text pipeline (BIM)</span>
                              ) : r.start.source === "desktop" ? (
                                <span className="an-n"> · desktop</span>
                              ) : null}
                            </p>
                            {r.start.priorities && (
                              <p>
                                <strong>Priorities</strong> — {r.start.priorities}
                              </p>
                            )}
                            {r.start.mustDo && (
                              <p>
                                <strong>Must do</strong> — {r.start.mustDo}
                              </p>
                            )}
                            {r.start.summary && (
                              <p>
                                <strong>Intentions</strong> — {r.start.summary}
                              </p>
                            )}
                            {r.start.nextPlans && (
                              <p>
                                <strong>Plan</strong> — {r.start.nextPlans}
                              </p>
                            )}
                          </div>
                        )}
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
          </Fold>
        </>
      )}
      {corpus.notes.length > 0 && (
        <>
          <p className="an-canvas-title">Why it didn&apos;t get done</p>
          <p className="an-n" data-testid="miss-reason-counts">
            {corpus.sourceCounts.map((source) => `${source.label} ${source.count}`).join(" · ")}
            {corpus.tokenCounts.length > 0
              ? ` · ${corpus.tokenCounts.map((token) => `${token.label} ${token.count}`).join(" · ")}`
              : ""}
          </p>
          {tokenTiles.length > 0 && (
            <div className="an-tiles" data-testid="miss-reason-tiles">
              {tokenTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="an-tile"
                  style={{ ["--tile" as string]: tile.color }}
                  aria-pressed={noteToken === tile.id}
                  onClick={() => setNoteToken(noteToken === tile.id ? null : tile.id)}
                >
                  <span className="an-tile-count">{tile.count}</span>
                  <span>{tile.label}</span>
                  {tile.latest && tile.latest.trim().toLowerCase() !== tile.label.toLowerCase() ? (
                    <span className="an-tile-quote">“{tile.latest}”</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
          <div className="an-bx-tools">
            <SearchField value={noteQuery} onChange={setNoteQuery} placeholder="Words in the note…" />
            <ChipFilter
              options={corpus.sourceCounts.map((sc) => ({
                id: sc.id,
                label: sc.label,
                count: sc.count,
              }))}
              value={noteSource}
              onChange={setNoteSource}
            />
          </div>
          <ul data-testid="miss-reason-corpus" className="an-list">
            {shownNotes.map((note) => (
              <li key={note.id} className="an-list-row" style={{ cursor: "default" }}>
                <span>
                  <strong>{note.subject}</strong> · {note.text}
                </span>
                <span className="an-n" style={{ whiteSpace: "nowrap" }}>
                  {MISS_SOURCE_LABEL[note.source]} · {note.date}
                </span>
              </li>
            ))}
          </ul>
          {notes.length === 0 && <p className="an-canvas-hint">No note matches.</p>}
          {moreNotes}
        </>
      )}
    </div>
  )
}
