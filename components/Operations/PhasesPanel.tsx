/**
 * components/Operations/PhasesPanel.tsx — Operation phases + their parts
 *
 * Lists an operation's phase tasks (linked via `has-phase`/`phase-of`), each
 * with a completion bar derived from its part tasks (`lib/operations.evaluatePhase`).
 * Phases and parts can be added inline; toggling a part's done state and opening
 * a task delegate to the task store / parent. Adding/removing uses the typed
 * relations through `operation-actions` (which call the link helpers).
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, ChevronRight, ChevronDown, X, ArrowUpRight } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { getParts, getPhases, evaluatePhase, OP_REL } from "@/lib/operations"
import type { Task } from "@/lib/types"
import { addPhase, addPart, setTaskCompleted, unlinkChild } from "./operation-actions"

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
    addPart(phase.id, partDraft)
    setPartDraft("")
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 p-2.5">
        <button type="button" className="text-muted-foreground" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Checkbox
          checked={progress.complete}
          onCheckedChange={(c) => setTaskCompleted(phase.id, !!c)}
          aria-label="Toggle phase complete"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-medium ${progress.complete ? "line-through text-muted-foreground" : ""}`}>
              {phase.description}
            </span>
            {onOpenItem && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onOpenItem(phase.id)}
                title="Open phase"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded bg-muted">
              <div className="h-full bg-teal-600" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          title="Detach phase"
          onClick={() => unlinkChild(operationId, OP_REL.hasPhase, phase.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="space-y-1 border-t bg-muted/30 px-3 py-2">
          {parts.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No steps yet.</p>
          ) : (
            parts.map((part) => (
              <div key={part.id} className="flex items-center gap-2">
                <Checkbox
                  checked={part.completed}
                  onCheckedChange={(c) => setTaskCompleted(part.id, !!c)}
                  aria-label="Toggle step complete"
                />
                <span className={`flex-1 truncate text-sm ${part.completed ? "line-through text-muted-foreground" : ""}`}>
                  {part.description}
                </span>
                {onOpenItem && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onOpenItem(part.id)}
                    title="Open step"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  title="Detach step"
                  onClick={() => unlinkChild(phase.id, OP_REL.hasPart, part.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={partDraft}
              onChange={(e) => setPartDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPart()}
              placeholder="Add a step…"
              className="h-8"
            />
            <Button size="sm" variant="outline" onClick={submitPart} disabled={!partDraft.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
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
    <div className="space-y-3">
      {phases.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
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

      <div className="flex items-center gap-2">
        <Input
          value={phaseDraft}
          onChange={(e) => setPhaseDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPhase()}
          placeholder="Add a phase…"
        />
        <Button onClick={submitPhase} disabled={!phaseDraft.trim()}>
          <Plus className="h-4 w-4 mr-1.5" /> Phase
        </Button>
      </div>
    </div>
  )
}

export default PhasesPanel
