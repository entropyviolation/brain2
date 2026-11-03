"use client"

/**
 * Fascia keys: Session (live countdown), Sessions, and Pick list.
 */
import { liveSession, useSessionPlanStore } from "@/lib/session-plan-store"
import { allLines, remainingSec } from "@/lib/session-plan"
import { fmtClock } from "./format"
import { useNow } from "./use-now"

/** The fascia key: "Session", or the live countdown while one runs. Ticks on its own so the panel does not. */

export function SessionKey({ onOpen }: { onOpen: () => void }) {
  const open = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const live = liveSession(open)
  const running = live?.phase === "run"
  const parked = open.filter((p) => p.phase === "parked").length
  const now = useNow(running)
  const shown = open.find((p) => p.id === focusId)
  const label = live
    ? live.phase === "run"
      ? `Session ${fmtClock(remainingSec(live, now))}`
      : "Review session"
    : shown?.phase === "draft" && allLines(shown).length
      ? "Session (draft)"
      : "Session"
  return (
    <button
      type="button"
      className={`todo-btn todo-session-key${running ? " is-running" : ""}`}
      title="Plan a time box in three tiers and work through it"
      onClick={onOpen}
    >
      {label}
      {parked ? (
        <span className="todo-session-parkcount" aria-label={`${parked} parked`}>
          {" "}⏸{parked}
        </span>
      ) : null}
    </button>
  )
}

/** The fascia key for the Sessions history panel (Drafts / Parked / Done). */
export function SessionsKey({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="todo-btn todo-sessions-key" title="Drafts, parked and done sessions" onClick={onOpen}>
      Sessions
    </button>
  )
}

/** The fascia key for the flat pick list: every open step, no session made until asked. */
export function PickListKey({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="todo-btn todo-picklist-key" title="Every open step in one flat list" onClick={onOpen}>
      Pick list
    </button>
  )
}
