/**
 * session-planner/dialog.tsx — the Session popup body. `SessionPlanner.tsx` re-exports it.
 *
 * components/Home/ToDo/SessionPlanner.tsx — Plan a session, run it, review it
 *
 * One popup (`data-ui-name="Session"`) over `lib/session-plan.ts`:
 * - **Draft** (redesign 2026-10-22): a pick list of every open task and step (this period, or
 *   all open) with Min / Goal / Exc keys, a typed length tube, one fit bar
 *   that B, G and E fill in turn, and three tier wells of tiles you drag.
 *   Bare minimum must be estimated before Start.
 *   **Break down** opens the lid's steps editor for a task in place.
 * - **Run** (redesign 2026-10-22): a big countdown, the line you are on, then
 *   every line in its tier with Est and Actual side by side. ▶ on any line,
 *   or **Random task** / **Next shortest task** to be offered one. ⏸ holds the
 *   clock, ■ lets go of the line, Done ticks it. Optionally the Tracking pen
 *   clock on the current step.
 * - **Review**: estimate vs actual per line, the tier reached and its points,
 *   and what to do with each unfinished line (keep for next session, push,
 *   leave). Save writes a Plan block for the session and files it in history.
 * - **Park** (slice H): the run view's Park key, or **Park** when closing a
 *   running session, puts it down with its line and time left. Starting or
 *   resuming another parks the running one. **Sessions** (caption and fascia)
 *   opens the shelves: Drafts, Parked, Done; a done one opens read-only and
 *   offers **Run again**.
 * - **Slice H2**: templates (built-in Just 25, Morning 90m, Evening 3h, and
 *   **Save as template**), the `"timebox"` shape, break lines, a note to
 *   tomorrow-you at Park and End, a Hofstadter mark on each gauge, the
 *   Bare-minimum floor suggestion, and the flat **Pick list** view
 *   (`startOn="list"`). Requests from outside To Do come through
 *   `lib/session-open-store.ts` and `SessionDock.tsx`.
 */

"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { liveSession, useSessionPlanStore } from "@/lib/session-plan-store"
import type { SessionOpenRequest } from "@/lib/session-open-store"
import { parkSession, runAgain, type SessionPlan } from "@/lib/session-plan"
import { DoneView } from "./done-view"
import { DraftView } from "./draft-view"
import { newDraft, newDraftFrom, putSession } from "./drafts"
import { FlatListView } from "./flat-list-view"
import { FutureNoteInput } from "./future-note"
import { ParkedView } from "./parked-view"
import { ReviewView } from "./review-view"
import { RunView } from "./run-view"
import { ShelvesView } from "./shelves-view"

