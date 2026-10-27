"use client"

/**
 * components/Lists/board/lists-inspector.tsx
 *
 * Right rail. Four exclusive branches: an open list, folder or global All
 * Items, a smart list, then a plain folder. Store values are passed in.
 */
import type { ListDisplay } from "@/lib/lists-ui-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import {
  foldersInGlobalAllForFilter,
  listsInFolderForFilter,
} from "@/lib/folder-all-items"
import { isFolderHiddenFromGlobalAll } from "@/lib/module-lists"
import { ListIconsDesktopSwitch } from "@/components/Lists/list-content/ListContentIconsDesktop"
import { AllViewCheckboxFilter } from "@/components/Lists/list-content/AllViewCheckboxFilter"
import { formatInspectorDate } from "@/components/Lists/lib/velvet-icon-grid"
import { openTargetKey } from "@/components/Lists/open-target"
import type { IconPickerTarget, OpenTarget } from "@/components/Lists/types"
import type { Folder, List, Task } from "@/lib/types"

function latestTouch(createdAt: Date | undefined, tasks: Task[]): Date | undefined {
  let latest = createdAt ? new Date(createdAt).getTime() : 0
  for (const t of tasks) {
    for (const d of [t.createdAt, t.completedDate, t.startedAt]) {
      if (!d) continue
      const n = new Date(d).getTime()
      if (!Number.isNaN(n) && n > latest) latest = n
    }
  }
  return latest ? new Date(latest) : undefined
}

function InspectorFacts({
  countLabel,
  typeLabel,
  lastTouched,
}: {
  countLabel: string
  typeLabel: string
  lastTouched: string
}) {
  return (
    <dl className="fm-inspector-facts">
      <dt>Count</dt>
      <dd>
        <span className="fm-crt-count">{countLabel}</span>
      </dd>
      <dt>Type</dt>
      <dd>{typeLabel}</dd>
      <dt>Last touched</dt>
      <dd>{lastTouched}</dd>
    </dl>
  )
}

