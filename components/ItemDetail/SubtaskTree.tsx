/**
 * components/ItemDetail/SubtaskTree.tsx — Nested subtasks with minutes
 *
 * The Subtasks tab editor, shaped like Tidy's breakdown but on any item's
 * `subtasks` tree. Every step can take its own steps (+), as deep as you like,
 * and each add row stays open after Add so you can keep typing. Minutes that
 * count on a step are the greater of the typed estimate and the nested sum
 * (`lib/todo-steps`). Checking a step does not check its parent.
 */
"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import type { Subtask } from "@/lib/types"
import { Checkbox } from "@/components/ui/checkbox"
import {
  addNestedStep,
  effectiveDurationMinutes,
  flattenSteps,
  internalStepProgress,
  removeNestedStep,
  updateNestedStep,
} from "@/lib/todo-steps"

function parseMinutes(raw: FormDataEntryValue | string | null): number | undefined {
  const n = Number(String(raw ?? "").trim())
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function findStep(steps: readonly Subtask[], id: string): Subtask | undefined {
  return flattenSteps(steps).find((s) => s.id === id)
}

function StepComposer({
  nested,
  onAdd,
  onCancel,
}: {
  nested: boolean
  onAdd: (description: string, minutes: number | undefined) => void
  onCancel?: () => void
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const d = new FormData(form)
    const description = String(d.get("description") || "").trim()
    if (!description) return
    onAdd(description, parseMinutes(d.get("minutes")))
    form.reset()
    ;(form.elements.namedItem("description") as HTMLInputElement | null)?.focus()
  }
  return (
    <form
      className={`id-step-add${nested ? " is-nested" : ""}`}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <input
        type="text"
        name="description"
        autoComplete="off"
        autoFocus={nested}
        placeholder={nested ? "Add a step inside…" : "Add a subtask…"}
        aria-label={nested ? "New nested step" : "New subtask"}
      />
      <input type="number" name="minutes" min={0} step={1} placeholder="min" aria-label="Estimated minutes" />
      <button type="submit" className="id-btn">
        Add
      </button>
      {onCancel ? (
        <button type="button" className="id-btn" onClick={onCancel}>
          Done
        </button>
      ) : null}
    </form>
  )
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
  const list = steps ?? []
  const [addingUnder, setAddingUnder] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const remove = (step: Subtask) => {
    const inner = flattenSteps(step.subtasks).length
    if (inner > 0 && !window.confirm(`Delete "${step.description}" and its ${inner} nested steps?`)) return
    onChange(removeNestedStep(list, step.id))
    onRemoved?.([step.id, ...flattenSteps(step.subtasks).map((s) => s.id)])
    if (addingUnder && (addingUnder === step.id || findStep(step.subtasks ?? [], addingUnder))) setAddingUnder(null)
  }

  const renderStep = (step: Subtask, depth: number) => {
    const kids = step.subtasks ?? []
    const isCollapsed = collapsed.has(step.id)
    const counts = effectiveDurationMinutes(step.estimatedDuration, kids)
    const progress = internalStepProgress(kids)
    return (
      <li key={step.id} className={`id-step${step.completed ? " is-done" : ""}`} data-depth={depth}>
        <div className="id-step-row">
          {kids.length ? (
            <button
              type="button"
              className="id-step-fold"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Show nested steps" : "Hide nested steps"}
              onClick={() => toggleCollapsed(step.id)}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : (
            <span className="id-step-fold is-empty" aria-hidden />
          )}
          <Checkbox
            checked={step.completed}
            aria-label={`Complete ${step.description}`}
            onCheckedChange={() => onChange(updateNestedStep(list, step.id, { completed: !step.completed }))}
          />
          <input
            key={`d-${step.description}`}
            className="id-step-title"
            defaultValue={step.description}
            aria-label="Step"
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (!v) e.currentTarget.value = step.description
              else if (v !== step.description) onChange(updateNestedStep(list, step.id, { description: v }))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
            }}
          />
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
            className="id-step-btn"
            title="Break into steps"
            aria-label={`Add step inside ${step.description}`}
            aria-pressed={addingUnder === step.id}
            onClick={() => {
              setAddingUnder((cur) => (cur === step.id ? null : step.id))
              if (isCollapsed) toggleCollapsed(step.id)
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="id-step-btn is-del"
            title="Delete"
            aria-label={`Delete ${step.description}`}
            onClick={() => remove(step)}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {isCollapsed ? null : (
          <>
            {kids.length ? <ul className="id-steps">{kids.map((k) => renderStep(k, depth + 1))}</ul> : null}
            {addingUnder === step.id ? (
              <StepComposer
                nested
                onAdd={(description, minutes) =>
                  onChange(addNestedStep(list, step.id, { description, estimatedDuration: minutes }))
                }
                onCancel={() => setAddingUnder(null)}
              />
            ) : null}
          </>
        )}
      </li>
    )
  }

  const all = flattenSteps(list)
  const total = effectiveDurationMinutes(undefined, list)
  return (
    <div className="id-step-tree">
      <StepComposer nested={false} onAdd={(description, minutes) => onChange(addNestedStep(list, null, { description, estimatedDuration: minutes }))} />
      {list.length ? (
        <ul className="id-steps is-root">{list.map((s) => renderStep(s, 0))}</ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">No subtasks yet. Add one, then use + on any step to break it down further.</p>
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
