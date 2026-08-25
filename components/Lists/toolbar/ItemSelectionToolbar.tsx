"use client"

import { useState } from "react"
import type { ItemPlacementMode } from "@/lib/item-selection"
import { ListPicker } from "@/components/Lists/list-picker"

export interface ItemSelectionToolbarProps {
  selectedCount: number
  placementMode: ItemPlacementMode
  canMove: boolean
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
        <span style={{ fontSize: 11 }}>{selectedCount} selected</span>
        <button className="fm-btn fm-btn-sm" onClick={onSelectAll}>
          Select All
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onDeselectAll} disabled={selectedCount === 0}>
          Deselect All
        </button>
        <div className="fm-toolbar-sep" />
        <label className="fm-radio-row" style={{ padding: "0 4px" }}>
          <input
            type="radio"
            name="item-placement"
            checked={placementMode === "keep"}
            onChange={() => onPlacementModeChange("keep")}
          />
          Keep in this list
        </label>
        <label
          className="fm-radio-row"
          style={{ padding: "0 4px" }}
          title={canMove ? undefined : "Items are never removed from All Items or smart lists"}
        >
          <input
            type="radio"
            name="item-placement"
            checked={placementMode === "move"}
            disabled={!canMove}
            onChange={() => onPlacementModeChange("move")}
          />
          Move from this list
        </label>
        <div className="fm-toolbar-sep" />
        <button className="fm-btn fm-btn-sm" onClick={onAddToNewList} disabled={selectedCount === 0}>
          Add to New List
        </button>
        <button
          className="fm-btn fm-btn-sm"
          onClick={onMerge}
          disabled={selectedCount < 2}
          title="Merge 2 or more items into one"
        >
          Merge items
        </button>
        <button className="fm-btn fm-btn-sm fm-btn-danger" onClick={onDelete} disabled={selectedCount === 0}>
          Delete selected
        </button>
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
