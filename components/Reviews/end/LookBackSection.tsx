/**
 * components/Reviews/LookBackSection.tsx — End ritual: the plan beside the period
 *
 * Read-only. Night shows that morning's answers (day plan, must-do, required
 * and priority tasks with whether they got done, best day). Week to year show
 * that period's Start ritual (priorities, must-do, intentions, plan). Below,
 * what happened to the unfinished list in this ritual. One note
 * (`PeriodReview.lookBack`) holds the reflection on the gap.
 */
"use client"

import { Textarea } from "@/components/ui/textarea"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import type { PeriodReview, ReviewPeriod } from "@/lib/types"

type Counts = { done: number; pushed: number; missed: number; open: number }

function Block({ label, text }: { label: string; text?: string | null }) {
  if (!text?.trim()) return null
  return (
    <div className="lb-block">
      <span className="mr-carry-label">{label}</span>
      <p className="lb-text">{text.trim()}</p>
    </div>
  )
}

export function LookBackSection({
  period,
  review,
  counts,
  note,
  onNote,
}: {
  period: ReviewPeriod
  review: PeriodReview | undefined
  counts: Counts
  note: string
  onNote: (value: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const morning = period === "day" ? review?.morning : undefined
  const start = period !== "day" ? review?.start : undefined
  const marked = [
    ...(morning?.requiredTaskIds ?? []).map((id) => ({ id, kind: "Required" })),
    ...(morning?.priorityTaskIds ?? [])
      .filter((id) => !morning?.requiredTaskIds?.includes(id))
      .map((id) => ({ id, kind: "Priority" })),
  ]
    .map((row) => ({ ...row, task: tasks.find((t) => t.id === row.id) }))
    .filter((row) => row.task)
  const hasPlan = !!(morning || start)
  const unit = period === "day" ? "morning" : `${period === "quarter" ? "season" : period} start`

  return (
    <section className="space-y-3">
      <p className="mr-lede">What you meant to do, beside what happened. Look while it is fresh.</p>
      {hasPlan ? (
        <div className="lb-grid">
          <Block label="Day plan" text={morning?.dayPlanText} />
          <Block label="Must do" text={morning?.mustDo ?? start?.mustDo} />
          <Block label="Intentions" text={morning?.intentions?.filter(Boolean).join("\n") || start?.summary} />
          <Block label="Priorities" text={start?.priorities} />
          <Block label="Plan" text={start?.nextPlans} />
          <Block label="Best day ever" text={morning?.bestDayWhy} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No {unit} ritual was saved for this {period}.</p>
      )}
      {marked.length > 0 ? (
        <ul className="lb-marks">
          {marked.map(({ id, kind, task }) => (
            <li key={id} data-done={task!.completed ? "true" : undefined}>
              <span className="lb-mark">{task!.completed ? "✓" : "·"}</span>
              <span className="lb-mark-title">{itemTitle(task!)}</span>
              <span className="lb-mark-kind">{kind}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="lb-tally" aria-label="Unfinished list in this ritual">
        <span><b>{counts.done}</b> done</span>
        <span><b>{counts.pushed}</b> pushed</span>
        <span><b>{counts.missed}</b> missed</span>
        <span><b>{counts.open}</b> still open</span>
      </div>
      <Textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={3}
        aria-label="Looking back"
        placeholder="Where did the plan and the day part ways, and why?"
      />
    </section>
  )
}
