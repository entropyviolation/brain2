"use client"

import { useMemo, useState } from "react"
import type { Folder } from "@/lib/types"
import type { ListPlacementMode } from "@/lib/folder-selection"

export interface SelectionToolbarProps {
  selectedListCount: number
  selectedFolderCount: number
  placementMode: ListPlacementMode
  originIsAll: boolean
  /** Search has no single "this folder" — Move still relocates into a destination. */
  fromSearch?: boolean
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
  fromSearch = false,
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
  const canMove = fromSearch || !originIsAll
  const [folderQuery, setFolderQuery] = useState("")
  const q = folderQuery.trim().toLowerCase()
  const filteredFolders = useMemo(() => {
    if (!q) return destinationFolders
    return destinationFolders.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q),
    )
  }, [destinationFolders, q])

  return (
    <div>
      <div className="fm-toolbar" style={{ marginTop: 3 }}>
        <span className="fm-crt-count">{selectedCount} selected</span>
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
          {fromSearch ? "Keep in current folders" : "Keep in this folder"}
        </label>
        <label
          className="fm-radio-row"
          style={{ padding: "0 4px" }}
          title={
            canMove
              ? fromSearch
                ? "Add to the destination and remove from other folders"
                : undefined
              : "Lists are never removed from All"
          }
        >
          <input
            type="radio"
            name="list-placement"
            checked={placementMode === "move"}
            disabled={!canMove}
            onChange={() => onPlacementModeChange("move")}
          />
          {fromSearch ? "Move to destination" : "Move from this folder"}
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
      </div>
      <div className="fm-toolbar fm-folder-dest-bay" style={{ alignItems: "flex-start", marginTop: 1 }}>
        <span className="fm-folder-dest-label">Add to folder</span>
        <div className="fm-folder-dest">
          <span className="fm-search fm-folder-dest-search">
            <input
              type="search"
              className="fm-input"
              placeholder="Search folders…"
              aria-label="Search folders"
              value={folderQuery}
              onChange={(e) => setFolderQuery(e.target.value)}
            />
            {folderQuery && (
              <button
                type="button"
                className="fm-search-clear"
                aria-label="Clear folder search"
                onClick={() => setFolderQuery("")}
              >
                ×
              </button>
            )}
          </span>
          <div className="fm-folder-dest-list" role="listbox" aria-label="Destination folders">
            {destinationFolders.length === 0 ? (
              <p className="fm-folder-dest-empty">No folders available.</p>
            ) : filteredFolders.length === 0 ? (
              <p className="fm-folder-dest-empty">No folders match “{folderQuery.trim()}”.</p>
            ) : (
              filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  role="option"
                  className="fm-btn fm-btn-sm fm-folder-dest-btn"
                  disabled={selectedCount === 0}
                  onClick={() => onAddToFolder(folder.id)}
                >
                  → {folder.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
