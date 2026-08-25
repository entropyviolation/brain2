"use client"

import type React from "react"
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { List, Task } from "@/lib/types"
import type { GridEntry, SmartId } from "@/components/Lists/types"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Trash,
  Calendar,
  Check,
  Settings,
  Plus,
  GripVertical,
  AlertTriangle,
  Star,
  Eye,
} from "lucide-react"
import { safeDateFormat } from "@/lib/date-utils"
const TASK_PREVIEW_LIMIT = 8
const INITIAL_CARD_BATCH = 12
const CARD_BATCH_STEP = 10

export interface FolderViewCardsProps {
  entries: GridEntry[]
  categoryById: Map<string, List>
  selectMode: boolean
  selectedCategories: string[]
  addingTaskToTarget: string | null
  scopeKey: string
  getSmartTasks: (id: SmartId) => Task[]
  getTasksForCategory: (id: string) => Task[]
  getCategoryCompletionRate: (id: string) => number
  itemLabelFor: (id?: string, category?: List) => string
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  handleTaskDragStart: (e: React.DragEvent, task: Task) => void
  clearDrag: () => void
  openEntry: (entry: GridEntry) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedTaskId: (id: string) => void
  setAddingTaskToTarget: (id: string | null) => void
  setEditingCategory: (category: List) => void
  deleteList: (id: string) => void
  handleAddTaskToCategory: (categoryId: string, description: string) => void
  handleCompleteTask: (taskId: string) => void
}

