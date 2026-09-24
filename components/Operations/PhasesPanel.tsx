/**
 * components/Operations/PhasesPanel.tsx — Operation phases + their parts
 *
 * Lists an operation's phase tasks (linked via `has-phase`/`phase-of`), each
 * with a completion bar derived from its step tasks (`lib/operations.evaluatePhase`).
 * Phases and steps can be added inline; a new step is also filed on the
 * operation's To do list. Toggling done and opening a task delegate to the task
 * store / parent. The Parts tab is a separate formula layer (`PartsPanel`).
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { getParts, getPhases, evaluatePhase, OP_REL } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { addPhase, addPhaseStep, setTaskCompleted, unlinkChild } from "./operation-actions"

function PhaseRow({
  operationId,
  phase,
  allTasks,
  onOpenItem,
}: {
  operationId: string
  phase: Task
  allTasks: Task[]
  onOpenItem?: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [partDraft, setPartDraft] = useState("")
  const parts = useMemo(() => getParts(phase.id, allTasks), [phase.id, allTasks])
  const progress = evaluatePhase(phase, parts)

  const submitPart = () => {
    if (!partDraft.trim()) return
    addPhaseStep(operationId, phase.id, partDraft)
    setPartDraft("")
  }

  return (
    <div className="ops-phase">
      <div className="ops-row" style={{ boxShadow: "none", background: "transparent" }}>
        <button type="button" className="ops-btn ops-icon-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse phase" : "Expand phase"}>
          {open ? "▾" : "▸"}
        </button>
        <input
          type="checkbox"
          checked={progress.complete}
          onChange={(e) => setTaskCompleted(phase.id, e.target.checked)}
          aria-label="Toggle phase complete"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-medium ${progress.complete ? "line-through" : ""}`}>
              {phase.description}
            </span>
            {onOpenItem && (
              <button type="button" className="ops-btn ops-icon-btn" onClick={() => onOpenItem(phase.id)} title="Open phase">
                ↗
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="ops-progress w-28">
              <span style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
            <span className="tabular-nums text-[11px]">
              {progress.done}/{progress.total}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="ops-btn ops-icon-btn"
          title="Detach phase"
          onClick={() => unlinkChild(operationId, OP_REL.hasPhase, phase.id)}
        >
          ×
        </button>
      </div>

      {open && (
        <div className="ops-phase-body space-y-1">
          {parts.length === 0 ? (
            <p className="ops-hint italic">No steps yet.</p>
          ) : (
            parts.map((part) => (
              <div key={part.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={part.completed}
                  onChange={(e) => setTaskCompleted(part.id, e.target.checked)}
                  aria-label="Toggle step complete"
                />
                <span className={`flex-1 truncate text-sm ${part.completed ? "line-through" : ""}`}>
                  {part.description}
                </span>
                {onOpenItem && (
                  <button type="button" className="ops-btn ops-icon-btn" onClick={() => onOpenItem(part.id)} title="Open step">
                    ↗
                  </button>
                )}
                <button
                  type="button"
                  className="ops-btn ops-icon-btn"
                  title="Detach step"
                  onClick={() => unlinkChild(phase.id, OP_REL.hasPart, part.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
          <div className="ops-add-row pt-1">
            <input
              className="ops-input"
              value={partDraft}
              onChange={(e) => setPartDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPart()}
              placeholder="Add a step…"
            />
            <button type="button" className="ops-btn" onClick={submitPart} disabled={!partDraft.trim()}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PhasesPanel({
  operation,
  onOpenItem,
}: {
  operation: Task
  onOpenItem?: (id: string) => void
}) {
  const allTasks = useTaskStore((s) => s.tasks)
  const phases = useMemo(() => getPhases(operation.id, allTasks), [operation.id, allTasks])
  const [phaseDraft, setPhaseDraft] = useState("")

  const submitPhase = () => {
    if (!phaseDraft.trim()) return
    addPhase(operation.id, phaseDraft)
    setPhaseDraft("")
  }

  return (
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">
          Phases
          <span>{phases.length} phase{phases.length === 1 ? "" : "s"}</span>
        </div>
        {phases.length === 0 ? (
          <p className="ops-hint">
            No phases yet. Break this operation into phases to track its arc.
          </p>
        ) : (
          <div className="space-y-2">
            {phases.map((phase) => (
              <PhaseRow
                key={phase.id}
                operationId={operation.id}
                phase={phase}
                allTasks={allTasks}
                onOpenItem={onOpenItem}
              />
            ))}
          </div>
        )}
      </div>

      <div className="ops-add-row">
        <input
          className="ops-input"
          value={phaseDraft}
          onChange={(e) => setPhaseDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPhase()}
          placeholder="Name the next phase…"
        />
        <button type="button" className="ops-btn ops-btn-default" onClick={submitPhase} disabled={!phaseDraft.trim()}>
          Add phase
        </button>
      </div>
    </div>
  )
}

export default PhasesPanel
