/**
 * components/ItemDetail/ItemDetailPage.tsx — Full-screen item detail door
 *
 * Composes the page-only modules in `page/`. The screen, the DOM, and the copy
 * stay as they were. Shares load/draft state with `ItemDetailPopup` via
 * `useItemDetailDraft`. `page/` is not for the popup, the To do drawer, or the
 * task card.
 *
 * Import as `EnhancedTaskDetail` from `@/components/ItemDetail/ItemDetailPage`.
 * Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ItemDetailPageAnalysis } from "@/components/ItemDetail/page/ItemDetailPageAnalysis"
import { ItemDetailPageDependencies } from "@/components/ItemDetail/page/ItemDetailPageDependencies"
import { ItemDetailPageDetails } from "@/components/ItemDetail/page/ItemDetailPageDetails"
import { ItemDetailPageDialogs } from "@/components/ItemDetail/page/ItemDetailPageDialogs"
import { ItemDetailPageFascia } from "@/components/ItemDetail/page/ItemDetailPageFascia"
import { ItemDetailPageLedgerTabs } from "@/components/ItemDetail/page/ItemDetailPageLedgerTabs"
import { ItemDetailPageScheduling } from "@/components/ItemDetail/page/ItemDetailPageScheduling"
import { ItemDetailPageSubtasks } from "@/components/ItemDetail/page/ItemDetailPageSubtasks"
import { ItemDetailPageTabList } from "@/components/ItemDetail/page/ItemDetailPageTabList"
import { useItemDetailPageCommands } from "@/components/ItemDetail/page/useItemDetailPageCommands"
import { useItemDetailPageView } from "@/components/ItemDetail/page/useItemDetailPageView"
import { useItemDetailDraft } from "@/components/ItemDetail/draft/useItemDetailDraft"
import { useItemDetailSession } from "@/components/ItemDetail/draft/useItemDetailUnloadGuard"
import { useItemDetailSaveHotkey } from "@/components/ItemDetail/draft/useItemDetailSaveHotkey"
import { useItemDetailUndoHotkey } from "@/components/ItemDetail/draft/useItemDetailUndoHotkey"
import { UnsavedChangesDialog, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import { Tabs } from "@/components/ui/tabs"
import { useItemTypeStore } from "@/lib/item-type-store"
import { peekHabitSettingsReturn } from "@/lib/habit-list-item"
import { requestNavigateToListAfterPaint } from "@/lib/app-navigation"
import { useTaskStore } from "@/lib/task-store"
import type { ItemTypeDefinition, Task } from "@/lib/types"
import "@/components/ItemDetail/chrome/item-detail-chrome.css"
import { dmMonoFace } from "@/lib/fonts/dm-mono"
import { useStampFontVariables } from "@/lib/fonts/stamp-font-variables"

interface EnhancedTaskDetailProps {
  taskId: string
  onBack: () => void
}

export function EnhancedTaskDetail({ taskId, onBack }: EnhancedTaskDetailProps) {
  const detailRef = useRef<HTMLDivElement>(null)
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [missAsk, setMissAsk] = useState(false)
  const effectiveId = overrideId ?? taskId

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
    isDraftDirty,
    setOriginalTask,
    allTasks,
    lists,
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

  const folders = useTaskStore((state) => state.folders)
  const itemTypes = useItemTypeStore((state) => state.types)
  const updateItemType = useItemTypeStore((state) => state.updateType)
  const addItemType = useItemTypeStore((state) => state.addType)
  const deleteItemType = useItemTypeStore((state) => state.deleteType)

  const [isEditing, setIsEditing] = useState(false)
  const [cycleLabel, setCycleLabel] = useState<string | null>(null)
  const actualDurationRef = useRef("")
  const [editingItemType, setEditingItemType] = useState<ItemTypeDefinition | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [itemSettingsOpen, setItemSettingsOpen] = useState(false)

  const {
    isTask,
    setTypePick,
    primaryTypeId,
    itemTypesAssigned,
    activeTypeId,
    viewAsTypeId,
    detailView,
    visiblePanels,
    caps,
    scheduleableCategoryIds,
    detailTabs,
    setDetailTab,
    activeDetailTab,
  } = useItemDetailPageView({ task, folders, lists, itemTypes, effectiveId })

  const {
    handleSave,
    handleDelete,
    handleComplete,
    handleReopen,
    handleMissed,
    handleSaveItemType,
    deleteEditingItemType,
  } = useItemDetailPageCommands({
    task,
    getDraft,
    commitDraft,
    deleteTask,
    onBack,
    setIsEditing,
    actualDurationRef,
    setMissAsk,
    itemTypes,
    updateItemType,
    addItemType,
    deleteItemType,
    editingItemType,
    setEditingItemType,
  })

  useItemDetailSaveHotkey(detailRef, handleSave, Boolean(task))
  useItemDetailUndoHotkey(detailRef, undo, redo, Boolean(task))
  useStampFontVariables(dmMonoFace)

  // Every way out of the page asks about unsaved edits first.
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onBack()
    },
    isDirty: isDraftDirty,
    onSave: handleSave,
    onDiscard: () => {
      if (originalTask) setTask(originalTask)
    },
  })
  const { guardAction, requestClose } = guard
  useItemDetailSession(Boolean(task), effectiveId, handleSave)

  const openItem = useCallback(
    (id: string) => guardAction(() => setOverrideId(id)),
    [guardAction],
  )

  const handleNavigateToList = useCallback(
    (listId: string) =>
      guardAction(() => {
        // Back on a habit-opened detail returns to habit settings. The list chip
        // opens this list instead. The shell's navigate event closes the page.
        requestNavigateToListAfterPaint(listId, folders)
        if (!peekHabitSettingsReturn()) onBack()
      }),
    [guardAction, folders, onBack],
  )
  const patchItem = useCallback(
    (patch: Partial<Task>) => {
      touchDraft(patch)
      setTask((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    [touchDraft, setTask],
  )

  // Read-only attribute summary is rendered inline where needed; attributes are
  // always editable via ItemAttributesSection on the details tab.

  if (!task) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Item not found</p>
      </div>
    )
  }

  return (
    <>
    <div ref={detailRef} className={`id95 ${dmMonoFace}`} data-ui-name="Item detail" data-ui-docs="components/ItemDetail/README.md">
      <div className="id-window">
      <ItemDetailPageFascia
        task={task}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        touchDraft={touchDraft}
        setTask={setTask}
        originalTask={originalTask}
        getDraft={getDraft}
        subscribeDraft={subscribeDraft}
        requestClose={requestClose}
        handleSave={handleSave}
        handleReopen={handleReopen}
        caps={caps}
        actualDurationRef={actualDurationRef}
        handleComplete={handleComplete}
        handleMissed={handleMissed}
        handleDelete={handleDelete}
        reviewOpen={reviewOpen}
        setReviewOpen={setReviewOpen}
        itemTypesAssigned={itemTypesAssigned}
        activeTypeId={activeTypeId}
        primaryTypeId={primaryTypeId}
        setTypePick={setTypePick}
        setEditingItemType={setEditingItemType}
        commitDraft={commitDraft}
        setItemSettingsOpen={setItemSettingsOpen}
      />

      <Tabs value={activeDetailTab} onValueChange={setDetailTab} className="id-body w-full">
        <ItemDetailPageTabList detailTabs={detailTabs} visiblePanels={visiblePanels} task={task} />
        <ItemDetailPageDetails
          task={task}
          isEditing={isEditing}
          isTask={isTask}
          lists={lists}
          touchDraft={touchDraft}
          setTask={setTask}
          getDraft={getDraft}
          commitDraft={commitDraft}
          originalTask={originalTask}
          setOriginalTask={setOriginalTask}
          updateTask={updateTask}
          activeTypeId={activeTypeId}
          viewAsTypeId={viewAsTypeId}
          detailView={detailView}
          openItem={openItem}
          handleNavigateToList={handleNavigateToList}
          onBack={onBack}
          guardAction={guardAction}
          itemTypesAssigned={itemTypesAssigned}
          primaryTypeId={primaryTypeId}
          setTypePick={setTypePick}
          setEditingItemType={setEditingItemType}
          removeFromCategory={removeFromCategory}
          setLists={setLists}
          addTag={addTag}
          removeTag={removeTag}
          addLink={addLink}
          removeLink={removeLink}
          allTasks={allTasks}
          requestClose={requestClose}
        />
        <ItemDetailPageScheduling
          task={task}
          isEditing={isEditing}
          scheduleableCategoryIds={scheduleableCategoryIds}
          setTask={setTask}
          touchDraft={touchDraft}
        />
        <ItemDetailPageDependencies
          task={task}
          isEditing={isEditing}
          allTasks={allTasks}
          effectiveId={effectiveId}
          addDependency={addDependency}
          removeDependency={removeDependency}
          setCycleLabel={setCycleLabel}
        />
        <ItemDetailPageSubtasks
          task={task}
          effectiveId={effectiveId}
          allTasks={allTasks}
          setTask={setTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
        />
        <ItemDetailPageAnalysis
          task={task}
          isEditing={isEditing}
          touchDraft={touchDraft}
          setTask={setTask}
        />
        <ItemDetailPageLedgerTabs
          visiblePanels={visiblePanels}
          task={task}
          isTask={isTask}
          isEditing={isEditing}
          patchItem={patchItem}
          touchDraft={touchDraft}
          setTask={setTask}
          lists={lists}
          getDraft={getDraft}
        />
      </Tabs>
      </div>
    </div>

    <ItemDetailPageDialogs
      itemSettingsOpen={itemSettingsOpen}
      setItemSettingsOpen={setItemSettingsOpen}
      task={task}
      lists={lists}
      isTask={isTask}
      patchItem={patchItem}
      cycleLabel={cycleLabel}
      setCycleLabel={setCycleLabel}
      editingItemType={editingItemType}
      setEditingItemType={setEditingItemType}
      itemTypes={itemTypes}
      onSaveItemType={handleSaveItemType}
      onDeleteItemType={deleteEditingItemType}
      openItem={openItem}
      missAsk={missAsk}
      setMissAsk={setMissAsk}
    />
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