function CardAddTaskForm({
  itemLabel,
  onAdd,
  onCancel,
}: {
  itemLabel: string
  onAdd: (description: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState("")
  return (
    <div className="mb-4 p-3 border rounded-md bg-muted/50">
      <div className="space-y-2">
        <Textarea
          placeholder={`Enter ${itemLabel.toLowerCase()} description...`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAdd(value)}>
            Add {itemLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

const TaskRow = memo(function TaskRow({
  task,
  onSelect,
  onComplete,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  onSelect: (id: string) => void
  onComplete: (id: string) => void
  onDragStart: (e: React.DragEvent, task: Task) => void
  onDragEnd: () => void
}) {
  return (
    <div
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group transition-all duration-200 task-item"
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(task.id)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{task.description}</p>
          </div>
          <div className="flex gap-3 mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>Urgency {task.urgency}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3" />
              <span>Importance {task.importance}</span>
            </div>
            {task.scheduledDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {safeDateFormat(task.scheduledDate)}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 focus-ring"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(task.id)
          }}
        >
          <Eye className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-green-600 hover:text-green-700 focus-ring"
          onClick={(e) => {
            e.stopPropagation()
            onComplete(task.id)
          }}
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})

const ListCard = memo(function ListCard({
  entry,
  category,
  tasks,
  completionRate,
  itemLabel,
  selectMode,
  isSelected,
  isAdding,
  handleDragOver,
  handleDropOnEntry,
  setSelectedCategories,
  setSelectedTaskId,
  setAddingTaskToTarget,
  setEditingCategory,
  onDeleteList,
  handleAddTaskToCategory,
  handleCompleteTask,
  handleTaskDragStart,
  clearDrag,
  openEntry,
}: {
  entry: GridEntry
  category: List
  tasks: Task[]
  completionRate: number
  itemLabel: string
  selectMode: boolean
  isSelected: boolean
  isAdding: boolean
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedTaskId: (id: string) => void
  setAddingTaskToTarget: (id: string | null) => void
  setEditingCategory: (category: List) => void
  onDeleteList: (id: string) => void
  handleAddTaskToCategory: (categoryId: string, description: string) => void
  handleCompleteTask: (taskId: string) => void
  handleTaskDragStart: (e: React.DragEvent, task: Task) => void
  clearDrag: () => void
  openEntry: (entry: GridEntry) => void
}) {
  const preview = tasks.length > TASK_PREVIEW_LIMIT ? tasks.slice(0, TASK_PREVIEW_LIMIT) : tasks
  const hiddenCount = tasks.length - preview.length

  return (
    <Card
      className={`overflow-hidden ${selectMode && isSelected ? "ring-2 ring-primary" : ""}`}
      data-list-card={category.id}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDropOnEntry(e, entry)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-1">
            {selectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  setSelectedCategories((prev) =>
                    isSelected ? prev.filter((id) => id !== category.id) : [...prev, category.id],
                  )
                }
                className="mr-1"
              />
            )}
            <img src={iconFor(category.id, category.icon)} alt="" className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
            <div>
              <CardTitle className="text-lg">{category.name}</CardTitle>
              {category.description && (
                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddingTaskToTarget(category.id)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="List Settings"
              onClick={() => setEditingCategory(category)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Delete ${category.name}`}
              onClick={() => onDeleteList(category.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <Badge variant="secondary">
            {tasks.length} active {itemLabel.toLowerCase()}s
          </Badge>
          <Badge variant="outline">{completionRate}% complete</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isAdding && (
          <CardAddTaskForm
            itemLabel={itemLabel}
            onAdd={(description) => handleAddTaskToCategory(category.id, description)}
            onCancel={() => setAddingTaskToTarget(null)}
          />
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto fm-card-tasklist">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active {itemLabel.toLowerCase()}s in this list
            </p>
          ) : (
            <>
              {preview.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onSelect={setSelectedTaskId}
                  onComplete={handleCompleteTask}
                  onDragStart={handleTaskDragStart}
                  onDragEnd={clearDrag}
                />
              ))}
              {hiddenCount > 0 && (
                <button type="button" className="fm-card-more" onClick={() => openEntry(entry)}>
                  + {hiddenCount} more — open list
                </button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

const SmartCard = memo(function SmartCard({
  entry,
  tasks,
  openEntry,
  setSelectedTaskId,
}: {
  entry: GridEntry
  tasks: Task[]
  openEntry: (entry: GridEntry) => void
  setSelectedTaskId: (id: string) => void
}) {
  const preview = tasks.length > TASK_PREVIEW_LIMIT ? tasks.slice(0, TASK_PREVIEW_LIMIT) : tasks
  const hiddenCount = tasks.length - preview.length
  return (
    <Card key={entry.id} className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <img src={orbFor(entry.id)} alt="" className="w-7 h-7 object-contain" loading="lazy" decoding="async" />
            <div>
              <CardTitle className="text-lg">{entry.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{tasks.length} due</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntry(entry)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 max-h-64 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nothing scheduled for this period.</p>
        ) : (
          <>
            {preview.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <p className="text-sm font-medium truncate">{task.description}</p>
                {task.estimatedDuration != null && (
                  <span className="text-xs text-muted-foreground">{task.estimatedDuration}m</span>
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <button type="button" className="fm-card-more" onClick={() => openEntry(entry)}>
                + {hiddenCount} more — open list
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
})

function CardSkeleton() {
  return (
    <div className="fm-card-skeleton" aria-hidden>
      <div className="fm-card-skeleton-line wide" />
      <div className="fm-card-skeleton-line" />
      <div className="fm-card-skeleton-line short" />
    </div>
  )
}

export function FolderViewCards({
  entries,
  categoryById,
  selectMode,
  selectedCategories,
  addingTaskToTarget,
  scopeKey,
  getSmartTasks,
  getTasksForCategory,
  getCategoryCompletionRate,
  itemLabelFor,
  handleDragOver,
  handleDropOnEntry,
  handleTaskDragStart,
  clearDrag,
  openEntry,
  setSelectedCategories,
  setSelectedTaskId,
  setAddingTaskToTarget,
  setEditingCategory,
  deleteList,
  handleAddTaskToCategory,
  handleCompleteTask,
}: FolderViewCardsProps) {
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set())
  const listCountOnInit = entries.filter((e) => e.kind === "list").length
  const [revealCount, setRevealCount] = useState(() =>
    listCountOnInit <= INITIAL_CARD_BATCH ? Number.MAX_SAFE_INTEGER : INITIAL_CARD_BATCH,
  )
  const [hydrating, setHydrating] = useState(() => listCountOnInit > INITIAL_CARD_BATCH)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    const listCount = entriesRef.current.filter((e) => e.kind === "list").length
    if (listCount <= INITIAL_CARD_BATCH) {
      setRevealCount(Number.MAX_SAFE_INTEGER)
      setHydrating(false)
      return
    }
    setRevealCount(INITIAL_CARD_BATCH)
    setHydrating(true)
    let shown = INITIAL_CARD_BATCH
    let raf = 0
    let cancelled = false
    const pump = () => {
      if (cancelled) return
      shown += CARD_BATCH_STEP
      if (shown >= listCount) {
        setRevealCount(Number.MAX_SAFE_INTEGER)
        setHydrating(false)
        return
      }
      setRevealCount(shown)
      raf = requestAnimationFrame(pump)
    }
    raf = requestAnimationFrame(pump)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [scopeKey])

  useEffect(() => {
    if (pendingDeleteIds.size === 0) return
    const present = new Set(entries.filter((e) => e.kind === "list").map((e) => e.id))
    setPendingDeleteIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (present.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [entries, pendingDeleteIds])

  const onDeleteList = useCallback(
    (id: string) => {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      startTransition(() => {
        deleteList(id)
      })
    },
    [deleteList],
  )

  const visibleEntries = useMemo(
    () => entries.filter((e) => e.kind !== "list" || !pendingDeleteIds.has(e.id)),
    [entries, pendingDeleteIds],
  )

  const grouped = useMemo(() => {
    const objectives: GridEntry[] = []
    const habits: GridEntry[] = []
    const smart: GridEntry[] = []
    const folders: GridEntry[] = []
    const lists: GridEntry[] = []
    for (const entry of visibleEntries) {
      if (entry.kind === "objectives") objectives.push(entry)
      else if (entry.kind === "habits") habits.push(entry)
      else if (entry.kind === "smart") smart.push(entry)
      else if (entry.kind === "folder") folders.push(entry)
      else if (entry.kind === "list") lists.push(entry)
    }
    return { objectives, habits, smart, folders, lists }
  }, [visibleEntries])

  const shownLists = grouped.lists.slice(0, revealCount)
  const pendingSkeletons = hydrating ? Math.min(6, Math.max(0, grouped.lists.length - shownLists.length)) : 0
  const isBusy = hydrating || pendingDeleteIds.size > 0
  const statusText = hydrating
    ? `Loading lists… ${shownLists.length} of ${grouped.lists.length}`
    : pendingDeleteIds.size > 0
      ? "Removing list…"
      : null

  return (
    <div className="fm-sunken fm-cards">
      {isBusy && statusText && (
        <div className="fm-cards-status" role="status" aria-live="polite" data-testid="fm-cards-status">
          <span className="fm-cards-spinner" />
          {statusText}
        </div>
      )}
      <div
        className="fm-cards-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}
      >
        {grouped.objectives.map((entry) => (
          <Card key={entry.id} className="cursor-pointer card-hover" onClick={() => openEntry(entry)}>
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <img src={orbFor(entry.id)} alt="" className="w-8 h-8 object-contain" loading="lazy" decoding="async" />
              <div>
                <CardTitle className="text-lg">{entry.name}</CardTitle>
                <p className="text-sm text-muted-foreground">Life directions & priorities</p>
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{entry.count} active</Badge>
            </CardContent>
          </Card>
        ))}
        {grouped.habits.map((entry) => (
          <Card key={entry.id} className="cursor-pointer card-hover" onClick={() => openEntry(entry)}>
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <img src={orbFor(entry.id)} alt="" className="w-8 h-8 object-contain" loading="lazy" decoding="async" />
              <div>
                <CardTitle className="text-lg">{entry.name}</CardTitle>
                <p className="text-sm text-muted-foreground">Daily habit tracking</p>
              </div>
            </CardHeader>
          </Card>
        ))}
        {grouped.smart.map((entry) => (
          <SmartCard
            key={entry.id}
            entry={entry}
            tasks={getSmartTasks(entry.id as SmartId)}
            openEntry={openEntry}
            setSelectedTaskId={setSelectedTaskId}
          />
        ))}
        {grouped.folders.map((entry) => (
          <Card
            key={entry.id}
            className="cursor-pointer card-hover"
            onClick={() => openEntry(entry)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnEntry(e, entry)}
          >
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <FolderGlyph size={32} color={entry.color} />
              <div>
                <CardTitle className="text-lg">{entry.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{entry.count} lists</p>
              </div>
            </CardHeader>
          </Card>
        ))}
        {shownLists.map((entry) => {
          const category = categoryById.get(entry.id)
          if (!category) return null
          return (
            <ListCard
              key={category.id}
              entry={entry}
              category={category}
              tasks={getTasksForCategory(category.id)}
              completionRate={getCategoryCompletionRate(category.id)}
              itemLabel={itemLabelFor(category.id, category)}
              selectMode={selectMode}
              isSelected={selectedCategories.includes(category.id)}
              isAdding={addingTaskToTarget === category.id}
              handleDragOver={handleDragOver}
              handleDropOnEntry={handleDropOnEntry}
              setSelectedCategories={setSelectedCategories}
              setSelectedTaskId={setSelectedTaskId}
              setAddingTaskToTarget={setAddingTaskToTarget}
              setEditingCategory={setEditingCategory}
              onDeleteList={onDeleteList}
              handleAddTaskToCategory={handleAddTaskToCategory}
              handleCompleteTask={handleCompleteTask}
              handleTaskDragStart={handleTaskDragStart}
              clearDrag={clearDrag}
              openEntry={openEntry}
            />
          )
        })}
        {Array.from({ length: pendingSkeletons }, (_, i) => (
          <CardSkeleton key={`skeleton-${i}`} />
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">This location is empty.</p>
        )}
      </div>
    </div>
  )
}
