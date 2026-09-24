"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Folder, List } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { MODULE_LISTS_FOLDER_ID } from "@/lib/module-lists"
import {
  buildFolderTree,
  defaultExpandedFolderIds,
  flattenFolderTree,
  isEditableFolder,
} from "@/lib/folder-tree"
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
  onEditFolder?: (folder: Folder) => void
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

function QaGlyph({ glyph }: { glyph: string }) {
  return (
    <span className="fm-qa-glyph" aria-hidden>
      {glyph}
    </span>
  )
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
  onEditFolder,
  categories,
  activeCategoryId,
  onNavToCategory,
}: FolderTreeProps) {
  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const moduleListsFolder = useMemo(
    () => folders.find((f) => f.id === MODULE_LISTS_FOLDER_ID) ?? null,
    [folders],
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    defaultExpandedFolderIds(folders, location),
  )

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of defaultExpandedFolderIds(folders, location)) next.add(id)
      return next
    })
  }, [folders, location])

  const visibleNodes = useMemo(() => flattenFolderTree(tree, expandedIds), [tree, expandedIds])

  const toggleExpanded = useCallback((folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }, [])

  const navigateToFolder = useCallback(
    (folderId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.add(folderId)
        return next
      })
      onNavTo(folderId)
    },
    [onNavTo],
  )

  const categoryNodes =
    categories && categories.length > 0 && onNavToCategory
      ? flattenListTree(buildListTree(categories))
      : []

  return (
    <nav className="fm-sidebar" aria-label="Lists folders">
      <div className="fm-sidebar-heading" id="fm-qa-heading">
        Quick Access
      </div>
      <div className="fm-qa-list" role="list" aria-labelledby="fm-qa-heading">
        <div
          role="listitem"
          className={`fm-tree-item fm-qa-item${isHome && !openTarget ? " active" : ""}`}
          onClick={() => onNavTo("home")}
          onDragOver={onDragOver}
        >
          <QaGlyph glyph="🏠" />
          <span className="fm-tree-label">Home</span>
        </div>
        <div
          role="listitem"
          className={`fm-tree-item fm-qa-item${isAll && !openTarget ? " active" : ""}`}
          onClick={() => onNavTo("all")}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, null)}
        >
          <QaGlyph glyph="🗂" />
          <span className="fm-tree-label">All</span>
        </div>
        {moduleListsFolder && (
          <div
            role="listitem"
            className={`fm-tree-item fm-qa-item${location === moduleListsFolder.id && !openTarget ? " active" : ""}`}
            onClick={() => navigateToFolder(moduleListsFolder.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, moduleListsFolder)}
          >
            <QaGlyph glyph="📦" />
            <span className="fm-tree-label">{moduleListsFolder.name}</span>
          </div>
        )}
      </div>

      <div className="fm-sidebar-heading" id="fm-folders-heading">
        Folders
      </div>
      <div className="fm-folder-list" role="tree" aria-labelledby="fm-folders-heading">
        {visibleNodes.map(({ folder, depth, hasChildren }) => {
          const expanded = expandedIds.has(folder.id)
          const selected = location === folder.id
          return (
            <div
              key={folder.id}
              role="treeitem"
              aria-expanded={hasChildren ? expanded : undefined}
              aria-selected={selected}
              className={`fm-tree-item fm-tree-folder${selected ? " active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => navigateToFolder(folder.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, folder)}
              data-folder-id={folder.id}
              data-depth={depth}
              data-scheduled={isScheduledFolderId(folder.id) ? "true" : undefined}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="fm-tree-toggle"
                  aria-label={expanded ? "Collapse folder" : "Expand folder"}
                  aria-expanded={expanded}
                  onClick={(e) => toggleExpanded(folder.id, e)}
                >
                  {expanded ? "▼" : "▶"}
                </button>
              ) : (
                <span className="fm-tree-toggle-spacer" aria-hidden />
              )}
              <span className="fm-tree-swatch" style={{ background: folder.color || "#9CA3AF" }} />
              <span className="fm-tree-label">{folder.name}</span>
              {onEditFolder && isEditableFolder(folder.id) && (
                <button
                  type="button"
                  className="fm-tree-edit"
                  title="Folder settings"
                  aria-label={`Edit ${folder.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditFolder(folder)
                  }}
                >
                  ⚙
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="fm-sidebar-new">
        <button className="fm-btn fm-btn-sm" style={{ width: "100%" }} onClick={onCreateFolder}>
          + New Folder
        </button>
      </div>

      {categoryNodes.length > 0 && (
        <>
          <div className="fm-sidebar-heading">Lists</div>
          {categoryNodes.map(({ list: category, depth }) => (
            <div
              key={category.id}
              className={`fm-tree-item${activeCategoryId === category.id ? " active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => onNavToCategory?.(category.id)}
              data-category-id={category.id}
              data-depth={depth}
            >
              <span className="fm-tree-swatch" style={{ background: category.color || "#9CA3AF" }} />
              <span className="fm-tree-label">{category.name}</span>
            </div>
          ))}
        </>
      )}
    </nav>
  )
}
