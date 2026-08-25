/**
 * Improved Packing + Before Trip checklist UIs for the itinerary module.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Plus } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { createListItem, withCategoryDefaults, getItemLabel } from "@/lib/item-utils"
import type { ModuleView } from "@/lib/modules-store"
import type { Task } from "@/lib/types"
import "./trip-checklists.css"

const PACK_KINDS = ["Clothes", "Toiletries", "Electronics", "Documents", "Other"] as const

function useChecklistTasks(categoryId?: string) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const category = categoryId ? lists.find((l) => l.id === categoryId) : undefined
  const listTasks = useMemo(
    () => (categoryId ? tasks.filter((t) => t.lists?.includes(categoryId)) : []),
    [tasks, categoryId],
  )
  return { tasks: listTasks, category, folders }
}

export function PackingChecklistView({
  view,
  onOpenItem,
}: {
  view: ModuleView
  onOpenItem?: (id: string) => void
}) {
  const { tasks, category, folders } = useChecklistTasks(view.config.categoryId)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const [desc, setDesc] = useState("")
  const [kind, setKind] = useState<string>("Clothes")
  const [filter, setFilter] = useState<string | "all">("all")

  if (!view.config.categoryId) {
    return <p className="trip-checklist-paper tc-empty">Pick a list.</p>
  }
  const label = getItemLabel(category, folders, view.config.categoryId)

  const packed = tasks.filter((t) => t.completed).length
  const total = tasks.length
  const pct = total ? Math.round((packed / total) * 100) : 0

  const filtered = filter === "all" ? tasks : tasks.filter((t) => String(t.attributes?.packKind ?? "Other") === filter)

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const k of PACK_KINDS) map.set(k, [])
    for (const t of filtered) {
      const k = String(t.attributes?.packKind ?? "Other")
      const arr = map.get(k) ?? []
      arr.push(t)
      map.set(k, arr)
    }
    return [...map.entries()].filter(([, items]) => items.length > 0 || filter === "all")
  }, [filtered, filter])

  const add = () => {
    const d = desc.trim()
    if (!d || !category) return
    addTask(
      withCategoryDefaults(
        { ...createListItem(d, [view.config.categoryId!]), attributes: { packKind: kind } },
        category,
      ),
    )
    setDesc("")
  }

  return (
    <div className="trip-checklist-paper space-y-4">
      <div className="tc-card space-y-2">
        <div className="flex items-center justify-between">
          <span className="tc-progress-label">Packing progress</span>
          <span className="tc-progress-meta">
            {packed}/{total} · {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {PACK_KINDS.map((k) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)} label={k} />
        ))}
      </div>

      <div className="tc-add-row">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add ${label}…`}
          className="h-9 max-w-xs"
        />
        <select className="h-9 px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          {PACK_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={add} disabled={!desc.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-3">
        {groups.map(([group, items]) => {
          const done = items.filter((t) => t.completed).length
          return (
            <section key={group} className="tc-section">
              <header>
                <h4 className="text-sm font-semibold m-0">{group}</h4>
                <span className="tc-muted text-xs">
                  {done}/{items.length}
                </span>
              </header>
              <ul className="tc-list" style={{ padding: "0 0.85rem" }}>
                {items.map((t) => (
                  <li key={t.id}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#2f5d8c]"
                      checked={!!t.completed}
                      onChange={() => updateTask({ ...t, completed: !t.completed })}
                    />
                    <button
                      type="button"
                      className={t.completed ? "is-done" : undefined}
                      onClick={() => onOpenItem?.(t.id)}
                    >
                      {t.description}
                    </button>
                  </li>
                ))}
                {items.length === 0 && <li className="tc-empty">Nothing in this category.</li>}
              </ul>
            </section>
          )
        })}
      </div>
      {tasks.length === 0 && <p className="tc-empty">Start packing — add items above.</p>}
    </div>
  )
}

export function PreTripChecklistView({
  view,
  onOpenItem,
}: {
  view: ModuleView
  onOpenItem?: (id: string) => void
}) {
  const { tasks, category, folders } = useChecklistTasks(view.config.categoryId)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const [desc, setDesc] = useState("")
  const [priority, setPriority] = useState("Medium")
  const [bulk, setBulk] = useState("")

  if (!view.config.categoryId) {
    return <p className="trip-checklist-paper tc-empty">Pick a list.</p>
  }
  const label = getItemLabel(category, folders, view.config.categoryId)

  const done = tasks.filter((t) => t.completed).length
  const total = tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const active = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  const priorityOrder = { High: 0, Medium: 1, Low: 2 } as Record<string, number>
  const sortedActive = [...active].sort((a, b) => {
    const pa = priorityOrder[String(a.attributes?.priority ?? "Medium")] ?? 1
    const pb = priorityOrder[String(b.attributes?.priority ?? "Medium")] ?? 1
    return pa - pb
  })

  const add = () => {
    const d = desc.trim()
    if (!d || !category) return
    addTask(
      withCategoryDefaults(
        { ...createListItem(d, [view.config.categoryId!]), attributes: { priority } },
        category,
      ),
    )
    setDesc("")
  }

  const addBulk = () => {
    if (!category || !view.config.categoryId) return
    const lines = bulk
      .split(/\n/)
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
    for (const line of lines) {
      addTask(
        withCategoryDefaults(
          { ...createListItem(line, [view.config.categoryId]), attributes: { priority: "Medium" } },
          category,
        ),
      )
    }
    setBulk("")
  }

  return (
    <div className="trip-checklist-paper space-y-4">
      <div className="tc-card space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm m-0">Before you leave</h3>
            <p className="tc-muted text-xs mt-0.5 mb-0">Handle these so departure day stays calm.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums text-[var(--tc-ink)]">{pct}%</div>
            <div className="tc-progress-meta">
              {done}/{total} done
            </div>
          </div>
        </div>
        <Progress value={pct} className="h-2.5" />
      </div>

      <div className="tc-add-row">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add ${label}…`}
          className="h-9 max-w-xs"
        />
        <select className="h-9 px-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <Button size="sm" onClick={add} disabled={!desc.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <details className="tc-bulk">
        <summary>Paste a list of tasks</summary>
        <textarea
          className="mt-2 w-full min-h-[80px] p-2 text-sm"
          placeholder={"Hold mail\nNotify bank\nCheck passport expiry"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <Button size="sm" className="mt-2" onClick={addBulk} disabled={!bulk.trim()}>
          Add all lines
        </Button>
      </details>

      <div className="tc-card">
        <ul className="tc-list">
          {sortedActive.map((t) => (
            <li key={t.id}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#2f5d8c]"
                checked={false}
                onChange={() => updateTask({ ...t, completed: true })}
              />
              <button type="button" onClick={() => onOpenItem?.(t.id)}>
                {t.description}
              </button>
              {t.attributes?.priority && (
                <span className={`tc-badge ${t.attributes.priority === "High" ? "is-high" : ""}`}>
                  {String(t.attributes.priority)}
                </span>
              )}
            </li>
          ))}
          {sortedActive.length === 0 && total === 0 && (
            <li className="tc-empty">Nothing yet — add tasks or paste a list.</li>
          )}
          {sortedActive.length === 0 && total > 0 && (
            <li className="tc-empty">All clear — everything is done.</li>
          )}
        </ul>
      </div>

      {completed.length > 0 && (
        <details className="tc-done">
          <summary>{completed.length} completed</summary>
          <ul className="tc-list mt-2">
            {completed.map((t) => (
              <li key={t.id}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#2f5d8c]"
                  checked
                  onChange={() => updateTask({ ...t, completed: false })}
                />
                <button type="button" className="is-done" onClick={() => onOpenItem?.(t.id)}>
                  {t.description}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`tc-chip ${active ? "is-on" : ""}`}>
      {label}
    </button>
  )
}
