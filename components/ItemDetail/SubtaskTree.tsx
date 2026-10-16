/**
 * components/ItemDetail/SubtaskTree.tsx — Nested subtasks with minutes
 *
 * The Subtasks tab, drawn by the shared `StepTree` (`components/steps/`, the
 * same tree as the To Do lid) with item detail's columns: parts, minutes, the
 * nested sum, delete. Minutes that count on a step are the greater of the
 * typed estimate and the nested sum (`lib/todo-steps`). Checking a step does
 * not check its parent. Hide locked and Show next only stay off here.
 */
"use client"

import { Trash2 } from "lucide-react"
import type { Subtask } from "@/lib/types"
import { StepTree } from "@/components/steps/StepTree"
import {
  effectiveDurationMinutes,
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
}: {
  steps: readonly Subtask[] | undefined
  onChange: (next: Subtask[]) => void
  /** Ids of the step removed and every step nested inside it. */
  onRemoved?: (ids: string[]) => void
}) {
  const list = [...(steps ?? [])]

  const remove = (step: Subtask) => {
    const inner = flattenSteps(step.subtasks).length
    if (inner > 0 && !window.confirm(`Delete "${step.description}" and its ${inner} nested steps?`)) return
    onChange(removeNestedStep(list, step.id))
    onRemoved?.([step.id, ...flattenSteps(step.subtasks).map((s) => s.id)])
  }

  const columns = (step: Subtask) => {
    const kids = step.subtasks ?? []
    const counts = effectiveDurationMinutes(step.estimatedDuration, kids)
    const progress = internalStepProgress(kids)
    return (
      <>
        {progress ? (
          <span className="id-step-meta">
            {progress.completed}/{progress.total}
          </span>
        ) : null}
        <input
          key={`m-${step.estimatedDuration ?? ""}`}
          type="number"
          min={0}
          step={1}
          className="id-step-min"
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
          <span className="id-step-meta" title="Sum of the steps inside">
            ={counts}m
          </span>
        ) : null}
        <button
          type="button"
          className="id-step-btn is-del"
          title="Delete"
          aria-label={`Delete ${step.description}`}
          onClick={() => remove(step)}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </>
    )
  }

  const all = flattenSteps(list)
  const total = effectiveDurationMinutes(undefined, list)
  return (
    <div className="id-step-tree">
      <StepTree steps={list} onChange={onChange} columns={columns} label="Subtasks" />
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
