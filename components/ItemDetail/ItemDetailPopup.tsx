/**
 * components/ItemDetail/ItemDetailPopup.tsx — Compact item detail popup
 *
 * Public door for the item-detail popup. Import `TaskDetailPopup` from
 * `@/components/ItemDetail/ItemDetailPopup`. Draft state, the unsaved guard,
 * and the dialog shell stay here. Panels live in `popup/` and are private
 * to this file: not for the page, the To do drawer, or the task card.
 *
 * Each popup host holds a row of windows, one per item, like tabs. Opening an
 * item (from the host or from a link inside a window) minimizes whichever
 * window is open and opens that item's own window. Minimized windows stay
 * mounted on the dock with their drafts until their own close.
 *
 * Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { foldPersonNoteLog } from "@/lib/person-notes-fold"
import { useItemDetailDraft } from "@/components/ItemDetail/draft/useItemDetailDraft"
import { useItemDetailSession } from "@/components/ItemDetail/draft/useItemDetailUnloadGuard"
import { edgeCount } from "@/lib/link-graph"
import { useItemEdges } from "@/components/ItemDetail/tabs/links/RichLinksPanel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { onCurrentPeriod, useTaskCardStore } from "@/lib/task-card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ItemDetailDock } from "@/components/ItemDetail/chrome/ItemDetailDock"
import { iconFor } from "@/components/Icons/Icon"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import type { Task, ItemDetailPanel, CompletionStatus, ItemTypeDefinition, AttributeDefinition, AttributeValue } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import { withStatus, withCompleted } from "@/lib/completion-status"
import { isTaskItem, itemTitleOrUntitled } from "@/lib/item-utils"
import { getScheduleableCategoryIds } from "@/components/Scheduler/scheduler-utils"
import { activeDetailTypeId, assignedItemTypes, BUILTIN_ITEM_TYPE_ID, BUILTIN_TASK_TYPE_ID, resolveDetailView } from "@/lib/item-types"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { asListReference } from "@/lib/text-list-to-list"
import { APP_NAV_KEYS, readStoredRecord, requestNavigateToListAfterPaint, writeStoredRecordField } from "@/lib/app-navigation"
import { isSentOnList, withSentMark } from "@/lib/list-sent"
import { useItemDetailSaveHotkey } from "@/components/ItemDetail/draft/useItemDetailSaveHotkey"
import { CompletionDialog } from "@/components/Completion/CompletionDialog"
import { ItemDoneBanner } from "@/components/ItemDetail/chrome/ItemDoneBanner"
import { useItemDetailUndoHotkey } from "@/components/ItemDetail/draft/useItemDetailUndoHotkey"
import { useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { layerSafeDismiss } from "@/components/ItemDetail/popup/layer-safe-dismiss"
import { PopupAnalysisTab } from "@/components/ItemDetail/popup/PopupAnalysisTab"
import { PopupBodyTab, PopupHistoryTab, PopupLinksTab, PopupNotesTab, PopupResourcesTab } from "@/components/ItemDetail/popup/PopupRecordTabs"
import { PopupDependenciesTab } from "@/components/ItemDetail/popup/PopupDependenciesTab"
import { PopupDetailsMain } from "@/components/ItemDetail/popup/PopupDetailsMain"
import { PopupDetailsRail } from "@/components/ItemDetail/popup/PopupDetailsRail"
import { PopupFascia } from "@/components/ItemDetail/popup/PopupFascia"
import { PopupOverlayDialogs } from "@/components/ItemDetail/popup/PopupOverlayDialogs"
import { PopupSchedulingTab } from "@/components/ItemDetail/popup/PopupSchedulingTab"
import { PopupSubtasksTab } from "@/components/ItemDetail/popup/PopupSubtasksTab"
import { PopupTabKeys } from "@/components/ItemDetail/popup/PopupTabKeys"
import { PopupTimeTab } from "@/components/ItemDetail/popup/PopupTimeTab"
import "@/components/ItemDetail/chrome/item-detail-chrome.css"
import { dmMonoFace } from "@/lib/fonts/dm-mono"
import { useStampFontVariables } from "@/lib/fonts/stamp-font-variables"

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
  /**
   * Keep the host's item while its window sits on the dock. Pass it when the
   * host unmounts this popup once its item clears (search, the reload dock,
   * step layers). Other hosts get their item handed back on minimize, so
   * picking that item again reopens its docked window.
   */
  holdOnMinimize?: boolean
}

