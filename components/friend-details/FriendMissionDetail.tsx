/**
 * components/friend-details/FriendMissionDetail.tsx — Mission detail card
 *
 * Sits over the instrument. The journal and today’s strip both open it.
 * The task opens item detail on top. Accept, and the smaller-task walk,
 * live here.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { friendSourceLabel } from "@/lib/friend-copy"
import {
  friendMissionItemId,
  friendMissionLogSentence,
  friendMissionStatusLabel,
  isActionableFriendKind,
  type FriendMission,
} from "@/lib/friend-mission"
import { ensureFriendFirstStep, splitFriendTask } from "@/lib/friend-mission-steps"
import { formatCountdown, formatExactTime, formatRelativeTime, journalLogEntries } from "@/lib/friend-stats"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"

type Ladder = "offer" | "smaller" | "first" | "why"

export function FriendMissionDetail({
  mission,
  friendName,
  now,
  onClose,
  onCoverChange,
}: {
  mission: FriendMission
  friendName: string
  now: Date
  onClose: () => void
  onCoverChange?: (open: boolean) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Ladder>("offer")
  const [why, setWhy] = useState("")
  const [note, setNote] = useState("")
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const notes = journalLogEntries(mission)
  const due = mission.status === "accepted" ? formatCountdown(mission.deadline, now) : ""
  const itemId = friendMissionItemId(mission.taskId)
  const actionable = isActionableFriendKind(mission.kind) && Boolean(mission.taskId)
  const title = mission.stepTitle || mission.title

  useEffect(() => {
    setPhase("offer")
    setWhy("")
    setNote("")
    setOpenItemId(null)
  }, [mission.id, mission.status])

  useEffect(() => {
    onCoverChange?.(!!openItemId)
    return () => onCoverChange?.(false)
  }, [openItemId, onCoverChange])

  useEffect(() => {
    if (!openItemId) closeRef.current?.focus()
  }, [mission.id, openItemId])

  const accept = (step?: { stepId: string; stepTitle: string }) => {
    useBabyAnimalsStore.getState().acceptMission(mission.taskId, step)
    setPhase("offer")
  }

  return (
    <div className="friend-mission-pop" role="dialog" aria-modal="true" aria-labelledby="friend-mission-pop-title">
      <p className="friend-mission-pop-kicker">
        {friendMissionStatusLabel(mission.status)}
        {mission.source ? ` · ${friendSourceLabel(mission.source)}` : ""}
      </p>
      <h3 id="friend-mission-pop-title">Mission from {friendName}</h3>
      {itemId ? (
        <button type="button" className="friend-mission-pop-task" aria-label={`Open ${mission.title}`} onClick={() => setOpenItemId(itemId)}>
          {title}
        </button>
      ) : (
        <p>{title}</p>
      )}
      {mission.line && mission.line !== mission.title ? <p>{mission.line}</p> : null}
      {mission.blurb ? <p>{mission.blurb}</p> : null}
      {due ? <p>Due {due}</p> : null}
      {note ? <p>{note}</p> : null}
      {mission.status === "done" ? <p>Friend points +{mission.points}</p> : null}
      {mission.declineReason ? <p>{mission.declineReason}</p> : null}

      {mission.status === "offered" && actionable && phase === "offer" ? (
        <div className="friend-mission-actions">
          <button type="button" className="friend-key is-on" onClick={() => accept()}>
            Accept
          </button>
          <button type="button" className="friend-key" onClick={() => setPhase("smaller")}>
            Something smaller
          </button>
        </div>
      ) : null}

      {phase === "smaller" ? (
        <div className="friend-mission-actions">
          <p>Break this into smaller tasks?</p>
          <button
            type="button"
            className="friend-key is-on"
            onClick={() => {
              const lines = splitFriendTask(mission.taskId, mission.title)
              const detail = lines.length ? lines.join(" · ") : "Already one small step."
              useBabyAnimalsStore.getState().noteMission(mission.taskId, "breakdown-yes", detail)
              setNote(lines.length ? `Smaller tasks: ${detail}` : "This one is already a single small step.")
              setPhase("offer")
            }}
          >
            Yes, smaller
          </button>
          <button
            type="button"
            className="friend-key"
            onClick={() => {
              useBabyAnimalsStore.getState().noteMission(mission.taskId, "breakdown-no")
              setPhase("first")
            }}
          >
            Keep it whole
          </button>
        </div>
      ) : null}

      {phase === "first" ? (
        <div className="friend-mission-actions">
          <p>Just the first step?</p>
          <button
            type="button"
            className="friend-key is-on"
            onClick={() => {
              const step = ensureFriendFirstStep(mission.taskId, mission.title)
              useBabyAnimalsStore.getState().noteMission(mission.taskId, "first-step-yes", step?.stepTitle ?? mission.title)
              accept(step ?? undefined)
            }}
          >
            Yes, the first step
          </button>
          <button
            type="button"
            className="friend-key"
            onClick={() => {
              useBabyAnimalsStore.getState().noteMission(mission.taskId, "first-step-no")
              setPhase("why")
            }}
          >
            Not even that
          </button>
        </div>
      ) : null}

      {phase === "why" ? (
        <form
          className="friend-mission-actions"
          onSubmit={(event) => {
            event.preventDefault()
            const reason = why.trim()
            if (!reason) return
            useBabyAnimalsStore.getState().declineMission(mission.taskId, reason)
            onClose()
          }}
        >
          <label htmlFor="friend-mission-pop-why">Why decline?</label>
          <input
            id="friend-mission-pop-why"
            className="friend-bead-input"
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            required
          />
          <button type="submit" className="friend-key" disabled={!why.trim()}>
            Decline
          </button>
        </form>
      ) : null}

      {mission.status === "accepted" && mission.kind === "whim" ? (
        <div className="friend-mission-actions">
          <button type="button" className="friend-key is-on" onClick={() => useBabyAnimalsStore.getState().completeMission(mission.taskId)}>
            I did it
          </button>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <ol>
          {notes.map((entry, index) => (
            <li key={`${mission.id}-${index}`}>
              <span>{friendMissionLogSentence(entry)}</span>
              <time dateTime={entry.at} title={formatExactTime(entry.at)}>
                {formatRelativeTime(entry.at, now)}
              </time>
            </li>
          ))}
        </ol>
      ) : null}
      <button ref={closeRef} type="button" className="friend-key" onClick={onClose}>
        Close mission
      </button>
      <TaskDetailPopup taskId={openItemId} open={!!openItemId} onClose={() => setOpenItemId(null)} stackAbove />
    </div>
  )
}
