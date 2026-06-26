"use client"

import type { Folder, List } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { buildListTree, flattenListTree } from "@/lib/list-tree"

export interface FolderTreeProps {
  folders: Folder[]
  location: string
  openTarget: unknown
  isHome: boolean
  isAll: boolean
  onNavTo: (loc: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, folder: Folder | null) => void
  onCreateFolder: () => void
  /**
   * Optional nested-category (sublist) tree (Feature 8). When provided, a
   * "Lists" section renders the categories indented by their `parentListId`
   * depth. Omit to keep the folders-only sidebar.
   */
  categories?: List[]
  /** Currently open category id, used to highlight the active sublist. */
  activeCategoryId?: string
  onNavToCategory?: (categoryId: string) => void
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
  categories,
  activeCategoryId,
  onNavToCategory,
}: FolderTreeProps) {
  const categoryNodes =
    categories && categories.length > 0 && onNavToCategory
      ? flattenListTree(buildListTree(categories))
      : []
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

      {categoryNodes.length > 0 && (
        <>
          <div className="fm-search-group-label" style={{ padding: "8px 6px 2px" }}>
            Lists
          </div>
          {categoryNodes.map(({ list: category, depth }) => (
            <div
              key={category.id}
              className={`fm-tree-item${activeCategoryId === category.id ? " active" : ""}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              onClick={() => onNavToCategory?.(category.id)}
              data-category-id={category.id}
              data-depth={depth}
            >
              <span className="fm-tree-swatch" style={{ background: category.color || "#9CA3AF" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {category.name}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
