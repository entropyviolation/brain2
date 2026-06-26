/**
 * components/ItemDetail/ItemDetailPopup.tsx — Compact item detail popup
 *
 * A modal/popover detail view of a single task used inline by the Scheduler,
 * Plan, and To-Do panels (edit fields, complete, reschedule). Lighter-weight
 * sibling of the full-screen `ItemDetailPage.tsx`. Both share load/draft state
 * and the category/dependency mutators via `useItemDetailDraft`.
 *
 * Imported app-wide as `TaskDetailPopup` via the `components/task-detail-popup`
 * barrel. Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { TagInput } from "@/components/ItemDetail/TagInput"
import { LinkPicker } from "@/components/ItemDetail/LinkPicker"
import { RelatedItemsPanel } from "@/components/ItemDetail/RelatedItemsPanel"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ListPicker } from "@/components/Lists/list-picker"
import { LinkGraph } from "@/components/Graph/LinkGraph"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Save,
  Clock,
  AlertTriangle,
  Star,
  CheckCircle,
  XCircle,
  Timer,
  Award,
  X,
  Plus,
  Trash2,
  Calendar,
  Target,
  Zap,
  Brain,
  Users,
  FileText,
  Settings,
  ArrowRight,
} from "lucide-react"
import type { Task, TaskCompletionReview, ItemDetailPanel, TimeLogEntry, CompletionStatus } from "@/lib/types"
import { safeDateFormat, safeISODateString, getWeekString } from "@/lib/date-utils"
import {
  COMPLETION_STATUSES,
  COMPLETION_STATUS_LABELS,
  COMPLETION_STATUS_DESCRIPTIONS,
  effectiveStatus,
  withStatus,
} from "@/lib/completion-status"
import { ItemAttributesSection } from "@/components/ItemDetail/ItemAttributesSection"
import { isTaskItem } from "@/lib/item-utils"
import { assignedItemTypes, BUILTIN_TASK_TYPE_ID } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { requestNavigateToList } from "@/lib/app-navigation"

interface TaskDetailPopupProps {
  taskId: string | null
  open: boolean
  onClose: () => void
}

export function TaskDetailPopup({ taskId, open, onClose }: TaskDetailPopupProps) {
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const effectiveId = overrideId ?? taskId

  // Reset the in-popup navigation override whenever the host opens a new item.
  useEffect(() => {
    setOverrideId(null)
  }, [taskId])

  const {
    task,
    setTask,
    originalTask,
    setOriginalTask,
    allTasks,
    lists,
    folders,
    updateTask,
    deleteTask,
    removeFromCategory,
    setLists,
    removeDependency,
    addTag,
    removeTag,
    addLink,
    removeLink,
  } = useItemDetailDraft(effectiveId)

  const updateList = useTaskStore((state) => state.updateList)
  const itemTypes = useItemTypeStore((state) => state.types)
  const updateItemType = useItemTypeStore((state) => state.updateType)
  const addItemType = useItemTypeStore((state) => state.addType)
  const deleteItemType = useItemTypeStore((state) => state.deleteType)

  const [newSubtaskDescription, setNewSubtaskDescription] = useState("")
  const [selectedDependency, setSelectedDependency] = useState("none")
  const [editingItemType, setEditingItemType] = useState<ItemTypeDefinition | null>(null)

  // A "task" item type (anything in Next Actions, plus items explicitly typed
  // "task") gets the full set of task features/panels.
  const isTask = task ? isTaskItem(task, folders) : false
  const visiblePanels = useMemo((): ItemDetailPanel[] => {
    if (!task) return ["details"]
    const defaults: ItemDetailPanel[] = isTask
      ? ["details", "scheduling", "dependencies", "subtasks", "analysis", "time"]
      : ["details", "time"]
    const fromLists = (task.lists ?? []).flatMap((cid) => {
      const c = lists.find((x) => x.id === cid)
      return c?.detailPanels?.length ? c.detailPanels : []
    })
    // The "body" document panel (Worker D) is added for note-type items.
    const fromType: ItemDetailPanel[] = task.type === "note" ? ["body"] : []
    const added = [...fromLists, ...fromType]
    if (added.length === 0) return defaults
    // List/type-configured panels only ADD to the defaults — next-action items
    // always keep their full task panel set regardless of any custom config.
    const merged = new Set<ItemDetailPanel>([...defaults, ...added, "time"])
    return Array.from(merged)
  }, [task, lists, isTask])

  // Deep compare function for tasks (shallow for now, can be improved)
  const isTaskChanged = useCallback(() => {
    if (!task || !originalTask) return false
    return JSON.stringify(task) !== JSON.stringify(originalTask)
  }, [task, originalTask])

  const handleSave = useCallback(() => {
    if (task) {
      updateTask(task)
      setOriginalTask(task)
    }
  }, [task, updateTask])

  const handleDelete = useCallback(() => {
    if (!task) return
    if (confirm(`Delete "${task.description}"? This cannot be undone.`)) {
      deleteTask(task.id)
      onClose()
    }
  }, [task, deleteTask, onClose])

  // Marking complete flips the flag and lets the global completion popup capture
  // the contribution (objective/goal) + optional review on every completion.
  const handleComplete = useCallback(() => {
    if (task) {
      updateTask({ ...task, completed: true })
      onClose()
    }
  }, [task, updateTask, onClose])

  // Persist a richer completion status immediately, keeping the legacy
  // `completed` flag in sync (invariant: status "done" ⇔ completed true).
  const handleStatusChange = useCallback(
    (status: CompletionStatus) => {
      if (!task) return
      const updated = withStatus(task, status)
      setTask(updated)
      updateTask(updated)
      setOriginalTask(updated)
    },
    [task, setTask, updateTask, setOriginalTask],
  )

  const handleScheduleToWeek = useCallback(
    (date: Date) => {
      if (task) {
        const weekString = getWeekString(date)
        setTask({
          ...task,
          scheduledWeek: weekString,
          scheduledDate: undefined,
          scheduledTime: undefined,
          scheduledMonth: undefined,
          scheduledYear: undefined,
        })
      }
    },
    [task],
  )

  const handleMoveToWeeklyTodo = useCallback(() => {
    if (!task) return
    const weekString = getWeekString(new Date())
    const updated = {
      ...task,
      scheduledWeek: weekString,
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledMonth: undefined,
      scheduledYear: undefined,
    }
    setTask(updated)
    updateTask(updated)
  }, [task, updateTask])

  const addSubtask = useCallback(() => {
    if (task && newSubtaskDescription.trim()) {
      const newSubtask = {
        id: Date.now().toString(),
        description: newSubtaskDescription.trim(),
        completed: false,
      }
      setTask({
        ...task,
        subtasks: [...(task.subtasks || []), newSubtask],
      })
      setNewSubtaskDescription("")
    }
  }, [task, newSubtaskDescription])

  const toggleSubtask = useCallback(
    (subtaskId: string) => {
      if (task) {
        setTask({
          ...task,
          subtasks: task.subtasks?.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
          ),
        })
      }
    },
    [task],
  )

  const removeSubtask = useCallback(
    (subtaskId: string) => {
      if (task) {
        setTask({
          ...task,
          subtasks: task.subtasks?.filter((subtask) => subtask.id !== subtaskId),
        })
      }
    },
    [task],
  )

  // Create a brand-new attribute from the detail view. When a list is targeted,
  // the definition is persisted onto that list's schema immediately (so every
  // item in the list gains the attribute); the value is set on the draft and
  // persisted with the next save.
  const handleCreateAttribute = useCallback(
    (def: AttributeDefinition, value: AttributeValue, listId: string | null) => {
      if (!task) return
      if (listId) {
        const cat = lists.find((c) => c.id === listId)
        if (cat) {
          updateList({ ...cat, itemAttributes: [...(cat.itemAttributes ?? []), def] })
        }
        setTask({ ...task, attributes: { ...(task.attributes || {}), [def.id]: value } })
        return
      }
      setTask({
        ...task,
        itemAttributeDefinitions: [...(task.itemAttributeDefinitions ?? []), def],
        attributes: { ...(task.attributes || {}), [def.id]: value },
      })
    },
    [task, lists, updateList, setTask],
  )

  const handleNavigateToList = useCallback(
    (listId: string) => {
      requestNavigateToList(listId, folders)
      onClose()
    },
    [folders, onClose],
  )

  const handleSaveItemType = useCallback(
    (def: ItemTypeDefinition) => {
      if (itemTypes.some((t) => t.id === def.id)) updateItemType(def)
      else addItemType(def)
      setEditingItemType(null)
    },
    [itemTypes, updateItemType, addItemType],
  )

  const addDependency = useCallback(() => {
    if (
      task &&
      selectedDependency &&
      selectedDependency !== "none" &&
      !((task.dependencies ?? []).includes(selectedDependency))
    ) {
      setTask({
        ...task,
        dependencies: [...(task.dependencies ?? []), selectedDependency],
      })
      setSelectedDependency("none")
    }
  }, [task, selectedDependency])

  if (!task) {
    return null
  }

  const availableTasksForDependencies = allTasks.filter((t) => t.id !== task.id && !(task.dependencies || []).includes(t.id))

  // Every item type assigned to this item: its own type plus any type pinned by
  // a list it belongs to (e.g. a task that also lives in a "Goals" list).
  const assignedTypes = assignedItemTypes(
    { type: task.type, lists: task.lists ?? [] },
    lists,
    itemTypes,
  )
  const primaryTypeId = task.type ?? BUILTIN_TASK_TYPE_ID

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden !flex flex-col gradient-bg">
          <DialogHeader className="pb-4 shrink-0">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    value={task.description}
                    onChange={(e) => setTask({ ...task, description: e.target.value })}
                    className="text-2xl font-bold border-0 shadow-none px-0 h-auto focus-visible:ring-0 w-full"
                    placeholder="Item name"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={task.completed ? "default" : "secondary"} className="font-medium">
                      {task.completed ? "Completed" : task.stage}
                    </Badge>
                    {task.actualDuration && (
                      <Badge variant="outline" className="font-medium">
                        <Timer className="h-3 w-3 mr-1" />
                        Took {task.actualDuration}m
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex justify-end gap-3 mb-6 shrink-0">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="focus-ring text-destructive border-destructive/30 hover:bg-destructive/10 mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            {!task.completed && (
              <Button
                variant="outline"
                onClick={handleComplete}
                className="focus-ring bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Task
              </Button>
            )}
            {isTaskChanged() && (
              <Button onClick={handleSave} className="focus-ring">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col">
              <TabsList className={`grid w-full mb-6`} style={{ gridTemplateColumns: `repeat(${visiblePanels.length}, minmax(0, 1fr))` }}>
                {visiblePanels.includes("details") && (
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Details
                </TabsTrigger>
                )}
                {visiblePanels.includes("scheduling") && (
                <TabsTrigger value="scheduling" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Scheduling
                </TabsTrigger>
                )}
                {visiblePanels.includes("dependencies") && (
                <TabsTrigger value="dependencies" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Dependencies
                </TabsTrigger>
                )}
                {visiblePanels.includes("subtasks") && (
                <TabsTrigger value="subtasks" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Subtasks
                </TabsTrigger>
                )}
                {visiblePanels.includes("analysis") && (
                <TabsTrigger value="analysis" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                )}
                {visiblePanels.includes("time") && (
                <TabsTrigger value="time" className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Time
                </TabsTrigger>
                )}
                {visiblePanels.includes("body") && (
                <TabsTrigger value="body" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Body
                </TabsTrigger>
                )}
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <TabsContent value="details" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label htmlFor="task-description" className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Detailed Description
                        </Label>
                        <Textarea
                          id="task-description"
                          value={task.taskDescription || ""}
                          onChange={(e) => setTask({ ...task, taskDescription: e.target.value })}
                          placeholder="Detailed description of the task..."
                          rows={4}
                          className="focus-ring"
                        />
                      </div>

                      {isTask && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label htmlFor="estimated-duration" className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Estimated Duration
                          </Label>
                          <div className="relative">
                            <Input
                              id="estimated-duration"
                              type="number"
                              value={task.estimatedDuration ?? ""}
                              onChange={(e) =>
                                setTask({ ...task, estimatedDuration: Number.parseInt(e.target.value) || 0 })
                              }
                              className="focus-ring pr-12"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                              min
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="reward-value" className="text-sm font-semibold flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Reward Value
                          </Label>
                          <Input
                            id="reward-value"
                            type="number"
                            value={task.rewardValue ?? ""}
                            onChange={(e) => setTask({ ...task, rewardValue: Number.parseInt(e.target.value) || 0 })}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="urgency" className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Urgency
                          </Label>
                          <Select
                            value={(task.urgency ?? 3).toString()}
                            onValueChange={(value) => setTask({ ...task, urgency: Number.parseInt(value) })}
                          >
                            <SelectTrigger className="focus-ring">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - Low</SelectItem>
                              <SelectItem value="2">2 - Medium-Low</SelectItem>
                              <SelectItem value="3">3 - Medium</SelectItem>
                              <SelectItem value="4">4 - High</SelectItem>
                              <SelectItem value="5">5 - Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="importance" className="text-sm font-semibold flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Importance
                          </Label>
                          <Select
                            value={(task.importance ?? 3).toString()}
                            onValueChange={(value) => setTask({ ...task, importance: Number.parseInt(value) })}
                          >
                            <SelectTrigger className="focus-ring">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - Low</SelectItem>
                              <SelectItem value="2">2 - Medium-Low</SelectItem>
                              <SelectItem value="3">3 - Medium</SelectItem>
                              <SelectItem value="4">4 - High</SelectItem>
                              <SelectItem value="5">5 - Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label className="text-sm font-semibold">Show in Scheduler</Label>
                          <p className="text-xs text-muted-foreground">Include this item in the Scheduler panel.</p>
                        </div>
                        <Switch
                          checked={task.scheduleable !== false}
                          onCheckedChange={(checked) => setTask({ ...task, scheduleable: checked })}
                        />
                      </div>

                      {/* Repeated Task Settings */}
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Repeated Task Settings
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="is-repeated"
                              checked={task.isRepeated || false}
                              onCheckedChange={(checked) => setTask({ ...task, isRepeated: !!checked })}
                            />
                            <Label htmlFor="is-repeated" className="text-sm font-medium">
                              This is a repeated task
                            </Label>
                          </div>

                          {task.isRepeated && (
                            <div className="space-y-4 ml-6 p-4 bg-background/50 rounded-lg border">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Repeat Type</Label>
                                <Select
                                  value={task.repeatSettings?.type || "count"}
                                  onValueChange={(value: "count" | "frequency") =>
                                    setTask({
                                      ...task,
                                      repeatSettings: { ...task.repeatSettings, type: value },
                                    })
                                  }
                                >
                                  <SelectTrigger className="focus-ring">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="count">Must be completed X times total</SelectItem>
                                    <SelectItem value="frequency">Must be completed X times per period</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {task.repeatSettings?.type === "count" && (
                                <div className="space-y-2">
                                  <Label htmlFor="total-count" className="text-sm font-medium">
                                    Total times to complete
                                  </Label>
                                  <Input
                                    id="total-count"
                                    type="number"
                                    min="1"
                                    value={task.repeatSettings?.totalCount || 1}
                                    onChange={(e) =>
                                      setTask({
                                        ...task,
                                        repeatSettings: {
                                          ...task.repeatSettings,
                                          type: "count",
                                          totalCount: Number.parseInt(e.target.value) || 1,
                                        },
                                      })
                                    }
                                    className="focus-ring"
                                  />
                                </div>
                              )}

                              {task.repeatSettings?.type === "frequency" && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="frequency-times" className="text-sm font-medium">
                                      Times per period
                                    </Label>
                                    <Input
                                      id="frequency-times"
                                      type="number"
                                      min="1"
                                      value={task.repeatSettings?.frequency?.times || 1}
                                      onChange={(e) =>
                                        setTask({
                                          ...task,
                                          repeatSettings: {
                                            ...task.repeatSettings,
                                            type: "frequency",
                                            frequency: {
                                              ...task.repeatSettings?.frequency,
                                              times: Number.parseInt(e.target.value) || 1,
                                              period: task.repeatSettings?.frequency?.period || "week",
                                            },
                                          },
                                        })
                                      }
                                      className="focus-ring"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="frequency-period" className="text-sm font-medium">
                                      Period
                                    </Label>
                                    <Select
                                      value={task.repeatSettings?.frequency?.period || "week"}
                                      onValueChange={(value: "day" | "week" | "month") =>
                                        setTask({
                                          ...task,
                                          repeatSettings: {
                                            ...task.repeatSettings,
                                            type: "frequency",
                                            frequency: {
                                              ...task.repeatSettings?.frequency,
                                              times: task.repeatSettings?.frequency?.times || 1,
                                              period: value,
                                            },
                                          },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="focus-ring">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="day">Day</SelectItem>
                                        <SelectItem value="week">Week</SelectItem>
                                        <SelectItem value="month">Month</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Type</Label>
                        <div className="flex flex-wrap gap-2">
                          {assignedTypes.map((type) => (
                            <Badge
                              key={type.id}
                              variant="secondary"
                              className="flex items-center gap-2 px-3 py-1 text-sm font-medium cursor-pointer"
                              style={{
                                backgroundColor: `${type.color ?? "#cbd5e1"}20`,
                                borderColor: type.color ?? "#cbd5e1",
                              }}
                              title="Double-click to view or edit this type"
                              onDoubleClick={() => setEditingItemType(type)}
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: type.color ?? "#cbd5e1" }}
                              />
                              {type.name}
                              {type.id === primaryTypeId && assignedTypes.length > 1 && (
                                <span className="text-[10px] text-muted-foreground">primary</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">Lists</Label>
                        <div className="flex flex-wrap gap-2">
                          {task.lists?.map((categoryId) => {
                            const category = lists.find((c) => c.id === categoryId)
                            if (!category) return null

                            return (
                              <Badge
                                key={categoryId}
                                variant="secondary"
                                className="flex items-center gap-2 px-3 py-1 text-sm font-medium cursor-pointer"
                                style={{ backgroundColor: `${category.color}20`, borderColor: category.color }}
                                title="Double-click to open this list"
                                onDoubleClick={() => handleNavigateToList(categoryId)}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                                {category.name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFromCategory(categoryId)
                                  }}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className="ml-1 hover:text-destructive transition-colors"
                                >
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })}
                        </div>

                        <div className="space-y-2">
                          <ListPicker
                            selected={task.lists ?? []}
                            onChange={setLists}
                            mode="multi"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Tags</h3>
                        <TagInput tags={task.tags ?? []} onAdd={addTag} onRemove={removeTag} />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Related</h3>
                        <LinkPicker sourceId={task.id} onAdd={addLink} />
                        <RelatedItemsPanel
                          task={task}
                          onOpenItem={(id) => setOverrideId(id)}
                          onRemoveLink={removeLink}
                        />
                        {/* Visual companion to the textual Related list; clicking a
                            node reuses the same in-place navigation override. */}
                        <LinkGraph focusId={task.id} onOpenItem={(id) => setOverrideId(id)} />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Attributes</h3>
                        <ItemAttributesSection
                          attributes={task.attributes || {}}
                          itemCategoryIds={task.lists ?? []}
                          categories={lists}
                          itemAttributeDefinitions={task.itemAttributeDefinitions}
                          itemType={task.type}
                          onChangeValues={(attributes) => setTask({ ...task, attributes })}
                          onChangeItemAttributeDefinitions={(itemAttributeDefinitions) =>
                            setTask({ ...task, itemAttributeDefinitions })
                          }
                          onCreateAttribute={handleCreateAttribute}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-3 text-sm">
                        <h3 className="font-semibold">Task Information</h3>
                        <div className="space-y-2">
                          <Label htmlFor="completion-status" className="text-sm font-medium">
                            Completion status
                          </Label>
                          <Select value={effectiveStatus(task)} onValueChange={(v) => handleStatusChange(v as CompletionStatus)}>
                            <SelectTrigger id="completion-status" className="focus-ring">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMPLETION_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {COMPLETION_STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {COMPLETION_STATUS_DESCRIPTIONS[effectiveStatus(task)]}
                          </p>
                        </div>
                        <div className="space-y-2 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Created:</span>
                            <span className="font-medium">{safeDateFormat(task.createdAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lifecycle:</span>
                            <span className="font-medium">{task.stage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span className="font-medium">{task.completed ? "Yes" : "No"}</span>
                          </div>
                          {task.deadline && (
                            <div className="flex justify-between">
                              <span>Deadline:</span>
                              <span className="font-medium">{safeDateFormat(task.deadline)}</span>
                            </div>
                          )}
                          {task.actualDuration && (
                            <div className="flex justify-between">
                              <span>Actual Duration:</span>
                              <span className="font-medium">{task.actualDuration} minutes</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="scheduling" className="space-y-6 mt-0">
                  <div className="space-y-8">
                    {task.scheduledDate && !task.scheduledWeek && (
                      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-blue-50/60 border-blue-200">
                        <div>
                          <p className="font-semibold text-sm">On daily to-do list</p>
                          <p className="text-xs text-muted-foreground">
                            Move this task to the weekly to-do list instead of today.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleMoveToWeeklyTodo}>
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Move to Weekly
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Specific Date & Time
                          </h3>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="scheduled-date" className="text-sm font-medium">
                                Scheduled Date
                              </Label>
                              <Input
                                id="scheduled-date"
                                type="date"
                                value={safeISODateString(task.scheduledDate)}
                                onChange={(e) => {
                                  const date = e.target.value ? new Date(e.target.value) : undefined
                                  setTask({
                                    ...task,
                                    scheduledDate: date,
                                    scheduledWeek: undefined,
                                    scheduledMonth: undefined,
                                    scheduledYear: undefined,
                                  })
                                }}
                                className="focus-ring"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-time" className="text-sm font-medium">
                                Scheduled Time
                              </Label>
                              <Input
                                id="scheduled-time"
                                type="time"
                                value={task.scheduledTime || ""}
                                onChange={(e) => setTask({ ...task, scheduledTime: e.target.value })}
                                className="focus-ring"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Deadline
                          </h3>
                          <div className="space-y-2">
                            <Label htmlFor="deadline" className="text-sm font-medium">
                              Deadline Date
                            </Label>
                            <Input
                              id="deadline"
                              type="date"
                              value={safeISODateString(task.deadline)}
                              onChange={(e) => {
                                const date = e.target.value ? new Date(e.target.value) : undefined
                                setTask({ ...task, deadline: date })
                              }}
                              className="focus-ring"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                          <h3 className="font-semibold">Flexible Scheduling</h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="scheduled-week" className="text-sm font-medium">
                                Scheduled Week
                              </Label>
                              <Input
                                id="scheduled-week"
                                type="date"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleScheduleToWeek(new Date(e.target.value))
                                  }
                                }}
                                placeholder="Select any day in the week"
                                className="focus-ring"
                              />
                              {task.scheduledWeek && (
                                <p className="text-xs text-muted-foreground">Currently: {task.scheduledWeek}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-month" className="text-sm font-medium">
                                Scheduled Month
                              </Label>
                              <Input
                                id="scheduled-month"
                                type="month"
                                value={task.scheduledMonth || ""}
                                onChange={(e) =>
                                  setTask({
                                    ...task,
                                    scheduledMonth: e.target.value,
                                    scheduledWeek: undefined,
                                    scheduledDate: undefined,
                                    scheduledYear: undefined,
                                  })
                                }
                                className="focus-ring"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-year" className="text-sm font-medium">
                                Scheduled Year
                              </Label>
                              <Input
                                id="scheduled-year"
                                type="number"
                                min="2024"
                                max="2030"
                                value={task.scheduledYear || ""}
                                onChange={(e) =>
                                  setTask({
                                    ...task,
                                    scheduledYear: e.target.value,
                                    scheduledMonth: undefined,
                                    scheduledWeek: undefined,
                                    scheduledDate: undefined,
                                  })
                                }
                                className="focus-ring"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Scheduling Constraints */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Scheduling Constraints
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="must-be-done-after" className="text-sm font-medium">
                            Must be done after
                          </Label>
                          <Input
                            id="must-be-done-after"
                            type="date"
                            value={safeISODateString(task.schedulingConstraints?.mustBeDoneAfter)}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined
                              setTask({
                                ...task,
                                schedulingConstraints: {
                                  ...task.schedulingConstraints,
                                  mustBeDoneAfter: date,
                                },
                              })
                            }}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="must-be-done-before" className="text-sm font-medium">
                            Must be done before
                          </Label>
                          <Input
                            id="must-be-done-before"
                            type="date"
                            value={safeISODateString(task.schedulingConstraints?.mustBeDoneBefore)}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : undefined
                              setTask({
                                ...task,
                                schedulingConstraints: {
                                  ...task.schedulingConstraints,
                                  mustBeDoneBefore: date,
                                },
                              })
                            }}
                            className="focus-ring"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="time-preference" className="text-sm font-medium">
                          Time of day preference
                        </Label>
                        <Select
                          value={task.schedulingConstraints?.timeOfDayPreference || "none"}
                          onValueChange={(value: "morning" | "afternoon" | "evening" | "night" | "none") =>
                            setTask({
                              ...task,
                              schedulingConstraints: {
                                ...task.schedulingConstraints,
                                timeOfDayPreference: value === "none" ? undefined : value,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="focus-ring">
                            <SelectValue placeholder="No preference" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No preference</SelectItem>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="day-constraints" className="text-sm font-medium">
                          Day constraints
                        </Label>
                        <Textarea
                          id="day-constraints"
                          value={task.schedulingConstraints?.dayConstraints || ""}
                          onChange={(e) =>
                            setTask({
                              ...task,
                              schedulingConstraints: {
                                ...task.schedulingConstraints,
                                dayConstraints: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g., Only on weekdays, Not on Mondays, etc."
                          rows={2}
                          className="focus-ring"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="dependencies" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Task Dependencies
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Tasks that must be completed before this task can be started.
                      </p>

                      <div className="flex gap-2">
                        <Select value={selectedDependency} onValueChange={setSelectedDependency}>
                          <SelectTrigger className="flex-1 focus-ring">
                            <SelectValue placeholder="Select a task dependency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>
                              Select a task
                            </SelectItem>
                            {availableTasksForDependencies.map((availableTask) => (
                              <SelectItem key={availableTask.id} value={availableTask.id}>
                                {availableTask.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={addDependency}
                          disabled={selectedDependency === "none"}
                          className="focus-ring"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {(task.dependencies ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No dependencies set</p>
                        ) : (
                          (task.dependencies ?? []).map((depId) => {
                            const depTask = allTasks.find((t) => t.id === depId)
                            if (!depTask) return null

                            return (
                              <div
                                key={depId}
                                className="flex items-center justify-between p-3 bg-background/50 rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-2 h-2 rounded-full ${depTask.completed ? "bg-green-500" : "bg-yellow-500"}`}
                                  />
                                  <span className="text-sm font-medium">{depTask.description}</span>
                                  <Badge variant={depTask.completed ? "default" : "secondary"} className="text-xs">
                                    {depTask.completed ? "Completed" : "Pending"}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDependency(depId)}
                                  className="h-6 w-6 focus-ring"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subtasks" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Subtasks
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Break down this task into smaller, manageable subtasks.
                      </p>

                      <div className="flex gap-2">
                        <Input
                          value={newSubtaskDescription}
                          onChange={(e) => setNewSubtaskDescription(e.target.value)}
                          placeholder="Enter subtask description..."
                          className="flex-1 focus-ring"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              addSubtask()
                            }
                          }}
                        />
                        <Button onClick={addSubtask} disabled={!newSubtaskDescription.trim()} className="focus-ring">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {!task.subtasks || task.subtasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No subtasks created</p>
                        ) : (
                          task.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center justify-between p-3 bg-background/50 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={subtask.completed}
                                  onCheckedChange={() => toggleSubtask(subtask.id)}
                                />
                                <span
                                  className={`text-sm font-medium ${subtask.completed ? "line-through text-muted-foreground" : ""}`}
                                >
                                  {subtask.description}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSubtask(subtask.id)}
                                className="h-6 w-6 focus-ring"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>

                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress:</span>
                            <span className="font-medium">
                              {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length} completed
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mt-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${(task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="analysis" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Task Analysis
                      </h3>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="why" className="text-sm font-semibold">
                            Why do you need to do this task?
                          </Label>
                          <Textarea
                            id="why"
                            value={task.why || ""}
                            onChange={(e) => setTask({ ...task, why: e.target.value })}
                            placeholder="Explain the purpose and motivation behind this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="consequences" className="text-sm font-semibold">
                            What happens if you don't do it?
                          </Label>
                          <Textarea
                            id="consequences"
                            value={task.consequences || ""}
                            onChange={(e) => setTask({ ...task, consequences: e.target.value })}
                            placeholder="Describe the potential consequences of not completing this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-sm font-semibold">
                            Additional Notes
                          </Label>
                          <Textarea
                            id="notes"
                            value={task.notes || ""}
                            onChange={(e) => setTask({ ...task, notes: e.target.value })}
                            placeholder="Any additional thoughts or context..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {visiblePanels.includes("time") && (
                <TabsContent value="time" className="space-y-6 mt-0">
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Estimated vs actual time
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Estimated (plan)</Label>
                        <Input
                          type="number"
                          value={task.estimatedDuration ?? ""}
                          onChange={(e) =>
                            setTask({ ...task, estimatedDuration: Number.parseInt(e.target.value) || undefined })
                          }
                          placeholder="minutes"
                        />
                      </div>
                      <div>
                        <Label>Actual (logged total)</Label>
                        <Input type="number" value={task.actualDuration ?? ""} readOnly className="bg-muted" />
                      </div>
                    </div>
                    {(task.timeLogs?.length ?? 0) > 0 && (
                      <ul className="text-sm space-y-1">
                        {task.timeLogs!.map((log) => (
                          <li key={log.id} className="flex justify-between border-b py-1">
                            <span>{log.durationMinutes}m{log.location ? ` @ ${log.location}` : ""}{log.notes ? ` — ${log.notes}` : ""}</span>
                            <span className="text-muted-foreground">{log.date}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>
                )}

                {visiblePanels.includes("body") && (
                <TabsContent value="body" className="space-y-6 mt-0">
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Body
                    </h3>
                    <BodyPanel taskId={task.id} />
                  </div>
                </TabsContent>
                )}
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <ItemTypeEditor
        open={!!editingItemType}
        onOpenChange={(open) => {
          if (!open) setEditingItemType(null)
        }}
        type={editingItemType}
        existingIds={itemTypes.map((t) => t.id as string)}
        allTypes={itemTypes}
        onSave={handleSaveItemType}
        onNavigateType={(t) => setEditingItemType(t)}
        onDelete={
          editingItemType && !editingItemType.builtin
            ? () => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(`Delete the "${editingItemType.name}" item type? Items keep their data.`)
                ) {
                  return
                }
                deleteItemType(editingItemType.id as string)
                setEditingItemType(null)
              }
            : undefined
        }
        onOpenItem={(id) => {
          setEditingItemType(null)
          setOverrideId(id)
        }}
      />
    </>
  )
}
