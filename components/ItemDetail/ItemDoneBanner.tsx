/**
 * components/ItemDetail/ItemDoneBanner.tsx — A finished task says so, loudly
 *
 * Shown on a task that is marked completed. Names the day it was finished and
 * offers **Mark incomplete**, which reopens the item and changes nothing else
 * (`withCompleted(task, false)`: status back to active, steps, notes and time
 * stay). Shared by the popup and the page.
 */
"use client"

import { CheckCircle2, Undo2 } from "lucide-react"
import { getTaskCompletionDate } from "@/lib/completion-status"
import { REFLECTION_SCALES } from "@/lib/completion-review"
import type { Task } from "@/lib/types"

export function ItemDoneBanner({ task, onReopen, onEditReview }: { task: Task; onReopen: () => void; onEditReview?: () => void }) {
  if (!task.completed) return null
  const done = getTaskCompletionDate(task)
  const day = done?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  const review = task.completionReview as unknown as Record<string, unknown> | undefined
  const answers = REFLECTION_SCALES.filter((scale) => typeof review?.[scale.key] === "number")
  const notes = typeof review?.notes === "string" ? review.notes.trim() : ""
  return (
    <div className="id-done-wrap">
    <div className="id-done-banner" role="status" data-testid="item-done-banner">
      <CheckCircle2 className="id-done-mark" aria-hidden />
      <div className="id-done-text">
        <strong>Marked complete</strong>
        <span>{day ? `Finished ${day}. ` : ""}Nothing else was changed or removed.</span>
      </div>
      {onEditReview ? (
        <button type="button" className="id-done-undo" onClick={onEditReview} data-testid="edit-completion-review">
          {review ? "View / edit review" : "Fill in review"}
        </button>
      ) : null}
      <button type="button" className="id-done-undo" onClick={onReopen} title="Undo Complete and keep everything else">
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        Mark incomplete
      </button>
    </div>
    {answers.length || notes ? (
      <dl className="id-done-review" aria-label="Completion review answers">
        {answers.map((scale) => (
          <div key={scale.key}>
            <dt>{scale.label}</dt>
            <dd>{String(review?.[scale.key])}/10</dd>
          </div>
        ))}
        {notes ? (
          <div className="id-done-review-notes">
            <dt>Notes</dt>
            <dd>{notes}</dd>
          </div>
        ) : null}
      </dl>
    ) : null}
    </div>
  )
}
