/**
 * components/ItemDetail/ItemDetailPopup.tsx — Compact item detail popup
 *
 * A modal/popover detail view of a single task used inline by the Scheduler,
 * Plan, and To-Do panels (edit fields, complete, reschedule). Lighter-weight
 * sibling of the full-screen `ItemDetailPage.tsx`. Both share load/draft state
 * and the category/dependency mutators via `useItemDetailDraft`.
 *
 * Import as `TaskDetailPopup` from `@/components/ItemDetail/ItemDetailPopup`.
 * Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { ReminderScheduleFields } from "@/components/ItemDetail/ReminderScheduleFields"
import { PersonDetail } from "@/components/People/person-detail"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import { PERSON_ATTR } from "@/lib/person-types"
import { useItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { isReminderTask } from "@/lib/reminders"
import { TagInput } from "@/components/ItemDetail/TagInput"
import { LinkPicker } from "@/components/ItemDetail/LinkPicker"
import { RelatedItemsPanel } from "@/components/ItemDetail/RelatedItemsPanel"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ListPicker } from "@/components/Lists/list-picker"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { SubtaskComposer } from "@/components/ItemDetail/SubtaskComposer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Save,
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
  History,
  TimerOff,
} from "lucide-react"
import { ItemActivityPanel } from "@/components/ItemDetail/ItemActivityPanel"
import { CycleConfirmDialog } from "@/components/ItemDetail/CycleConfirmDialog"
import type { Task, TaskCompletionReview, ItemDetailPanel, TimeLogEntry, CompletionStatus } from "@/lib/types"
import { dateInputValue, getWeekString, parseLocalDate, safeDateFormat } from "@/lib/date-utils"
import {
  COMPLETION_STATUSES,
  COMPLETION_STATUS_LABELS,
  COMPLETION_STATUS_DESCRIPTIONS,
  effectiveStatus,
  withStatus,
  isClearedFromWork,
} from "@/lib/completion-status"
import { ItemAttributesSection } from "@/components/ItemDetail/ItemAttributesSection"
import { isTaskItem, itemTitleOrUntitled } from "@/lib/item-utils"
import { markMissedOpportunity } from "@/lib/services/completion-service"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { getScheduleableCategoryIds } from "@/components/Scheduler/scheduler-utils"
import { assignedItemTypes, BUILTIN_ITEM_TYPE_ID, BUILTIN_TASK_TYPE_ID, resolveDetailView } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition } from "@/lib/types"
import { TodoCommitmentFields } from "@/components/ItemDetail/TodoCommitmentFields"
import { ItemEstimateField } from "@/components/ItemDetail/ItemEstimateField"
import { ItemScheduleFlags } from "@/components/ItemDetail/ItemScheduleFlags"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { APP_NAV_KEYS, readStoredRecord, requestNavigateToListAfterPaint, writeStoredRecordField } from "@/lib/app-navigation"
import { isSentOnList, withSentMark } from "@/lib/list-sent"
import { ItemSaveFlag } from "@/components/ItemDetail/ItemSaveFlag"
import { useItemDetailSaveHotkey } from "@/components/ItemDetail/useItemDetailSaveHotkey"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./item-detail-chrome.css"

interface TaskDetailPopupProps {
  taskId: string | null
  open: boolean
  onClose: () => void
  /** Stack above another dialog that is already open (friend mission sheet). */
  stackAbove?: boolean
  /** Mount inside that dialog so the page’s focus lock does not hide this one. */
  container?: HTMLElement | null
}

