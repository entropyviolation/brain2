/**
 * components/header-now-rows.tsx — Live clocks inside the header now well
 *
 * Loaded by `header-now-box.tsx` only after an Operations or pen-color session
 * is already live. This module may read the timegrid (pen color) and the
 * clock hooks (pause, stop, elapsed, objectives-for-right-now popup). The
 * always-mounted shell does not.
 */
"use client"

import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { useWorkSessionClock } from "@/components/Operations/WorkingNowControl"
import { usePenColorSessionClock } from "@/components/Home/Tracking/pen-color-now-strip"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  formatElapsedClock,
  isSessionPaused,
  pauseWorkingOnOperation,
  resumeWorkingOnOperation,
  sessionElapsedMs,
  stopWorkingOnOperation,
} from "@/lib/operation-work-session"
import {
  addPenColorNowObjective,
  editPenColorNowObjectiveText,
  pausePenColorSession,
  removePenColorNowObjective,
  resumePenColorSession,
  stopPenColorSession,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import {
  addWorkNowObjective,
  editWorkNowObjectiveText,
  removeWorkNowObjective,
  toggleWorkNowObjectiveComplete,
} from "@/lib/operation-work-session"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import type { NowObjective } from "@/lib/now-objective"

function NowRow({
  name,
  elapsed,
  paused,
  onStop,
  onPauseToggle,
  stopLabel,
  color,
  objectives,
  onAddObjective,
  onEditObjective,
  onToggleObjective,
  onRemoveObjective,
}: {
  name: string
  elapsed: string
  paused: boolean
  onStop: () => void
  onPauseToggle: () => void
  stopLabel: string
  color?: string
  objectives?: NowObjective[]
  onAddObjective: (text: string) => void
  onEditObjective: (id: string, text: string) => void
  onToggleObjective: (id: string) => void
  onRemoveObjective: (id: string) => void
}) {
  const pauseLabel = paused ? `Resume ${name}` : `Pause ${name}`
  return (
    <div className="b2-shell-now-row">
      {color ? <span className="b2-shell-now-swatch" style={{ background: color }} aria-hidden /> : null}
      <span className="b2-shell-now-name" title={name}>
        {name}
      </span>
      <span className="b2-shell-now-elapsed" aria-live="polite">
        {elapsed}
      </span>
      <NowObjectivesList
        objectives={objectives}
        contextName={name}
        onAdd={onAddObjective}
        onEditText={onEditObjective}
        onToggleComplete={onToggleObjective}
        onRemove={onRemoveObjective}
      />
      <DvdTransportKey mark={paused ? "play" : "pause"} label={pauseLabel} className="b2-shell-now-icon" onClick={onPauseToggle} />
      <DvdTransportKey mark="stop" label={stopLabel} className="b2-shell-now-icon" onClick={onStop} />
    </div>
  )
}

export function HeaderNowRows() {
  const { session: opSession, now: opNow } = useWorkSessionClock()
  const { session: penSession, now: penNow } = usePenColorSessionClock()
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const penScope = penSession ? scopes.find((scope) => scope.id === penSession.scopeId) : undefined
  const penColor = penScope?.pens.find((pen) => pen.id === penSession?.penId)?.color
  const penName = penSession
    ? penScope
      ? `${penSession.title} · ${penScope.name}`
      : penSession.title
    : ""

  if (!opSession && !penSession) return null

  return (
    <fieldset
      className="b2-shell-group b2-shell-now"
      data-testid="header-now-box"
      data-ui-name="Now"
      aria-label="now"
    >
      <legend>now</legend>
      <div className="b2-shell-now-body">
        {opSession && (
          <NowRow
            name={opSession.title}
            elapsed={formatElapsedClock(sessionElapsedMs(opSession, opNow))}
            paused={isSessionPaused(opSession)}
            stopLabel={`Stop ${opSession.title}`}
            onStop={() => stopWorkingOnOperation()}
            onPauseToggle={() =>
              isSessionPaused(opSession) ? resumeWorkingOnOperation() : pauseWorkingOnOperation()
            }
            objectives={opSession.nowObjectives}
            onAddObjective={(text) => addWorkNowObjective(text)}
            onEditObjective={(id, text) => editWorkNowObjectiveText(id, text)}
            onToggleObjective={(id) => toggleWorkNowObjectiveComplete(id)}
            onRemoveObjective={(id) => removeWorkNowObjective(id)}
          />
        )}
        {penSession && (
          <NowRow
            name={penName}
            color={penColor}
            elapsed={formatElapsedClock(sessionElapsedMs(penSession, penNow))}
            paused={isSessionPaused(penSession)}
            stopLabel={`Stop ${penName}`}
            onStop={() => stopPenColorSession()}
            onPauseToggle={() =>
              isSessionPaused(penSession) ? resumePenColorSession() : pausePenColorSession()
            }
            objectives={penSession.nowObjectives}
            onAddObjective={(text) => addPenColorNowObjective(text)}
            onEditObjective={(id, text) => editPenColorNowObjectiveText(id, text)}
            onToggleObjective={(id) => togglePenColorNowObjectiveComplete(id)}
            onRemoveObjective={(id) => removePenColorNowObjective(id)}
          />
        )}
      </div>
    </fieldset>
  )
}

export default HeaderNowRows
