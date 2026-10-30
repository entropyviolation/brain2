/**
 * components/friend-mission-sheet.tsx — Mission from today's friend
 *
 * The task row opens item detail over this sheet (the sheet drops its modal
 * lock so the item popup can cover the page). That popup loads through
 * `components/friend-details/use-item-detail-popup.ts` when an item id is
 * opened, so a refresh does not parse the item-detail module with this sheet. Accept starts a same-day point window. Decline asks to break the
 * task down, then to do only the first step, then for a written reason.
 * Each answer is logged on the mission.
 */
"use client"

import { useEffect, useState } from "react"
import { useItemDetailPopup } from "@/components/friend-details/use-item-detail-popup"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FriendNudge } from "@/lib/baby-animal-nudge"
import type { FriendMission } from "@/lib/friend-mission"
import { friendMissionItemId, isActionableFriendKind } from "@/lib/friend-mission"
import { ensureFriendFirstStep, splitFriendTask } from "@/lib/friend-mission-steps"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"

type Phase = "offer" | "breakdown" | "first" | "why" | "accepted"

export function FriendMissionSheet({
  open,
  nudge,
  friendName,
  onOpenChange,
  onFinished,
}: {
  open: boolean
  nudge: FriendNudge | null
  friendName: string
  onOpenChange: (open: boolean) => void
  /** Close the sheet. Pass the finished mission when this click completed it. */
  onFinished: (done: FriendMission | null) => void
}) {
  const missions = useBabyAnimalsStore((s) => s.friendMissions)
  const [phase, setPhase] = useState<Phase>("offer")
  const [splitNote, setSplitNote] = useState("")
  const [why, setWhy] = useState("")
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const ItemPopup = useItemDetailPopup(openItemId)

  const taskKey = nudge?.taskId ?? ""
  const stored = missions.find((row) => row.taskId === taskKey && (row.status === "offered" || row.status === "accepted"))

  useEffect(() => {
    setWhy("")
    setSplitNote("")
    setOpenItemId(null)
    setPhase(stored?.status === "accepted" ? "accepted" : "offer")
  }, [taskKey, open, stored?.status])

  if (!nudge) return null

  const who = friendName.trim() || "your friend"
  const itemId = friendMissionItemId(nudge.taskId)
  const actionable = isActionableFriendKind(nudge.kind)
  const holdOutside = (event: Event) => {
    if (openItemId) event.preventDefault()
  }

  const accept = (step?: { stepId: string; stepTitle: string }) => {
    useBabyAnimalsStore.getState().acceptMission(nudge.taskId, step)
    setPhase("accepted")
  }

  return (
    <Dialog open={open} modal={!openItemId} onOpenChange={onOpenChange}>
      <DialogContent
        className="baby-friend-mission fm98-dialog max-w-none gap-0 p-0"
        hideClose
        onPointerDownOutside={holdOutside}
        onInteractOutside={holdOutside}
        onEscapeKeyDown={holdOutside}
      >
        <div className="baby-friend-mission-body">
          <DialogHeader className="baby-friend-mission-head">
            <DialogTitle className="baby-friend-mission-title">
              {actionable ? `Mission from ${who}:` : `${who} says:`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {actionable
                ? `${nudge.title}. Accept to earn friend points by the end of today, or decline.`
                : nudge.line || nudge.title}
            </DialogDescription>
          </DialogHeader>
          {nudge.line ? <p className="baby-friend-mission-said">{nudge.line}</p> : null}
          {phase === "offer" && actionable ? (
            itemId ? (
              <button
                type="button"
                className="baby-friend-mission-task"
                data-no95=""
                aria-label={`Open ${nudge.title}`}
                onClick={() => setOpenItemId(itemId)}
              >
                <span className="baby-friend-mission-task-title">{splitNote || nudge.title}</span>
              </button>
            ) : (
              <p className="baby-friend-mission-ask">{splitNote || nudge.title}</p>
            )
          ) : null}
          {phase === "breakdown" ? (
            <p className="baby-friend-mission-ask">{who} tilts their head. Want me to break this into smaller tasks?</p>
          ) : null}
          {phase === "first" ? <p className="baby-friend-mission-ask">Just the first step, then?</p> : null}
          {phase === "why" ? (
            <label className="baby-friend-mission-ask" htmlFor="friend-decline-why">
              {who} nods. Why are you declining?
            </label>
          ) : null}
          {phase === "accepted" ? (
            <p className="baby-friend-mission-ask">
              Accepted. You have until the end of today. Finish it and {who} will share the friend points.
              {stored?.stepTitle ? ` Today’s piece: ${stored.stepTitle}.` : ""}
            </p>
          ) : null}
          {phase === "why" ? (
            <textarea
              id="friend-decline-why"
              form="friend-decline-form"
              className="fm-input baby-friend-decline-why"
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              rows={3}
              required
            />
          ) : null}
        </div>
        <div className="baby-friend-mission-foot">
          {phase === "offer" && actionable ? (
            <>
              <div className="baby-friend-mission-actions">
                <button type="button" className="friend-key is-on" data-no95="" onClick={() => accept()}>
                  Accept mission
                </button>
                <button type="button" className="friend-key" data-no95="" onClick={() => setPhase("breakdown")}>
                  Decline mission
                </button>
              </div>
              <p className="baby-friend-mission-pay">
                {nudge.rewardPoints
                  ? `${nudge.rewardPoints} friend points if you accept and finish before the end of today.`
                  : "Accept and finish before the end of today."}
              </p>
            </>
          ) : null}
          {phase === "breakdown" ? (
            <div className="baby-friend-mission-actions">
              <button
                type="button"
                className="friend-key is-on"
                data-no95=""
                onClick={() => {
                  const lines = splitFriendTask(nudge.taskId, nudge.title)
                  const detail = lines.length ? lines.join(" · ") : "Already one small step."
                  useBabyAnimalsStore.getState().noteMission(nudge.taskId, "breakdown-yes", detail)
                  setSplitNote(lines.length ? `Smaller tasks: ${detail}` : `${who} looks it over. This one is already a single small step.`)
                  setPhase("offer")
                }}
              >
                Yes, break it down
              </button>
              <button
                type="button"
                className="friend-key"
                data-no95=""
                onClick={() => {
                  useBabyAnimalsStore.getState().noteMission(nudge.taskId, "breakdown-no")
                  setPhase("first")
                }}
              >
                No, keep it whole
              </button>
            </div>
          ) : null}
          {phase === "first" ? (
            <div className="baby-friend-mission-actions">
              <button
                type="button"
                className="friend-key is-on"
                data-no95=""
                onClick={() => {
                  const step = ensureFriendFirstStep(nudge.taskId, nudge.title)
                  useBabyAnimalsStore.getState().noteMission(
                    nudge.taskId,
                    "first-step-yes",
                    step?.stepTitle ?? nudge.title,
                  )
                  accept(step ?? undefined)
                }}
              >
                Yes, just the first step
              </button>
              <button
                type="button"
                className="friend-key"
                data-no95=""
                onClick={() => {
                  useBabyAnimalsStore.getState().noteMission(nudge.taskId, "first-step-no")
                  setPhase("why")
                }}
              >
                No, not even that
              </button>
            </div>
          ) : null}
          {phase === "why" ? (
            <form
              id="friend-decline-form"
              className="baby-friend-mission-actions is-one"
              onSubmit={(event) => {
                event.preventDefault()
                const reason = why.trim()
                if (!reason) return
                useBabyAnimalsStore.getState().declineMission(nudge.taskId, reason)
                onFinished(null)
              }}
            >
              <button type="submit" className="friend-key" data-no95="" disabled={!why.trim()}>
                Decline
              </button>
            </form>
          ) : null}
          {phase === "accepted" ? (
            <div className={`baby-friend-mission-actions${nudge.kind === "whim" ? "" : " is-one"}`}>
              {nudge.kind === "whim" ? (
                <button
                  type="button"
                  className="friend-key is-on"
                  data-no95=""
                  onClick={() => {
                    const done = useBabyAnimalsStore.getState().completeMission(nudge.taskId)
                    if (done) onFinished(done)
                  }}
                >
                  I did it
                </button>
              ) : null}
              <button type="button" className="friend-key" data-no95="" onClick={() => onOpenChange(false)}>
                Close
              </button>
            </div>
          ) : null}
          {!actionable ? (
            <div className="baby-friend-mission-actions is-one">
              <button type="button" className="friend-key" data-no95="" onClick={() => onOpenChange(false)}>
                Close
              </button>
            </div>
          ) : null}
        </div>
        {ItemPopup ? (
          <ItemPopup
            taskId={openItemId}
            open={!!openItemId}
            onClose={() => setOpenItemId(null)}
            stackAbove
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
