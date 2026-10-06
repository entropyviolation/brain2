"use client"

import { useState } from "react"
import type { ItemPlacementMode } from "@/lib/item-selection"
import { ListPicker } from "@/components/Lists/list-picker"
import { SelectModeActionChrome } from "./SelectModeActionChrome"

export interface ItemSelectionToolbarProps {
  selectedCount: number
  placementMode: ItemPlacementMode
  canMove: boolean
  /** Search has no single "this list" — labels say destination instead. */
  fromSearch?: boolean
  excludeListIds: string[]
  onSelectAll: () => void
  onDeselectAll: () => void
  onPlacementModeChange: (mode: ItemPlacementMode) => void
  onAddToNewList: () => void
  onAddToLists: (listIds: string[]) => void
  onMerge: () => void
  onDelete: () => void
}

export function ItemSelectionToolbar({
  selectedCount,
  placementMode,
  canMove,
  fromSearch = false,
  excludeListIds,
  onSelectAll,
  onDeselectAll,
  onPlacementModeChange,
  onAddToNewList,
  onAddToLists,
  onMerge,
  onDelete,
}: ItemSelectionToolbarProps) {
  const [destIds, setDestIds] = useState<string[]>([])
  const applyLabel =
    placementMode === "move"
      ? destIds.length === 1
        ? "Move to selected list"
        : "Move to selected lists"
      : destIds.length === 1
        ? "Add to selected list"
        : "Add to selected lists"

  return (
    <div>
      <div className="fm-toolbar" style={{ marginTop: 3 }}>
        <SelectModeActionChrome
          selectedCount={selectedCount}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          placementName="item-placement"
          placementMode={placementMode}
          onPlacementModeChange={onPlacementModeChange}
          keepLabel={fromSearch ? "Keep on current lists" : "Keep in this list"}
          moveLabel={fromSearch ? "Move to destination" : "Move from this list"}
          moveDisabled={!canMove}
          moveTitle={
            canMove
              ? fromSearch
                ? "Add to the destination and remove from other real lists"
                : undefined
              : "Items are never removed from All Items or smart lists"
          }
          onMerge={onMerge}
          mergeLabel="Merge items"
          mergeDisabled={selectedCount < 2}
          mergeTitle="Merge 2 or more items into one"
          onDelete={onDelete}
          beforeMerge={
            <button className="fm-btn fm-btn-sm" onClick={onAddToNewList} disabled={selectedCount === 0}>
              Add to New List
            </button>
          }
        />
      </div>
      <div className="fm-toolbar" style={{ alignItems: "flex-start", marginTop: 1 }}>
        <span style={{ fontSize: 11, padding: "4px 4px 0" }}>Add to lists</span>
        <div className="fm-item-list-picker">
          <ListPicker
            selected={destIds}
            onChange={setDestIds}
            mode="multi"
            compact
            variant="fm"
            showCreate={false}
            excludeIds={excludeListIds}
          />
        </div>
        <button
          className="fm-btn fm-btn-sm"
          disabled={selectedCount === 0 || destIds.length === 0}
          onClick={() => onAddToLists(destIds)}
        >
          {applyLabel}
        </button>
      </div>
    </div>
  )
}
