/**
 * components/Focus/FocusBar.tsx — The task on the clock, docked at the foot of Home
 *
 * Shown while a task rides the Tracking pen clock (`lib/task-clock.ts`). One
 * thin strip of dark glass, the Just Start family: pen swatch, `Task › step`
 * (click opens that task), **Task** (the step on the clock, or a new one),
 * the step's estimate, the live clock, Objectives (tied to steps), Just Start,
 * Pause / Resume, and Stop. Stop first asks whether to save still-open
 * objectives for the next time this task or subtask is tracked. Yes parks
 * them, No leaves them on this sitting, Cancel keeps the clock running.
 * Then, when a line is not a step yet, it asks whether to keep those free
 * objectives as steps of the task or leave them on the Tracking block.
 * Then the end-of-sitting strip (`SittingEnd`) pauses the clock and says
 * how long you sat and where you left it; its Keep or Skip stops the clock
 * and opens the sitting review.
 *
 * Sessions (slice H2): while a To Do session runs, **Park session** puts it
 * down (with an optional note to tomorrow-you). Otherwise **Session** and
 * **Just 25** open a new draft on the task on the clock
 * (`lib/session-open-store.ts`).
 *
 * `FocusBarDock` is the always-mounted shell. It reads only the session's
 * task id and loads this module once a task is on the clock.
 */
"use client"

import { useState, useEffect } from "react"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { ClockTaskButton } from "@/components/Home/Tracking/clock-task-panel"
import { usePenColorSessionClock } from "@/components/Home/Tracking/pen-color-now-strip"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatElapsedClock, isSessionPaused, sessionElapsedMs } from "@/lib/operation-work-session"
import {
  addPenColorCompletedObjective,
  addPenColorNowObjective,
  attachPenNowObjective,
  editPenColorNowObjectiveText,
  pausePenColorSession,
  removePenColorNowObjective,
  resumePenColorSession,
  savePenObjectiveForLater,
  stopPenColorSession,
  tiePenColorNowObjective,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import { offerPenDebrief } from "@/lib/session-debrief"
import { SessionHandoffNote } from "@/components/Home/Tracking/session-handoff-note"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useSessionPlanStore, parkLiveSession } from "@/lib/session-plan-store"
import { activeNowObjectives } from "@/lib/now-objective"
import { attachChoicesForPen } from "@/lib/unfinished-objectives"
import { useTaskStore } from "@/lib/task-store"
import { openSession } from "@/lib/session-open-store"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { JUST_25_TEMPLATE_ID } from "@/lib/session-plan"
import JustStartMode from "./JustStartMode"
import SittingEnd from "./SittingEnd"
import { useClockTask } from "./use-clock-task"
import "./focus-bar.css"

