"use client"

import type { Folder } from "@/lib/types"
import type { ListPlacementMode } from "@/lib/folder-selection"

export interface SelectionToolbarProps {
  selectedListCount: number
  selectedFolderCount: number
  placementMode: ListPlacementMode
  originIsAll: boolean
  destinationFolders: Folder[]
  onSelectAll: () => void
  onDeselectAll: () => void
  onPlacementModeChange: (mode: ListPlacementMode) => void
  onAddToNewFolder: () => void
  onAddToFolder: (folderId: string) => void
  onMerge: () => void
  onDelete: () => void
}

export function SelectionToolbar({
  selectedListCount,
  selectedFolderCount,
  placementMode,
  originIsAll,
  destinationFolders,
  onSelectAll,
  onDeselectAll,
  onPlacementModeChange,
  onAddToNewFolder,
  onAddToFolder,
  onMerge,
  onDelete,
}: SelectionToolbarProps) {
  const selectedCount = selectedListCount + selectedFolderCount
  const canMerge = selectedListCount >= 2
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
          name="list-placement"
          checked={placementMode === "keep"}
          onChange={() => onPlacementModeChange("keep")}
        />
        Keep in this folder
      </label>
      <label className="fm-radio-row" style={{ padding: "0 4px" }} title={originIsAll ? "Lists are never removed from All" : undefined}>
        <input
          type="radio"
          name="list-placement"
          checked={placementMode === "move"}
          disabled={originIsAll}
          onChange={() => onPlacementModeChange("move")}
        />
        Move from this folder
      </label>
      <div className="fm-toolbar-sep" />
      <button className="fm-btn fm-btn-sm" onClick={onAddToNewFolder} disabled={selectedCount === 0}>
        Add to New Folder
      </button>
      <button className="fm-btn fm-btn-sm" onClick={onMerge} disabled={!canMerge} title="Merge 2 or more lists into one">
        Merge lists
      </button>
      <button className="fm-btn fm-btn-sm fm-btn-danger" onClick={onDelete} disabled={selectedCount === 0}>
        Delete selected
      </button>
      {destinationFolders.map((folder) => (
        <button
          key={folder.id}
          className="fm-btn fm-btn-sm"
          disabled={selectedCount === 0}
          onClick={() => onAddToFolder(folder.id)}
        >
          → {folder.name}
        </button>
      ))}
    </div>
  )
}
