"use client"

import type { Task, TaskCategory, CategoryFolder } from "@/lib/types"
import { FolderGlyph, iconFor } from "@/components/Lists/lib/icon-utils"

export interface SearchResultsViewProps {
  searchTerm: string
  folders: CategoryFolder[]
  lists: TaskCategory[]
  tasks: Task[]
  getTasksForCategory: (id: string) => Task[]
  onSelectFolder: (folderId: string) => void
  onSelectList: (listId: string, parentFolderId: string | null) => void
  onSelectTask: (taskId: string) => void
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
}: SearchResultsViewProps) {
  const total = folders.length + lists.length + tasks.length

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
              <div key={f.id} className="fm-link-row" onClick={() => onSelectFolder(f.id)}>
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
                className="fm-link-row"
                onClick={() => {
                  const parent = folders.find((f) => f.categoryIds.includes(c.id))
                  onSelectList(c.id, parent ? parent.id : null)
                }}
              >
                <img className="fm-link-icon" src={iconFor(c.id, c.icon)} alt="" />
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
              <div key={t.id} className="fm-link-row" onClick={() => onSelectTask(t.id)}>
                <img className="fm-link-icon" src={iconFor(t.id, t.icon)} alt="" />
                <span className="fm-link-text">{t.description}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
