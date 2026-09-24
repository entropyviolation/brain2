/**
 * components/Operations/PartsPanel.tsx — Formulas, part pages, ideas, glance
 *
 * The Parts tab. A kind is a formula (Issue → Articles of drafted / written /
 * formatted; or just Room). Each part has its own page: its stages, the parts
 * inside it, and ideas that are not tasks. The board tallies the labels you
 * choose to keep in view.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { OPERATION_ATTR } from "@/lib/operation-types"
import {
  childFormulas,
  formulaCounts,
  formulaDescendantIds,
  glanceLabelUniverse,
  glanceMeters,
  instanceTaskProgress,
  instancesOf,
  partTaskFor,
  readPartFormulas,
  readPartInstances,
  resolveGlanceSelection,
  topLevelFormulas,
  type PartFormula,
  type PartInstance,
} from "@/lib/operation-parts"
import type { Task } from "@/lib/types"
import {
  addPartIdea,
  addPartInstance,
  deletePartFormula,
  deletePartInstance,
  removePartIdea,
  renamePartInstance,
  savePartFormula,
  setPartsGlance,
  setTaskCompleted,
  syncAllPartTasks,
} from "./operation-actions"

export function PartsPanel({ operation }: { operation: Task }) {
  const tasks = useTaskStore((s) => s.tasks)
  const live = tasks.find((task) => task.id === operation.id) ?? operation
  const formulas = useMemo(
    () => readPartFormulas(live.attributes?.[OPERATION_ATTR.partFormulas]),
    [live],
  )
  const instances = useMemo(
    () => readPartInstances(live.attributes?.[OPERATION_ATTR.partInstances]),
    [live],
  )
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    syncAllPartTasks(operation.id)
  }, [operation.id])

  useEffect(() => {
    setOpenId(null)
  }, [operation.id])

  const open = instances.find((instance) => instance.id === openId) ?? null

  if (open) {
    return (
      <PartPage
        operationId={operation.id}
        instance={open}
        formulas={formulas}
        instances={instances}
        tasks={tasks}
        onOpen={setOpenId}
        onBack={() => setOpenId(open.parentInstanceId)}
      />
    )
  }

  return (
    <PartsBoard
      operationId={operation.id}
      formulas={formulas}
      instances={instances}
      tasks={tasks}
      glanceStored={live.attributes?.[OPERATION_ATTR.partsGlance]}
      onOpen={setOpenId}
    />
  )
}

function PartsBoard({
  operationId,
  formulas,
  instances,
  tasks,
  glanceStored,
  onOpen,
}: {
  operationId: string
  formulas: PartFormula[]
  instances: PartInstance[]
  tasks: Task[]
  glanceStored: unknown
  onOpen: (id: string) => void
}) {
  const universe = useMemo(() => glanceLabelUniverse(formulas), [formulas])
  const selected = resolveGlanceSelection(glanceStored, universe)
  const meters = glanceMeters(formulas, instances, tasks, selected)
  const counts = formulaCounts(formulas, instances).filter((count) => count.count > 0)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kindName, setKindName] = useState("")
  const [parentId, setParentId] = useState("")
  const [stagesDraft, setStagesDraft] = useState("")
  const [finishDraft, setFinishDraft] = useState("")
  const [partDrafts, setPartDrafts] = useState<Record<string, string>>({})

  const descendants = editingId ? formulaDescendantIds(formulas, editingId) : new Set<string>()
  const parentOptions = formulas.filter((formula) => formula.id !== editingId && !descendants.has(formula.id))

  const resetKind = () => {
    setEditingId(null)
    setKindName("")
    setParentId("")
    setStagesDraft("")
    setFinishDraft("")
  }

  const saveKind = () => {
    if (!kindName.trim()) return
    savePartFormula(operationId, {
      id: editingId ?? undefined,
      name: kindName,
      parentFormulaId: parentId || null,
      stages: stagesDraft,
      finishSteps: finishDraft,
    })
    resetKind()
  }

  const editKind = (formula: PartFormula) => {
    setEditingId(formula.id)
    setKindName(formula.name)
    setParentId(formula.parentFormulaId ?? "")
    setStagesDraft(formula.stages.join(", "))
    setFinishDraft(formula.finishSteps.join(", "))
  }

  const toggleMetric = (label: string, on: boolean) => {
    const next = on ? [...selected, label] : selected.filter((entry) => entry.toLowerCase() !== label.toLowerCase())
    setPartsGlance(operationId, next)
  }

  return (
    <div className="ops-panel">
      <div className="ops-glance" aria-label="Completion at a glance">
        {counts.map((count) => (
          <span key={count.id} className="ops-glance-metric">
            <strong>{count.count}</strong> {count.name}
          </span>
        ))}
        {meters.map((meter) => (
          <span key={meter.label} className="ops-glance-metric">
            <strong>
              {meter.done}/{meter.total}
            </strong>{" "}
            {meter.label}
          </span>
        ))}
        {formulas.length > 0 && (
          <button type="button" className="ops-btn" onClick={() => setMetricsOpen((open) => !open)}>
            {metricsOpen ? "Hide metrics" : "Metrics"}
          </button>
        )}
      </div>

      {metricsOpen && (
        <div className="ops-deck">
          <div className="ops-deck-head">
            At a glance
            <span>Choose what the board counts</span>
          </div>
          <div className="ops-panel-grid">
            {universe.map((label) => (
              <label key={label} className="ops-check">
                <input
                  type="checkbox"
                  checked={selected.some((entry) => entry.toLowerCase() === label.toLowerCase())}
                  onChange={(e) => toggleMetric(label, e.target.checked)}
                />
                <span>
                  <strong>{label}</strong>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="ops-deck">
        <div className="ops-deck-head">
          Kinds
          <span>The formula for a part</span>
        </div>
        <p className="ops-hint">
          A kind is the shape every part of that sort shares. A magazine might have Issues that
          contain Articles — drafted, then written, then formatted — and finish with ordered, printed.
          Cleaning the house might only be Rooms, with no stages at all.
        </p>
        {formulas.length === 0 ? (
          <p className="ops-hint">No kinds yet.</p>
        ) : (
          <ul className="ops-kind-list">
            {formulas.map((formula) => {
              const parent = formulas.find((entry) => entry.id === formula.parentFormulaId)
              const used = instances.some((instance) => instance.formulaId === formula.id)
              const hasChildren = childFormulas(formulas, formula.id).length > 0
              return (
                <li key={formula.id} className="ops-kind">
                  <div className="min-w-0 flex-1">
                    <strong>{formula.name}</strong>
                    <div className="ops-hint">
                      {parent ? `Inside ${parent.name}. ` : "Top level. "}
                      {formula.stages.length > 0 ? formula.stages.join(" → ") : "No stages"}
                      {formula.finishSteps.length > 0 ? ` · then ${formula.finishSteps.join(" → ")}` : ""}
                    </div>
                  </div>
                  <button type="button" className="ops-btn" onClick={() => editKind(formula)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ops-btn ops-icon-btn"
                    aria-label={`Remove kind ${formula.name}`}
                    title={used || hasChildren ? "Remove its parts and child kinds first" : "Remove kind"}
                    disabled={used || hasChildren}
                    onClick={() => deletePartFormula(operationId, formula.id)}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="ops-kind-form">
          <div>
            <label htmlFor="ops-kind-name">{editingId ? "Rename kind" : "New kind"}</label>
            <input
              id="ops-kind-name"
              className="ops-input"
              value={kindName}
              onChange={(e) => setKindName(e.target.value)}
              placeholder="Issue, Article, Room…"
            />
          </div>
          <div>
            <label htmlFor="ops-kind-parent">Lives inside</label>
            <select
              id="ops-kind-parent"
              className="ops-input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Top level</option>
              {parentOptions.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ops-kind-stages">Stages</label>
            <input
              id="ops-kind-stages"
              className="ops-input"
              value={stagesDraft}
              onChange={(e) => setStagesDraft(e.target.value)}
              placeholder="drafted, written, formatted"
            />
          </div>
          <div>
            <label htmlFor="ops-kind-finish">When finished</label>
            <input
              id="ops-kind-finish"
              className="ops-input"
              value={finishDraft}
              onChange={(e) => setFinishDraft(e.target.value)}
              placeholder="ordered, printed"
            />
          </div>
          <div className="ops-kind-form-actions">
            <button type="button" className="ops-btn ops-btn-default" onClick={saveKind} disabled={!kindName.trim()}>
              {editingId ? "Save kind" : "Add kind"}
            </button>
            {editingId && (
              <button type="button" className="ops-btn" onClick={resetKind}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ops-deck">
        <div className="ops-deck-head">
          Parts
          <span>Each one opens its own page</span>
        </div>
        {topLevelFormulas(formulas).length === 0 ? (
          <p className="ops-hint">Add a kind, then name the parts that follow it.</p>
        ) : (
          topLevelFormulas(formulas).map((formula) => {
            const rows = instancesOf(instances, formula.id, null)
            const draft = partDrafts[formula.id] ?? ""
            return (
              <section key={formula.id} className="ops-part-group">
                <h3>{formula.name}</h3>
                {rows.length === 0 ? (
                  <p className="ops-hint">None yet.</p>
                ) : (
                  rows.map((instance) => (
                    <PartCard
                      key={instance.id}
                      instance={instance}
                      formula={formula}
                      formulas={formulas}
                      instances={instances}
                      tasks={tasks}
                      onOpen={() => onOpen(instance.id)}
                      onRemove={() => deletePartInstance(operationId, instance.id)}
                    />
                  ))
                )}
                <div className="ops-add-row">
                  <input
                    className="ops-input"
                    value={draft}
                    aria-label={`New ${formula.name}`}
                    placeholder={`New ${formula.name.toLowerCase()}…`}
                    onChange={(e) => setPartDrafts((prev) => ({ ...prev, [formula.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draft.trim()) {
                        addPartInstance(operationId, formula.id, draft, null)
                        setPartDrafts((prev) => ({ ...prev, [formula.id]: "" }))
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ops-btn"
                    disabled={!draft.trim()}
                    onClick={() => {
                      addPartInstance(operationId, formula.id, draft, null)
                      setPartDrafts((prev) => ({ ...prev, [formula.id]: "" }))
                    }}
                  >
                    Add
                  </button>
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function PartCard({
  instance,
  formula,
  formulas,
  instances,
  tasks,
  onOpen,
  onRemove,
}: {
  instance: PartInstance
  formula: PartFormula
  formulas: PartFormula[]
  instances: PartInstance[]
  tasks: Task[]
  onOpen: () => void
  onRemove: () => void
}) {
  const progress = instanceTaskProgress(instance, formula, tasks)
  const nested = instances.filter((entry) => entry.parentInstanceId === instance.id).length
  const ideaCount = instance.ideas.length
  const meta = [
    progress.total > 0 ? `${progress.done}/${progress.total}` : null,
    nested > 0 ? `${nested} inside` : null,
    ideaCount > 0 ? `${ideaCount} idea${ideaCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="ops-part-card">
      <button type="button" className="ops-part-open" aria-label={`Open ${instance.title}`} onClick={onOpen}>
        <strong>{instance.title}</strong>
        <span>{meta || formulas.find((entry) => entry.id === formula.id)?.name}</span>
      </button>
      <button type="button" className="ops-btn ops-icon-btn" aria-label={`Remove ${instance.title}`} onClick={onRemove}>
        ×
      </button>
    </div>
  )
}

function PartPage({
  operationId,
  instance,
  formulas,
  instances,
  tasks,
  onOpen,
  onBack,
}: {
  operationId: string
  instance: PartInstance
  formulas: PartFormula[]
  instances: PartInstance[]
  tasks: Task[]
  onOpen: (id: string) => void
  onBack: () => void
}) {
  const formula = formulas.find((entry) => entry.id === instance.formulaId)
  const [title, setTitle] = useState(instance.title)
  const [ideaDraft, setIdeaDraft] = useState("")
  const [childDrafts, setChildDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setTitle(instance.title)
  }, [instance.id, instance.title])

  const commitTitle = () => {
    if (title.trim() && title.trim() !== instance.title) renamePartInstance(operationId, instance.id, title)
  }

  const submitIdea = () => {
    if (!ideaDraft.trim()) return
    addPartIdea(operationId, instance.id, ideaDraft)
    setIdeaDraft("")
  }

  const crumbs = breadcrumb(instance, instances)

  return (
    <div className="ops-panel">
      <div className="ops-part-nav">
        <button type="button" className="ops-btn" onClick={onBack}>
          {instance.parentInstanceId ? "Back" : "All parts"}
        </button>
        <span className="ops-hint">{crumbs.join(" / ")}</span>
      </div>

      <div className="ops-deck">
        <div className="ops-deck-head">
          {formula?.name ?? "Part"}
          <span>This page</span>
        </div>
        <label htmlFor="ops-part-title">Name</label>
        <input
          id="ops-part-title"
          className="ops-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />

        {formula && (formula.stages.length > 0 || formula.finishSteps.length > 0) && (
          <ul className="ops-part-steps">
            {formula.stages.map((label) => (
              <StepRow
                key={`stage-${label}`}
                label={label}
                task={partTaskFor(tasks, instance.id, "stage", label)}
              />
            ))}
            {formula.finishSteps.map((label) => (
              <StepRow
                key={`finish-${label}`}
                label={label}
                task={partTaskFor(tasks, instance.id, "finish", label)}
                note="when finished"
              />
            ))}
          </ul>
        )}
        {formula && formula.stages.length === 0 && formula.finishSteps.length === 0 && (
          <p className="ops-hint">This kind has no stages. It is a place for the parts and ideas inside it.</p>
        )}
      </div>

      {formula &&
        childFormulas(formulas, formula.id).map((child) => {
          const rows = instancesOf(instances, child.id, instance.id)
          const draft = childDrafts[child.id] ?? ""
          return (
            <div key={child.id} className="ops-deck">
              <div className="ops-deck-head">
                {child.name}
                <span>
                  {rows.length} inside
                </span>
              </div>
              {rows.map((row) => (
                <PartCard
                  key={row.id}
                  instance={row}
                  formula={child}
                  formulas={formulas}
                  instances={instances}
                  tasks={tasks}
                  onOpen={() => onOpen(row.id)}
                  onRemove={() => deletePartInstance(operationId, row.id)}
                />
              ))}
              <div className="ops-add-row">
                <input
                  className="ops-input"
                  value={draft}
                  aria-label={`New ${child.name}`}
                  placeholder={`New ${child.name.toLowerCase()}…`}
                  onChange={(e) => setChildDrafts((prev) => ({ ...prev, [child.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !draft.trim()) return
                    addPartInstance(operationId, child.id, draft, instance.id)
                    setChildDrafts((prev) => ({ ...prev, [child.id]: "" }))
                  }}
                />
                <button
                  type="button"
                  className="ops-btn"
                  disabled={!draft.trim()}
                  onClick={() => {
                    addPartInstance(operationId, child.id, draft, instance.id)
                    setChildDrafts((prev) => ({ ...prev, [child.id]: "" }))
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )
        })}

      <div className="ops-deck">
        <div className="ops-deck-head">
          Ideas
          <span>Not to-dos</span>
        </div>
        <p className="ops-hint">Notes that belong to this part. They stay here and do not join To do.</p>
        {instance.ideas.length === 0 ? (
          <p className="ops-hint">No ideas yet.</p>
        ) : (
          <ul className="ops-idea-list">
            {instance.ideas.map((idea) => (
              <li key={idea.id} className="ops-idea">
                <span>{idea.text}</span>
                <button
                  type="button"
                  className="ops-btn ops-icon-btn"
                  aria-label={`Remove idea ${idea.text}`}
                  onClick={() => removePartIdea(operationId, instance.id, idea.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="ops-add-row">
          <input
            className="ops-input"
            value={ideaDraft}
            aria-label="New idea"
            placeholder="Save an idea…"
            onChange={(e) => setIdeaDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitIdea()}
          />
          <button type="button" className="ops-btn" onClick={submitIdea} disabled={!ideaDraft.trim()}>
            Add idea
          </button>
        </div>
      </div>
    </div>
  )
}

function StepRow({
  label,
  task,
  note,
}: {
  label: string
  task: Task | undefined
  note?: string
}) {
  return (
    <li className="ops-part-step">
      <input
        type="checkbox"
        checked={!!task?.completed}
        disabled={!task}
        aria-label={`Toggle ${label}`}
        onChange={(e) => task && setTaskCompleted(task.id, e.target.checked)}
      />
      <span className={task?.completed ? "line-through" : undefined}>{label}</span>
      {note && <em className="ops-hint">{note}</em>}
    </li>
  )
}

function breadcrumb(instance: PartInstance, instances: PartInstance[]): string[] {
  const names: string[] = [instance.title]
  let parentId = instance.parentInstanceId
  const guard = new Set<string>([instance.id])
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = instances.find((entry) => entry.id === parentId)
    if (!parent) break
    names.unshift(parent.title)
    parentId = parent.parentInstanceId
  }
  return names
}

export default PartsPanel
