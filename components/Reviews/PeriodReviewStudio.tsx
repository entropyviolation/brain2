/**
 * components/Reviews/PeriodReviewStudio.tsx — Stats, then reflection
 *
 * Week, month, season, and year. The night ritual does not use this.
 * Numbers come from the same habit, points, and tracking summaries as the
 * rest of the app. The questions are optional and live on `review.arc`.
 */
"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAttachmentSrc } from "@/hooks/use-attachment-src"
import { arcPrompts, type ArcPrompt } from "@/lib/period-arc"
import { buildPeriodRitualStats, type RitualStats } from "@/lib/period-ritual-stats"
import { useHabitsStore } from "@/lib/habits-store"
import { resolveCompletionPoints } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { formatDuration } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { FileValue, PeriodArcReflection, ReviewPeriod } from "@/lib/types"

function deltaPhrase(delta: number, unit = ""): string {
  const rounded = Math.round(delta * 10) / 10
  if (rounded > 0) return `up ${rounded}${unit}`
  if (rounded < 0) return `down ${Math.abs(rounded)}${unit}`
  return "same as last period"
}

function InspirationPhoto({ photo, onRemove }: { photo: FileValue; onRemove: () => void }) {
  const src = useAttachmentSrc(photo.uri)
  return (
    <figure className="space-y-1">
      {src ? (
        <img src={src} alt={photo.name || "Inspiration"} className="h-24 w-24 object-cover border" />
      ) : (
        <div className="h-24 w-24 border bg-muted" />
      )}
      <button type="button" className="text-xs underline" onClick={onRemove}>
        Remove
      </button>
    </figure>
  )
}

function ArcFields({
  period,
  arc,
  onArc,
}: {
  period: ReviewPeriod
  arc: PeriodArcReflection
  onArc: (next: PeriodArcReflection) => void
}) {
  const prompts = arcPrompts(period)
  const setText = (id: keyof PeriodArcReflection, value: string) => onArc({ ...arc, [id]: value })

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const { fileToFileValue } = await import("@/components/Lists/attributes/helpers")
    const added = await Promise.all([...files].filter((file) => file.type.startsWith("image/")).map(fileToFileValue))
    onArc({ ...arc, inspiredPhotos: [...(arc.inspiredPhotos ?? []), ...added] })
  }

  let lastGroup = ""
  return (
    <div className="space-y-4">
      {prompts.map((prompt) => {
        const showGroup = prompt.group !== lastGroup
        lastGroup = prompt.group
        return (
          <div key={prompt.sectionId} className="space-y-1">
            {showGroup && (
              <h3 className="font-semibold text-sm pt-2">
                {prompt.group === "Also" ? "Also" : prompt.group}
              </h3>
            )}
            <PromptField prompt={prompt} arc={arc} onText={setText} />
            {prompt.photos && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(arc.inspiredPhotos ?? []).map((photo) => (
                    <InspirationPhoto
                      key={photo.id}
                      photo={photo}
                      onRemove={() =>
                        onArc({
                          ...arc,
                          inspiredPhotos: (arc.inspiredPhotos ?? []).filter((item) => item.id !== photo.id),
                        })
                      }
                    />
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="text-xs"
                  aria-label="Add inspiration photos"
                  onChange={(event) => {
                    void addPhotos(event.target.files)
                    event.target.value = ""
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PromptField({
  prompt,
  arc,
  onText,
}: {
  prompt: ArcPrompt
  arc: PeriodArcReflection
  onText: (id: keyof PeriodArcReflection, value: string) => void
}) {
  const value = typeof arc[prompt.id] === "string" ? (arc[prompt.id] as string) : ""
  return (
    <div className="space-y-1">
      <Label className="text-sm">{prompt.label}</Label>
      <p className="text-sm text-muted-foreground">{prompt.question}</p>
      <Textarea
        value={value}
        rows={2}
        aria-label={prompt.question}
        onChange={(event) => onText(prompt.id, event.target.value)}
      />
      {prompt.reframe && (
        <>
          <p className="text-sm text-muted-foreground">{prompt.reframe.question}</p>
          <Textarea
            value={arc.fearReframe ?? ""}
            rows={2}
            aria-label={prompt.reframe.question}
            onChange={(event) => onText("fearReframe", event.target.value)}
          />
        </>
      )}
    </div>
  )
}

function StatsBlock({ stats }: { stats: RitualStats }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-semibold">Biggest points missed</p>
        {stats.missed.length === 0 ? (
          <p className="text-muted-foreground">Nothing scored and left undone in this period.</p>
        ) : (
          <ul className="space-y-0.5">
            {stats.missed.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                {row.title} · {row.points} pts · {row.kind}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p>
        <span className="font-semibold">Points </span>
        {stats.points.current} this period, {stats.points.previous} last period · {deltaPhrase(stats.points.delta)}
      </p>
      <div>
        <p>
          <span className="font-semibold">{stats.habitGrade.label} </span>
          {Math.round(stats.habitGrade.current)}% vs {Math.round(stats.habitGrade.previous)}% last period ·{" "}
          {deltaPhrase(stats.habitGrade.delta)}
        </p>
        {stats.habitGrade.parts.length > 0 && (
          <ul className="text-muted-foreground">
            {stats.habitGrade.partsLabel && <li className="font-medium">{stats.habitGrade.partsLabel}</li>}
            {stats.habitGrade.parts.map((part) => (
              <li key={part.label}>
                {part.label} · {Math.round(part.grade)}%
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-semibold">Daily habits not done once</p>
        {stats.habitsNever.length === 0 ? (
          <p className="text-muted-foreground">Every daily habit was touched at least once.</p>
        ) : (
          <ul>
            {stats.habitsNever.map((habit) => (
              <li key={habit.id}>{habit.name}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <p className="font-semibold">Where the time went</p>
        {stats.tracking.length === 0 ? (
          <p className="text-muted-foreground">No tracked time in this period.</p>
        ) : (
          stats.tracking.map((scope) => (
            <div key={scope.scopeId}>
              <p className="text-muted-foreground">{scope.scopeName}</p>
              <ul>
                {scope.rows.map((row) => (
                  <li key={row.name} className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: row.color }} />
                    <span>
                      {row.name} · {formatDuration(row.minutes)} · {row.share}%
                      {row.previousMinutes
                        ? ` · last period ${formatDuration(row.previousMinutes)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function PeriodReviewStudio({
  period,
  periodKey,
  arc,
  onArc,
}: {
  period: ReviewPeriod
  periodKey: string
  arc: PeriodArcReflection
  onArc: (next: PeriodArcReflection) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const tolerance = useHabitsStore((s) => s.gradeTolerance)
  const points = usePointsStore((s) => s.pointsHistory)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)

  const stats = useMemo(() => {
    if (period === "day") return null
    return buildPeriodRitualStats({
      period,
      periodKey,
      now: new Date(),
      tasks,
      lists,
      folders,
      habits,
      weeklyData,
      points,
      entries,
      scopes,
      tolerance,
      pointsForTask: (task) => resolveCompletionPoints(task, lists, folders),
    })
  }, [period, periodKey, tasks, lists, folders, habits, weeklyData, points, entries, scopes, tolerance])

  if (period === "day" || !stats) return null

  return (
    <section className="space-y-4" data-ui-name="Period ritual studio">
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">This period</h3>
        <StatsBlock stats={stats} />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Reflection</h3>
        <p className="text-sm text-muted-foreground">Optional. Leave any of these blank.</p>
        <ArcFields period={period} arc={arc} onArc={onArc} />
      </div>
    </section>
  )
}