export function SessionPlanner({
  open,
  onClose,
  periodTasks,
  periodLabel,
  startOn = "session",
  request,
}: {
  open: boolean
  onClose: () => void
  /** Open tasks on the To Do lens right now. */
  periodTasks: Task[]
  periodLabel: string
  /** `shelves` opens on the Sessions history panel; `list` on the flat pick list. */
  startOn?: "session" | "shelves" | "list"
  /** From another way in: a new draft of this length, template or seed. */
  request?: Omit<SessionOpenRequest, "startOn">
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const openPlans = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const history = useSessionPlanStore((s) => s.history)
  const [view, setView] = useState<"session" | "shelves" | "list">(startOn)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [parkNote, setParkNote] = useState("")

  // Opening shows the live session, else the focused one, else a new draft
  // seeded with lines kept from last time. Only on open: a session saved while
  // the popup is still up must not spawn a new draft.
  useEffect(() => {
    if (!open || startOn !== "session") return
    const store = useSessionPlanStore.getState()
    if (request && (request.durationMin || request.templateId || request.seed?.length)) {
      newDraftFrom(request)
      return
    }
    const live = liveSession(store.open)
    if (live) {
      store.focus(live.id)
      return
    }
    if (store.focusId && store.open.some((p) => p.id === store.focusId)) return
    newDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const plan = openPlans.find((p) => p.id === focusId) ?? null
  const parkedCount = openPlans.filter((p) => p.phase === "parked").length
  const done = doneId ? history.find((p) => p.id === doneId) : undefined
  const update = (next: SessionPlan) => putSession(next)

  const requestClose = () => {
    if (plan?.phase === "run" && view === "session") {
      setParkNote(plan.futureNote?.text ?? "")
      setAsking(true)
    } else onClose()
  }
  const parkAndClose = () => {
    if (plan) putSession(parkSession(plan, new Date(), parkNote))
    setAsking(false)
    onClose()
  }
  const showShelves = () => {
    setDoneId(null)
    if (view === "shelves" && !plan) newDraft()
    setView(view === "shelves" ? "session" : "shelves")
  }
  const openFromShelf = (id: string) => {
    useSessionPlanStore.getState().focus(id)
    setDoneId(null)
    setView("session")
  }

  const title =
    view === "shelves"
      ? done
        ? `Session · ${done.title}`
        : "Sessions"
      : view === "list"
        ? "Pick list"
        : plan?.phase === "run"
        ? `Session · ${plan.title}`
        : plan?.phase === "parked"
          ? `Parked · ${plan.title}`
          : plan?.phase === "review"
            ? "Session review"
            : "Plan a session"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="todo95-dialog todo-session"
        hideClose
        // The focus bar (pen clock) stays usable over the popup; a click on it is not a click outside.
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.(".focus-bar")) e.preventDefault()
        }}
        aria-describedby={undefined}
        data-ui-name="Session"
        data-ui-help="Plan a time box in three tiers, work it with a clock, and review it."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>{title}</DialogTitle>
          <span className="todo-session-caption-keys">
            <button
              type="button"
              data-no95
              className={`ses-caption-key${view === "shelves" ? " is-on" : ""}`}
              aria-pressed={view === "shelves"}
              title={view === "shelves" ? "Back to the session" : "Drafts, parked and done sessions"}
              onClick={showShelves}
            >
              <i className="ses-caption-lamp" aria-hidden />
              Sessions
              {parkedCount ? (
                <span className="ses-parked" aria-hidden title={`${parkedCount} parked`}>
                  ⏸ {parkedCount}
                </span>
              ) : null}
            </button>
            <KeycapClose label="Close" onClick={requestClose} />
          </span>
        </div>
        {asking ? (
          <div className="todo-session-ask" role="alertdialog" aria-label="The session is running">
            <span>The session is still running.</span>
            <FutureNoteInput value={parkNote} onChange={setParkNote} />
            <button type="button" className="todo-btn is-primary" onClick={parkAndClose}>
              Park
            </button>
            <button
              type="button"
              className="todo-btn"
              onClick={() => {
                setAsking(false)
                onClose()
              }}
            >
              Keep running
            </button>
          </div>
        ) : null}
        <div className="todo-dialog-body todo-session-body">
          {view === "list" ? (
            <FlatListView
              tasks={tasks}
              periodTasks={periodTasks}
              periodLabel={periodLabel}
              onSession={(ref, templateId) => {
                newDraftFrom({ seed: [ref], templateId })
                setView("session")
              }}
            />
          ) : view === "shelves" ? (
            done ? (
              <DoneView plan={done} tasks={tasks} onBack={() => setDoneId(null)} onRunAgain={() => openFromShelf(putSession(runAgain(done, new Date())))} />
            ) : (
              <ShelvesView
                open={openPlans}
                history={history}
                tasks={tasks}
                onOpen={openFromShelf}
                onOpenDone={setDoneId}
                onRunAgain={(p) => openFromShelf(putSession(runAgain(p, new Date())))}
                onNew={() => {
                  newDraft()
                  setView("session")
                }}
              />
            )
          ) : !plan ? null : plan.phase === "draft" ? (
            <DraftView plan={plan} tasks={tasks} history={history} periodTasks={periodTasks} periodLabel={periodLabel} onChange={update} />
          ) : plan.phase === "run" ? (
            <RunView plan={plan} tasks={tasks} onChange={update} />
          ) : plan.phase === "parked" ? (
            <ParkedView plan={plan} tasks={tasks} onChange={update} onShelves={showShelves} />
          ) : (
            <ReviewView plan={plan} tasks={tasks} onDone={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