type DetailWindow = { id: string; minimized: boolean }

/** Open `id` (adding its window if new) and minimize every other window. */
function focusWindow(windows: DetailWindow[], id: string): DetailWindow[] {
  const next = windows.map((w) => {
    const minimized = w.id !== id
    return w.minimized === minimized ? w : { ...w, minimized }
  })
  return next.some((w) => w.id === id) ? next : [...next, { id, minimized: false }]
}

export function TaskDetailPopup({
  taskId,
  open,
  onClose,
  startMinimized = false,
  holdOnMinimize = false,
  ...shared
}: TaskDetailPopupProps) {
  const initial = open && taskId ? taskId : null
  const [windows, setWindows] = useState<DetailWindow[]>(() =>
    initial ? [{ id: initial, minimized: startMinimized }] : [],
  )
  // The item the host last asked for. Its window's close hands back to the host.
  const hostId = useRef<string | null>(initial)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const next = open && taskId ? taskId : null
    if (hostId.current === next) return
    hostId.current = next
    if (next) setWindows((ws) => focusWindow(ws, next))
  }, [open, taskId])

  // Once the host's own window is docked, hand the item back to the host.
  // The window stays mounted; the next pick of that item reopens it.
  useEffect(() => {
    const id = hostId.current
    if (!id || holdOnMinimize) return
    if (!windows.some((w) => w.id === id && w.minimized)) return
    hostId.current = null
    onCloseRef.current()
  }, [windows, holdOnMinimize])

  const show = useCallback((id: string) => setWindows((ws) => focusWindow(ws, id)), [])
  const minimize = useCallback(
    (id: string) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w))),
    [],
  )
  const close = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id))
    if (id === hostId.current) {
      hostId.current = null
      onCloseRef.current()
    }
  }, [])

  return (
    <>
      {windows.map((w) => (
        <ItemDetailWindow
          key={w.id}
          itemId={w.id}
          minimized={w.minimized}
          onMinimize={() => minimize(w.id)}
          onRestore={() => show(w.id)}
          onOpenItem={show}
          onClose={() => close(w.id)}
          {...shared}
        />
      ))}
    </>
  )
}

type ItemDetailWindowProps = Omit<TaskDetailPopupProps, "taskId" | "open" | "startMinimized"> & {
  itemId: string
  minimized: boolean
  onMinimize: () => void
  onRestore: () => void
  /** Open another item in its own window. This one minimizes and keeps its draft. */
  onOpenItem: (id: string) => void
}

