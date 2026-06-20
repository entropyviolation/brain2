"use client"

import type { FolderView } from "@/lib/lists-ui-store"
import type { OpenTarget } from "@/components/Lists/types"
import { ViewModeControls } from "./ViewModeControls"

export interface ListsToolbarProps {
  openTarget: OpenTarget
  isHome: boolean
  isAll: boolean
  searchTerm: string
  searchActive: boolean
  selectMode: boolean
  folderView: FolderView
  currentDisplay: import("@/lib/lists-ui-store").ListDisplay
  location: string
  entryKeys: string[]
  onUp: () => void
  onNewList: () => void
  onNewFolder: () => void
  onImportCsv: () => void
  onCompleted: () => void
  onSettings: () => void
  onToggleSelect: () => void
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  onFolderViewChange: (view: FolderView) => void
  onListDisplayChange: (key: string, display: import("@/lib/lists-ui-store").ListDisplay) => void
  onAutoOrganize: () => void
}

export function ListsToolbar({
  openTarget,
  isHome,
  isAll,
  searchTerm,
  searchActive,
  selectMode,
  folderView,
  currentDisplay,
  location,
  entryKeys,
  onUp,
  onNewList,
  onNewFolder,
  onImportCsv,
  onCompleted,
  onSettings,
  onToggleSelect,
  onSearchChange,
  onClearSearch,
  onFolderViewChange,
  onListDisplayChange,
  onAutoOrganize,
}: ListsToolbarProps) {
  return (
    <div className="fm-toolbar">
      <button className="fm-btn fm-btn-sm" disabled={!openTarget && (isHome || isAll)} onClick={onUp}>
        ↑ Up
      </button>
      <button className="fm-btn fm-btn-sm" onClick={onNewList}>
        New List
      </button>
      <button className="fm-btn fm-btn-sm" onClick={onNewFolder}>
        New Folder
      </button>
      <button className="fm-btn fm-btn-sm" onClick={onImportCsv}>
        Import CSV
      </button>
      <div className="fm-toolbar-sep" />
      <button className="fm-btn fm-btn-sm" onClick={onCompleted}>
        Completed
      </button>
      <button className="fm-btn fm-btn-sm" onClick={onSettings}>
        Settings
      </button>
      <button className={`fm-btn fm-btn-sm${selectMode ? " active" : ""}`} onClick={onToggleSelect}>
        {selectMode ? "Cancel Select" : "Select"}
      </button>
      <div className="fm-toolbar-sep" />
      <ViewModeControls
        openTarget={openTarget}
        folderView={folderView}
        currentDisplay={currentDisplay}
        location={location}
        entryKeys={entryKeys}
        onFolderViewChange={onFolderViewChange}
        onListDisplayChange={onListDisplayChange}
        onAutoOrganize={onAutoOrganize}
      />
      <div className="fm-toolbar-spacer" />
      <input
        className="fm-input"
        style={{ width: 180 }}
        placeholder="Search folders, lists, items…"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchActive && (
        <button className="fm-btn fm-btn-sm" onClick={onClearSearch}>
          Clear
        </button>
      )}
    </div>
  )
}
