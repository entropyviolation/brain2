/**
 * components/ItemDetail/SubtaskTree.tsx — Nested subtasks with minutes
 *
 * The Subtasks tab: its own outline, not the To Do lid's `StepTree`. One row
 * per step: tick, name, parts, minutes, the nested sum, **Open** (the step's
 * item on top), + inside, delete. Minutes that count on a step are the greater of the
 * typed estimate and the nested sum (`lib/todo-steps`). Checking a step does
 * not check its parent. Hide locked and Show next only stay off here.
 */
"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { Subtask } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { findStep, updateStepChildren } from "@/lib/step-items"
import { openStepItem } from "@/lib/step-item-stack"
import {
  effectiveDurationMinutes,
  addNestedStep,
  flattenSteps,
  internalStepProgress,
  removeNestedStep,
  updateNestedStep,
} from "@/lib/todo-steps"

function parseMinutes(raw: string): number | undefined {
  const n = Number(raw.trim())
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function SubtaskTree({
  steps,
  onChange,
  onRemoved,
  onOpenStep,
}: {
  steps: readonly Subtask[] | undefined
  onChange: (next: Subtask[]) => void
  /** Ids of the step removed and every step nested inside it. */
  onRemoved?: (ids: string[]) => void
  /** Open a step's item on top. Only for a stored task. */
  onOpenStep?: (step: Subtask) => void
}) {
  const list = [...(steps ?? [])]
  const [adding, setAdding] = useState<string | null>(null) // parent id being added under, "" = top level

  const remove = (step: Subtask) => {
    const inner = flattenSteps(step.subtasks).length
    if (inner > 0 && !window.confirm(`Delete "${step.description}" and its ${inner} nested steps?`)) return
    onChange(removeNestedStep(list, step.id))
    onRemoved?.([step.id, ...flattenSteps(step.subtasks).map((s) => s.id)])
  }

  const commitAdd = (parentId: string, raw: string) => {
    setAdding(null)
    if (raw.trim()) onChange(addNestedStep(list, parentId || null, { description: raw }))
  }

  const addRow = (parentId: string) =>
    adding === parentId ? (
      <input
        autoFocus
        className="id-sub-add-input"
        placeholder="Name the step, then Enter"
        aria-label="New step name"
        onBlur={(e) => commitAdd(parentId, e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setAdding(null)
        }}
      />
    ) : null

  const renderStep = (step: Subtask, depth: number): React.ReactNode => {
    const kids = step.subtasks ?? []
    const progress = internalStepProgress(kids)
    const counts = effectiveDurationMinutes(step.estimatedDuration, kids)
    return (
      <li key={step.id} className="id-sub-item" data-depth={depth}>
        <div className="id-sub-row" data-done={step.completed ? "true" : "false"}>
          <input
            type="checkbox"
            className="id-sub-check"
            checked={step.completed}
            aria-label={`Done: ${step.description}`}
            onChange={(e) => onChange(updateNestedStep(list, step.id, { completed: e.target.checked }))}
          />
          <input
            key={`d-${step.description}`}
            className="id-sub-name"
            defaultValue={step.description}
            aria-label="Step name"
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (v && v !== step.description) onChange(updateNestedStep(list, step.id, { description: v }))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
          />
          {progress ? (
            <span className="id-sub-meta" title="Nested steps done">
              {progress.completed}/{progress.total}
            </span>
          ) : null}
          <input
            key={`m-${step.estimatedDuration ?? ""}`}
            type="number"
            min={0}
            className="id-sub-min"
            placeholder="min"
            defaultValue={step.estimatedDuration ?? ""}
            aria-label={`Minutes for ${step.description}`}
            onBlur={(e) => {
              const m = parseMinutes(e.currentTarget.value)
              if (m !== step.estimatedDuration) onChange(updateNestedStep(list, step.id, { estimatedDuration: m }))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
          />
          {kids.length && counts > (step.estimatedDuration ?? 0) ? (
            <span className="id-sub-meta" title="Sum of the steps inside">
              ={counts}m
            </span>
          ) : null}
          {onOpenStep ? (
            <button type="button" className="id-sub-btn is-open" onClick={() => onOpenStep(step)} aria-label={`Open ${step.description}`}>
              Open
            </button>
          ) : null}
          <button type="button" className="id-sub-btn" onClick={() => setAdding(step.id)} aria-label={`Add a step inside ${step.description}`} title="Add a step inside">
            +
          </button>
          <button type="button" className="id-sub-btn is-del" onClick={() => remove(step)} aria-label={`Delete ${step.description}`} title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {kids.length || adding === step.id ? (
          <ul className="id-sub-list">
            {kids.map((k) => renderStep(k, depth + 1))}
            {adding === step.id ? <li className="id-sub-item">{addRow(step.id)}</li> : null}
          </ul>
        ) : null}
      </li>
    )
  }

  const all = flattenSteps(list)
  const total = effectiveDurationMinutes(undefined, list)
  return (
    <div className="id-sub">
      {list.length ? (
        <ul className="id-sub-list">{list.map((s) => renderStep(s, 0))}</ul>
      ) : (
        <p className="id-sub-empty">No steps yet.</p>
      )}
      {adding === "" ? addRow("") : (
        <button type="button" className="id-sub-add" onClick={() => setAdding("")}>
          + Add step
        </button>
      )}
      {all.length ? (
        <div className="id-step-sum">
          <span>
            {all.filter((s) => s.completed).length} / {all.length} done
          </span>
          <span>{total > 0 ? `${total}m est` : "no estimate"}</span>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Subtasks tab on a step's item (Phase 11): the steps inside that step, read
 * from and written to the parent's tree, so there is no second copy.
 */
export function StepItemSubtasks({ stepOf }: { stepOf: { taskId: string; stepId: string } }) {
  const parent = useTaskStore((s) => s.tasks.find((t) => t.id === stepOf.taskId))
  const step = findStep(parent, stepOf.stepId)
  if (!step) return <p className="text-sm text-muted-foreground">This step is no longer in its task.</p>
  return (
    <SubtaskTree
      steps={step.subtasks}
      onChange={(children) => updateStepChildren(stepOf, children)}
      onOpenStep={(child) => openStepItem(stepOf.taskId, child.id)}
    />
  )
}
