/**
 * components/Operations/OperationSettingsDialog.tsx — per-operation settings
 *
 * An operation is not assumed to be shaped like a trip: this dialog is where the
 * user decides what *this* operation is. It edits
 *
 *   - identity: name, mission, stage, target date;
 *   - **categories** — free-form labels an operation can hold several of
 *     ("paid" *and* "foxtide job"). Existing categories across all operations are
 *     offered as suggestions; typing a new one creates it;
 *   - **panels** — which prebuilt panels the workspace shows (`OPERATION_PANELS`),
 *     plus one-click presets (Trip / Project / Paid job / Blank);
 *   - **tracking tags** — the same tag library Home → Tracking uses, so
 *     "Working on this now" can auto-fill linked daily habits.
 *
 * Mirrors `components/ItemTypes/ItemTypeEditor.tsx` (the item-type analogue):
 * checkbox lists over a serializable definition, recipes/presets for a fast
 * start, everything persisted on the item itself.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTaskStore } from "@/lib/task-store"
import {
  OPERATION_ATTR,
  OPERATION_PANELS,
  OPERATION_PRESETS,
  OPERATION_STAGES,
  getOperationCategories,
  getOperationTrackingTagIds,
  operationCategoryKey,
  resolveOperationPanels,
  type OperationPanelId,
  type OperationStage,
} from "@/lib/operation-types"
import { collectOperationCategories, selectOperations } from "@/lib/operations"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useHabitsStore } from "@/lib/habits-store"
import { activeTrackingLink } from "@/lib/habit-tracking"
import type { Task } from "@/lib/types"
import {
  addOperationCategory,
  applyOperationPreset,
  removeOperationCategory,
  deleteOperation,
  renameOperation,
  setMission,
  setOperationTrackingTags,
  setStage,
  setTargetDate,
  toggleOperationPanel,
} from "./operation-actions"
import "./operations-chrome.css"

function attrString(operation: Task, id: string): string {
  const raw = operation.attributes?.[id]
  return typeof raw === "string" ? raw : ""
}

export function OperationSettingsDialog({
  operation,
  open,
  onClose,
  onDeleted,
}: {
  operation: Task
  open: boolean
  onClose: () => void
  /** Called after the operation is deleted, so the workspace can leave. */
  onDeleted?: () => void
}) {
  const allTasks = useTaskStore((s) => s.tasks)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const addTrackingTag = useTimeTrackingStore((s) => s.addTag)
  const habits = useHabitsStore((s) => s.tasks)
  const [nameDraft, setNameDraft] = useState(operation.description)
  const [missionDraft, setMissionDraft] = useState(attrString(operation, OPERATION_ATTR.mission))
  const [categoryDraft, setCategoryDraft] = useState("")
  const [tagDraft, setTagDraft] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categories = getOperationCategories(operation)
  const trackingTagIds = getOperationTrackingTagIds(operation)
  const panels = resolveOperationPanels(operation)
  const stage = (attrString(operation, OPERATION_ATTR.stage) || "planning") as OperationStage
  const targetDate = attrString(operation, OPERATION_ATTR.targetDate).slice(0, 10)

  const suggestions = useMemo(() => {
    const own = new Set(categories.map(operationCategoryKey))
    return collectOperationCategories(selectOperations(allTasks)).filter(
      (name) => !own.has(operationCategoryKey(name)),
    )
  }, [allTasks, categories])

  const commitCategory = () => {
    const name = categoryDraft.trim()
    if (!name) return
    addOperationCategory(operation.id, name)
    setCategoryDraft("")
  }

  const commitTag = () => {
    const name = tagDraft.trim()
    if (!name) return
    const id = addTrackingTag(name)
    setOperationTrackingTags(operation.id, [...trackingTagIds, id])
    setTagDraft("")
  }

  const toggleTag = (tagId: string, on: boolean) => {
    setOperationTrackingTags(
      operation.id,
      on ? [...trackingTagIds, tagId] : trackingTagIds.filter((id) => id !== tagId),
    )
  }

  const fedHabits = habits.filter((habit) => {
    const link = activeTrackingLink(habit)
    return link ? link.tagIds.some((id) => trackingTagIds.includes(id)) : false
  })

  const tabPanels = OPERATION_PANELS.filter((p) => p.surface === "tab")
  const railPanels = OPERATION_PANELS.filter((p) => p.surface === "rail")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="ops95-dialog sm:max-w-2xl">
        <DialogHeader className="ops-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="ops-title-text">Operation settings</DialogTitle>
          <button type="button" className="ops-title-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </DialogHeader>

        <div className="ops-dialog-body">
          <fieldset className="ops-group">
            <legend>Identity</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ops-set-name">Name</label>
                <input
                  id="ops-set-name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => renameOperation(operation.id, nameDraft)}
                />
              </div>
              <div>
                <label htmlFor="ops-set-stage">Stage</label>
                <select
                  id="ops-set-stage"
                  value={stage}
                  onChange={(e) => setStage(operation.id, e.target.value as OperationStage)}
                >
                  {OPERATION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ops-set-mission">Mission</label>
                <input
                  id="ops-set-mission"
                  value={missionDraft}
                  onChange={(e) => setMissionDraft(e.target.value)}
                  onBlur={() => setMission(operation.id, missionDraft)}
                  placeholder="What is this operation trying to achieve?"
                />
              </div>
              <div>
                <label htmlFor="ops-set-target">Target date</label>
                <input
                  id="ops-set-target"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(operation.id, e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="ops-group">
            <legend>Categories</legend>
            <p className="ops-hint">
              An operation can belong to several — e.g. <em>paid</em> and <em>foxtide job</em>. The
              home board groups by these. Type a new name to create one.
            </p>
            <div className="ops-chip-row">
              {categories.length === 0 && <span className="ops-hint">Uncategorized.</span>}
              {categories.map((name) => (
                <span key={name} className="ops-chip">
                  {name}
                  <button
                    type="button"
                    className="ops-chip-x"
                    aria-label={`Remove category ${name}`}
                    onClick={() => removeOperationCategory(operation.id, name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="ops-add-row">
              <input
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitCategory()
                  }
                }}
                placeholder="trip, paid, foxtide job…"
                aria-label="New category"
                list="ops-category-suggestions"
              />
              <datalist id="ops-category-suggestions">
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <button type="button" className="ops-btn" onClick={commitCategory} disabled={!categoryDraft.trim()}>
                Add category
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="ops-chip-row">
                {suggestions.slice(0, 12).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="ops-chip ops-chip-add"
                    onClick={() => addOperationCategory(operation.id, name)}
                  >
                    + {name}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="ops-group">
            <legend>Tracking & habits</legend>
            <p className="ops-hint">
              These are the same tags pens carry on Home → Tracking. "Working on this now"
              paints the Activity grid with them, so any daily habit linked to a tag here
              auto-fills from the minutes.
            </p>
            <div className="ops-panel-grid">
              {trackingTags.map((tag) => (
                <label key={tag.id} className="ops-check">
                  <input
                    type="checkbox"
                    checked={trackingTagIds.includes(tag.id)}
                    onChange={(e) => toggleTag(tag.id, e.target.checked)}
                  />
                  <span>
                    <strong>
                      <span className="ops-tag-dot" style={{ background: tag.color }} aria-hidden />
                      {tag.name}
                    </strong>
                  </span>
                </label>
              ))}
            </div>
            <div className="ops-add-row">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitTag()
                  }
                }}
                placeholder="new tag…"
                aria-label="New tracking tag"
              />
              <button type="button" className="ops-btn" onClick={commitTag} disabled={!tagDraft.trim()}>
                Add tag
              </button>
            </div>
            {fedHabits.length > 0 ? (
              <p className="ops-hint">Feeds habits: {fedHabits.map((h) => h.name).join(", ")}</p>
            ) : (
              <p className="ops-hint">
                No daily habit currently links these tags. Link a tag on a Goal / Yes-No
                habit under Auto-fill from Tracking.
              </p>
            )}
          </fieldset>

          <fieldset className="ops-group">
            <legend>Panels</legend>
            <p className="ops-hint">
              Only the panels you switch on appear in this workspace.
            </p>
            <div className="ops-panel-grid">
              {tabPanels.map((panel) => (
                <label key={panel.id} className="ops-check">
                  <input
                    type="checkbox"
                    checked={panels.includes(panel.id)}
                    disabled={panel.locked}
                    onChange={(e) =>
                      toggleOperationPanel(operation.id, panel.id as OperationPanelId, e.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      {panel.label}
                      {panel.locked ? " (always on)" : ""}
                    </strong>
                    <em>{panel.description}</em>
                  </span>
                </label>
              ))}
            </div>
            <div className="ops-panel-grid">
              {railPanels.map((panel) => (
                <label key={panel.id} className="ops-check">
                  <input
                    type="checkbox"
                    checked={panels.includes(panel.id)}
                    onChange={(e) =>
                      toggleOperationPanel(operation.id, panel.id as OperationPanelId, e.target.checked)
                    }
                  />
                  <span>
                    <strong>{panel.label}</strong>
                    <em>{panel.description}</em>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="ops-group">
            <legend>Presets</legend>
            <p className="ops-hint">
              Replace the panel selection with a prebuilt set. Categories a preset suggests are
              added, never removed.
            </p>
            <div className="ops-preset-row">
              {OPERATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="ops-preset"
                  onClick={() => applyOperationPreset(operation.id, preset.id)}
                >
                  <strong>{preset.name}</strong>
                  <em>{preset.description}</em>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="ops-group">
            <legend>Delete</legend>
            <p className="ops-hint">
              Removes this operation, its to-do list, its phases, and its parts.
            </p>
            <button type="button" className="ops-btn ops-btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete operation
            </button>
          </fieldset>
        </div>

        <div className="ops-actions">
          <button type="button" className="ops-btn ops-btn-default" onClick={onClose}>
            Done
          </button>
        </div>
      </DialogContent>

      <Dialog open={confirmDelete} onOpenChange={(next) => !next && setConfirmDelete(false)}>
        <DialogContent className="ops95-dialog sm:max-w-md">
          <DialogHeader className="ops-title-bar flex-row items-center space-y-0 text-left">
            <DialogTitle className="ops-title-text">Are you sure?</DialogTitle>
            <button type="button" className="ops-title-btn" aria-label="Close" onClick={() => setConfirmDelete(false)}>
              ×
            </button>
          </DialogHeader>
          <div className="ops-dialog-body">
            <p>
              Delete <strong>{operation.description}</strong>? This removes the operation, its to-do
              list, its phases, and its parts.
            </p>
          </div>
          <div className="ops-actions">
            <button type="button" className="ops-btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="ops-btn ops-btn-danger"
              onClick={() => {
                deleteOperation(operation.id)
                setConfirmDelete(false)
                onClose()
                onDeleted?.()
              }}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

export default OperationSettingsDialog
