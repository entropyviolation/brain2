// Page-only view derivation for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useEffect, useMemo, useState } from "react"
import { APP_NAV_KEYS, readStoredRecord, writeStoredRecordField } from "@/lib/app-navigation"
import { getScheduleableCategoryIds } from "@/components/Scheduler/scheduler-utils"
import {
  activeDetailTypeId,
  assignedItemTypes,
  BUILTIN_ITEM_TYPE_ID,
  BUILTIN_TASK_TYPE_ID,
  resolveDetailView,
  type DetailViewResolution,
} from "@/lib/item-types"
import { isTaskItem } from "@/lib/item-utils"
import type { Folder, ItemTypeDefinition, Task } from "@/lib/types"
import type { ItemDetailDraft } from "@/components/ItemDetail/draft/useItemDetailDraft"

export function useItemDetailPageView({
  task,
  folders,
  lists,
  itemTypes,
  effectiveId,
}: {
  task: Task | null
  folders: Folder[]
  lists: ItemDetailDraft["lists"]
  itemTypes: ItemTypeDefinition[]
  effectiveId: string
}) {
  const isTask = task ? isTaskItem(task, folders) : false
  const [typePick, setTypePick] = useState<{ itemId: string | undefined; typeId: string | null }>({
    itemId: undefined,
    typeId: null,
  })
  // Render-time reset. An effect would flash the previous item's type view.
  if (typePick.itemId !== task?.id) {
    setTypePick({ itemId: task?.id, typeId: null })
  }
  const primaryTypeId = task?.type ?? (isTask ? BUILTIN_TASK_TYPE_ID : BUILTIN_ITEM_TYPE_ID)
  const itemTypesAssigned = task
    ? assignedItemTypes({ type: primaryTypeId, lists: task.lists ?? [] }, lists, itemTypes)
    : []
  const activeTypeId = activeDetailTypeId(
    String(primaryTypeId),
    typePick.typeId,
    itemTypesAssigned.map((type) => String(type.id)),
  )
  const viewAsTypeId = activeTypeId !== String(primaryTypeId) ? activeTypeId : undefined
  const detailView = useMemo<DetailViewResolution>(
    () =>
      task
        ? resolveDetailView(task, lists, itemTypes, { isTask, viewAsTypeId })
        : { panels: ["details"], capabilities: {}, layout: undefined },
    [task, lists, itemTypes, isTask, viewAsTypeId],
  )
  const visiblePanels = detailView.panels
  const caps = detailView.capabilities
  const scheduleableCategoryIds = useMemo(() => getScheduleableCategoryIds(lists), [lists])
  const detailTabs = useMemo(() => {
    const hidden = new Set(task?.hiddenShellTabs ?? [])
    const tabs = ["details", ...visiblePanels.filter((panel) => panel !== "details")]
    if (!hidden.has("history")) tabs.push("history")
    return tabs
  }, [visiblePanels, task?.hiddenShellTabs])
  const [detailTab, setDetailTab] = useState(() => {
    const stored = readStoredRecord(APP_NAV_KEYS.itemDetailTab)[effectiveId]
    return stored || "details"
  })

  useEffect(() => {
    const stored = readStoredRecord(APP_NAV_KEYS.itemDetailTab)[effectiveId]
    setDetailTab(stored || "details")
  }, [effectiveId])

  useEffect(() => {
    writeStoredRecordField(APP_NAV_KEYS.itemDetailTab, effectiveId, detailTab)
  }, [effectiveId, detailTab])

  const activeDetailTab = detailTabs.includes(detailTab) ? detailTab : "details"

  return {
    isTask,
    typePick,
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
    detailTab,
    setDetailTab,
    activeDetailTab,
  }
}
