/**
 * components/header-now-rows.tsx — Live clocks inside the header now well
 *
 * Loaded by `header-now-box.tsx` only after an Operations or pen-color session
 * is already live. This module may read the timegrid (pen color) and the
 * clock hooks (pause, stop, elapsed, objectives-for-right-now popup, and the
 * task key on a pen clock). The always-mounted shell does not.
 */
"use client"

import type { ReactNode } from "react"
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
  addPenColorCompletedObjective,
  addPenColorNowObjective,
  attachPenNowObjective,
  editPenColorNowObjectiveText,
  pausePenColorSession,
  removePenColorNowObjective,
  resumePenColorSession,
  savePenObjectiveForLater,
  stopPenColorSession,
  togglePenColorNowObjectiveComplete,
} from "@/lib/pen-color-session"
import {
  addWorkCompletedObjective,
  addWorkNowObjective,
  attachWorkNowObjective,
  editWorkNowObjectiveText,
  removeWorkNowObjective,
  saveWorkObjectiveForLater,
  toggleWorkNowObjectiveComplete,
} from "@/lib/operation-work-session"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { activeNowObjectives, type NowObjective } from "@/lib/now-objective"
import { attachChoicesForOperation, attachChoicesForPen, type ObjectiveAttachChoice } from "@/lib/unfinished-objectives"
import { useClockTask } from "@/components/Focus/use-clock-task"
import { ClockTaskButton } from "@/components/Home/Tracking/clock-task-panel"
import { useTaskStore } from "@/lib/task-store"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"

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
  onAddCompleted,
  onEditObjective,
  onToggleObjective,
  onRemoveObjective,
  onSaveForLater,
  onAttach,
  attachChoices,
  stepChoices,
  onTieStep,
  onSetCompletes,
  onOpen,
  taskSlot,
}: {
  name: string
  elapsed: string
  paused: boolean
  onStop: (park: boolean) => void
  onPauseToggle: () => void
  stopLabel: string
  color?: string
  objectives?: NowObjective[]
  onAddObjective: (text: string) => void
  onAddCompleted: (text: string) => void
  onEditObjective: (id: string, text: string) => void
  onToggleObjective: (id: string) => void
  onRemoveObjective: (id: string) => void
  onSaveForLater: (id: string) => void
  onAttach: (id: string, target: { taskId: string; stepId?: string } | { createName: string }) => void
  attachChoices?: ObjectiveAttachChoice[]
  stepChoices?: { id: string; label: string }[]
  onTieStep?: (id: string, stepId: string | "new" | undefined) => void
  onSetCompletes?: (id: string, completes: boolean) => void
  onOpen?: () => void
  taskSlot?: ReactNode
}) {
  const pauseLabel = paused ? `Resume ${name}` : `Pause ${name}`
  const unfinished = useUnfinishedStop(activeNowObjectives(objectives).length, onStop)
  return (
    <div className="b2-shell-now-row">
      {color ? <span className="b2-shell-now-swatch" style={{ background: color }} aria-hidden /> : null}
      {onOpen ? (
        <button type="button" className="b2-shell-now-name" data-no95 title={`Open ${name}`} onClick={onOpen}>
          {name}
        </button>
      ) : (
        <span className="b2-shell-now-name" title={name}>
          {name}
        </span>
      )}
      <span className="b2-shell-now-elapsed" aria-live="polite">
        {elapsed}
      </span>
      <NowObjectivesList
        objectives={objectives}
        contextName={name}
        onAdd={onAddObjective}
        onAddCompleted={onAddCompleted}
        onEditText={onEditObjective}
        onToggleComplete={onToggleObjective}
        onRemove={onRemoveObjective}
        onSaveForLater={onSaveForLater}
        onAttach={onAttach}
        attachChoices={attachChoices}
        stepChoices={stepChoices}
        onTieStep={onTieStep}
        onSetCompletes={onSetCompletes}
      />
      {taskSlot}
      <DvdTransportKey mark={paused ? "play" : "pause"} label={pauseLabel} className="b2-shell-now-icon" onClick={onPauseToggle} />
      <DvdTransportKey mark="stop" label={stopLabel} className="b2-shell-now-icon" onClick={unfinished.request} />
      {unfinished.dialog}
    </div>
  )
}

export function HeaderNowRows() {
  const { session: opSession, now: opNow } = useWorkSessionClock()
  const { session: penSession, now: penNow } = usePenColorSessionClock()
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const penScope = penSession ? scopes.find((scope) => scope.id === penSession.scopeId) : undefined
  const penColor = penScope?.pens.find((pen) => pen.id === penSession?.penId)?.color
  const clock = useClockTask(penSession)
  const tasks = useTaskStore((s) => s.tasks)
  const penName = penSession
    ? clock.path
      ? `${clock.path} · ${penScope?.pens.find((pen) => pen.id === penSession.penId)?.name ?? penSession.title}`
      : penScope
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
            onStop={(park) => stopWorkingOnOperation(new Date(), park ? { parkUnfinished: true } : undefined)}
            onPauseToggle={() =>
              isSessionPaused(opSession) ? resumeWorkingOnOperation() : pauseWorkingOnOperation()
            }
            objectives={opSession.nowObjectives}
            onAddObjective={(text) => addWorkNowObjective(text)}
            onAddCompleted={(text) => addWorkCompletedObjective(text)}
            onEditObjective={(id, text) => editWorkNowObjectiveText(id, text)}
            onToggleObjective={(id) => toggleWorkNowObjectiveComplete(id)}
            onRemoveObjective={(id) => removeWorkNowObjective(id)}
            onSaveForLater={(id) => saveWorkObjectiveForLater(id)}
            onAttach={(id, target) => attachWorkNowObjective(id, target)}
            attachChoices={attachChoicesForOperation(tasks, opSession.operationId)}
          />
        )}
        {penSession && (
          <NowRow
            name={penName}
            color={penColor}
            elapsed={formatElapsedClock(sessionElapsedMs(penSession, penNow))}
            paused={isSessionPaused(penSession)}
            stopLabel={`Stop ${penName}`}
            onStop={(park) => stopPenColorSession(new Date(), park ? { parkUnfinished: true } : undefined)}
            onPauseToggle={() =>
              isSessionPaused(penSession) ? resumePenColorSession() : pausePenColorSession()
            }
            objectives={penSession.nowObjectives}
            onAddObjective={(text) => addPenColorNowObjective(text)}
            onAddCompleted={(text) => addPenColorCompletedObjective(text)}
            onEditObjective={(id, text) => editPenColorNowObjectiveText(id, text)}
            onToggleObjective={(id) => togglePenColorNowObjectiveComplete(id)}
            onRemoveObjective={(id) => removePenColorNowObjective(id)}
            onSaveForLater={(id) => savePenObjectiveForLater(id)}
            onAttach={(id, target) => attachPenNowObjective(id, target)}
            attachChoices={attachChoicesForPen(tasks, penSession.penId, penSession.taskId)}
            stepChoices={clock.stepChoices}
            onTieStep={clock.onTieStep}
            onSetCompletes={clock.onSetCompletes}
            onOpen={penSession.taskId ? () => openItemDetailPopup(penSession.taskId!) : undefined}
            taskSlot={<ClockTaskButton />}
          />
        )}
      </div>
    </fieldset>
  )
}

export default HeaderNowRows
