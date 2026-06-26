/**
 * components/Modules/workspace/module-view-bodies.tsx — Workspace view panels
 *
 * The per-kind render bodies for a workspace module's bound views plus the
 * `ModuleViewBody` switch. Each view reads items from a source list (category)
 * and presents them a chosen way:
 *   - spreadsheet : editable Google-Sheets-style grid (reuses SheetGrid)
 *   - checklist   : check/complete + add
 *   - agenda      : items grouped by a date attribute (the Itinerary view)
 *   - summary     : rollups (count + sum) grouped by an attribute
 *   - randomizer  : gamified "pick N" with an optional countdown
 *   - timer       : a focus countdown
 *   - stat        : a single analytics headline number
 *   - gallery     : image cards
 *   - notes       : free text (persisted to localStorage)
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, RotateCcw, RefreshCw, Plus, Check, Link2, AlertTriangle, Sparkles } from "lucide-react"
import { Trophy } from "lucide-react"
import type { AttributeDefinition, AttributeValue, FileValue, ItemLink, Task, List } from "@/lib/types"
import { useModulesStore, type DashboardCard, type ModuleView } from "@/lib/modules-store"
import { useTaskStore } from "@/lib/task-store"
import { createListItem, withCategoryDefaults, getItemLabel } from "@/lib/item-utils"
import { safeDateFormat } from "@/lib/date-utils"
import { formatAttributeValue } from "@/components/Lists/attribute-editor"
import { SheetGrid } from "@/components/spreadsheet/SheetGrid"
import {
  aggregateColumn,
  aggregateIncluded,
  formatNumber,
  isCurrencyAttribute,
  isIncluded,
  rollup,
  sumBy,
  toNumber,
} from "@/lib/spreadsheet-utils"
import { scoreDecisionMatrix, type MatrixCriterion, type MatrixOption } from "@/lib/decision-matrix"
import { rand, randN } from "@/components/Modules/module-helpers"
import { findBookMatch, type BookMatchCandidate } from "@/lib/book-match"
import { AnalyticsStat } from "@/components/Modules/module-bodies"
import {
  KANBAN_BACKLOG,
  deriveKanbanColumns,
  statusValueToWrite,
} from "@/components/Lists/list-content/kanban-utils"

function getDef(cat: List | undefined, id?: string): AttributeDefinition | undefined {
  if (!cat || !id) return undefined
  return cat.itemAttributes?.find((d) => d.id === id)
}

/** Items in the view's source list, applying an optional attribute-equality filter. */
function useViewTasks(view: ModuleView): { tasks: Task[]; category?: List } {
  const allTasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const { categoryId, filterAttrId, filterValue } = view.config
  return useMemo(() => {
    const category = categories.find((c) => c.id === categoryId)
    let tasks = categoryId ? allTasks.filter((t) => t.lists?.includes(categoryId)) : []
    if (filterAttrId && filterValue) {
      tasks = tasks.filter((t) => String(t.attributes?.[filterAttrId] ?? "") === filterValue)
    }
    return { tasks, category }
  }, [allTasks, categories, categoryId, filterAttrId, filterValue])
}

