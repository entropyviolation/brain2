"use client"

import { useMemo, useState } from "react"
import type { Folder } from "@/lib/types"
import type { ListPlacementMode } from "@/lib/folder-selection"
import { SelectModeActionChrome } from "./SelectModeActionChrome"

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
  onDuplicate: () => void
}

/**
 * Select mode control strip — folder chip bay on the left, selection actions on the right.
 * One horizontal band. The file manager grows by this band so the tree and content
 * keep the height they have when select mode is off.
 */
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
  onDuplicate,
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
    <div
      className="fm-select-strip"
      role="region"
      aria-label="Select mode control strip"
      data-ui-name="Select mode control strip"
    >
      <div className="fm-folder-dest-bay">
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

      <div className="fm-select-strip-controls">
        <SelectModeActionChrome
          selectedCount={selectedCount}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          placementName="list-placement"
          placementMode={placementMode}
          onPlacementModeChange={onPlacementModeChange}
          keepLabel={fromSearch ? "Keep in current folders" : "Keep in this folder"}
          moveLabel={fromSearch ? "Move to destination" : "Move from this folder"}
          moveDisabled={!canMove}
          moveTitle={
            canMove
              ? fromSearch
                ? "Add to the destination and remove from other folders"
                : undefined
              : "Lists are never removed from All"
          }
          onMerge={onMerge}
          mergeLabel="Merge lists"
          mergeDisabled={!canMerge}
          mergeTitle="Merge 2 or more lists into one"
          onDelete={onDelete}
          beforeMerge={
            <button
              type="button"
              className="fm-btn fm-btn-sm"
              onClick={onAddToNewFolder}
              disabled={selectedCount === 0}
            >
              Add to New Folder
            </button>
          }
          afterMerge={
            <button
              type="button"
              className="fm-btn fm-btn-sm"
              onClick={onDuplicate}
              disabled={selectedCount === 0}
            >
              Duplicate selection
            </button>
          }
        />
      </div>
    </div>
  )
}
