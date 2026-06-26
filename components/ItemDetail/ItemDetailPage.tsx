/**
 * components/ItemDetail/ItemDetailPage.tsx — Full-screen item detail/editor
 *
 * The full task editor opened from the app shell when a task is selected. Exposes
 * all task attributes — details, description, scheduling, dependencies, subtasks,
 * partial completion, repeat settings, and analysis. Shares load/draft state and
 * the category/dependency mutators with `ItemDetailPopup` via `useItemDetailDraft`.
 *
 * Imported app-wide as `EnhancedTaskDetail` via the `components/enhanced-task-detail`
 * barrel. Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useState, useCallback, useEffect } from "react"
import { useItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { TagInput } from "@/components/ItemDetail/TagInput"
import { LinkPicker } from "@/components/ItemDetail/LinkPicker"
import { RelatedItemsPanel } from "@/components/ItemDetail/RelatedItemsPanel"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ListPicker } from "@/components/Lists/list-picker"
import { LinkGraph } from "@/components/Graph/LinkGraph"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Save,
  Calendar,
  Clock,
  AlertTriangle,
  Star,
  CheckCircle,
  XCircle,
  Plus,
  Trash,
  GitBranch,
  Target,
  CalendarDays,
  Users,
  Timer,
  Award,
  Sparkles,
  Split,
  MoreHorizontal,
  Rocket,
} from "lucide-react"
import { upgradeTaskToOperation, OPERATION_TYPE_ID } from "@/components/Operations"
import { ItemAttributesSection } from "@/components/ItemDetail/ItemAttributesSection"
import { useItemTypeStore } from "@/lib/item-type-store"
import { assignedItemTypes, BUILTIN_TASK_TYPE_ID } from "@/lib/item-types"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition, Subtask, Task } from "@/lib/types"
import { safeDateFormat, safeISODateString } from "@/lib/date-utils"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { requestNavigateToList } from "@/lib/app-navigation"
import {
  addStepsAsSubtasks,
  parseSteps,
  setSubtaskContext,
  toggleMolecular,
  toggleSubtaskComplete,
  removeSubtask as removeMolecularStep,
} from "@/lib/molecular"

interface EnhancedTaskDetailProps {
  taskId: string
  onBack: () => void
}

export function EnhancedTaskDetail({ taskId, onBack }: EnhancedTaskDetailProps) {
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const effectiveId = overrideId ?? taskId

  useEffect(() => {
    setOverrideId(null)
  }, [taskId])

  const {
    task,
    setTask,
    allTasks,
    lists,
    updateTask,
    addTask,
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
  const folders = useTaskStore((state) => state.folders)
  const itemTypes = useItemTypeStore((state) => state.types)
  const updateItemType = useItemTypeStore((state) => state.updateType)
  const addItemType = useItemTypeStore((state) => state.addType)
  const deleteItemType = useItemTypeStore((state) => state.deleteType)

  const [isEditing, setIsEditing] = useState(false)
  const [newSubtaskDescription, setNewSubtaskDescription] = useState("")
  const [selectedDependency, setSelectedDependency] = useState("")
  const [actualDurationInput, setActualDurationInput] = useState("")
  const [splitText, setSplitText] = useState("")
  const [editingItemType, setEditingItemType] = useState<ItemTypeDefinition | null>(null)

  // Create a new attribute from the detail view. Targeting a list persists the
  // definition onto that list's schema immediately; the value lands on the draft
  // and persists with Save Changes.
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

  const handleSave = useCallback(() => {
    if (task) {
      updateTask(task)
      setIsEditing(false)
    }
  }, [task, updateTask])

  const handleDelete = useCallback(() => {
    if (!task) return
    if (confirm(`Delete "${task.description}"? This cannot be undone.`)) {
      deleteTask(task.id)
      onBack()
    }
  }, [task, deleteTask, onBack])

  const handleComplete = useCallback(() => {
    if (task) {
      const actualDuration = actualDurationInput ? Number.parseInt(actualDurationInput) : undefined
      updateTask({
        ...task,
        completed: true,
        actualDuration: actualDuration,
      })
    }
  }, [task, actualDurationInput, updateTask])

  const handleSchedule = useCallback(
    (type: "date" | "week" | "month" | "year", value: string) => {
      if (task) {
        const updates: Partial<Task> = {}

        switch (type) {
          case "date":
            updates.scheduledDate = value ? new Date(value) : undefined
            break
          case "week":
            updates.scheduledWeek = value
            break
          case "month":
            updates.scheduledMonth = value
            break
          case "year":
            updates.scheduledYear = value
            break
        }

        setTask({ ...task, ...updates })
      }
    },
    [task],
  )

  const addSubtask = useCallback(() => {
    if (task && newSubtaskDescription.trim()) {
      const subtask: Task = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        description: newSubtaskDescription,
        stage: "clarified",
        createdAt: new Date(),
        estimatedDuration: 15,
        cognitiveLoad: 1,
        urgency: task.urgency,
        importance: task.importance,
        dependencies: [],
        context: task.context,
        entropy: 0.3,
        rewardValue: 3,
        completed: false,
        lists: task.lists || [],
        parentTaskId: task.id,
        subtasks: [],
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      }

      // Add the subtask to the store
      addTask(subtask)

      // Update the parent task to include this subtask
      const updatedTask = {
        ...task,
        subtasks: [...(task.subtasks || []), { id: subtask.id, description: subtask.description, completed: false }],
      }
      setTask(updatedTask)
      updateTask(updatedTask)

      setNewSubtaskDescription("")
    }
  }, [task, newSubtaskDescription, addTask, updateTask])

  const removeSubtask = useCallback(
    (subtaskId: string) => {
      if (task) {
        deleteTask(subtaskId)
        const updatedTask = {
          ...task,
          subtasks: task.subtasks?.filter((s) => s.id !== subtaskId) || [],
        }
        setTask(updatedTask)
        updateTask(updatedTask)
      }
    },
    [task, deleteTask, updateTask],
  )

  // ---- Molecular steps (operate on the Task.subtasks tree directly) --------
  const persistSubtasks = useCallback(
    (subtasks: Subtask[]) => {
      if (!task) return
      const updated = { ...task, subtasks }
      setTask(updated)
      updateTask(updated)
    },
    [task, setTask, updateTask],
  )

  const splitIntoSteps = useCallback(() => {
    if (!task) return
    const steps = parseSteps(splitText)
    if (steps.length === 0) return
    persistSubtasks(addStepsAsSubtasks(task.subtasks, steps))
    setSplitText("")
  }, [task, splitText, persistSubtasks])

  const handleToggleStepComplete = useCallback(
    (id: string) => {
      if (task) persistSubtasks(toggleSubtaskComplete(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  const handleToggleStepMolecular = useCallback(
    (id: string) => {
      if (task) persistSubtasks(toggleMolecular(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  const handleStepContextChange = useCallback(
    (id: string, context: string) => {
      if (task) persistSubtasks(setSubtaskContext(task.subtasks ?? [], id, context))
    },
    [task, persistSubtasks],
  )

  const handleDeleteStep = useCallback(
    (id: string) => {
      if (task) persistSubtasks(removeMolecularStep(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  const addDependency = useCallback(() => {
    if (task && selectedDependency && !(task.dependencies ?? []).includes(selectedDependency)) {
      setTask({
        ...task,
        dependencies: [...(task.dependencies ?? []), selectedDependency],
      })
      setSelectedDependency("")
    }
  }, [task, selectedDependency])

  // Get available tasks for dependencies (excluding current task and its subtasks)
  const availableDependencies = allTasks.filter(
    (t) => t.id !== effectiveId && !t.completed && t.parentTaskId !== effectiveId,
  )

  // Get subtasks
  const subtaskIds = new Set((task?.subtasks ?? []).map((s) => s.id))
  const subtasks = allTasks.filter((t) => subtaskIds.has(t.id))

  // Every item type assigned to this item: its own type plus any type pinned by
  // a list it belongs to (e.g. a task that also lives in a "Goals" list).
  const itemTypes_assigned = assignedItemTypes(
    { type: task?.type, lists: task?.lists ?? [] },
    lists,
    itemTypes,
  )
  const primaryTypeId = task?.type ?? BUILTIN_TASK_TYPE_ID

  const handleNavigateToList = useCallback(
    (listId: string) => {
      requestNavigateToList(listId, folders)
      onBack()
    },
    [folders, onBack],
  )

  const handleSaveItemType = useCallback(
    (def: ItemTypeDefinition) => {
      if (itemTypes.some((t) => t.id === def.id)) updateItemType(def)
      else addItemType(def)
      setEditingItemType(null)
    },
    [itemTypes, updateItemType, addItemType],
  )

  // Read-only attribute summary is rendered inline where needed; attributes are
  // always editable via ItemAttributesSection on the details tab.

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  // The "body" document panel (Worker D) shows for note-type items and any list
  // whose detailPanels include "body".
  const showBody =
    task.type === "note" ||
    (task.lists ?? []).some((cid) =>
      lists.find((c) => c.id === cid)?.detailPanels?.includes("body"),
    )
  const tabCount = 5 + (showBody ? 1 : 0)

  return (
    <>
    <div className="space-y-6">
      {/* Fixed header with task title */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{task.description}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={task.completed ? "default" : "secondary"}>
                  {task.completed ? "Completed" : task.stage}
                </Badge>
                {task.actualDuration && (
                  <Badge variant="outline">
                    <Timer className="h-3 w-3 mr-1" />
                    Took {task.actualDuration}m
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!task.completed && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Actual minutes"
                  value={actualDurationInput}
                  onChange={(e) => setActualDurationInput(e.target.value)}
                  className="w-32"
                />
                <Button variant="outline" onClick={handleComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </div>
            )}
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Task</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={task.type === OPERATION_TYPE_ID}
                  onClick={() => upgradeTaskToOperation(task.id)}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  {task.type === OPERATION_TYPE_ID ? "Already an Operation" : "Upgrade to Operation"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}
        >
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          {showBody && <TabsTrigger value="body">Body</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimated-duration">Estimated Duration (minutes)</Label>
                      {isEditing ? (
                        <Input
                          id="estimated-duration"
                          type="number"
                          value={task.estimatedDuration}
                          onChange={(e) =>
                            setTask({ ...task, estimatedDuration: Number.parseInt(e.target.value) || 0 })
                          }
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{task.estimatedDuration} minutes</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reward-value">Reward Value (1-10)</Label>
                      {isEditing ? (
                        <Input
                          id="reward-value"
                          type="number"
                          min="1"
                          max="10"
                          value={task.rewardValue}
                          onChange={(e) => setTask({ ...task, rewardValue: Number.parseInt(e.target.value) || 1 })}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          <span>{task.rewardValue}/10</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="urgency">Urgency</Label>
                      {isEditing ? (
                        <Select
                          value={(task.urgency ?? 3).toString()}
                          onValueChange={(value) => setTask({ ...task, urgency: Number.parseInt(value) })}
                        >
                          <SelectTrigger>
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
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <span>{task.urgency ?? 3}/5</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="importance">Importance</Label>
                      {isEditing ? (
                        <Select
                          value={(task.importance ?? 3).toString()}
                          onValueChange={(value) => setTask({ ...task, importance: Number.parseInt(value) })}
                        >
                          <SelectTrigger>
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
                      ) : (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-muted-foreground" />
                          <span>{task.importance ?? 3}/5</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="context">Context</Label>
                      {isEditing ? (
                        <Input
                          id="context"
                          value={task.context}
                          onChange={(e) => setTask({ ...task, context: e.target.value })}
                        />
                      ) : (
                        <Badge variant="outline">{task.context}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Partial Completion Settings */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-medium">Partial Completion Settings</h3>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="allow-partial"
                          checked={task.allowPartialCompletion}
                          onCheckedChange={(checked) =>
                            isEditing && setTask({ ...task, allowPartialCompletion: !!checked })
                          }
                          disabled={!isEditing}
                        />
                        <Label htmlFor="allow-partial">Allow partial completion</Label>
                      </div>

                      {task.allowPartialCompletion && (
                        <div className="space-y-2">
                          <Label htmlFor="chunk-size">Minimum chunk size (minutes)</Label>
                          {isEditing ? (
                            <Input
                              id="chunk-size"
                              type="number"
                              min="5"
                              value={task.minimumChunkSize}
                              onChange={(e) =>
                                setTask({ ...task, minimumChunkSize: Number.parseInt(e.target.value) || 15 })
                              }
                            />
                          ) : (
                            <span className="text-sm">{task.minimumChunkSize} minutes</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {itemTypes_assigned.map((type) => (
                      <Badge
                        key={type.id}
                        variant="secondary"
                        className="flex items-center gap-1.5 cursor-pointer"
                        style={{
                          backgroundColor: `${type.color ?? "#cbd5e1"}20`,
                          borderColor: type.color ?? "#cbd5e1",
                        }}
                        title="Double-click to view or edit this type"
                        onDoubleClick={() => setEditingItemType(type)}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: type.color ?? "#cbd5e1" }}
                        />
                        {type.name}
                        {type.id === primaryTypeId && itemTypes_assigned.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">primary</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lists</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {task.lists?.map((categoryId) => {
                      const category = lists.find((c) => c.id === categoryId)
                      if (!category) return null

                      return (
                        <Badge
                          key={categoryId}
                          variant="secondary"
                          className="flex items-center gap-1 cursor-pointer"
                          style={{ backgroundColor: `${category.color}20`, borderColor: category.color }}
                          title="Double-click to open this list"
                          onDoubleClick={() => handleNavigateToList(categoryId)}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.name}
                          {isEditing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFromCategory(categoryId)
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              className="ml-1 hover:text-destructive"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      )
                    })}
                  </div>

                  {isEditing && (
                    <div className="space-y-2">
                      <Label>Add to List</Label>
                      <ListPicker
                        selected={task.lists ?? []}
                        onChange={setLists}
                        mode="multi"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <TagInput tags={task.tags ?? []} onAdd={addTag} onRemove={removeTag} />
                  ) : (task.tags?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.tags!.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tags</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attributes</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Related</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing && <LinkPicker sourceId={task.id} onAdd={addLink} />}
                  <RelatedItemsPanel
                    task={task}
                    onOpenItem={(id) => setOverrideId(id)}
                    onRemoveLink={removeLink}
                  />
                  {/* Visual companion to the textual Related list; clicking a
                      node reuses the same in-place navigation override. */}
                  <LinkGraph focusId={task.id} onOpenItem={(id) => setOverrideId(id)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div>Created: {safeDateFormat(task.createdAt)}</div>
                  <div>Status: {task.stage}</div>
                  <div>Completed: {task.completed ? "Yes" : "No"}</div>
                  {task.deadline && <div>Deadline: {safeDateFormat(task.deadline)}</div>}
                  {task.parentTaskId && (
                    <div>Parent Task: {allTasks.find((t) => t.id === task.parentTaskId)?.description}</div>
                  )}
                  {task.actualDuration && <div>Actual Duration: {task.actualDuration} minutes</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Scheduling & Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Specific Date & Time</h3>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-date">Scheduled Date</Label>
                    <Input
                      id="scheduled-date"
                      type="date"
                      value={safeISODateString(task.scheduledDate)}
                      onChange={(e) => handleSchedule("date", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled-time">Scheduled Time</Label>
                    <Input
                      id="scheduled-time"
                      type="time"
                      value={task.scheduledTime || ""}
                      onChange={(e) => setTask({ ...task, scheduledTime: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Deadline</h3>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline Date</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={safeISODateString(task.deadline)}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined
                        setTask({ ...task, deadline: date })
                      }}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Flexible Scheduling</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-week">Scheduled Week</Label>
                    <Input
                      id="scheduled-week"
                      placeholder="e.g., 2024-05-19_2024-05-25"
                      value={task.scheduledWeek || ""}
                      onChange={(e) => handleSchedule("week", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled-month">Scheduled Month</Label>
                    <Input
                      id="scheduled-month"
                      type="month"
                      value={task.scheduledMonth || ""}
                      onChange={(e) => handleSchedule("month", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled-year">Scheduled Year</Label>
                    <Input
                      id="scheduled-year"
                      type="number"
                      min="2024"
                      max="2030"
                      value={task.scheduledYear || ""}
                      onChange={(e) => handleSchedule("year", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>

              {(task.scheduledDate ||
                task.deadline ||
                task.scheduledWeek ||
                task.scheduledMonth ||
                task.scheduledYear) && (
                <div className="p-4 bg-muted rounded-md space-y-2">
                  {task.scheduledDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Scheduled for {safeDateFormat(task.scheduledDate)}
                        {task.scheduledTime && ` at ${task.scheduledTime}`}
                      </span>
                    </div>
                  )}
                  {task.deadline && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4" />
                      <span>Deadline: {safeDateFormat(task.deadline)}</span>
                    </div>
                  )}
                  {task.scheduledWeek && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>Scheduled for week: {task.scheduledWeek}</span>
                    </div>
                  )}
                  {task.scheduledMonth && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>Scheduled for month: {task.scheduledMonth}</span>
                    </div>
                  )}
                  {task.scheduledYear && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>Scheduled for year: {task.scheduledYear}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Task Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Dependencies</Label>
                {(task.dependencies ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {(task.dependencies ?? []).map((depId) => {
                      const depTask = allTasks.find((t) => t.id === depId)
                      return (
                        <div key={depId} className="flex justify-between items-center p-2 border rounded-md">
                          <span className="text-sm">{depTask?.description || "Unknown Task"}</span>
                          {isEditing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeDependency(depId)}
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No dependencies</p>
                )}
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <Label>Add Dependency</Label>
                  <div className="flex gap-2">
                    <Select value={selectedDependency} onValueChange={setSelectedDependency}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a task" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDependencies
                          .filter((t) => !(task.dependencies ?? []).includes(t.id))
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.description}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addDependency} disabled={!selectedDependency}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subtasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subtasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing && (
                <div className="space-y-2">
                  <Label>Add Subtask</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter subtask description..."
                      value={newSubtaskDescription}
                      onChange={(e) => setNewSubtaskDescription(e.target.value)}
                      className="flex-1"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          addSubtask()
                        }
                      }}
                    />
                    <Button onClick={addSubtask} disabled={!newSubtaskDescription.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Current Subtasks</Label>
                {subtasks.length > 0 ? (
                  <div className="space-y-2">
                    {subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex justify-between items-center p-2 border rounded-md">
                        <div className="flex items-center gap-2">
                          <CheckCircle
                            className={`h-4 w-4 ${subtask.completed ? "text-green-500" : "text-muted-foreground"}`}
                          />
                          <span className={`text-sm ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
                            {subtask.description}
                          </span>
                        </div>
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeSubtask(subtask.id)}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No subtasks</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Split className="h-5 w-5" />
                Molecular Breakdown
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Split this task into as many separate steps as you can. If a step can&apos;t be split further, mark it{" "}
                <span className="font-medium">MOLECULAR</span>. Give each step enough context to understand it on its
                own — that&apos;s what &quot;Just Start&quot; focuses on.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="split-steps">Split into steps (one per line)</Label>
                <Textarea
                  id="split-steps"
                  rows={4}
                  placeholder={"1. Open the file\n2. Find the section\n3. Write the first sentence"}
                  value={splitText}
                  onChange={(e) => setSplitText(e.target.value)}
                />
                <Button onClick={splitIntoSteps} disabled={!parseSteps(splitText).length}>
                  <Split className="h-4 w-4 mr-2" />
                  Add steps
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Steps</Label>
                {(task.subtasks ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {(task.subtasks ?? []).map((step) => (
                      <div key={step.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={step.completed}
                            onCheckedChange={() => handleToggleStepComplete(step.id)}
                            className="mt-1"
                          />
                          <span
                            className={`flex-1 text-sm ${step.completed ? "line-through text-muted-foreground" : ""}`}
                          >
                            {step.description}
                          </span>
                          <Button
                            variant={step.isMolecular ? "default" : "outline"}
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleToggleStepMolecular(step.id)}
                            title="Atomic step that can't be split further"
                          >
                            <Sparkles className="h-3 w-3" />
                            {step.isMolecular ? "MOLECULAR" : "Atomic?"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteStep(step.id)}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Context — what you need to know to do this step on its own…"
                          value={step.context ?? ""}
                          onChange={(e) => handleStepContextChange(step.id, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No steps yet — split the task above to begin.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="why">Why do you need to do this task?</Label>
                {isEditing ? (
                  <Textarea
                    id="why"
                    value={task.why || ""}
                    onChange={(e) => setTask({ ...task, why: e.target.value })}
                    placeholder="Explain the purpose and motivation behind this task..."
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{task.why || "No reason specified"}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consequences">What happens if you don't do it?</Label>
                {isEditing ? (
                  <Textarea
                    id="consequences"
                    value={task.consequences || ""}
                    onChange={(e) => setTask({ ...task, consequences: e.target.value })}
                    placeholder="Describe the potential consequences of not completing this task..."
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{task.consequences || "No consequences specified"}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                {isEditing ? (
                  <Textarea
                    id="notes"
                    value={task.notes || ""}
                    onChange={(e) => setTask({ ...task, notes: e.target.value })}
                    placeholder="Any additional thoughts or context..."
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{task.notes || "No additional notes"}</p>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Task Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Entropy:</span>
                    <span className="font-medium">{(task.entropy ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Reward Value:</span>
                    <span className="font-medium">{task.rewardValue}/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cognitive Load:</span>
                    <span className="font-medium">{task.cognitiveLoad}/3</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Estimated Duration:</span>
                    <span className="font-medium">{task.estimatedDuration} minutes</span>
                  </div>
                  {task.actualDuration && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Actual Duration:</span>
                      <span className="font-medium">{task.actualDuration} minutes</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showBody && (
          <TabsContent value="body" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Body</CardTitle>
              </CardHeader>
              <CardContent>
                <BodyPanel taskId={task.id} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>

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
