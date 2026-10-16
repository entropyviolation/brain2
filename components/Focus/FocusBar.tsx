/**
 * components/Focus/FocusBar.tsx — The task on the clock, docked at the foot of Home
 *
 * Shown while a task rides the Tracking pen clock (`lib/task-clock.ts`). One
 * thin strip of dark glass, the Just Start family: pen swatch, `Task › step`,
 * the step's estimate, the live clock, Objectives (tied to steps), Just Start,
 * Pause / Resume, and Stop. Stop asks once what to do with free objectives:
 * keep them as steps of the task, or leave them on the Tracking block.
 * Then the end-of-sitting strip (`SittingEnd`) pauses the clock and says
 * how long you sat and where you left it; its Keep or Skip stops the clock.
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

import { useState } from "react"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { usePenColorSessionClock } from "@/components/Home/Tracking/pen-color-now-strip"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatElapsedClock, isSessionPaused, sessionElapsedMs } from "@/lib/operation-work-session"
import {
  addPenColorNowObjective,
  editPenColorNowObjectiveText,
  pausePenColorSession,
  removePenColorNowObjective,
  resumePenColorSession,
  stopPenColorSession,
  tiePenColorNowObjective,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useSessionPlanStore, parkLiveSession } from "@/lib/session-plan-store"
import { openSession } from "@/lib/session-open-store"
import { releasePenClock } from "@/lib/session-pen"
import { JUST_25_TEMPLATE_ID } from "@/lib/session-plan"
import JustStartMode from "./JustStartMode"
import SittingEnd from "./SittingEnd"
import { useClockTask } from "./use-clock-task"
import "./focus-bar.css"

export default function FocusBar() {
  const { session, now } = usePenColorSessionClock()
  const clock = useClockTask(session)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [asking, setAsking] = useState(false)
  const [justStart, setJustStart] = useState(false)
  const [satMinutes, setSatMinutes] = useState<number | null>(null)
  const [parkNote, setParkNote] = useState<string | null>(null)
  const sessionRuns = useSessionPlanStore((s) => s.open.some((p) => p.phase === "run"))

  if (!session?.taskId || !clock.task) return null
  const pen = scopes.find((scope) => scope.id === session.scopeId)?.pens.find((p) => p.id === session.penId)
  const paused = isSessionPaused(session)
  const free = (session.nowObjectives ?? []).filter((row) => !row.stepId)
  const estimate = clock.step?.estimatedDuration

  // The end-of-sitting strip (Phase 15 A): pause so the minutes hold still, stop on Keep or Skip.
  const endSitting = () => {
    setAsking(false)
    const live = usePenColorSessionStore.getState().session
    setSatMinutes(live ? sessionElapsedMs(live) / 60_000 : 0)
    pausePenColorSession()
  }

  const stop = () => {
    if (free.length && !asking) {
      setAsking(true)
      return
    }
    endSitting()
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
      className="focus-bar"
      role="region"
      aria-label="On the clock"
      data-ui-name="Focus bar"
      data-ui-docs="components/Focus/README.md"
    >
      {satMinutes != null ? (
        <SittingEnd
          task={clock.task}
          minutes={satMinutes}
          onDone={() => {
            setSatMinutes(null)
            stopPenColorSession()
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
            className="focus-bar-key is-primary"
            onClick={() => {
              const parked = parkLiveSession(new Date(), parkNote)
              setParkNote(null)
              if (parked) releasePenClock([parked])
            }}
          >
            Park
          </button>
          <button data-no95 type="button" className="focus-bar-key" onClick={() => setParkNote(null)}>
            Keep going
          </button>
        </div>
      ) : asking ? (
        <div className="focus-bar-ask" role="alertdialog" aria-label="Free objectives">
          <span className="focus-bar-ask-text">
            {free.length === 1 ? "1 objective isn't a step yet." : `${free.length} objectives aren't steps yet.`}
          </span>
          <button data-no95 type="button" className="focus-bar-key is-primary" onClick={keepAsSteps}>
            Keep as steps
          </button>
          <button
            data-no95
            type="button"
            className="focus-bar-key"
            onClick={endSitting}
          >
            Leave on the block
          </button>
          <button data-no95 type="button" className="focus-bar-key" onClick={() => setAsking(false)}>
            Keep going
          </button>
        </div>
      ) : (
        <>
          <span className="focus-bar-lamp" aria-hidden />
          {pen ? <span className="focus-bar-swatch" style={{ background: pen.color }} title={pen.name} aria-hidden /> : null}
          <span className="focus-bar-path" title={clock.path}>
            {clock.path}
          </span>
          {estimate ? <span className="focus-bar-est">{estimate}m est</span> : null}
          <span className={`focus-bar-clock${paused ? " is-paused" : ""}`} aria-live="off">
            {formatElapsedClock(sessionElapsedMs(session, now))}
          </span>
          <NowObjectivesList
            objectives={session.nowObjectives}
            contextName={clock.path}
            onAdd={(text) => addPenColorNowObjective(text)}
            onEditText={(id, text) => editPenColorNowObjectiveText(id, text)}
            onToggleComplete={(id) => togglePenColorNowObjectiveComplete(id)}
            onRemove={(id) => removePenColorNowObjective(id)}
            stepChoices={clock.stepChoices}
            onTieStep={clock.onTieStep}
          />
          <button
            data-no95
            type="button"
            className="focus-bar-key"
            title="Just Start: the smallest ready step"
            onClick={() => setJustStart(true)}
          >
            Just start
          </button>
          {sessionRuns ? (
            <button data-no95 type="button" className="focus-bar-key" title="Park the running session" onClick={() => setParkNote("")}>
              Park session
            </button>
          ) : (
            <>
              <button
                data-no95
                type="button"
                className="focus-bar-key"
                title="Plan a session starting with this"
                onClick={() => openSession({ startOn: "session", seed: [{ taskId: session.taskId!, ...(session.stepId ? { stepId: session.stepId } : {}) }] })}
              >
                Session
              </button>
              <button
                data-no95
                type="button"
                className="focus-bar-key"
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
