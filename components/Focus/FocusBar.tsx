/**
 * components/Focus/FocusBar.tsx — The task on the clock, docked at the foot of Home
 *
 * Shown while a task rides the Tracking pen clock (`lib/task-clock.ts`). One
 * thin strip of dark glass, the Just Start family: pen swatch, `Task › step`,
 * the step's estimate, the live clock, Objectives (tied to steps), Just Start,
 * Pause / Resume, and Stop. Stop asks once what to do with free objectives:
 * keep them as steps of the task, or leave them on the Tracking block.
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
import JustStartMode from "./JustStartMode"
import { useClockTask } from "./use-clock-task"
import "./focus-bar.css"

export default function FocusBar() {
  const { session, now } = usePenColorSessionClock()
  const clock = useClockTask(session)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [asking, setAsking] = useState(false)
  const [justStart, setJustStart] = useState(false)

  if (!session?.taskId || !clock.task) return null
  const pen = scopes.find((scope) => scope.id === session.scopeId)?.pens.find((p) => p.id === session.penId)
  const paused = isSessionPaused(session)
  const free = (session.nowObjectives ?? []).filter((row) => !row.stepId)
  const estimate = clock.step?.estimatedDuration

  const stop = () => {
    if (free.length && !asking) {
      setAsking(true)
      return
    }
    setAsking(false)
    stopPenColorSession()
  }

  const keepAsSteps = () => {
    // Read the live list: each tie writes the session again.
    for (const row of usePenColorSessionStore.getState().session?.nowObjectives ?? []) {
      if (!row.stepId) tiePenColorNowObjective(row.id, "new")
    }
    setAsking(false)
    stopPenColorSession()
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
      {asking ? (
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
            onClick={() => {
              setAsking(false)
              stopPenColorSession()
            }}
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