export function ModuleViewBody({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  switch (view.kind) {
    case "spreadsheet":
      return <SpreadsheetView view={view} onOpenItem={onOpenItem} />
    case "checklist":
      return <ChecklistView view={view} onOpenItem={onOpenItem} />
    case "agenda":
      return <AgendaView view={view} onOpenItem={onOpenItem} />
    case "summary":
      return <SummaryView view={view} />
    case "randomizer":
      return <RandomizerView view={view} onOpenItem={onOpenItem} />
    case "timer":
      return <TimerView minutes={view.config.timerMinutes ?? 25} />
    case "stat":
      return <AnalyticsStat stat={view.config.stat || "points-week"} />
    case "gallery":
      return <GalleryView view={view} onOpenItem={onOpenItem} />
    case "notes":
      return <NotesView notesKey={view.config.notesKey || `notes-${view.id}`} />
    case "decision-matrix":
      return <DecisionMatrixView view={view} onOpenItem={onOpenItem} />
    case "kanban":
      return <KanbanView view={view} onOpenItem={onOpenItem} />
    case "timeline":
      return <TimelineView view={view} onOpenItem={onOpenItem} />
    case "matcher":
      return <MatcherView view={view} onOpenItem={onOpenItem} />
    case "quiz":
      return <QuizView view={view} onOpenItem={onOpenItem} />
    case "dashboard":
      return <DashboardView view={view} onOpenItem={onOpenItem} />
    default:
      return null
  }
}

/** Coerce a scalar attribute value to plain text (undefined for objects/arrays). */
function toText(value: AttributeValue | undefined): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

/** Read a task's matchable/quiz text: a string attr, attached file's extracted
 * text, or (fallback) the item description. Powers matcher + quiz. */
function taskSearchText(task: Task, attrId?: string): string {
  if (attrId) {
    const raw = task.attributes?.[attrId]
    const files: FileValue[] = Array.isArray(raw)
      ? (raw.filter((v) => v && typeof v === "object" && "uri" in v) as FileValue[])
      : raw && typeof raw === "object" && "uri" in (raw as object)
        ? [raw as FileValue]
        : []
    if (files.length > 0) {
      const text = files.map((f) => f.extractedText || f.name).filter(Boolean).join("\n").trim()
      if (text) return text
    }
    if (typeof raw === "string" && raw.trim()) return raw
  }
  return task.description
}

function NoList() {
  return <p className="text-sm text-muted-foreground py-8 text-center">Configure a source list for this view.</p>
}

function SpreadsheetView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const folders = useTaskStore((s) => s.folders)
  if (!view.config.categoryId) return <NoList />
  return (
    <SheetGrid
      categoryId={view.config.categoryId}
      tasks={tasks}
      onOpenItem={onOpenItem}
      newItemLabel={getItemLabel(category, folders, view.config.categoryId)}
    />
  )
}

function ChecklistView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const folders = useTaskStore((s) => s.folders)
  const [desc, setDesc] = useState("")
  const cols = (category?.itemAttributes ?? []).filter((d) =>
    category?.displayedAttributes?.length ? category.displayedAttributes.includes(d.id) : true,
  )

  if (!view.config.categoryId) return <NoList />
  const label = getItemLabel(category, folders, view.config.categoryId)

  const add = () => {
    const d = desc.trim()
    if (!d) return
    addTask(withCategoryDefaults(createListItem(d, [view.config.categoryId!]), category))
    setDesc("")
  }

  const active = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  const row = (t: Task) => (
    <li key={t.id} className="flex items-center gap-2 py-1 border-b last:border-0">
      <input type="checkbox" checked={!!t.completed} onChange={() => updateTask({ ...t, completed: !t.completed })} />
      <button
        className={`flex-1 text-left text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}
        onClick={() => onOpenItem?.(t.id)}
      >
        {t.description}
      </button>
      <div className="flex gap-1">
        {cols.map((d) => {
          const f = formatAttributeValue(d, t.attributes?.[d.id])
          return f ? (
            <Badge key={d.id} variant="secondary" className="text-[10px]">
              {f}
            </Badge>
          ) : null
        })}
      </div>
    </li>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add ${label}…`}
          className="h-9 max-w-xs"
        />
        <Button size="sm" onClick={add} disabled={!desc.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <ul>{active.map(row)}</ul>
      {done.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{done.length} completed</summary>
          <ul className="mt-1">{done.map(row)}</ul>
        </details>
      )}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
    </div>
  )
}

