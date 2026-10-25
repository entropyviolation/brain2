/**
 * components/Home/Tracking/session-handoff-note.tsx
 *
 * The note left at the end of the last sitting, shown when that task or pen
 * is on the clock again. Dismiss puts it away.
 */
"use client"

import { handoffsFor, useSessionDebriefStore } from "@/lib/session-debrief-store"
import "./session-debrief.css"

export function SessionHandoffNote({ taskId, penId }: { taskId?: string; penId?: string }) {
  const handoffs = useSessionDebriefStore((state) => state.handoffs)
  const dismissHandoff = useSessionDebriefStore((state) => state.dismissHandoff)
  const notes = handoffsFor(handoffs, { taskId, penId })
  if (!notes.length) return null
  return (
    <>
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
