"use client"

import type { Task, List, Folder } from "@/lib/types"
import { FolderGlyph, iconFor } from "@/components/Lists/lib/icon-utils"
import { itemTitle } from "@/lib/item-utils"

export interface SearchResultsViewProps {
  searchTerm: string
  folders: Folder[]
  lists: List[]
  tasks: Task[]
  getTasksForCategory: (id: string) => Task[]
  onSelectFolder: (folderId: string) => void
  onSelectList: (listId: string, parentFolderId: string | null) => void
  onSelectTask: (taskId: string) => void
  /** When true, rows toggle selection instead of navigating. */
  selectMode?: boolean
  selectedFolderIds?: string[]
  selectedListIds?: string[]
  selectedTaskIds?: string[]
  onToggleFolderSelect?: (folderId: string) => void
  onToggleListSelect?: (listId: string) => void
  onToggleTaskSelect?: (taskId: string) => void
}

export function SearchResultsView({
  searchTerm,
  folders,
  lists,
  tasks,
  getTasksForCategory,
  onSelectFolder,
  onSelectList,
  onSelectTask,
  selectMode = false,
  selectedFolderIds = [],
  selectedListIds = [],
  selectedTaskIds = [],
  onToggleFolderSelect,
  onToggleListSelect,
  onToggleTaskSelect,
}: SearchResultsViewProps) {
  const total = folders.length + lists.length + tasks.length
  const selectedFolders = new Set(selectedFolderIds)
  const selectedLists = new Set(selectedListIds)
  const selectedTasks = new Set(selectedTaskIds)

  return (
    <div className="fm-sunken">
      <div className="fm-search-results">
        {total === 0 && (
          <div className="fm-empty">
            <p>No matches for “{searchTerm}”.</p>
          </div>
        )}
        {folders.length > 0 && (
          <>
            <div className="fm-search-group-label">Folders ({folders.length})</div>
            {folders.map((f) => (
              <div
                key={f.id}
                className={`fm-link-row${selectMode && selectedFolders.has(f.id) ? " selected" : ""}`}
                onClick={() => {
                  if (selectMode) onToggleFolderSelect?.(f.id)
                  else onSelectFolder(f.id)
                }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedFolders.has(f.id)}
                    aria-label={`Select folder ${f.name}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleFolderSelect?.(f.id)}
                  />
                )}
                <FolderGlyph size={22} color={f.color || undefined} />
                <span className="fm-link-text">{f.name}</span>
              </div>
            ))}
          </>
        )}
        {lists.length > 0 && (
          <>
            <div className="fm-search-group-label">Lists ({lists.length})</div>
            {lists.map((c) => (
              <div
                key={c.id}
                className={`fm-link-row${selectMode && selectedLists.has(c.id) ? " selected" : ""}`}
                onClick={() => {
                  if (selectMode) onToggleListSelect?.(c.id)
                  else {
                    const parent = folders.find((f) => f.listIds.includes(c.id))
                    onSelectList(c.id, parent ? parent.id : null)
                  }
                }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedLists.has(c.id)}
                    aria-label={`Select list ${c.name}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleListSelect?.(c.id)}
                  />
                )}
                <img className="fm-link-icon" src={iconFor(c.id, c.icon)} alt="" loading="lazy" decoding="async" />
                <span className="fm-link-text">{c.name}</span>
                <span className="fm-icon-badge">{getTasksForCategory(c.id).length}</span>
              </div>
            ))}
          </>
        )}
        {tasks.length > 0 && (
          <>
            <div className="fm-search-group-label">Items ({tasks.length})</div>
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`fm-link-row${selectMode && selectedTasks.has(t.id) ? " selected" : ""}`}
                onClick={() => {
                  if (selectMode) onToggleTaskSelect?.(t.id)
                  else onSelectTask(t.id)
                }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(t.id)}
                    aria-label={`Select ${itemTitle(t)}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleTaskSelect?.(t.id)}
                  />
                )}
                <img className="fm-link-icon" src={iconFor(t.id, t.icon)} alt="" loading="lazy" decoding="async" />
                <span className="fm-link-text">{itemTitle(t)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