function ItemDetailWindow({
  itemId,
  minimized,
  onMinimize,
  onRestore,
  onOpenItem,
  onClose,
  stackAbove = false,
  container = null,
  layerHeader,
  onStepComplete,
}: ItemDetailWindowProps) {
  const detailRef = useRef<HTMLDivElement>(null)
  const settingsHost = useRef<HTMLDivElement>(null)
  const settingsLock = useRef(false)
  const attributeLock = useRef(false)
  const [missAsk, setMissAsk] = useState(false)

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
  } = useItemDetailDraft(itemId)

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
  const [typePick, setTypePick] = useState<{ itemId: string | undefined; typeId: string | null }>({
    itemId: undefined,
    typeId: null,
  })
  if (typePick.itemId !== task?.id) {
    setTypePick({ itemId: task?.id, typeId: null })
  }
  // `resolveDetailView` reads type, lists, and the chosen type view, so typing
  // elsewhere in the draft does not recompute the panels.
  const hasTask = !!task
  const taskType = task?.type
  const taskLists = task?.lists
  const taskHiddenPanels = task?.hiddenDetailPanels
  const taskShownPanels = task?.shownDetailPanels
  const hiddenShell = task?.hiddenShellTabs
  const primaryTypeId = taskType ?? (isTask ? BUILTIN_TASK_TYPE_ID : BUILTIN_ITEM_TYPE_ID)
  const assignedTypes = hasTask
    ? assignedItemTypes({ type: primaryTypeId, lists: taskLists ?? [] }, lists, itemTypes)
    : []
  const activeTypeId = activeDetailTypeId(
    String(primaryTypeId),
    typePick.typeId,
    assignedTypes.map((type) => String(type.id)),
  )
  const viewAsTypeId = activeTypeId !== String(primaryTypeId) ? activeTypeId : undefined
  const detailView = useMemo(
    () =>
      hasTask
        ? resolveDetailView(
            { type: taskType, lists: taskLists, hiddenDetailPanels: taskHiddenPanels, shownDetailPanels: taskShownPanels },
            lists,
            itemTypes,
            { isTask, viewAsTypeId },
          )
        : { panels: ["details"] as ItemDetailPanel[], capabilities: {}, layout: undefined },
    [hasTask, taskType, taskLists, taskHiddenPanels, taskShownPanels, lists, itemTypes, isTask, viewAsTypeId],
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
  const [dockShape, setDockShape] = useState<"bar" | "icon">("bar")
  const minimizeLock = useRef(false)
  const [detailTab, setDetailTab] = useState(() => {
    const stored = itemId ? readStoredRecord(APP_NAV_KEYS.itemDetailTab)[itemId] : null
    return stored || "details"
  })

  useEffect(() => {
    if (!itemId) return
    const stored = readStoredRecord(APP_NAV_KEYS.itemDetailTab)[itemId]
    setDetailTab(stored || "details")
  }, [itemId])

  useEffect(() => {
    if (!itemId) return
    writeStoredRecordField(APP_NAV_KEYS.itemDetailTab, itemId, detailTab)
  }, [itemId, detailTab])

  const activeDetailTab = popupTabs.some((tab) => tab === detailTab) ? detailTab : "details"

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

  useItemDetailSaveHotkey(detailRef, handleSave, Boolean(task))
  useItemDetailUndoHotkey(detailRef, undo, redo, Boolean(task))

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
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty: isDraftDirty,
    onSave: handleSave,
    onDiscard: () => {
      if (originalTask) setTask(originalTask)
    },
  })
  useItemDetailSession(Boolean(task), itemId, handleSave)
  const outsideHold = useRef(false)
  outsideHold.current =
    itemSettingsOpen ||
    attributeSettingsId != null ||
    editingItemType != null ||
    !!cycleLabel ||
    missAsk ||
    reviewOpen ||
    guard.prompt.open

  // A related item opens in its own window; this one minimizes with its draft.
  const openItem = onOpenItem
  const itemEdges = useItemEdges(task)

  // However this window gets minimized (its key, a click away, or another
  // item opening), the live draft moves into the kept task first.
  const stashDraft = useRef(() => {})
  stashDraft.current = () => {
    const draft = getDraft()
    if (draft && task && !snapshotsEqual(task, draft)) setTask({ ...draft })
    settingsLock.current = false
    attributeLock.current = false
    setItemSettingsOpen(false)
    setAttributeSettingsId(null)
  }
  useEffect(() => {
    if (minimized) stashDraft.current()
  }, [minimized])
  const minimize = useCallback(() => {
    stashDraft.current()
    minimizeLock.current = true
    onMinimize()
  }, [onMinimize])
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
  useStampFontVariables(dmMonoFace)

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
        open={!minimized}
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
          className={`id95-dialog id95 sm:max-w-5xl max-h-[90vh] overflow-hidden !flex flex-col${stackAbove ? " z-[80]" : ""} ${dmMonoFace}`}
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
          <PopupFascia
            task={task}
            writeDraft={writeDraft}
            touchDraft={touchDraft}
            setTask={setTask}
            settingsLock={settingsLock}
            setItemSettingsOpen={setItemSettingsOpen}
            minimize={minimize}
            guard={guard}
            assignedTypes={assignedTypes}
            activeTypeId={activeTypeId}
            primaryTypeId={primaryTypeId}
            setTypePick={setTypePick}
            setEditingItemType={setEditingItemType}
            getDraft={getDraft}
            commitDraft={commitDraft}
            originalTask={originalTask}
            subscribeDraft={subscribeDraft}
            handleSave={handleSave}
            caps={caps}
            handleReopen={handleReopen}
            handleComplete={handleComplete}
            handleMissed={handleMissed}
            cardTarget={cardTarget}
            stackAbove={stackAbove}
            handleDelete={handleDelete}
          />
          <ItemDoneBanner task={task} onReopen={handleReopen} onEditReview={() => setReviewOpen(true)} />
          {reviewOpen ? <CompletionDialog taskId={task.id} basePoints={0} edit onClose={() => setReviewOpen(false)} /> : null}

          <div className="id-dialog-scroll">
            <Tabs value={activeDetailTab} onValueChange={setDetailTab} className="id-popup-tabs flex-1 min-h-0 flex flex-col">
              <PopupTabKeys
                visiblePanels={visiblePanels}
                popupTabs={popupTabs}
                noteCount={noteCount}
                resourceCount={resourceCount}
                linkCount={linkCount}
              />
              <div className="id-popup-panel flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <TabsContent value="details" className="space-y-6 mt-0">
                  <div className="id-details-grid">
                    <PopupDetailsMain
                      task={task}
                      lists={lists}
                      commitReminder={commitReminder}
                      touchDraft={touchDraft}
                      setTask={setTask}
                      getDraft={getDraft}
                      handleNavigateToList={handleNavigateToList}
                      activeTypeId={activeTypeId}
                      openItem={openItem}
                      viewAsTypeId={viewAsTypeId}
                      detailView={detailView}
                      handleCreateAttribute={handleCreateAttribute}
                      bindTextList={bindTextList}
                      caps={caps}
                      isTask={isTask}
                    />
                    <PopupDetailsRail
                      isTask={isTask}
                      task={task}
                      stackAbove={stackAbove}
                      guard={guard}
                      removeFromCategory={removeFromCategory}
                      lists={lists}
                      handleNavigateToList={handleNavigateToList}
                      setLists={setLists}
                      addTag={addTag}
                      removeTag={removeTag}
                      visiblePanels={visiblePanels}
                      writeDraft={writeDraft}
                      setDetailTab={setDetailTab}
                      sentListIds={sentListIds}
                      sentOnThoseLists={sentOnThoseLists}
                      handleToggleSent={handleToggleSent}
                      caps={caps}
                      handleStatusChange={handleStatusChange}
                    />
                  </div>
                </TabsContent>
                <PopupNotesTab
                  visiblePanels={visiblePanels}
                  task={task}
                  lists={lists}
                  touchDraft={touchDraft}
                  setTask={setTask}
                  getDraft={getDraft}
                  writeDraft={writeDraft}
                />
                <PopupResourcesTab visiblePanels={visiblePanels} task={task} writeDraft={writeDraft} />
                <PopupLinksTab
                  task={task}
                  addLink={addLink}
                  removeLink={removeLink}
                  writeDraft={writeDraft}
                  openItem={openItem}
                />
                <PopupSchedulingTab
                  task={task}
                  scheduleableCategoryIds={scheduleableCategoryIds}
                  setTask={setTask}
                  touchDraft={touchDraft}
                  handleMoveToWeeklyTodo={handleMoveToWeeklyTodo}
                  handleScheduleToWeek={handleScheduleToWeek}
                />
                <PopupDependenciesTab
                  task={task}
                  allTasks={allTasks}
                  syncDependencies={syncDependencies}
                  removeDependency={removeDependency}
                />
                <PopupSubtasksTab task={task} setTask={setTask} allTasks={allTasks} />
                <PopupAnalysisTab task={task} touchDraft={touchDraft} setTask={setTask} />
                {visiblePanels.includes("time") && (
                  <PopupTimeTab
                    task={task}
                    touchDraft={touchDraft}
                    setTask={setTask}
                    isTask={isTask}
                    patchItem={patchItem}
                  />
                )}
                <PopupBodyTab visiblePanels={visiblePanels} task={task} />
                <PopupHistoryTab task={task} />
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
          onRestore={onRestore}
          onClose={() => guard.requestClose()}
        />
      ) : null}
      <PopupOverlayDialogs
        itemSettingsOpen={itemSettingsOpen}
        attributeLock={attributeLock}
        settingsLock={settingsLock}
        setItemSettingsOpen={setItemSettingsOpen}
        settingsHost={settingsHost}
        detailRef={detailRef}
        task={task}
        lists={lists}
        isTask={isTask}
        patchItem={patchItem}
        setAttributeSettingsId={setAttributeSettingsId}
        attributeSettingsId={attributeSettingsId}
        guard={guard}
        cycleLabel={cycleLabel}
        setCycleLabel={setCycleLabel}
        editingItemType={editingItemType}
        setEditingItemType={setEditingItemType}
        itemTypes={itemTypes}
        handleSaveItemType={handleSaveItemType}
        deleteItemType={deleteItemType}
        openItem={openItem}
        missAsk={missAsk}
        setMissAsk={setMissAsk}
        onClose={onClose}
      />
    </>
  )
}
