"use client"

import { useDeferredValue, useMemo, useState } from "react"
import type React from "react"
import type { GridEntry } from "@/components/Lists/types"
import { entryIconSrc } from "@/components/Lists/lib/icon-utils"
import { FolderRenameInput } from "@/components/Lists/views/FolderContextMenu"
import { isMultiSelectableEntry, pinMatchingListsToTop } from "@/lib/lists-folder-search"

export interface FolderViewListProps {
  entries: GridEntry[]
  activeIconId: string | null
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  clearDrag: () => void
  setActiveIconId: (id: string) => void
  openEntry: (entry: GridEntry) => void
  selectMode?: boolean
  selectedCategories?: string[]
  selectedFolderIds?: string[]
  onToggleListSelect?: (listId: string) => void
  onToggleFolderSelect?: (folderId: string) => void
  /** When true, search placeholder mentions the current folder. */
  inFolder?: boolean
  onFolderContextMenu?: (folderId: string, clientX: number, clientY: number) => void
  renamingFolderId?: string | null
  onCommitFolderRename?: (folderId: string, name: string) => void
  onCancelFolderRename?: () => void
}

export function FolderViewList({
  entries,
  activeIconId,
  handleCategoryDragStart,
  handleDragOver,
  handleDropOnEntry,
  clearDrag,
  setActiveIconId,
  openEntry,
  selectMode = false,
  selectedCategories = [],
  selectedFolderIds = [],
  onToggleListSelect,
  onToggleFolderSelect,
  inFolder = false,
  onFolderContextMenu,
  renamingFolderId = null,
  onCommitFolderRename,
  onCancelFolderRename,
}: FolderViewListProps) {
  const [listSearch, setListSearch] = useState("")
  const deferredSearch = useDeferredValue(listSearch)
  const visibleEntries = useMemo(() => pinMatchingListsToTop(entries, deferredSearch), [entries, deferredSearch])
  const selectedLists = new Set(selectedCategories)
  const selectedFolders = new Set(selectedFolderIds)

  const isSelected = (entry: GridEntry) =>
    entry.kind === "list" ? selectedLists.has(entry.id) : entry.kind === "folder" ? selectedFolders.has(entry.id) : false

  const toggleSelect = (entry: GridEntry) => {
    if (entry.kind === "list") onToggleListSelect?.(entry.id)
    else if (entry.kind === "folder") onToggleFolderSelect?.(entry.id)
  }

  return (
    <div className="fm-sunken">
      <div className="fm-list-search">
        <input
          className="fm-input"
          type="search"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder={inFolder ? "Search lists in this folder…" : "Search lists…"}
          aria-label={inFolder ? "Search lists in this folder" : "Search lists"}
        />
      </div>
      <div className="fm-linklist">
        {visibleEntries.map((entry) => {
          const selectable = isMultiSelectableEntry(entry)
          const selected = isSelected(entry)
          const highlighted = selectMode ? selected : activeIconId === entry.id
          return (
            <div
              key={`${entry.kind}-${entry.id}`}
              className={`fm-link-row${highlighted ? " selected" : ""}`}
              draggable={entry.kind === "list" && !selectMode}
              onDragStart={(e) => entry.kind === "list" && !selectMode && handleCategoryDragStart(e, entry.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnEntry(e, entry)}
              onDragEnd={clearDrag}
              onClick={() => {
                if (renamingFolderId === entry.id) return
                if (selectMode && selectable) toggleSelect(entry)
                else setActiveIconId(entry.id)
              }}
              onDoubleClick={() => {
                if (!selectMode) openEntry(entry)
              }}
              onContextMenu={(e) => {
                if (entry.kind !== "folder" || !onFolderContextMenu) return
                e.preventDefault()
                e.stopPropagation()
                onFolderContextMenu(entry.id, e.clientX, e.clientY)
              }}
            >
              {selectMode && selectable && (
                <input
                  type="checkbox"
                  checked={selected}
                  aria-label={`Select ${entry.name}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(entry)}
                />
              )}
              <img
                className="fm-link-icon"
                src={entryIconSrc(entry)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
              />
              {entry.kind === "folder" && renamingFolderId === entry.id && onCommitFolderRename && onCancelFolderRename ? (
                <FolderRenameInput
                  name={entry.name}
                  className="fm-input fm-rename-input fm-rename-input-row"
                  onCommit={(next) => onCommitFolderRename(entry.id, next)}
                  onCancel={onCancelFolderRename}
                />
              ) : (
                <span className="fm-link-text">{entry.name}</span>
              )}
              <span className="fm-icon-badge">{entry.count}</span>
            </div>
          )
        })}
        {visibleEntries.length === 0 && (
          <div className="fm-empty">
            <p>{listSearch.trim() ? "No lists match this search." : "This location is empty."}</p>
          </div>
        )}
      </div>
    </div>
  )
}