function AgendaView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const dateDef = getDef(category, view.config.dateAttrId)
  const timeDef = category?.itemAttributes?.find((d) => d.datetimeMode === "time")
  const costDef = category?.itemAttributes?.find((d) => isCurrencyAttribute(d))

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = dateDef ? String(t.attributes?.[dateDef.id] ?? "") || "Unscheduled" : "All"
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    const sortedKeys = [...map.keys()].sort((a, b) => {
      if (a === "Unscheduled") return 1
      if (b === "Unscheduled") return -1
      return a.localeCompare(b)
    })
    return sortedKeys.map((k) => {
      const items = map.get(k)!.slice().sort((x, y) => {
        const tx = timeDef ? String(x.attributes?.[timeDef.id] ?? "") : ""
        const ty = timeDef ? String(y.attributes?.[timeDef.id] ?? "") : ""
        return tx.localeCompare(ty)
      })
      return { key: k, items }
    })
  }, [tasks, dateDef, timeDef])

  if (!view.config.categoryId) return <NoList />
  if (!dateDef) return <p className="text-sm text-muted-foreground py-8 text-center">Pick a date attribute for the agenda.</p>

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="space-y-1">
          <h4 className="font-semibold text-sm border-b pb-1">
            {g.key === "Unscheduled" || g.key === "" ? "Unscheduled" : formatGroupDate(g.key)}
          </h4>
          {g.items.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpenItem?.(t.id)}
              className="w-full text-left flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50"
            >
              {timeDef && (
                <span className="text-xs text-muted-foreground w-16 shrink-0">
                  {formatAttributeValue(timeDef, t.attributes?.[timeDef.id]) || "—"}
                </span>
              )}
              <span className={`text-sm flex-1 ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                {t.description}
              </span>
              {costDef && t.attributes?.[costDef.id] != null && (
                <Badge variant="outline" className="text-[10px]">
                  {formatAttributeValue(costDef, t.attributes?.[costDef.id])}
                </Badge>
              )}
            </button>
          ))}
        </div>
      ))}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
    </div>
  )
}

function formatGroupDate(key: string): string {
  const d = new Date(key)
  if (!Number.isNaN(d.getTime())) return safeDateFormat(d)
  return key
}

function SummaryView({ view }: { view: ModuleView }) {
  const { tasks, category } = useViewTasks(view)
  const groupDef = getDef(category, view.config.groupAttrId)
  const valueDef = getDef(category, view.config.valueAttrId)

  if (!view.config.categoryId) return <NoList />
  if (!groupDef) return <p className="text-sm text-muted-foreground py-8 text-center">Pick an attribute to group by.</p>

  const rows = rollup(tasks, groupDef, valueDef)
  const total = valueDef ? sumBy(tasks, valueDef) : tasks.length
  const max = Math.max(1, ...rows.map((r) => (valueDef ? r.sum : r.count)))

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Grouped by <span className="font-medium text-foreground">{groupDef.name}</span>
        {valueDef ? (
          <>
            {" "}
            · summing <span className="font-medium text-foreground">{valueDef.name}</span>
          </>
        ) : null}
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const measure = valueDef ? r.sum : r.count
          return (
            <div key={r.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-sm">
                <span>{r.key}</span>
                <span className="font-medium">
                  {valueDef ? formatNumber(r.sum, valueDef) : r.count}
                  <span className="text-muted-foreground text-xs"> · {r.count} item{r.count === 1 ? "" : "s"}</span>
                </span>
              </div>
              <div className="w-full bg-muted rounded h-2">
                <div className="bg-primary h-2 rounded" style={{ width: `${(measure / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Total</span>
        <span>{valueDef ? formatNumber(total, valueDef) : `${total} items`}</span>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
    </div>
  )
}

function RandomizerView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks } = useViewTasks(view)
  const updateTask = useTaskStore((s) => s.updateTask)
  const open = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const pickCount = Math.max(1, view.config.pickCount ?? 1)
  const [pickIds, setPickIds] = useState<string[]>([])

  const repick = () => setPickIds(randN(open, pickCount).map((t) => t.id))
  useEffect(() => {
    setPickIds((prev) => {
      const valid = prev.filter((id) => open.some((t) => t.id === id))
      return valid.length ? valid : randN(open, pickCount).map((t) => t.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open.length, pickCount])

  const picks = pickIds.map((id) => open.find((t) => t.id === id)).filter(Boolean) as Task[]

  if (!view.config.categoryId) return <NoList />

  return (
    <div className="space-y-4">
      {view.config.timerMinutes ? <Timer minutes={view.config.timerMinutes} compact /> : null}
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">All done — nothing left to pick!</p>
      ) : (
        <div className="space-y-2">
          {picks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 border rounded px-3 py-2">
              <button className="flex-1 text-left font-medium hover:underline" onClick={() => onOpenItem?.(t.id)}>
                {view.config.framing ? `${view.config.framing}: ` : ""}
                {t.description}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateTask({ ...t, completed: true })
                  setPickIds((ids) => ids.filter((id) => id !== t.id))
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={repick} disabled={open.length === 0}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Surprise me{pickCount > 1 ? ` (${pickCount})` : ""}
      </Button>
    </div>
  )
}

function GalleryView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const imageDef = category?.itemAttributes?.find((d) => d.type === "image" || d.type === "multiimage")
  if (!view.config.categoryId) return <NoList />
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {tasks.map((t) => {
        const raw = imageDef ? t.attributes?.[imageDef.id] : undefined
        const src = Array.isArray(raw) ? (raw[0] as string) : (raw as string | undefined)
        return (
          <button
            key={t.id}
            onClick={() => onOpenItem?.(t.id)}
            className="border rounded overflow-hidden text-left hover:ring-2 hover:ring-primary"
          >
            {src || t.icon ? (
              <img src={src || t.icon} alt="" className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                No image
              </div>
            )}
            <div className="p-2 text-sm truncate">{t.description}</div>
          </button>
        )
      })}
      {tasks.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nothing here yet.</p>}
    </div>
  )
}

function NotesView({ notesKey }: { notesKey: string }) {
  const [text, setText] = useState("")
  useEffect(() => {
    if (typeof window !== "undefined") setText(localStorage.getItem(notesKey) || "")
  }, [notesKey])
  return (
    <textarea
      className="w-full min-h-[300px] border rounded p-3 text-sm bg-background resize-y"
      placeholder="Write freely… (saved automatically)"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (typeof window !== "undefined") localStorage.setItem(notesKey, e.target.value)
      }}
    />
  )
}

