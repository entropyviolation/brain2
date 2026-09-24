/**
 * components/Operations/OperationsView.tsx — Top-level Operations surface
 *
 * The home page for every operation. Operations are filed under any number of
 * free-form **categories** ("trip", "paid", "foxtide job", "computer work", …),
 * so this board can group by category — an operation that is both *paid* and
 * *foxtide job* appears under both — filter to a subset of categories with a
 * checkbox strip (the same affordance as the Lists All view), and sort within
 * each group by name, stage, target date, or recency.
 *
 * New operations are created inline from a **preset**, which decides the panels
 * the workspace starts with (nothing is assumed to be trip-shaped). Selecting an
 * operation mounts its `OperationWorkspace`.
 *
 * Mounted from the app shell's "Operations" tab (`app/page.tsx`).
 */
"use client"

import { useMemo, useState, useEffect } from "react"
import { Rocket } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import {
  OPERATION_ATTR,
  OPERATION_PRESETS,
  getOperationCategories,
  operationCategoryKey,
  resolveOperationPanels,
  type OperationStage,
} from "@/lib/operation-types"
import {
  collectOperationCategories,
  filterOperationsByCategory,
  groupOperationsByCategory,
  isArchivedOperation,
  selectOperations,
  type OperationSortMode,
} from "@/lib/operations"
import type { Task } from "@/lib/types"
import { OperationWorkspace } from "./OperationWorkspace"
import { createOperation } from "./operation-actions"
import { APP_NAV_KEYS, readStoredId, writeStoredId } from "@/lib/app-navigation"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import "./operations-chrome.css"

const SORT_LABELS: Record<OperationSortMode, string> = {
  name: "Name",
  stage: "Stage",
  target: "Target date",
  recent: "Newest",
}

interface OperationsViewProps {
  /** Optional callback to open a non-operation item elsewhere in the app. */
  onTaskSelect?: (taskId: string) => void
}

function OperationCard({ operation, onOpen }: { operation: Task; onOpen: () => void }) {
  const stage = (operation.attributes?.[OPERATION_ATTR.stage] as OperationStage) ?? "planning"
  const mission =
    typeof operation.attributes?.[OPERATION_ATTR.mission] === "string"
      ? (operation.attributes[OPERATION_ATTR.mission] as string)
      : ""
  const categories = getOperationCategories(operation)
  const panelCount = resolveOperationPanels(operation).length

  return (
    <button type="button" className="ops-card" onClick={onOpen}>
      <div className="ops-card-head">
        <span>{operation.description}</span>
        <span className={`ops-stage ops-stage-${stage}`}>{stage}</span>
      </div>
      <div className="ops-card-body">{mission.trim() ? mission : "No mission set."}</div>
      <div className="ops-card-foot">
        <span className="ops-chip-row">
          {categories.length === 0 ? (
            <span className="ops-chip ops-chip-muted">uncategorized</span>
          ) : (
            categories.map((name) => (
              <span key={name} className="ops-chip ops-chip-static">
                {name}
              </span>
            ))
          )}
        </span>
        <span className="ops-card-meta">{panelCount} panels</span>
      </div>
    </button>
  )
}