export function TaskDetailPopup({ taskId, open, onClose, stackAbove = false, container = null }: TaskDetailPopupProps) {
  const detailRef = useRef<HTMLDivElement>(null)
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [missAsk, setMissAsk] = useState(false)
  const effectiveId = overrideId ?? taskId

  // Reset the in-popup navigation override whenever the host opens a new item.
  useEffect(() => {
    setOverrideId(null)
  }, [taskId])

  const {
    task,
    setTask,
    getDraft,
    subscribeDraft,
    touchDraft,
    originalTask,
    setOriginalTask,
    allTasks,
    lists,
    folders,
    updateTask,
    commitDraft,
    deleteTask,
    removeFromCategory,
    setLists,
    removeDependency,
    addDependency,
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

  const [selectedDependency, setSelectedDependency] = useState("none")
  const [cycleLabel, setCycleLabel] = useState<string | null>(null)
  const [editingItemType, setEditingItemType] = useState<ItemTypeDefinition | null>(null)

  // A "task" item type (anything in Next Actions, plus items explicitly typed
  // "task") gets the full set of task features/panels.
  const isTask = task ? isTaskItem(task, folders) : false
  const detailView = useMemo(
    () =>
      task
        ? resolveDetailView(task, lists, itemTypes, { isTask })
        : { panels: ["details"] as ItemDetailPanel[], capabilities: {}, layout: undefined },
    [task, lists, itemTypes, isTask],
  )
  const visiblePanels = detailView.panels
  const caps = detailView.capabilities
  const scheduleableCategoryIds = useMemo(() => getScheduleableCategoryIds(lists), [lists])
  const popupTabs = useMemo(() => [...visiblePanels, "history"], [visiblePanels])
  const [detailTab, setDetailTab] = useState(() => {
    const stored = effectiveId ? readStoredRecord(APP_NAV_KEYS.itemDetailTab)[effectiveId] : null
    return stored || "details"
  })

  useEffect(() => {
    if (!effectiveId) return
    const stored = readStoredRecord(APP_NAV_KEYS.itemDetailTab)[effectiveId]
    setDetailTab(stored || "details")
  }, [effectiveId])

  useEffect(() => {
    if (!effectiveId) return
    writeStoredRecordField(APP_NAV_KEYS.itemDetailTab, effectiveId, detailTab)
  }, [effectiveId, detailTab])

  const activeDetailTab = popupTabs.includes(detailTab) ? detailTab : "details"

  const commitReminder = useCallback(
    (patch: Pick<Task, "scheduledDate" | "scheduledTime" | "reminder">) => {
      touchDraft(patch)
      setTask((prev) => (prev ? { ...prev, ...patch } : prev))
      const next = getDraft()
      if (!next) return
      commitDraft(next)
    },
    [touchDraft, setTask, getDraft, commitDraft],
  )

  const handleSave = useCallback(() => {
    const draft = getDraft()
    if (draft) commitDraft(draft)
  }, [getDraft, commitDraft])

  useItemDetailSaveHotkey(detailRef, handleSave, open && Boolean(task))

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
    const draft = getDraft()
    if (draft) {
      commitDraft({ ...draft, completed: true })
      onClose()
    }
  }, [getDraft, commitDraft, onClose])

  const handleMissed = useCallback(() => {
    if (!task) return
    setMissAsk(true)
  }, [task])

  // Persist a richer completion status immediately, keeping the legacy
  // `completed` flag in sync (invariant: status "done" ⇔ completed true).
  const handleStatusChange = useCallback(
    (status: CompletionStatus) => {
      if (!task) return
      commitDraft(withStatus(task, status))
    },
    [task, commitDraft],
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

  const addSubtask = useCallback((description: string) => {
    const trimmed = description.trim()
    if (!task || !trimmed) return
    setTask({
      ...task,
      subtasks: [...(task.subtasks || []), { id: Date.now().toString(), description: trimmed, completed: false }],
    })
  }, [task, setTask])

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
      onClose()
      requestNavigateToListAfterPaint(listId, folders)
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

  const handleAddDependency = useCallback(() => {
    const result = addDependency(selectedDependency)
    if (!result.ok) {
      setCycleLabel(result.cycleLabel)
      return
    }
    if (selectedDependency && selectedDependency !== "none") setSelectedDependency("none")
  }, [addDependency, selectedDependency])

  const isDirty = Boolean(task && originalTask && !snapshotsEqual(getDraft(), originalTask))
  const guard = useUnsavedGuard({
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: handleSave,
    onDiscard: () => {
      if (originalTask) setTask(originalTask)
    },
  })

  if (!task) {
    return null
  }

  const availableTasksForDependencies = allTasks.filter((t) => t.id !== task.id && !(task.dependencies || []).includes(t.id))

  // Every item type assigned to this item: its own type plus any type pinned by
  // a list it belongs to (e.g. a task that also lives in a "Goals" list).
  const assignedTypes = assignedItemTypes(
    { type: task.type ?? (isTask ? BUILTIN_TASK_TYPE_ID : BUILTIN_ITEM_TYPE_ID), lists: task.lists ?? [] },
    lists,
    itemTypes,
  )
  const primaryTypeId = task.type ?? (isTask ? BUILTIN_TASK_TYPE_ID : BUILTIN_ITEM_TYPE_ID)
  const sentListIds = (task.lists ?? []).filter((id) => lists.some((list) => list.id === id && list.sentThisWeek === true))
  const sentOnThoseLists = sentListIds.length > 0 && sentListIds.every((id) => isSentOnList(task, id))
  const handleToggleSent = () => {
    commitDraft(withSentMark(task, sentListIds, !sentOnThoseLists, new Date()))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={guard.handleOpenChange}>
        <DialogContent
          ref={detailRef}
          className={`id95-dialog id95 sm:max-w-5xl max-h-[90vh] overflow-hidden !flex flex-col${stackAbove ? " z-[80]" : ""}`}
          overlayClassName={stackAbove ? "z-[80]" : undefined}
          container={container}
          data-ui-name="Item detail"
          data-ui-docs="components/ItemDetail/README.md"
          {...unsavedDismissProps(guard.requestClose)}
        >
          <DialogTitle className="sr-only">Item detail</DialogTitle>
          <div className="id-fascia">
            <div className="id-fascia-row">
              <div className="id-mark">
                <span className="id-power-lamp is-on" aria-hidden />
                <IsolatedInput
                  value={task.description}
                  onLiveChange={(description) => touchDraft({ description, title: description })}
                  onCommit={(description) =>
                    setTask((prev) => (prev ? { ...prev, description, title: description } : prev))
                  }
                  className="id-title-input id-title"
                  placeholder="Item name"
                />
              </div>
            </div>
            <div className="id-fascia-row id-meta">
              <Badge variant={task.completed ? "default" : "secondary"} className="id-chip">
                {task.completed ? "Completed" : task.stage}
              </Badge>
              {task.actualDuration && (
                <Badge variant="outline" className="id-chip">
                  <Timer className="h-3 w-3" />
                  Took {task.actualDuration}m
                </Badge>
              )}
            </div>
            <div className="id-fascia-row">
              <div className="id-key-row" style={{ marginLeft: 0 }}>
                <div className="id-save-cluster">
                  <ItemSaveFlag originalTask={originalTask} getDraft={getDraft} subscribeDraft={subscribeDraft} />
                  <Button onClick={handleSave} className="id-btn id-btn-primary" title="Cmd/Ctrl+S">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
                {!isClearedFromWork(task) && caps.completable && (
                  <Button
                    variant="outline"
                    onClick={handleComplete}
                    className="id-btn id-btn-primary"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </Button>
                )}
                {!isClearedFromWork(task) && caps.completable && (
                  <Button
                    variant="outline"
                    onClick={handleMissed}
                    className="id-btn id-btn-secondary"
                    title="Too late — file as a missed opportunity"
                  >
                    <TimerOff className="h-4 w-4" />
                    Missed
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="id-btn id-btn-danger id-btn-quiet"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <div className="id-dialog-scroll">
            <Tabs value={activeDetailTab} onValueChange={setDetailTab} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="id-view-keys">
                {visiblePanels.includes("body") && (
                <TabsTrigger value="body" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Body
                </TabsTrigger>
                )}
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
                <TabsTrigger value="analysis" className="flex items-center gap-2 id-tab-secondary">
                  <Brain className="h-4 w-4" />
                  Analysis
                </TabsTrigger>
                )}
                {visiblePanels.includes("time") && (
                <TabsTrigger value="time" className="flex items-center gap-2 id-tab-secondary">
                  <Timer className="h-4 w-4" />
                  Time
                </TabsTrigger>
                )}
                <TabsTrigger value="history" className="flex items-center gap-2 id-tab-secondary">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <TabsContent value="details" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      {isReminderTask(task, lists) ? (
                        <ReminderScheduleFields
                          task={task}
                          onChange={(patch) => commitReminder(patch)}
                        />
                      ) : null}
                      {itemShowsPersonPipelines(task, lists) ? (
                        <>
                          <PersonDetail
                            person={task}
                            onChange={(patch) => {
                              touchDraft(patch)
                              setTask((prev) => (prev ? { ...prev, ...patch } : prev))
                            }}
                          />
                          <PersonPipelinesEditor
                            mode="person"
                            person={task}
                            onChange={(personPipelines) => {
                              const next = personPipelines.length > 0 ? personPipelines : undefined
                              touchDraft({ personPipelines: next })
                              setTask((prev) => (prev ? { ...prev, personPipelines: next } : prev))
                            }}
                          />
                        </>
                      ) : null}
                      <div className="space-y-3">
                        <Label htmlFor="task-description" className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Detailed Description
                        </Label>
                        <IsolatedTextarea
                          id="task-description"
                          value={task.taskDescription || ""}
                          onLiveChange={(taskDescription) => touchDraft({ taskDescription })}
                          onCommit={(taskDescription) =>
                            setTask((prev) => (prev ? { ...prev, taskDescription } : prev))
                          }
                          placeholder="Detailed description…"
                          rows={4}
                          className="focus-ring"
                        />
                      </div>

                      {(caps.duration || isTask) && (
                      <div className="grid grid-cols-2 gap-4">
                        <ItemEstimateField
                          estimatedDuration={task.estimatedDuration}
                          touchDraft={touchDraft}
                          setTask={setTask}
                          variant="popup"
                        />

                        <div className="space-y-3">
                          <Label htmlFor="reward-value" className="text-sm font-semibold flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Reward Value
                          </Label>
                          <IsolatedInput
                            id="reward-value"
                            type="number"
                            value={String(task.rewardValue ?? "")}
                            onLiveChange={(v) => touchDraft({ rewardValue: Number.parseInt(v) || 0 })}
                            onCommit={(v) =>
                              setTask((prev) =>
                                prev ? { ...prev, rewardValue: Number.parseInt(v) || 0 } : prev,
                              )
                            }
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

                      {caps.scheduleable && (
                      <>
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
                      </>
                      )}
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

                      {sentListIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Sent</Label>
                          <Button
                            type="button"
                            variant="outline"
                            className="id-btn"
                            aria-pressed={sentOnThoseLists}
                            onClick={handleToggleSent}
                          >
                            Sent
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Marks this item sent. It stays in the vault and is not deleted. Sent items hide in the list
                            until Show sent, and leave the list next week.
                          </p>
                        </div>
                      )}

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
                          layout={detailView.layout}
                          omitAttributeIds={
                            itemShowsPersonPipelines(task, lists)
                              ? [PERSON_ATTR.birthday, PERSON_ATTR.notes]
                              : undefined
                          }
                          onChangeValues={(attributes) => {
                            touchDraft({ attributes })
                            setTask((prev) => (prev ? { ...prev, attributes } : prev))
                          }}
                          onChangeItemAttributeDefinitions={(itemAttributeDefinitions) =>
                            setTask({ ...task, itemAttributeDefinitions })
                          }
                          onCreateAttribute={handleCreateAttribute}
                        />
                      </div>

                      <Separator />

                      {caps.completable && (
                      <div className="space-y-3 text-sm">
                        <h3 className="font-semibold">Status</h3>
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
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="scheduling" className="space-y-6 mt-0">
                  <div className="space-y-8">
                    <ItemScheduleFlags
                      task={task}
                      scheduleableCategoryIds={scheduleableCategoryIds}
                      onChange={setTask}
                    />
                    <TodoCommitmentFields task={task} onChange={setTask} />
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
                                value={dateInputValue(task.scheduledDate)}
                                onChange={(e) => {
                                  const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
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
                              <ClockPicker
                                id="scheduled-time"
                                value={task.scheduledTime || ""}
                                onChange={(scheduledTime) => {
                                  touchDraft({ scheduledTime })
                                  setTask((prev) => (prev ? { ...prev, scheduledTime } : prev))
                                }}
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
                              value={dateInputValue(task.deadline)}
                              onChange={(e) => {
                                const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
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
                                  const date = e.target.value ? parseLocalDate(e.target.value) : null
                                  if (date) handleScheduleToWeek(date)
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
                              <IsolatedInput
                                id="scheduled-year"
                                type="number"
                                min="2024"
                                max="2030"
                                value={task.scheduledYear || ""}
                                onLiveChange={(scheduledYear) =>
                                  touchDraft({
                                    scheduledYear,
                                    scheduledMonth: undefined,
                                    scheduledWeek: undefined,
                                    scheduledDate: undefined,
                                  })
                                }
                                onCommit={(scheduledYear) =>
                                  setTask((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          scheduledYear,
                                          scheduledMonth: undefined,
                                          scheduledWeek: undefined,
                                          scheduledDate: undefined,
                                        }
                                      : prev,
                                  )
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
                            value={dateInputValue(task.schedulingConstraints?.mustBeDoneAfter)}
                            onChange={(e) => {
                              const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
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
                            value={dateInputValue(task.schedulingConstraints?.mustBeDoneBefore)}
                            onChange={(e) => {
                              const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
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
                        <IsolatedTextarea
                          id="day-constraints"
                          value={task.schedulingConstraints?.dayConstraints || ""}
                          onLiveChange={(dayConstraints) =>
                            touchDraft({
                              schedulingConstraints: { ...task.schedulingConstraints, dayConstraints },
                            })
                          }
                          onCommit={(dayConstraints) =>
                            setTask((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    schedulingConstraints: { ...prev.schedulingConstraints, dayConstraints },
                                  }
                                : prev,
                            )
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
                          onClick={handleAddDependency}
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

                      <SubtaskComposer onAdd={addSubtask} />

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
                          <IsolatedTextarea
                            id="why"
                            value={task.why || ""}
                            onLiveChange={(why) => touchDraft({ why })}
                            onCommit={(why) => setTask((prev) => (prev ? { ...prev, why } : prev))}
                            placeholder="Explain the purpose and motivation behind this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="consequences" className="text-sm font-semibold">
                            What happens if you don't do it?
                          </Label>
                          <IsolatedTextarea
                            id="consequences"
                            value={task.consequences || ""}
                            onLiveChange={(consequences) => touchDraft({ consequences })}
                            onCommit={(consequences) => setTask((prev) => (prev ? { ...prev, consequences } : prev))}
                            placeholder="Describe the potential consequences of not completing this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes" className="text-sm font-semibold">
                            Additional Notes
                          </Label>
                          <IsolatedTextarea
                            id="notes"
                            value={task.notes || ""}
                            onLiveChange={(notes) => touchDraft({ notes })}
                            onCommit={(notes) => setTask((prev) => (prev ? { ...prev, notes } : prev))}
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
                        <IsolatedInput
                          type="number"
                          value={String(task.estimatedDuration ?? "")}
                          onLiveChange={(v) =>
                            touchDraft({ estimatedDuration: Number.parseInt(v) || undefined })
                          }
                          onCommit={(v) =>
                            setTask((prev) =>
                              prev ? { ...prev, estimatedDuration: Number.parseInt(v) || undefined } : prev,
                            )
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

                <TabsContent value="history" className="space-y-6 mt-0">
                  <ItemActivityPanel itemId={task.id} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />

      <CycleConfirmDialog
        open={!!cycleLabel}
        cycleLabel={cycleLabel ?? ""}
        onDismiss={() => setCycleLabel(null)}
      />

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
      <MissReasonDialog
        open={missAsk}
        subject={task ? itemTitleOrUntitled(task) : ""}
        onResolve={(reason) => {
          setMissAsk(false)
          if (task) markMissedOpportunity(task.id, undefined, reason)
          onClose()
        }}
      />
    </>
  )
}
