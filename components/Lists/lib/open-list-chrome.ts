/**
 * components/Lists/lib/open-list-chrome.ts
 *
 * Pure read of the open Lists target: which list is open, its name and icon,
 * and which displays it offers. No state. The item pipeline runs after this.
 */
import type { ListDisplay } from "@/lib/lists-ui-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import {
  folderAllItemsList,
  GLOBAL_ALL_ITEMS_KEY,
} from "@/lib/folder-all-items"
import { ROOT_ALL_FOLDER_ID } from "@/lib/lists-grid-entries"
import { listAllowsDocuments } from "@/lib/document-types"
import { listAllowsPhotos } from "@/lib/photo-types"
import { LIST_DISPLAY_MODES, isListDisplayMode, sanitizeEnabledDisplays, type Folder, type ItemTypeDefinition, type List } from "@/lib/types"
import { itemTypeListLabel } from "@/lib/item-type-lists"
import { SMART_LISTS } from "@/components/Lists/constants"
import { iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { openTargetKey } from "@/components/Lists/open-target"
import type { OpenTarget } from "@/components/Lists/types"

export function resolveOpenListChrome({
  openTarget,
  categories,
  itemTypes,
  currentFolder,
  listDisplay,
}: {
  openTarget: OpenTarget
  categories: List[]
  itemTypes: ItemTypeDefinition[]
  currentFolder: Folder | null
  listDisplay: Record<string, ListDisplay>
}) {
  const openCategory = openTarget?.type === "category" ? categories.find((c) => c.id === openTarget.id) || null : null
  const openSmart = openTarget?.type === "smart" ? SMART_LISTS.find((s) => s.id === openTarget.id) || null : null
  const openHabits = openTarget?.type === "habits"
  const openObjectives = openTarget?.type === "objectives"
  const openTypeList =
    openTarget?.type === "item-type" ? itemTypes.find((type) => type.id === openTarget.id) ?? null : null
  const openFolderAll = openTarget?.type === "folder-all"
  const isRootAll = openFolderAll && openTarget?.folderId === ROOT_ALL_FOLDER_ID
  const canEditFolderAllSettings =
    !!openFolderAll &&
    (isRootAll || (!!currentFolder && !isScheduledFolderId(currentFolder.id)))
  const folderAllList = !canEditFolderAllSettings
    ? null
    : isRootAll
      ? folderAllItemsList(categories, GLOBAL_ALL_ITEMS_KEY) ?? null
      : currentFolder
        ? folderAllItemsList(categories, currentFolder.id) ?? null
        : null
  const viewList = openCategory ?? folderAllList
  const openName = openObjectives
    ? "Objectives"
    : openHabits
    ? openTarget?.id === "weekly-habits"
      ? "Weekly Habits"
      : openTarget?.id === "monthly-habits"
        ? "Monthly Habits"
        : openTarget?.id === "season-habits"
          ? "Season Habits"
          : "Daily Habits"
    : openTypeList
      ? itemTypeListLabel(openTypeList)
      : openFolderAll ? "All Items" : openCategory?.name || openSmart?.name || ""
  const openIconKey = openTypeList
    ? iconFor(String(openTypeList.id), openTypeList.icon)
    : openCategory ? iconFor(openCategory.id, openCategory.icon) : isRootAll ? iconFor("lists-root", undefined) : openFolderAll && currentFolder ? iconFor(currentFolder.id, currentFolder.icon) : openSmart ? orbFor(openSmart.id) : openObjectives ? orbFor("objectives") : openHabits ? orbFor("daily-habits") : orbFor("lists-root")

  const rawDisplay: ListDisplay = (() => {
    if (!openTarget || openTarget.type === "habits" || openTarget.type === "objectives") return "default"
    const saved = listDisplay[openTargetKey(openTarget)]
    if (saved && isListDisplayMode(saved)) return saved
    return openSmart ? "checklist" : listAllowsPhotos(viewList) ? "gallery" : listAllowsDocuments(viewList) ? "documents" : "default"
  })()
  // If the list no longer offers the saved active display, fall back to the
  // first display it does offer (Feature 1: per-list display offerings).
  const offeredDisplays = (() => {
    const base = sanitizeEnabledDisplays(viewList?.enabledDisplays)
    const extra = (listAllowsPhotos(viewList) ? ["gallery"] : []).concat(listAllowsDocuments(viewList) ? ["documents"] : []) as ListDisplay[]
    if (extra.length === 0) return base
    const all = base ?? LIST_DISPLAY_MODES.filter((d) => d !== "gallery" && d !== "documents")
    return [...all, ...extra.filter((d) => !all.includes(d))]
  })()
  const currentDisplay: ListDisplay =
    offeredDisplays && !offeredDisplays.includes(rawDisplay) ? offeredDisplays[0] : rawDisplay

  // The open list's own name (the display mode already lights up in the Display deck).
  const innerCaption = openName || (openHabits ? "Habits" : openObjectives ? "Objectives" : "List")

  return {
    openCategory,
    openSmart,
    openHabits,
    openObjectives,
    openTypeList,
    openFolderAll,
    isRootAll,
    canEditFolderAllSettings,
    folderAllList,
    viewList,
    openName,
    openIconKey,
    rawDisplay,
    offeredDisplays,
    currentDisplay,
    innerCaption,
  }
}