export function OperationsView({ onTaskSelect }: OperationsViewProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const hydrated = usePersistHydrated(useTaskStore.persist)
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredId(APP_NAV_KEYS.opsId))
  const [newTitle, setNewTitle] = useState("")
  const [presetId, setPresetId] = useState(OPERATION_PRESETS[0].id)
  const [sort, setSort] = useState<OperationSortMode>("name")
  const [grouped, setGrouped] = useState(true)
  const [hiddenCategoryKeys, setHiddenCategoryKeys] = useState<string[]>([])
  const [hideUncategorized, setHideUncategorized] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const operations = useMemo(() => selectOperations(tasks), [tasks])
  const archivedCount = useMemo(() => operations.filter((op) => isArchivedOperation(op)).length, [operations])
  const boardOps = useMemo(
    () => (showArchived ? operations : operations.filter((op) => !isArchivedOperation(op))),
    [operations, showArchived],
  )
  const categories = useMemo(() => collectOperationCategories(boardOps), [boardOps])

  useEffect(() => {
    writeStoredId(APP_NAV_KEYS.opsId, selectedId)
  }, [selectedId])

  useEffect(() => {
    if (!hydrated) return
    if (!selectedId) return
    if (operations.some((op) => op.id === selectedId)) return
    setSelectedId(null)
  }, [hydrated, operations, selectedId])

  // `undefined` = no filter; an empty array = every category deselected.
  const visibleCategoryKeys = useMemo(() => {
    if (hiddenCategoryKeys.length === 0) return undefined
    const hidden = new Set(hiddenCategoryKeys)
    return categories.map(operationCategoryKey).filter((key) => !hidden.has(key))
  }, [categories, hiddenCategoryKeys])

  const groups = useMemo(
    () =>
      groupOperationsByCategory(boardOps, {
        sort,
        visibleCategoryKeys,
        hideUncategorized,
      }),
    [boardOps, sort, visibleCategoryKeys, hideUncategorized],
  )

  const flat = useMemo(
    () => filterOperationsByCategory(boardOps, { sort, visibleCategoryKeys, hideUncategorized }),
    [boardOps, sort, visibleCategoryKeys, hideUncategorized],
  )

  if (selectedId) {
    return (
      <OperationWorkspace
        operationId={selectedId}
        onBack={() => setSelectedId(null)}
        onOpenItem={onTaskSelect}
      />
    )
  }

  const handleCreate = () => {
    const title = newTitle.trim()
    if (!title) return
    const op = createOperation(title, { presetId })
    setNewTitle("")
    setSelectedId(op.id)
  }

  const toggleCategory = (key: string, visible: boolean) => {
    setHiddenCategoryKeys((prev) =>
      visible ? prev.filter((k) => k !== key) : prev.includes(key) ? prev : [...prev, key],
    )
  }

  const shown = grouped
    ? new Set(groups.flatMap((g) => g.operations.map((o) => o.id))).size
    : flat.length

  return (
    <div
      className="ops95"
      data-ui-name="Operations"
      data-ui-help="Command center for project operations — board, panels, and working-now clock."
      data-ui-docs="components/Operations/README.md"
    >
      <div className="ops-window">
        <div className="ops-fascia">
          <div className="ops-mark">
            <span className="ops-power-lamp is-on" aria-hidden />
            <Rocket className="ops-title-icon" aria-hidden />
            <h2>Operations — Command Center</h2>
          </div>
          <div className="ops-menubar">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Name a new operation…"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
              aria-label="New operation name"
            />
            <label className="ops-inline-label" htmlFor="ops-new-preset">
              Shape
            </label>
            <select
              id="ops-new-preset"
              className="ops-input ops-input-sm"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              title={OPERATION_PRESETS.find((p) => p.id === presetId)?.description}
            >
              {OPERATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button type="button" className="ops-btn ops-btn-default" onClick={handleCreate} disabled={!newTitle.trim()}>
              New Operation
            </button>
          </div>
        </div>

        {operations.length > 0 && (
          <div className="ops-toolbar">
            <label className="ops-inline-label" htmlFor="ops-sort">
              Sort
            </label>
            <select
              id="ops-sort"
              className="ops-input ops-input-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as OperationSortMode)}
            >
              {(Object.keys(SORT_LABELS) as OperationSortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </option>
              ))}
            </select>
            <label className="ops-check ops-check-inline">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
              />
              Group by category
            </label>
            <button
              type="button"
              className="ops-btn"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((on) => !on)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
            {(categories.length > 0 || boardOps.some((op) => getOperationCategories(op).length === 0)) && (
              <div className="ops-filter" role="group" aria-label="Filter categories">
                {categories.map((name) => {
                  const key = operationCategoryKey(name)
                  return (
                    <label key={key} className="ops-filter-item">
                      <input
                        type="checkbox"
                        checked={!hiddenCategoryKeys.includes(key)}
                        onChange={(e) => toggleCategory(key, e.target.checked)}
                      />
                      {name}
                    </label>
                  )
                })}
                <label className="ops-filter-item">
                  <input
                    type="checkbox"
                    checked={!hideUncategorized}
                    onChange={(e) => setHideUncategorized(!e.target.checked)}
                  />
                  Uncategorized
                </label>
              </div>
            )}
          </div>
        )}

        <div className="ops-body">
          {operations.length === 0 ? (
            <div className="ops-empty">
              <p>
                No operations yet. Name one above, pick the shape it should start as, or upgrade an
                existing task from its detail view.
              </p>
            </div>
          ) : shown === 0 ? (
            <div className="ops-empty">
              <p>
                {!showArchived && boardOps.length === 0 && archivedCount > 0
                  ? "Completed and inactive operations are hidden. Show archived to see them."
                  : "No operations match the selected categories."}
              </p>
            </div>
          ) : grouped ? (
            <div className="ops-groups">
              {groups.map((group) => (
                <section key={group.key || "__uncategorized__"} className="ops-category">
                  <h3 className="ops-category-head">
                    <span>{group.name}</span>
                    <span className="ops-category-count">{group.operations.length}</span>
                  </h3>
                  <div className="ops-board">
                    {group.operations.map((op) => (
                      <OperationCard key={op.id} operation={op} onOpen={() => setSelectedId(op.id)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="ops-board">
              {flat.map((op) => (
                <OperationCard key={op.id} operation={op} onOpen={() => setSelectedId(op.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="ops-status">
          <span className="ops-status-led" aria-hidden />
          {shown} showing
          {archivedCount > 0 && !showArchived ? ` · ${archivedCount} archived hidden` : ""}
          {showArchived && archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
          {" · "}
          {categories.length} categor{categories.length === 1 ? "y" : "ies"}
        </div>
      </div>
    </div>
  )
}

export default OperationsView
