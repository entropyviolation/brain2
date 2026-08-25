"use client"

import type { List } from "@/lib/types"
import type { ItemPlacementMode } from "@/lib/item-selection"

export interface ItemSelectionToolbarProps {
  selectedCount: number
  placementMode: ItemPlacementMode
  canMove: boolean
  destinationLists: List[]
  onSelectAll: () => void
  onDeselectAll: () => void
  onPlacementModeChange: (mode: ItemPlacementMode) => void
  onAddToNewList: () => void
  onAddToList: (listId: string) => void
  onDelete: () => void
}

export function ItemSelectionToolbar({
  selectedCount,
  placementMode,
  canMove,
  destinationLists,
  onSelectAll,
  onDeselectAll,
  onPlacementModeChange,
  onAddToNewList,
  onAddToList,
  onDelete,
}: ItemSelectionToolbarProps) {
  return (
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
      <button className="fm-btn fm-btn-sm fm-btn-danger" onClick={onDelete} disabled={selectedCount === 0}>
        Delete selected
      </button>
      {destinationLists.map((list) => (
        <button
          key={list.id}
          className="fm-btn fm-btn-sm"
          disabled={selectedCount === 0}
          onClick={() => onAddToList(list.id)}
        >
          → {list.name}
        </button>
      ))}
    </div>
  )
}