export function ListsInspector({
  openCategory,
  openFolderAll,
  isRootAll,
  currentFolder,
  openSmart,
  openTarget,
  listedTasks,
  openTasks,
  itemLabelFor,
  currentDisplay,
  setEditingCategory,
  setIconPickerFor,
  homePinned,
  toggleHomePin,
  typeFilterForOpen,
  hiddenItemTypeIdsByTarget,
  setItemTypeHidden,
  setHiddenItemTypeIds,
  canEditFolderAllSettings,
  openFolderAllSettings,
  folders,
  categories,
  globalAllHiddenFolderIds,
  setGlobalAllFolderHidden,
  setGlobalAllHiddenFolderIds,
  globalAllHideUncategorized,
  setGlobalAllHideUncategorized,
  folderAllHiddenListIds,
  setFolderAllListHidden,
  setFolderAllHiddenListIds,
  folderAllHideUncategorized,
  setFolderAllHideUncategorized,
  setAddingTaskToTarget,
  setEditingFolder,
  openNewCategoryDialog,
}: {
  openCategory: List | null
  openFolderAll: boolean
  isRootAll: boolean
  currentFolder: Folder | null
  openSmart: { id: string } | null
  openTarget: OpenTarget
  listedTasks: Task[]
  openTasks: Task[]
  itemLabelFor: (categoryId?: string, category?: List | null) => string
  currentDisplay: ListDisplay
  setEditingCategory: (list: List | null) => void
  setIconPickerFor: (target: IconPickerTarget) => void
  homePinned: string[]
  toggleHomePin: (id: string) => void
  typeFilterForOpen: { targetKey: string; items: { id: string; name: string }[] } | null
  hiddenItemTypeIdsByTarget: Record<string, string[]>
  setItemTypeHidden: (targetKey: string, typeId: string, hidden: boolean) => void
  setHiddenItemTypeIds: (targetKey: string, ids: string[]) => void
  canEditFolderAllSettings: boolean
  openFolderAllSettings: () => void
  folders: Folder[]
  categories: List[]
  globalAllHiddenFolderIds: string[] | undefined
  setGlobalAllFolderHidden: (folderId: string, hidden: boolean) => void
  setGlobalAllHiddenFolderIds: (ids: string[]) => void
  globalAllHideUncategorized: boolean
  setGlobalAllHideUncategorized: (hidden: boolean) => void
  folderAllHiddenListIds: Record<string, string[]> | undefined
  setFolderAllListHidden: (folderId: string, listId: string, hidden: boolean) => void
  setFolderAllHiddenListIds: (folderId: string, ids: string[]) => void
  folderAllHideUncategorized: Record<string, boolean> | undefined
  setFolderAllHideUncategorized: (folderId: string, hidden: boolean) => void
  setAddingTaskToTarget: (target: string | null) => void
  setEditingFolder: (folder: Folder | null) => void
  openNewCategoryDialog: () => void
}) {
  return (
    <>
      {openCategory && (
        <div className="fm-sidebar fm-inspector" data-ui-name="List inspector" data-ui-docs="components/Lists/README.md" style={{ width: 168 }}>
          <InspectorFacts
            countLabel={`${listedTasks.length} item(s)`}
            typeLabel={itemLabelFor(openCategory.id, openCategory)}
            lastTouched={formatInspectorDate(latestTouch(openCategory.createdAt, openTasks))}
          />
          <div className="fm-inspector-sep" />
          <div className="fm-inspector-actions">
            <ListIconsDesktopSwitch targetKey={openCategory.id} show={currentDisplay === "icons"} />
            <button className="fm-btn fm-btn-sm" onClick={() => setEditingCategory(openCategory)}>List Settings</button>
            <button className="fm-btn fm-btn-sm" onClick={() => setIconPickerFor({ kind: "category", id: openCategory.id })}>Change Icon</button>
            <button className="fm-btn fm-btn-sm" onClick={() => toggleHomePin(openCategory.id)}>{homePinned.includes(openCategory.id) ? "Unpin Home" : "Pin to Home"}</button>
          </div>
          {typeFilterForOpen && (
            <>
              <div className="fm-inspector-sep" />
              <AllViewCheckboxFilter
                items={typeFilterForOpen.items}
                hiddenIds={hiddenItemTypeIdsByTarget?.[typeFilterForOpen.targetKey] ?? []}
                onHiddenChange={(typeId, hidden) => setItemTypeHidden(typeFilterForOpen.targetKey, typeId, hidden)}
                onSetHiddenIds={(ids) => setHiddenItemTypeIds(typeFilterForOpen.targetKey, ids)}
                ariaLabel="Filter types"
              />
            </>
          )}
        </div>
      )}
      {openFolderAll && (isRootAll || currentFolder) && (
        <div className="fm-sidebar fm-inspector" data-ui-name="List inspector" data-ui-docs="components/Lists/README.md" style={{ width: 168 }}>
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            <ListIconsDesktopSwitch targetKey={openTargetKey(openTarget!)} show={currentDisplay === "icons"} />
            {canEditFolderAllSettings && (
              <button className="fm-btn fm-btn-sm" onClick={openFolderAllSettings}>List Settings</button>
            )}
            {isRootAll ? (
              <AllViewCheckboxFilter
                items={foldersInGlobalAllForFilter(folders).filter((f) => !isFolderHiddenFromGlobalAll(f, folders))}
                hiddenIds={globalAllHiddenFolderIds ?? []}
                onHiddenChange={(folderId, hidden) => setGlobalAllFolderHidden(folderId, hidden)}
                onSetHiddenIds={setGlobalAllHiddenFolderIds}
                ariaLabel="Filter folders"
                uncategorizedChecked={!globalAllHideUncategorized}
                onUncategorizedChange={(checked) => setGlobalAllHideUncategorized(!checked)}
              />
            ) : currentFolder && !isScheduledFolderId(currentFolder.id) ? (
              <AllViewCheckboxFilter
                items={listsInFolderForFilter(currentFolder, categories)}
                hiddenIds={folderAllHiddenListIds?.[currentFolder.id] ?? []}
                onHiddenChange={(listId, hidden) => setFolderAllListHidden(currentFolder.id, listId, hidden)}
                onSetHiddenIds={(ids) => setFolderAllHiddenListIds(currentFolder.id, ids)}
                ariaLabel="Filter lists"
                uncategorizedChecked={!folderAllHideUncategorized?.[currentFolder.id]}
                onUncategorizedChange={(checked) => setFolderAllHideUncategorized(currentFolder.id, !checked)}
              />
            ) : null}
            {typeFilterForOpen && (
              <AllViewCheckboxFilter
                items={typeFilterForOpen.items}
                hiddenIds={hiddenItemTypeIdsByTarget?.[typeFilterForOpen.targetKey] ?? []}
                onHiddenChange={(typeId, hidden) => setItemTypeHidden(typeFilterForOpen.targetKey, typeId, hidden)}
                onSetHiddenIds={(ids) => setHiddenItemTypeIds(typeFilterForOpen.targetKey, ids)}
                ariaLabel="Filter types"
              />
            )}
            <p style={{ fontSize: 11, color: "var(--fm-button-shadow)" }}>Items added here stay uncategorized until filed into a list.</p>
          </div>
        </div>
      )}
      {openSmart && (
        <div className="fm-sidebar fm-inspector" data-ui-name="List inspector" data-ui-docs="components/Lists/README.md" style={{ width: 168 }}>
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            <ListIconsDesktopSwitch targetKey={openSmart.id} show={currentDisplay === "icons"} />
            <button className="fm-btn fm-btn-sm" onClick={() => setAddingTaskToTarget(openSmart.id)}>Add Task</button>
            <p style={{ fontSize: 11, color: "var(--fm-button-shadow)" }}>Synced with the dashboard To-Do panel.</p>
          </div>
        </div>
      )}
      {!openCategory && !openFolderAll && !openSmart && currentFolder && (
        <div className="fm-sidebar fm-inspector" data-ui-name="List inspector" data-ui-docs="components/Lists/README.md" style={{ width: 168 }}>
          <InspectorFacts
            countLabel={`${currentFolder.listIds?.length ?? 0} list(s)`}
            typeLabel="Folder"
            lastTouched={formatInspectorDate(currentFolder.createdAt)}
          />
          <div className="fm-inspector-sep" />
          <div className="fm-inspector-actions">
            {!isScheduledFolderId(currentFolder.id) || currentFolder.id === "na-scheduled" ? (
              <button className="fm-btn fm-btn-sm" onClick={() => setEditingFolder(currentFolder)}>Folder Settings</button>
            ) : null}
            <button className="fm-btn fm-btn-sm" onClick={() => setIconPickerFor({ kind: "folder", id: currentFolder.id })}>Change Icon</button>
            <button className="fm-btn fm-btn-sm" onClick={openNewCategoryDialog}>New List Here</button>
            <button className="fm-btn fm-btn-sm" onClick={() => toggleHomePin(currentFolder.id)}>{homePinned.includes(currentFolder.id) ? "Unpin Home" : "Pin to Home"}</button>
          </div>
        </div>
      )}
    </>
  )
}
