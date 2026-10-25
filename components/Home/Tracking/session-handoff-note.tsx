/**
 * components/Home/Tracking/session-handoff-note.tsx
 *
 * What the last session left for this task or pen, shown when that work is
 * on the clock again. The handoff is the pass-on line. The review is the
 * saved end-of-session reflection (satisfaction, energy, blocker, note).
 * Dismiss puts the handoff away. The review stays; it is the record.
 */
"use client"

import { handoffsFor, latestReviewFor, useSessionDebriefStore, type SittingReview } from "@/lib/session-debrief-store"
import "./session-debrief.css"

const SATISFACTION = ["", "Little", "Some", "Enough", "Good", "Full"]
const ENERGY: Record<SittingReview["energy"] & string, string> = {
  low: "Low",
  steady: "Steady",
  high: "High",
}

function reviewLine(review: SittingReview): string {
  const bits: string[] = []
  if (review.satisfaction && review.satisfaction >= 1 && review.satisfaction <= 5) {
    bits.push(SATISFACTION[review.satisfaction])
  }
  if (review.energy) bits.push(ENERGY[review.energy])
  if (review.blocker) bits.push(review.blocker)
  if (review.note) bits.push(review.note)
  return bits.join(" · ")
}

export function SessionHandoffNote({ taskId, penId }: { taskId?: string; penId?: string }) {
  const handoffs = useSessionDebriefStore((state) => state.handoffs)
  const reviews = useSessionDebriefStore((state) => state.reviews)
  const dismissHandoff = useSessionDebriefStore((state) => state.dismissHandoff)
  const notes = handoffsFor(handoffs, { taskId, penId })
  const review = latestReviewFor(reviews, { taskId })
  const reflection = review ? reviewLine(review) : ""
  if (!notes.length && !reflection) return null
  return (
    <>
      {reflection ? (
        <p className="trk-handoff" role="note">
          <span className="trk-handoff-k">Last session</span>
          <span className="trk-handoff-text">{reflection}</span>
        </p>
      ) : null}
      {notes.map((note) => (
        <p key={note.id} className="trk-handoff" role="note">
          <span className="trk-handoff-k">From last time</span>
          <span className="trk-handoff-text">{note.text}</span>
          <button type="button" className="trk-handoff-x" aria-label="Dismiss note from last time" onClick={() => dismissHandoff(note.id)}>
            ×
          </button>
        </p>
      ))}
    </>
  )
}
