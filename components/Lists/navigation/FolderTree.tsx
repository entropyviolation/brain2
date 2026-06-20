"use client"

import type { CategoryFolder } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

export interface FolderTreeProps {
  folders: CategoryFolder[]
  location: string
  openTarget: unknown
  isHome: boolean
  isAll: boolean
  onNavTo: (loc: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, folder: CategoryFolder | null) => void
  onCreateFolder: () => void
}

export function FolderTree({
  folders,
  location,
  openTarget,
  isHome,
  isAll,
  onNavTo,
  onDragOver,
  onDrop,
  onCreateFolder,
}: FolderTreeProps) {
  return (
    <div className="fm-sidebar">
      <div className="fm-search-group-label" style={{ padding: "4px 6px 2px" }}>
        Quick Access
      </div>
      <div
        className={`fm-tree-item${isHome && !openTarget ? " active" : ""}`}
        onClick={() => onNavTo("home")}
        onDragOver={onDragOver}
      >
        <span>🏠</span>
        <span>Home</span>
      </div>
      <div
        className={`fm-tree-item${isAll && !openTarget ? " active" : ""}`}
        onClick={() => onNavTo("all")}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, null)}
      >
        <span>🗂</span>
        <span>All</span>
      </div>

      <div className="fm-search-group-label" style={{ padding: "8px 6px 2px" }}>
        Folders
      </div>
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={`fm-tree-item${location === folder.id ? " active" : ""}`}
          onClick={() => onNavTo(folder.id)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, folder)}
          data-folder-id={folder.id}
          data-scheduled={isScheduledFolderId(folder.id) ? "true" : undefined}
        >
          <span className="fm-tree-swatch" style={{ background: folder.color || "#9CA3AF" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
        </div>
      ))}
      <div style={{ padding: 6 }}>
        <button className="fm-btn fm-btn-sm" style={{ width: "100%" }} onClick={onCreateFolder}>
          + New Folder
        </button>
      </div>
    </div>
  )
}
