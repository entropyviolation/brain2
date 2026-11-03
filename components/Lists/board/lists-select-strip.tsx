"use client"

/**
 * components/Lists/board/lists-select-strip.tsx
 *
 * Select-mode control strip and the measure that grows the window. The + 3
 * is the strip's margin outside the border box. Closed, the height reports 0.
 */
import { useEffect, useRef } from "react"
import type { Dispatch, SetStateAction } from "react"
import { destinationFoldersForSelection, type ListPlacementMode } from "@/lib/folder-selection"
import { excludedListIdsForSelection, type ItemPlacementMode } from "@/lib/item-selection"
import { ItemSelectionToolbar } from "@/components/Lists/toolbar/ItemSelectionToolbar"
import { SelectionToolbar } from "@/components/Lists/toolbar/SelectionToolbar"
import type { Folder, List } from "@/lib/types"

export function ListsSelectStrip({
  selectStripOpen,
  setSelectBandPx,
  itemSelectActive,
  listSelectActive,
  selectedTaskIds,
  effectiveItemPlacement,
  itemCanMove,
  selectingSearchResults,
  categories,
  originListId,
  handleSelectAllSearchResults,
  handleSelectAllItems,
  clearTaskSelection,
  clearSelection,
  setItemPlacementMode,
  openNewCategoryDialog,
  placeItemsIntoLists,
  setItemMergeConfirmOpen,
  handleDeleteSelectedItems,
  selectedCategories,
  selectedFolderIds,
  effectivePlacement,
  isAll,
  searchActive,
  folders,
  currentFolder,
  handleSelectAllVisible,
  setPlacementMode,
  setShowNewFolderDialog,
  placeListsIntoFolder,
  setMergeConfirmOpen,
  handleDeleteSelected,
  openDuplicateSelection,
}: {
  selectStripOpen: boolean
  setSelectBandPx: Dispatch<SetStateAction<number>>
  itemSelectActive: boolean
  listSelectActive: boolean
  selectedTaskIds: string[]
  effectiveItemPlacement: ItemPlacementMode
  itemCanMove: boolean
  selectingSearchResults: boolean
  categories: List[]
  originListId: string | null
  handleSelectAllSearchResults: () => void
  handleSelectAllItems: () => void
  clearTaskSelection: () => void
  clearSelection: () => void
  setItemPlacementMode: (mode: ItemPlacementMode) => void
  openNewCategoryDialog: () => void
  placeItemsIntoLists: (destListIds: string[]) => void
  setItemMergeConfirmOpen: (open: boolean) => void
  handleDeleteSelectedItems: () => void
  selectedCategories: string[]
  selectedFolderIds: string[]
  effectivePlacement: ListPlacementMode
  isAll: boolean
  searchActive: boolean
  folders: Folder[]
  currentFolder: Folder | null
  handleSelectAllVisible: () => void
  setPlacementMode: (mode: ListPlacementMode) => void
  setShowNewFolderDialog: (open: boolean) => void
  placeListsIntoFolder: (destFolderId: string) => void
  setMergeConfirmOpen: (open: boolean) => void
  handleDeleteSelected: () => void
  openDuplicateSelection: () => void
}) {
  const selectBandRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selectStripOpen) {
      setSelectBandPx(0)
      return
    }
    const el = selectBandRef.current
    if (!el) return
    const measure = () => {
      // margin-top on the strip sits outside the border box; the window must grow by both
      const next = Math.ceil(el.getBoundingClientRect().height) + 3
      setSelectBandPx((prev) => (prev === next ? prev : next))
    }
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [selectStripOpen, setSelectBandPx])

  if (!selectStripOpen) return null
  return (
    <div ref={selectBandRef}>
      {itemSelectActive && (
        <ItemSelectionToolbar
          selectedCount={selectedTaskIds.length}
          placementMode={effectiveItemPlacement}
          canMove={itemCanMove}
          fromSearch={selectingSearchResults}
          excludeListIds={excludedListIdsForSelection(categories, originListId)}
          onSelectAll={selectingSearchResults ? handleSelectAllSearchResults : handleSelectAllItems}
          onDeselectAll={
            selectingSearchResults
              ? () => {
                  clearTaskSelection()
                  clearSelection()
                }
              : clearTaskSelection
          }
          onPlacementModeChange={setItemPlacementMode}
          onAddToNewList={openNewCategoryDialog}
          onAddToLists={placeItemsIntoLists}
          onMerge={() => setItemMergeConfirmOpen(true)}
          onDelete={handleDeleteSelectedItems}
        />
      )}
      {listSelectActive && (
        <SelectionToolbar
          selectedListCount={selectedCategories.length}
          selectedFolderCount={selectedFolderIds.length}
          placementMode={effectivePlacement}
          originIsAll={isAll && !searchActive}
          fromSearch={selectingSearchResults}
          destinationFolders={destinationFoldersForSelection(folders, {
            currentFolderId: searchActive ? null : currentFolder?.id,
            selectedFolderIds,
          })}
          onSelectAll={selectingSearchResults ? handleSelectAllSearchResults : handleSelectAllVisible}
          onDeselectAll={
            selectingSearchResults
              ? () => {
                  clearSelection()
                  clearTaskSelection()
                }
              : clearSelection
          }
          onPlacementModeChange={setPlacementMode}
          onAddToNewFolder={() => setShowNewFolderDialog(true)}
          onAddToFolder={placeListsIntoFolder}
          onMerge={() => setMergeConfirmOpen(true)}
          onDelete={handleDeleteSelected}
          onDuplicate={openDuplicateSelection}
        />
      )}
    </div>
  )
}