function DecisionMatrixView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const updateModule = useModulesStore((s) => s.updateModule)
  const modules = useModulesStore((s) => s.modules)

  const criteria = view.config.criteria ?? []
  const criterionDefs = useMemo(
    () =>
      criteria
        .map((c) => ({ crit: c, def: getDef(category, c.attrId) }))
        .filter((c): c is { crit: typeof criteria[number]; def: AttributeDefinition } => !!c.def),
    [criteria, category],
  )

  const ranked = useMemo(() => {
    const matrixCriteria: MatrixCriterion[] = criterionDefs.map(({ crit, def }) => ({
      id: def.id,
      label: def.name,
      weight: crit.weight,
      benefit: crit.benefit,
    }))
    const options: MatrixOption[] = tasks.map((t) => ({
      id: t.id,
      label: t.description,
      values: Object.fromEntries(criterionDefs.map(({ def }) => [def.id, toNumber(t.attributes?.[def.id]) ?? undefined])),
    }))
    return scoreDecisionMatrix(options, matrixCriteria)
  }, [tasks, criterionDefs])

  // Persist a criterion weight edit back onto this view in the owning module.
  const setWeight = (attrId: string, weight: number) => {
    const owner = modules.find((m) => m.views?.some((v) => v.id === view.id))
    if (!owner) return
    const views = (owner.views ?? []).map((v) =>
      v.id === view.id
        ? { ...v, config: { ...v.config, criteria: (v.config.criteria ?? []).map((c) => (c.attrId === attrId ? { ...c, weight } : c)) } }
        : v,
    )
    updateModule(owner.id, { views })
  }

  if (!view.config.categoryId) return <NoList />
  if (criterionDefs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Add one or more weighted numeric criteria to this view to rank options.
      </p>
    )
  }
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No options to compare yet.</p>

  const byId = new Map(ranked.map((r) => [r.id, r]))

  return (
    <div className="space-y-4">
      {/* Weight sliders — editing updates the ranking live + persists. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {criterionDefs.map(({ crit, def }) => (
          <div key={def.id} className="flex items-center gap-2 text-sm">
            <span className="w-28 truncate" title={def.name}>
              {def.name}
              {crit.benefit === false ? <span className="text-muted-foreground"> ↓</span> : <span className="text-muted-foreground"> ↑</span>}
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={crit.weight}
              onChange={(e) => setWeight(def.id, Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-6 text-right tabular-nums text-muted-foreground">{crit.weight}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1.5 pr-2 font-semibold w-10">#</th>
              <th className="py-1.5 pr-2 font-semibold">Option</th>
              {criterionDefs.map(({ def }) => (
                <th key={def.id} className="py-1.5 px-2 font-semibold text-right whitespace-nowrap">
                  {def.name}
                </th>
              ))}
              <th className="py-1.5 pl-2 font-semibold text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {tasks
              .slice()
              .sort((a, b) => (byId.get(b.id)?.score ?? 0) - (byId.get(a.id)?.score ?? 0))
              .map((t) => {
                const r = byId.get(t.id)
                const winner = !!r?.isWinner
                return (
                  <tr key={t.id} className={`border-b last:border-0 ${winner ? "bg-primary/10" : ""}`}>
                    <td className="py-1.5 pr-2 tabular-nums">{r?.rank ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      <button
                        className="text-left hover:underline inline-flex items-center gap-1 font-medium"
                        onClick={() => onOpenItem?.(t.id)}
                      >
                        {winner && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        {t.description}
                      </button>
                    </td>
                    {criterionDefs.map(({ def }) => (
                      <td key={def.id} className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                        {t.attributes?.[def.id] != null && t.attributes?.[def.id] !== ""
                          ? formatAttributeValue(def, t.attributes?.[def.id])
                          : "—"}
                      </td>
                    ))}
                    <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                      {((r?.score ?? 0) * 100).toFixed(0)}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Scores are weighted, min–max normalized across options (0–100). ↑ higher-is-better, ↓ lower-is-better.
      </p>
    </div>
  )
}

function KanbanView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const updateTask = useTaskStore((s) => s.updateTask)
  const def = getDef(category, view.config.statusAttrId)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const columns = useMemo(() => deriveKanbanColumns(tasks, def), [tasks, def])
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  if (!view.config.categoryId) return <NoList />
  if (!def)
    return <p className="text-sm text-muted-foreground py-8 text-center">Pick a status attribute for the board.</p>

  const moveTask = (taskId: string, columnKey: string) => {
    const task = taskById.get(taskId)
    if (!task) return
    const next = statusValueToWrite(def, columnKey)
    const attributes = { ...(task.attributes ?? {}) }
    if (next === undefined) delete attributes[def.id]
    else attributes[def.id] = next
    updateTask({ ...task, attributes })
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 items-start">
      {columns.map((col) => (
        <div
          key={col.key}
          className={`shrink-0 w-56 rounded border p-2 ${dragOver === col.key ? "ring-2 ring-primary bg-muted/40" : "bg-muted/20"}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(col.key)
          }}
          onDragLeave={() => setDragOver((k) => (k === col.key ? null : k))}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/plain")
            setDragOver(null)
            if (id) moveTask(id, col.key)
          }}
        >
          <div className="flex items-center justify-between mb-2 text-sm font-semibold">
            <span className="truncate">
              {col.key === KANBAN_BACKLOG ? col.label : formatAttributeValue(def, col.key) || col.label}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {col.taskIds.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {col.taskIds.map((id) => {
              const t = taskById.get(id)
              if (!t) return null
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  className="rounded border bg-background p-2 text-sm cursor-grab hover:ring-1 hover:ring-primary"
                  onClick={() => onOpenItem?.(id)}
                >
                  <span className={t.completed ? "line-through text-muted-foreground" : ""}>{t.description}</span>
                </div>
              )
            })}
            {col.taskIds.length === 0 && (
              <div className="text-xs text-muted-foreground py-2 text-center">Drop here</div>
            )}
          </div>
        </div>
      ))}
      {columns.length === 0 && <p className="text-sm text-muted-foreground">Nothing to show.</p>}
    </div>
  )
}

// ---- timeline (confirmed, dated items) ---------------------------------------

/**
 * Day-by-day view of confirmed/dated items (flights, finalized activities).
 * Mirrors the agenda grouping but surfaces time, cost, and booked/finalized
 * badges so it reads like a trip timeline. Reflects `module-schedule-sync`.
 */
function TimelineView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks, category } = useViewTasks(view)
  const dateDef = getDef(category, view.config.dateAttrId)
  const timeDef =
    getDef(category, view.config.timeAttrId) ||
    category?.itemAttributes?.find((d) => d.datetimeMode === "time")
  const costDef = category?.itemAttributes?.find((d) => isCurrencyAttribute(d))
  const bookedDef = category?.itemAttributes?.find((d) => d.type === "boolean")

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const raw = dateDef ? t.attributes?.[dateDef.id] : undefined
      const key = dateDef ? String(raw ?? "") || "Unscheduled" : "All"
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === "Unscheduled") return 1
      if (b === "Unscheduled") return -1
      return a.localeCompare(b)
    })
    return keys.map((k) => ({
      key: k,
      items: map.get(k)!.slice().sort((x, y) => {
        const tx = timeDef ? String(x.attributes?.[timeDef.id] ?? "") : ""
        const ty = timeDef ? String(y.attributes?.[timeDef.id] ?? "") : ""
        return tx.localeCompare(ty)
      }),
    }))
  }, [tasks, dateDef, timeDef])

  if (!view.config.categoryId) return <NoList />
  if (!dateDef)
    return <p className="text-sm text-muted-foreground py-8 text-center">Pick a date attribute for the timeline.</p>

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="relative pl-4 border-l-2 border-muted space-y-2">
          <h4 className="font-semibold text-sm -ml-4 pl-4">
            {g.key === "Unscheduled" || g.key === "" ? "Unscheduled" : formatGroupDate(g.key)}
          </h4>
          {g.items.map((t) => {
            const booked = bookedDef ? t.attributes?.[bookedDef.id] === true : undefined
            return (
              <button
                key={t.id}
                onClick={() => onOpenItem?.(t.id)}
                className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded border bg-background hover:bg-muted/50"
              >
                {timeDef && (
                  <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
                    {formatAttributeValue(timeDef, t.attributes?.[timeDef.id]) || "—"}
                  </span>
                )}
                <span className={`text-sm flex-1 ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                  {t.description}
                </span>
                {booked != null && (
                  <Badge variant={booked ? "default" : "outline"} className="text-[10px]">
                    {booked ? "Booked" : "Unbooked"}
                  </Badge>
                )}
                {costDef && t.attributes?.[costDef.id] != null && (
                  <Badge variant="secondary" className="text-[10px]">
                    {formatAttributeValue(costDef, t.attributes?.[costDef.id])}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      ))}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing on the timeline yet.</p>}
    </div>
  )
}

// ---- matcher (batch-link one list to another) --------------------------------

/**
 * Match each source-list item (e.g. a PDF) to its most likely candidate in
 * another list (e.g. a book) using `lib/book-match`, show confidence, and let
 * the user link with one click. Items with no confident match are flagged so an
 * "error if no match" workflow has a clear visual counterpart.
 */
function MatcherView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const { tasks: sources } = useViewTasks(view)
  const allTasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)

  const targetCatId = view.config.matchTargetCategoryId
  const relation = view.config.linkRelation || "about"
  const threshold = view.config.matchThreshold

  const candidates = useMemo<BookMatchCandidate[]>(() => {
    if (!targetCatId) return []
    const cat = categories.find((c) => c.id === targetCatId)
    const authorDef = cat?.itemAttributes?.find((d) => /author/i.test(d.name))
    return allTasks
      .filter((t) => t.lists?.includes(targetCatId))
      .map((t) => ({
        id: t.id,
        title: t.description,
        author: authorDef ? (toText(t.attributes?.[authorDef.id]) ?? undefined) : undefined,
      }))
  }, [allTasks, categories, targetCatId])

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])

  if (!view.config.categoryId) return <NoList />
  if (!targetCatId)
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Pick a target list to match items against.
      </p>
    )

  const isLinkedTo = (source: Task, targetId: string) =>
    (source.links ?? []).some((l) => l.relation === relation && l.targetId === targetId)

  const linkTo = (source: Task, targetId: string) => {
    if (isLinkedTo(source, targetId)) return
    const link: ItemLink = { id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, relation, targetId }
    updateTask({ ...source, links: [...(source.links ?? []), link] })
  }

  const unmatchedCount = sources.filter((s) => {
    const m = findBookMatch(taskSearchText(s, view.config.matchTextAttrId), candidates, threshold)
    return !m && !(s.links ?? []).some((l) => l.relation === relation)
  }).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Linking <span className="font-medium text-foreground">{relation}</span> →{" "}
          {categories.find((c) => c.id === targetCatId)?.name ?? "list"}
        </span>
        {unmatchedCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {unmatchedCount} unmatched
          </Badge>
        )}
      </div>

      {sources.length === 0 && <p className="text-sm text-muted-foreground">Nothing to match yet.</p>}

      <div className="space-y-2">
        {sources.map((s) => {
          const existing = (s.links ?? []).find((l) => l.relation === relation)
          const match = findBookMatch(taskSearchText(s, view.config.matchTextAttrId), candidates, threshold)
          const linkedTitle = existing ? candidateById.get(existing.targetId)?.title : undefined
          return (
            <div key={s.id} className="flex items-center gap-2 border rounded px-3 py-2">
              <button className="flex-1 text-left text-sm font-medium hover:underline truncate" onClick={() => onOpenItem?.(s.id)}>
                {s.description}
              </button>
              {linkedTitle ? (
                <Badge variant="default" className="text-[10px] shrink-0">
                  <Link2 className="h-3 w-3 mr-1" />
                  {linkedTitle}
                </Badge>
              ) : match ? (
                <>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {candidateById.get(match.candidateId)?.title}{" "}
                    <span className="tabular-nums">({Math.round(match.score * 100)}%)</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => linkTo(s, match.candidateId)}>
                    <Link2 className="h-4 w-4 mr-1" /> Link
                  </Button>
                </>
              ) : (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-1" /> No match
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- quiz / game ("taste a book") --------------------------------------------

/**
 * "Taste it" guessing game: pick a random source item (PDF) with extracted text,
 * show a random snippet, and present N candidate titles (one correct) as
 * multiple choice. Scores the guess. Uses random selection (`rand`/`randN`).
 */
function QuizView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const candidatesCatId = view.config.categoryId
  const sourceCatId = view.config.quizSourceCategoryId || view.config.categoryId
  const choiceCount = Math.max(2, view.config.quizChoiceCount ?? 4)

  const sources = useMemo(
    () =>
      allTasks
        .filter((t) => sourceCatId && t.lists?.includes(sourceCatId))
        .filter((t) => taskSearchText(t, view.config.fileAttrId).trim().length > 0),
    [allTasks, sourceCatId, view.config.fileAttrId],
  )
  const candidates = useMemo(
    () => allTasks.filter((t) => candidatesCatId && t.lists?.includes(candidatesCatId)),
    [allTasks, candidatesCatId],
  )

  const [round, setRound] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [guess, setGuess] = useState<string | null>(null)

  // The "correct" source is the one whose linked candidate (or itself) is right.
  const quiz = useMemo(() => {
    if (sources.length === 0 || candidates.length === 0) return null
    const source = rand(sources)
    if (!source) return null
    // Determine the correct candidate: a linked item, or the source itself if the
    // candidates list *is* the source list.
    const link = (source.links ?? []).find((l) => candidates.some((c) => c.id === l.targetId))
    const correct = link ? candidates.find((c) => c.id === link.targetId) : candidates.find((c) => c.id === source.id)
    const answer = correct ?? rand(candidates)!
    const distractors = randN(candidates.filter((c) => c.id !== answer.id), choiceCount - 1)
    const options = randN([answer, ...distractors], choiceCount)
    const text = taskSearchText(source, view.config.fileAttrId)
    const words = text.split(/\s+/)
    const start = words.length > 40 ? Math.floor(Math.random() * (words.length - 40)) : 0
    const snippet = words.slice(start, start + 40).join(" ")
    return { source, answerId: answer.id, options, snippet }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sources.length, candidates.length, choiceCount])

  if (!candidatesCatId) return <NoList />
  if (!quiz)
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Add source items with extracted text and candidate titles to play.
      </p>
    )

  const answered = guess !== null
  const next = () => {
    setGuess(null)
    setRound((r) => r + 1)
  }
  const choose = (id: string) => {
    if (answered) return
    setGuess(id)
    setScore((s) => ({ correct: s.correct + (id === quiz.answerId ? 1 : 0), total: s.total + 1 }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[11px]">
          <Sparkles className="h-3 w-3 mr-1" /> Taste it
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          Score: {score.correct}/{score.total}
        </span>
      </div>

      <blockquote className="border-l-2 pl-3 italic text-sm text-muted-foreground">
        “…{quiz.snippet}…”
      </blockquote>

      <div className="space-y-2">
        {quiz.options.map((opt) => {
          const isAnswer = opt.id === quiz.answerId
          const isGuess = opt.id === guess
          const cls = !answered
            ? "hover:bg-muted/50"
            : isAnswer
              ? "bg-emerald-500/15 border-emerald-500"
              : isGuess
                ? "bg-destructive/10 border-destructive"
                : "opacity-60"
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              disabled={answered}
              className={`w-full text-left text-sm border rounded px-3 py-2 transition-colors ${cls}`}
            >
              {opt.description}
              {answered && isAnswer && <Check className="h-4 w-4 inline ml-2 text-emerald-600" />}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="flex items-center justify-between">
          <button className="text-xs text-muted-foreground hover:underline" onClick={() => onOpenItem?.(quiz.source.id)}>
            Reveal source
          </button>
          <Button size="sm" variant="outline" onClick={next}>
            <RefreshCw className="h-4 w-4 mr-1" /> Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ---- dashboard (optional-inclusion rollup cards) -----------------------------

/**
 * A grid of headline cards, each a rollup over a list's numeric attribute with
 * an optional "include in calculation" boolean gate (Budget: liquid total, net
 * worth, expected spend, debts). Each card lists its contributing rows with a
 * checkbox so users toggle inclusion live.
 */
function DashboardView({ view, onOpenItem }: { view: ModuleView; onOpenItem?: (id: string) => void }) {
  const cards = view.config.cards ?? []
  if (cards.length === 0)
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Add one or more cards (a list, a numeric attribute, and an optional include toggle).
      </p>
    )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <DashboardCardView key={card.id} card={card} onOpenItem={onOpenItem} />
      ))}
    </div>
  )
}

function aggregate(tasks: Task[], def: AttributeDefinition, fn: DashboardCard["fn"], includeAttrId?: string): number {
  const agg = includeAttrId ? aggregateIncluded(tasks, def, includeAttrId) : aggregateColumn(tasks, def)
  switch (fn) {
    case "avg":
      return agg.avg
    case "min":
      return agg.min ?? 0
    case "max":
      return agg.max ?? 0
    case "count":
      return agg.numeric
    default:
      return agg.sum
  }
}

function DashboardCardView({ card, onOpenItem }: { card: DashboardCard; onOpenItem?: (id: string) => void }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [open, setOpen] = useState(false)

  const cat = categories.find((c) => c.id === card.categoryId)
  const def = cat?.itemAttributes?.find((d) => d.id === card.attrId)
  const rows = useMemo(
    () => allTasks.filter((t) => t.lists?.includes(card.categoryId)),
    [allTasks, card.categoryId],
  )

  const subCat = card.subtract ? categories.find((c) => c.id === card.subtract!.categoryId) : undefined
  const subDef = subCat?.itemAttributes?.find((d) => d.id === card.subtract!.attrId)
  const subRows = useMemo(
    () => (card.subtract ? allTasks.filter((t) => t.lists?.includes(card.subtract!.categoryId)) : []),
    [allTasks, card.subtract],
  )

  if (!def) {
    return (
      <div className="rounded-lg border p-3">
        <div className="text-xs text-muted-foreground">{card.label}</div>
        <div className="text-sm text-muted-foreground mt-2">Configure a list + numeric attribute.</div>
      </div>
    )
  }

  let value = aggregate(rows, def, card.fn, card.includeAttrId)
  if (card.subtract && subDef) {
    value -= aggregate(subRows, subDef, card.fn, card.subtract.includeAttrId)
  }
  const formatted = formatNumber(value, card.unit ? { ...def, unit: card.unit } : def)

  const toggle = (t: Task) => {
    if (!card.includeAttrId) return
    updateTask({ ...t, attributes: { ...(t.attributes ?? {}), [card.includeAttrId]: !isIncluded(t, card.includeAttrId) } })
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</div>
        <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : `${rows.length} item${rows.length === 1 ? "" : "s"}`}
        </button>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${value < 0 ? "text-destructive" : ""}`}>{formatted}</div>
      {open && (
        <div className="space-y-1 pt-1 border-t">
          {rows.map((t) => {
            const included = card.includeAttrId ? isIncluded(t, card.includeAttrId) : true
            const n = toNumber(t.attributes?.[def.id]) ?? 0
            return (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                {card.includeAttrId && (
                  <input type="checkbox" checked={included} onChange={() => toggle(t)} title="Include in calculation" />
                )}
                <button className={`flex-1 text-left truncate ${included ? "" : "text-muted-foreground line-through"}`} onClick={() => onOpenItem?.(t.id)}>
                  {t.description}
                </button>
                <span className="tabular-nums text-muted-foreground">{formatNumber(n, def)}</span>
              </div>
            )
          })}
          {rows.length === 0 && <p className="text-xs text-muted-foreground">No rows.</p>}
        </div>
      )}
    </div>
  )
}

// ---- shared countdown timer ---------------------------------------------------

export function TimerView({ minutes }: { minutes: number }) {
  return (
    <div className="py-6 flex justify-center">
      <Timer minutes={minutes} />
    </div>
  )
}

export function Timer({ minutes, compact = false }: { minutes: number; compact?: boolean }) {
  const [remaining, setRemaining] = useState(minutes * 60)
  const [running, setRunning] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false)
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => {
      if (ref.current) clearInterval(ref.current)
    }
  }, [running])

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0")
  const ss = String(remaining % 60).padStart(2, "0")

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "flex-col"}`}>
      <div className={`font-mono tabular-nums ${compact ? "text-2xl" : "text-6xl"} ${remaining === 0 ? "text-destructive" : ""}`}>
        {mm}:{ss}
      </div>
      <div className="flex gap-2">
        <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size={compact ? "sm" : "default"}
          variant="outline"
          onClick={() => {
            setRunning(false)
            setRemaining(minutes * 60)
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