export default function FocusBar() {
  const { session, now } = usePenColorSessionClock()
  const clock = useClockTask(session)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tasks = useTaskStore((s) => s.tasks)
  const [asking, setAsking] = useState<false | "save" | "steps">(false)
  const [parkOnStop, setParkOnStop] = useState(false)
  const [justStart, setJustStart] = useState(false)
  const [satMinutes, setSatMinutes] = useState<number | null>(null)
  const [parkNote, setParkNote] = useState<string | null>(null)
  const sessionRuns = useSessionPlanStore((s) => s.open.some((p) => p.phase === "run"))

  useEffect(() => {
    if (asking !== "save") return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setAsking(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [asking])

  if (!session?.taskId || !clock.task) return null
  const pen = scopes.find((scope) => scope.id === session.scopeId)?.pens.find((p) => p.id === session.penId)
  const paused = isSessionPaused(session)
  const active = activeNowObjectives(session.nowObjectives)
  const free = (session.nowObjectives ?? []).filter((row) => !row.stepId && !row.completedAt)
  const estimate = clock.step?.estimatedDuration
  const attachChoices = attachChoicesForPen(tasks, session.penId, session.taskId)

  // The end-of-sitting strip (Phase 15 A): pause so the minutes hold still, stop on Keep or Skip.
  const endSitting = () => {
    setAsking(false)
    const live = usePenColorSessionStore.getState().session
    setSatMinutes(live ? sessionElapsedMs(live) / 60_000 : 0)
    pausePenColorSession()
  }

  const stop = () => {
    if (active.length && !asking) {
      setAsking("save")
      return
    }
    if (free.length && asking !== "steps") {
      setAsking("steps")
      return
    }
    endSitting()
  }

  const answerSave = (park: boolean) => {
    setParkOnStop(park)
    if (free.length) setAsking("steps")
    else endSitting()
  }

  const keepAsSteps = () => {
    // Read the live list: each tie writes the session again.
    for (const row of usePenColorSessionStore.getState().session?.nowObjectives ?? []) {
      if (!row.stepId) tiePenColorNowObjective(row.id, "new")
    }
    endSitting()
  }

  // Just Start renders beside the bar, not inside it: the bar's transform would trap its fixed overlay.
  return (
    <>
    <div
      className="focus-bar b2-now"
      role="region"
      aria-label="On the clock"
      data-ui-name="Focus bar"
      data-ui-docs="components/Focus/README.md"
    >
      <SessionHandoffNote taskId={session.taskId} penId={session.penId} />
      {satMinutes != null ? (
        <SittingEnd
          task={clock.task}
          minutes={satMinutes}
          onDone={() => {
            setSatMinutes(null)
            const ended = stopPenColorSession(new Date(), parkOnStop ? { parkUnfinished: true } : undefined)
            if (ended) offerPenDebrief(ended)
          }}
        />
      ) : parkNote !== null ? (
        <div className="focus-bar-ask" role="alertdialog" aria-label="Park the session">
          <input
            className="focus-bar-note"
            aria-label="Note to tomorrow-you"
            placeholder="Note to tomorrow-you (optional)"
            value={parkNote}
            onChange={(e) => setParkNote(e.target.value)}
          />
          <button
            data-no95
            type="button"
            className="focus-bar-key todo-cap is-primary"
            onClick={() => {
              // The pen pauses with it (lib/session-pen.ts), so this bar stays.
              parkLiveSession(new Date(), parkNote)
              setParkNote(null)
            }}
          >
            Park
          </button>
          <button data-no95 type="button" className="focus-bar-key todo-cap" onClick={() => setParkNote(null)}>
            Keep going
          </button>
        </div>
      ) : asking === "save" ? (
        <div className="focus-bar-ask" role="alertdialog" aria-label="Save unfinished objectives">
          <span className="focus-bar-ask-text">
            {active.length === 1
              ? "1 objective is still open. Save it for the next time you track this?"
              : `${active.length} objectives are still open. Save them for the next time you track this?`}
          </span>
          <button data-no95 type="button" className="focus-bar-key todo-cap is-primary" onClick={() => answerSave(true)}>
            Yes
          </button>
          <button data-no95 type="button" className="focus-bar-key todo-cap" onClick={() => answerSave(false)}>
            No
          </button>
          <button data-no95 type="button" className="focus-bar-key todo-cap" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      ) : asking === "steps" ? (
        <div className="focus-bar-ask" role="alertdialog" aria-label="Free objectives">
          <span className="focus-bar-ask-text">
            {free.length === 1 ? "1 objective isn't a step yet." : `${free.length} objectives aren't steps yet.`}
          </span>
          <button data-no95 type="button" className="focus-bar-key todo-cap is-primary" onClick={keepAsSteps}>
            Keep as steps
          </button>
          <button
            data-no95
            type="button"
            className="focus-bar-key todo-cap"
            onClick={endSitting}
          >
            Leave on the block
          </button>
          <button data-no95 type="button" className="focus-bar-key todo-cap" onClick={() => setAsking(false)}>
            Keep going
          </button>
        </div>
      ) : (
        <>
          <span className="focus-bar-lamp" aria-hidden />
          {pen ? <span className="focus-bar-swatch" style={{ background: pen.color }} title={pen.name} aria-hidden /> : null}
          <button
            type="button"
            className="focus-bar-path"
            data-no95
            title={`Open ${clock.path}`}
            onClick={() => openItemDetailPopup(clock.task!.id)}
          >
            {clock.path}
          </button>
          <ClockTaskButton />
          {estimate ? <span className="focus-bar-est">{estimate}m est</span> : null}
          <span className={`focus-bar-clock${paused ? " is-paused" : ""}`} aria-live="off">
            {formatElapsedClock(sessionElapsedMs(session, now))}
          </span>
          <NowObjectivesList
            objectives={session.nowObjectives}
            contextName={clock.path}
            onAdd={(text) => addPenColorNowObjective(text)}
            onAddCompleted={(text) => addPenColorCompletedObjective(text)}
            onEditText={(id, text) => editPenColorNowObjectiveText(id, text)}
            onToggleComplete={(id) => togglePenColorNowObjectiveComplete(id)}
            onRemove={(id) => removePenColorNowObjective(id)}
            onSaveForLater={(id) => savePenObjectiveForLater(id)}
            onAttach={(id, target) => attachPenNowObjective(id, target)}
            attachChoices={attachChoices}
            stepChoices={clock.stepChoices}
            onTieStep={clock.onTieStep}
            onSetCompletes={clock.onSetCompletes}
          />
          <button
            data-no95
            type="button"
            className="focus-bar-key todo-cap"
            title="Just Start: the smallest ready step"
            onClick={() => setJustStart(true)}
          >
            Just start
          </button>
          {sessionRuns ? (
            <button data-no95 type="button" className="focus-bar-key todo-cap" title="Park the running session" onClick={() => setParkNote("")}>
              Park session
            </button>
          ) : (
            <>
              <button
                data-no95
                type="button"
                className="focus-bar-key todo-cap"
                title="Plan a session starting with this"
                onClick={() => openSession({ startOn: "session", seed: [{ taskId: session.taskId!, ...(session.stepId ? { stepId: session.stepId } : {}) }] })}
              >
                Session
              </button>
              <button
                data-no95
                type="button"
                className="focus-bar-key todo-cap"
                title="Just 25 minutes on this: the clock is the commitment"
                onClick={() =>
                  openSession({
                    startOn: "session",
                    templateId: JUST_25_TEMPLATE_ID,
                    seed: [{ taskId: session.taskId!, ...(session.stepId ? { stepId: session.stepId } : {}) }],
                  })
                }
              >
                Just 25
              </button>
            </>
          )}
          <DvdTransportKey
            className="focus-bar-icon"
            mark={paused ? "play" : "pause"}
            label={paused ? "Resume the clock" : "Pause the clock"}
            onClick={() => (paused ? resumePenColorSession() : pausePenColorSession())}
          />
          <DvdTransportKey className="focus-bar-icon" mark="stop" label={`Stop the clock on ${clock.path}`} onClick={stop} />
        </>
      )}
    </div>
      {justStart ? (
        <JustStartMode taskId={session.taskId} stepId={session.stepId} onClose={() => setJustStart(false)} />
      ) : null}
    </>
  )
}
