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

import { FasciaOrb } from "@/components/ItemDetail/FasciaOrb"
import { InboxClarifyKey } from "@/components/ItemDetail/InboxClarifyKey"
import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { ReminderScheduleFields } from "@/components/ItemDetail/ReminderScheduleFields"
import { PersonDetail } from "@/components/People/person-detail"
import { PersonNotes } from "@/components/People/person-notes"
import { foldPersonNoteLog } from "@/lib/person-notes-fold"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import { PERSON_ATTR } from "@/lib/person-types"
import { useItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { useItemDetailSession } from "@/components/ItemDetail/useItemDetailUnloadGuard"
import { isReminderTask } from "@/lib/reminders"
import { TagInput } from "@/components/ItemDetail/TagInput"
import { RichLinksPanel, useItemEdges } from "@/components/ItemDetail/links/RichLinksPanel"
import { edgeCount } from "@/lib/link-graph"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ListPicker } from "@/components/Lists/list-picker"
import { ItemPicker } from "@/components/Lists/item-picker"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { SubtaskTree, StepItemSubtasks } from "@/components/ItemDetail/SubtaskTree"
import { isStepItem } from "@/lib/step-items"
import { clearItemLayers, openStepItem } from "@/lib/step-item-stack"
import { onCurrentPeriod, openTaskCard, useTaskCardStore } from "@/lib/task-card"
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
  NotebookPen,
  Paperclip,
  Link2,
  Undo2,
} from "lucide-react"
import { ItemActivityPanel } from "@/components/ItemDetail/ItemActivityPanel"
import { ItemSettingsKey } from "@/components/ItemDetail/ItemSettingsKey"
import { ItemTaskCardKey } from "@/components/ItemDetail/ItemTaskCardKey"
import { WorkingNowBanner } from "@/components/ItemDetail/WorkingNowBanner"
import { KeycapClose } from "@/components/keycap-close"
import { ItemSettingsPanel } from "@/components/ItemDetail/ItemSettingsPanel"
import { AttributeSettingsDialog } from "@/components/ItemDetail/AttributeSettingsDialog"
import { ItemDetailDock } from "@/components/ItemDetail/ItemDetailDock"
import { iconFor } from "@/components/Icons/Icon"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { ItemNotesLog, NotesPeek } from "@/components/ItemDetail/ItemNotesLog"
import { ItemResourcesPanel } from "@/components/ItemDetail/ItemResourcesPanel"
import { CycleConfirmDialog } from "@/components/ItemDetail/CycleConfirmDialog"
import type { Task, TaskCompletionReview, ItemDetailPanel, TimeLogEntry, CompletionStatus } from "@/lib/types"
import { dateInputValue, getWeekString, parseLocalDate, safeDateFormat } from "@/lib/date-utils"
import {
  COMPLETION_STATUSES,
  COMPLETION_STATUS_LABELS,
  COMPLETION_STATUS_DESCRIPTIONS,
  effectiveStatus,
  withStatus,
  withCompleted,
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
import { asListReference } from "@/lib/text-list-to-list"
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition } from "@/lib/types"
import { TodoCommitmentFields } from "@/components/ItemDetail/TodoCommitmentFields"
import { ItemEstimateField } from "@/components/ItemDetail/ItemEstimateField"
import { ItemRewardField } from "@/components/ItemDetail/ItemRewardField"
import { ItemPenTimeSection } from "@/components/ItemDetail/ItemPenTime"
import { ItemScheduleFlags } from "@/components/ItemDetail/ItemScheduleFlags"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { APP_NAV_KEYS, readStoredRecord, requestNavigateToListAfterPaint, writeStoredRecordField } from "@/lib/app-navigation"
import { isSentOnList, withSentMark } from "@/lib/list-sent"
import { ItemSaveFlag } from "@/components/ItemDetail/ItemSaveFlag"
import { useItemDetailSaveHotkey } from "@/components/ItemDetail/useItemDetailSaveHotkey"
import { CompletionDialog } from "@/components/Completion/CompletionDialog"
import { ItemDoneBanner } from "@/components/ItemDetail/ItemDoneBanner"
import { SchedulingSummary } from "@/components/ItemDetail/SchedulingSummary"
import { useItemDetailUndoHotkey } from "@/components/ItemDetail/useItemDetailUndoHotkey"
import { UnsavedChangesDialog, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import "./item-detail-chrome.css"

/**
 * Phase 11: a click or focus inside an item layer stacked on top
 * (`StepItemStack`) is not "outside" this popup, so the popup underneath keeps
 * its place instead of closing.
 */
function layerSafeDismiss(handlers: {
  onOutside: (event: Event) => void
  onEscape: (event: KeyboardEvent) => void
}) {
  const inLayer = (event: Event) => {
    const target = ((event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? event.target) as
      | Element
      | null
    return !!target?.closest?.("[data-item-layer]")
  }
  return {
    onPointerDownOutside: (event: Event) => (inLayer(event) ? event.preventDefault() : handlers.onOutside(event)),
    onInteractOutside: (event: Event) => (inLayer(event) ? event.preventDefault() : handlers.onOutside(event)),
    onEscapeKeyDown: (event: KeyboardEvent) => {
      event.preventDefault()
      if (!inLayer(event)) handlers.onEscape(event)
    },
  }
}

interface TaskDetailPopupProps {
  taskId: string | null
  open: boolean
  onClose: () => void
  /** Stack above another dialog that is already open (friend mission sheet). */
  stackAbove?: boolean
  /** Mount inside that dialog so the page’s focus lock does not hide this one. */
  container?: HTMLElement | null
  /** Phase 11: a strip above the fascia (breadcrumb, Back, Parent) when this layer is a step's item. */
  layerHeader?: ReactNode
  /** Phase 11: Complete on a step item ticks the step instead of completing the item. */
  onStepComplete?: () => void
  /** Open straight onto the dock. A reload uses this so the editor does not flash open. */
  startMinimized?: boolean
}

export function TaskDetailPopup({
  taskId,
  open,
  onClose,
  stackAbove = false,
  container = null,
  layerHeader,
  onStepComplete,
  startMinimized = false,
}: TaskDetailPopupProps) {
  const detailRef = useRef<HTMLDivElement>(null)
  const settingsHost = useRef<HTMLDivElement>(null)
  const settingsLock = useRef(false)
  const attributeLock = useRef(false)
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
    undo,
    redo,
    getDraft,
    subscribeDraft,
    touchDraft,
    originalTask,
    setOriginalTask,
    isDraftDirty,
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

  const [cycleLabel, setCycleLabel] = useState<string | null>(null)
  const [editingItemType, setEditingItemType] = useState<ItemTypeDefinition | null>(null)

  // A "task" item type (anything in Next Actions, plus items explicitly typed
  // "task") gets the full set of task features/panels.
  const isTask = task ? isTaskItem(task, folders) : false
  // `resolveDetailView` reads only `type` and `lists`, so typing elsewhere
  // in the draft does not recompute the panels.
  const hasTask = !!task
  const taskType = task?.type
  const taskLists = task?.lists
  const taskHiddenPanels = task?.hiddenDetailPanels
  const taskShownPanels = task?.shownDetailPanels
  const hiddenShell = task?.hiddenShellTabs
  const detailView = useMemo(
    () =>
      hasTask
        ? resolveDetailView(
            { type: taskType, lists: taskLists, hiddenDetailPanels: taskHiddenPanels, shownDetailPanels: taskShownPanels },
            lists,
            itemTypes,
            { isTask },
          )
        : { panels: ["details"] as ItemDetailPanel[], capabilities: {}, layout: undefined },
    [hasTask, taskType, taskLists, taskHiddenPanels, taskShownPanels, lists, itemTypes, isTask],
  )
  const visiblePanels = detailView.panels
  const caps = detailView.capabilities
  const scheduleableCategoryIds = useMemo(() => getScheduleableCategoryIds(lists), [lists])
  const popupTabs = useMemo(() => {
    const shell = (["links", "history"] as const).filter((tab) => !(hiddenShell ?? []).includes(tab))
    return [...visiblePanels, ...shell]
  }, [visiblePanels, hiddenShell])
  const [itemSettingsOpen, setItemSettingsOpen] = useState(false)
  const [attributeSettingsId, setAttributeSettingsId] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(startMinimized)
  const [dockShape, setDockShape] = useState<"bar" | "icon">("bar")
  const minimizeLock = useRef(false)
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

  const activeDetailTab = popupTabs.includes(detailTab as (typeof popupTabs)[number]) ? detailTab : "details"

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
  useItemDetailUndoHotkey(detailRef, undo, redo, open && Boolean(task))

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
    if (draft && onStepComplete) {
      commitDraft(draft)
      onStepComplete()
      return
    }
    if (draft) {
      commitDraft({ ...draft, completed: true })
      onClose()
    }
  }, [getDraft, commitDraft, onClose, onStepComplete])

  // Mark incomplete changes only the done flag and status. Nothing else is cleared.
  const [reviewOpen, setReviewOpen] = useState(false)
  const handleReopen = useCallback(() => {
    const draft = getDraft()
    if (draft) commitDraft(withCompleted(draft, false))
  }, [getDraft, commitDraft])

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

  const handleSaveItemType = useCallback(
    (def: ItemTypeDefinition) => {
      if (itemTypes.some((t) => t.id === def.id)) updateItemType(def)
      else addItemType(def)
      setEditingItemType(null)
    },
    [itemTypes, updateItemType, addItemType],
  )

  const syncDependencies = useCallback(
    (ids: string[]) => {
      if (!task) return
      const prev = task.dependencies ?? []
      const added = ids.find((id) => !prev.includes(id))
      const removed = prev.filter((id) => !ids.includes(id))
      if (added && removed.length === 0) {
        const result = addDependency(added)
        if (!result.ok) setCycleLabel(result.cycleLabel)
        return
      }
      for (const id of removed) removeDependency(id)
    },
    [task, addDependency, removeDependency],
  )

  const guard = useUnsavedGuard({
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty: isDraftDirty,
    onSave: handleSave,
    onDiscard: () => {
      if (originalTask) setTask(originalTask)
    },
  })
  const { guardAction } = guard
  useItemDetailSession(open && Boolean(task), effectiveId, handleSave)
  const outsideHold = useRef(false)
  outsideHold.current =
    itemSettingsOpen ||
    attributeSettingsId != null ||
    editingItemType != null ||
    !!cycleLabel ||
    missAsk ||
    reviewOpen ||
    guard.prompt.open

  // Every way out of the popup asks about unsaved edits first.
  const openItem = useCallback(
    (id: string) => guardAction(() => setOverrideId(id)),
    [guardAction],
  )
  const itemEdges = useItemEdges(task)

  const minimize = useCallback(() => {
    const draft = getDraft()
    if (draft && task && !snapshotsEqual(task, draft)) setTask({ ...draft })
    minimizeLock.current = true
    settingsLock.current = false
    attributeLock.current = false
    setItemSettingsOpen(false)
    setAttributeSettingsId(null)
    setMinimized(true)
  }, [getDraft, setTask, task])
  const saveAndMinimize = useCallback(() => {
    handleSave()
    minimize()
  }, [handleSave, minimize])
  const parkFromOutside = useCallback(
    (event: Event) => {
      event.preventDefault()
      if (outsideHold.current) return
      saveAndMinimize()
    },
    [saveAndMinimize],
  )
  const handleNavigateToList = useCallback(
    (listId: string) => {
      minimize()
      requestNavigateToListAfterPaint(listId, folders)
    },
    [folders, minimize],
  )
  const bindTextList = useCallback(
    (attributeId: string, listId: string) => {
      const id = task?.id
      if (!id) return
      const current = getDraft()
      if (!current || current.id !== id) return
      const converted = asListReference(current, attributeId, listId)
      const owns = current.itemAttributeDefinitions?.some((def) => def.id === attributeId) ?? false
      const stamp = (base: Task): Task => ({
        ...base,
        attributes: owns ? { ...(base.attributes ?? {}), [attributeId]: listId } : base.attributes,
        itemAttributeDefinitions: owns ? converted.itemAttributeDefinitions : base.itemAttributeDefinitions,
        textListIds: converted.textListIds,
      })
      const stored = useTaskStore.getState().tasks.find((row) => row.id === id)
      if (stored) updateTask(stamp(stored))
      setOriginalTask(originalTask?.id === id ? stamp(originalTask) : stored ? stamp(stored) : converted)
      setTask(converted)
    },
    [task?.id, originalTask, getDraft, updateTask, setOriginalTask, setTask],
  )
  const patchItem = useCallback(
    (patch: Partial<Task>) => {
      touchDraft(patch)
      setTask((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    [touchDraft, setTask],
  )
  const cardHosts = useTaskCardStore((s) => s.hosts)

  if (!task) {
    return null
  }
  // Phase 12: **Card** opens the To Do task card (a step item opens its parent's, at the step).
  const cardTarget =
    cardHosts > 0 && !task.completed
      ? task.stepOf
        ? { taskId: task.stepOf.taskId, stepId: task.stepOf.stepId }
        : onCurrentPeriod(task)
          ? { taskId: task.id, stepId: undefined }
          : null
      : null

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
  // Old person notes still on personProfile.noteLog count too (3.3 fold).
  const noteCount = foldPersonNoteLog(task).noteLog?.length ?? 0
  const resourceCount = task.resources?.length ?? 0
  const linkCount = edgeCount(itemEdges)
  const writeDraft = (patch: Partial<Task>) => {
    touchDraft(patch)
    setTask((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return (
    <>
      <Dialog
        open={open && !minimized}
        onOpenChange={(next) => {
          if (!next && (minimizeLock.current || settingsLock.current)) {
            minimizeLock.current = false
            return
          }
          guard.handleOpenChange(next)
        }}
      >
        <DialogContent
          ref={detailRef}
          className={`id95-dialog id95 sm:max-w-5xl max-h-[90vh] overflow-hidden !flex flex-col${stackAbove ? " z-[80]" : ""}`}
          overlayClassName={stackAbove ? "z-[80]" : undefined}
          container={container}
          data-ui-name="Item detail"
          data-ui-docs="components/ItemDetail/README.md"
          {...layerSafeDismiss({
            onOutside: parkFromOutside,
            onEscape: () => {
              if (outsideHold.current) return
              guard.requestClose()
            },
          })}
          data-item-layer={layerHeader !== undefined ? "" : undefined}
          hideClose
        >
          <DialogTitle className="sr-only">Item detail</DialogTitle>
          {layerHeader}
          <div className="id-fascia">
            <WorkingNowBanner itemId={task.id} />
            <div className="id-fascia-row">
              <div className="id-mark">
                <span className="id-power-lamp is-on" aria-hidden />
                <FasciaOrb id={task.id} icon={task.icon} onPick={(icon) => writeDraft({ icon })} />
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
              <div className="id-window-keys">
                <ItemSettingsKey
                  onClick={() => {
                    settingsLock.current = true
                    setItemSettingsOpen(true)
                  }}
                />
                <button type="button" className="id-window-key id-minimize-key" data-no95 aria-label="Minimize" title="Minimize" onClick={minimize}>
                  <span className="id-minimize-mark" aria-hidden />
                </button>
                <KeycapClose onClick={() => guard.requestClose()} />
              </div>
            </div>
            <div className="id-fascia-row id-meta">
              {assignedTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className="id-type-plate"
                  style={{ ["--id-type-color" as string]: type.color ?? "#cbd5e1" }}
                  title="Double-click to view or edit this type"
                  onDoubleClick={() => setEditingItemType(type)}
                >
                  <span className="id-type-lamp" aria-hidden />
                  {type.name}
                  {type.id === primaryTypeId && assignedTypes.length > 1 && <span className="id-type-primary">primary</span>}
                </button>
              ))}
              <Badge variant={task.completed ? "default" : "secondary"} className="id-chip">
                {task.completed ? "Completed" : task.stage}
              </Badge>
              <InboxClarifyKey task={task} getDraft={getDraft} commitDraft={commitDraft} />
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
                {task.completed && caps.completable && !isStepItem(task) && (
                  <Button
                    variant="outline"
                    onClick={handleReopen}
                    className="id-btn id-btn-reopen"
                    title="Mark incomplete: undo Complete and keep everything else"
                  >
                    <Undo2 className="h-4 w-4" />
                    Mark incomplete
                  </Button>
                )}
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
                {!isClearedFromWork(task) && caps.completable && !isStepItem(task) && (
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
                {cardTarget ? (
                  <Button
                    variant="outline"
                    className="id-btn id-btn-secondary"
                    title="Open the To Do task card"
                    onClick={() => {
                      if (stackAbove) clearItemLayers()
                      else guard.requestClose()
                      openTaskCard(cardTarget.taskId, cardTarget.stepId)
                    }}
                  >
                    Card
                  </Button>
                ) : null}
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

          <ItemDoneBanner task={task} onReopen={handleReopen} onEditReview={() => setReviewOpen(true)} />
          {reviewOpen ? <CompletionDialog taskId={task.id} basePoints={0} edit onClose={() => setReviewOpen(false)} /> : null}

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
                {visiblePanels.includes("notes") && (
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4" />
                  Notes
                  {noteCount > 0 && <span className="id-tab-count">{noteCount}</span>}
                </TabsTrigger>
                )}
                {visiblePanels.includes("resources") && (
                <TabsTrigger value="resources" className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Resources
                  {resourceCount > 0 && <span className="id-tab-count">{resourceCount}</span>}
                </TabsTrigger>
                )}
                {popupTabs.includes("links") && (
                <TabsTrigger value="links" className="flex items-center gap-2 id-tab-secondary">
                  <Link2 className="h-4 w-4" />
                  Links
                  {linkCount > 0 && <span className="id-tab-count">{linkCount}</span>}
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
                {popupTabs.includes("history") && (
                <TabsTrigger value="history" className="flex items-center gap-2 id-tab-secondary">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
                )}
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <TabsContent value="details" className="space-y-6 mt-0">
                  <div className="id-details-grid">
                    <div className="id-details-main">
                      {isReminderTask(task, lists) ? (
                        <ReminderScheduleFields
                          task={task}
                          onChange={(patch) => commitReminder(patch)}
                        />
                      ) : null}
                      {itemShowsPersonPipelines(task, lists) ? (
                        <PersonDetail
                          person={task}
                          onChange={(patch) => {
                            touchDraft(patch)
                            setTask((prev) => (prev ? { ...prev, ...patch } : prev))
                          }}
                          onLive={touchDraft}
                          readDraft={getDraft}
                          onNavigateToList={handleNavigateToList}
                          pipelines={
                            <PersonPipelinesEditor
                              mode="person"
                              person={task}
                              onChange={(personPipelines) => {
                                const next = personPipelines.length > 0 ? personPipelines : undefined
                                touchDraft({ personPipelines: next })
                                setTask((prev) => (prev ? { ...prev, personPipelines: next } : prev))
                              }}
                            />
                          }
                        />
                      ) : null}
                      <div className="id-bay">
                        <ItemAttributesSection
                          attributes={task.attributes || {}}
                          itemCategoryIds={task.lists ?? []}
                          categories={lists}
                          itemAttributeDefinitions={task.itemAttributeDefinitions}
                          itemType={task.type}
                          layout={detailView.layout}
                          omitAttributeIds={
                            itemShowsPersonPipelines(task, lists)
                              ? [PERSON_ATTR.birthday, PERSON_ATTR.phone, PERSON_ATTR.notes]
                              : undefined
                          }
                          onLiveValue={(id, value) =>
                            touchDraft({ attributes: { ...(getDraft()?.attributes ?? {}), [id]: value } })
                          }
                          onChangeValues={(attributes) => {
                            touchDraft({ attributes })
                            setTask((prev) => (prev ? { ...prev, attributes } : prev))
                          }}
                          onChangeItemAttributeDefinitions={(itemAttributeDefinitions) =>
                            setTask({ ...task, itemAttributeDefinitions })
                          }
                          onCreateAttribute={handleCreateAttribute}
                          onOpenItem={openItem}
                          attributeLabels={task.attributeLabels}
                          hiddenAttributeIds={task.hiddenAttributeIds}
                          textListIds={task.textListIds}
                          onBindTextList={bindTextList}
                          onOpenTextList={handleNavigateToList}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="task-description" className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Detailed Description
                        </Label>
                        <IsolatedTextarea
                          id="task-description"
                          sizeKey={`id-desc:${task.id}`}
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

                        <ItemRewardField
                          task={task}
                          touchDraft={touchDraft}
                          setTask={setTask}
                          variant="popup"
                        />

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

                    <aside className="id-details-rail" aria-label="Where this item lives">
                      {isTask && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Task card</Label>
                          <ItemTaskCardKey
                            task={task}
                            onBeforeOpen={() => {
                              if (stackAbove) clearItemLayers()
                              else guard.requestClose()
                            }}
                          />
                        </div>
                      )}
                      <div className="space-y-3">
                        <Label className="id-rail-plate">Lists</Label>
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

                      <div className="space-y-3">
                        <Label className="id-rail-plate">Tags</Label>
                        <TagInput tags={task.tags ?? []} onAdd={addTag} onRemove={removeTag} />
                      </div>

                      {visiblePanels.includes("notes") && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Notes</Label>
                          <NotesPeek
                            entries={task.noteLog}
                            onChangeEntries={(noteLog) => writeDraft({ noteLog })}
                            onOpenAll={() => setDetailTab("notes")}
                          />
                        </div>
                      )}

                      {sentListIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Sent</Label>
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

                      {caps.completable && !isStepItem(task) && (
                      <div className="space-y-3 text-sm">
                        <h3 className="id-rail-plate">Status</h3>
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
                    </aside>
                  </div>
                </TabsContent>

                {visiblePanels.includes("notes") && (
                <TabsContent value="notes" className="mt-0">
                  {itemShowsPersonPipelines(task, lists) ? (
                    <PersonNotes
                      person={task}
                      onChange={(patch) => {
                        touchDraft(patch)
                        setTask((prev) => (prev ? { ...prev, ...patch } : prev))
                      }}
                      onLive={touchDraft}
                      readDraft={getDraft}
                    />
                  ) : (
                    <ItemNotesLog
                      entries={task.noteLog}
                      standing={task.notes}
                      onChangeEntries={(noteLog) => writeDraft({ noteLog })}
                      onLiveStanding={(notes) => touchDraft({ notes })}
                      onChangeStanding={(notes) => setTask((prev) => (prev ? { ...prev, notes } : prev))}
                    />
                  )}
                </TabsContent>
                )}

                {visiblePanels.includes("resources") && (
                <TabsContent value="resources" className="mt-0">
                  <ItemResourcesPanel resources={task.resources} onChange={(resources) => writeDraft({ resources })} />
                </TabsContent>
                )}

                <TabsContent value="links" className="space-y-4 mt-0">
                  <div className="id-bay">
                    <RichLinksPanel
                      task={task}
                      addLink={addLink}
                      removeLink={removeLink}
                      writeDraft={writeDraft}
                      onOpenItem={openItem}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="scheduling" className="space-y-6 mt-0">
                  <div className="id-sched">
                    <SchedulingSummary task={task} scheduleableCategoryIds={scheduleableCategoryIds} />
                    <section className="id-sched-sec" aria-label="Where it shows up">
                      <header className="id-sched-sechead"><span className="id-sched-num">01</span><h2>Where it shows up</h2><p>Which lists read this item: the Scheduler, and the To Do periods.</p></header>
                    <ItemScheduleFlags
                      task={task}
                      scheduleableCategoryIds={scheduleableCategoryIds}
                      onChange={setTask}
                    />
                    <TodoCommitmentFields task={task} onChange={setTask} />
                    {task.scheduledDate && !task.scheduledWeek && (
                      <div className="id-sched-callout">
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
                    </section>
                    <section className="id-sched-sec" aria-label="When">
                      <header className="id-sched-sechead"><span className="id-sched-num">02</span><h2>When</h2><p>Pick one placement. Setting a date clears the looser ones.</p></header>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">
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
                      </div>

                      <div className="space-y-6">
                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">Flexible Scheduling</h3>
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
                    </section>
                    <section className="id-sched-sec" aria-label="Deadline and limits">
                      <header className="id-sched-sechead"><span className="id-sched-num">03</span><h2>Deadline and limits</h2><p>What it must beat, and the windows it must stay inside.</p></header>

                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">
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
                    <div className="id-sched-card">
                      <h3 className="id-sched-card-title">
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
                    </section>
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

                      <ItemPicker
                        mode="multi"
                        searchLabel="Add dependency"
                        choices={allTasks
                          .filter((t) => t.id !== task.id)
                          .map((t) => ({ id: t.id, title: itemTitleOrUntitled(t), icon: t.icon }))}
                        selected={task.dependencies ?? []}
                        onChange={syncDependencies}
                      />

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
                        Break this into steps, and use + on any step to break it down again. Minutes on a step count as its own estimate or the sum of the steps inside, whichever is larger.
                      </p>

                      {task.stepOf ? (
                        <StepItemSubtasks stepOf={task.stepOf} />
                      ) : (
                        <SubtaskTree
                          steps={task.subtasks}
                          onChange={(subtasks) => setTask({ ...task, subtasks })}
                          onOpenStep={
                            allTasks.some((t) => t.id === task.id) ? (step) => openStepItem(task.id, step.id) : undefined
                          }
                        />
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
                  </div>
                  <div className="id-bay">
                    <ItemPenTimeSection
                      task={task}
                      editableTime={isTask}
                      onPatch={patchItem}
                      onPenLinksChange={(penLinks) => {
                        touchDraft({ penLinks })
                        setTask((prev) => (prev ? { ...prev, penLinks } : prev))
                      }}
                    />
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
      {minimized ? (
        <ItemDetailDock
          title={itemTitleOrUntitled(task)}
          iconSrc={iconFor(task.id, task.icon)}
          shape={dockShape}
          onShape={setDockShape}
          onRestore={() => setMinimized(false)}
          onClose={() => guard.requestClose()}
        />
      ) : null}
      <Dialog
        open={itemSettingsOpen}
        onOpenChange={(next) => {
          if (!next && attributeLock.current) return
          settingsLock.current = next
          setItemSettingsOpen(next)
        }}
      >
        <DialogContent
          ref={settingsHost}
          container={detailRef.current}
          className="id95-dialog id95 z-[90] sm:max-w-xl max-h-[85vh] overflow-hidden !flex flex-col"
          overlayClassName="z-[90]"
          data-ui-name="Item settings"
          onPointerDownOutside={(event) => {
            const target = event.target as Element | null
            if (target?.closest?.("[data-ui-name='Attribute settings']")) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            const target = event.target as Element | null
            if (target?.closest?.("[data-ui-name='Attribute settings']")) event.preventDefault()
          }}
        >
          <div className="id-settings-host">
            <ItemSettingsPanel
              task={task}
              lists={lists}
              isTask={isTask}
              showLinks
              onPatch={patchItem}
              onOpenAttribute={(id) => {
                attributeLock.current = true
                setAttributeSettingsId(id)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      <AttributeSettingsDialog
        attributeId={attributeSettingsId}
        open={attributeSettingsId != null}
        container={settingsHost.current ?? detailRef.current}
        onOpenChange={(next) => {
          if (!next) {
            attributeLock.current = false
            setAttributeSettingsId(null)
          }
        }}
        draftTask={task}
        onPatchDraft={patchItem}
      />
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
          openItem(id)
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
