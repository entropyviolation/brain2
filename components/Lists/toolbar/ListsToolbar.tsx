"use client"

import type { FolderView } from "@/lib/lists-ui-store"
import type { ListDisplayMode } from "@/lib/types"
import type { OpenTarget } from "@/components/Lists/types"
import { ToolbarSearch } from "./ToolbarSearch"
import { ViewModeControls } from "./ViewModeControls"

export interface ListsToolbarProps {
  openTarget: OpenTarget
  isHome: boolean
  isAll: boolean
  searchResetKey: number
  searchActive: boolean
  selectMode: boolean
  folderView: FolderView
  currentDisplay: import("@/lib/lists-ui-store").ListDisplay
  location: string
  entryKeys: string[]
  enabledDisplays?: ListDisplayMode[]
  onUp: () => void
  onNewList: () => void
  onNewFolder: () => void
  onImportCsv: () => void
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
  searchResetKey,
  searchActive,
  selectMode,
  folderView,
  currentDisplay,
  location,
  entryKeys,
  enabledDisplays,
  onUp,
  onNewList,
  onNewFolder,
  onImportCsv,
  onSettings,
  onToggleSelect,
  onSearchChange,
  onClearSearch,
  onFolderViewChange,
  onListDisplayChange,
  onAutoOrganize,
}: ListsToolbarProps) {
  return (
    <div className="fm-toolbar-stack">
      <div className="fm-toolbar">
        <button className="fm-btn fm-btn-sm" disabled={!openTarget && (isHome || isAll)} onClick={onUp}>
          ↑ Up
        </button>
        <div className="fm-toolbar-sep" role="separator" aria-label="New" />
        <button className="fm-btn fm-btn-sm" onClick={onNewList}>
          New List
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onNewFolder}>
          New Folder
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onImportCsv} title="Import CSV, TSV, or Excel spreadsheet">
          Import spreadsheet
        </button>
        <div className="fm-toolbar-sep" role="separator" />
        <button className="fm-btn fm-btn-sm" onClick={onSettings}>
          Settings
        </button>
        <button className={`fm-btn fm-btn-sm${selectMode ? " active" : ""}`} onClick={onToggleSelect}>
          {selectMode ? "Cancel Select" : "Select"}
        </button>
        <div className="fm-toolbar-spacer" />
        <ToolbarSearch resetKey={searchResetKey} onChange={onSearchChange} />
        {searchActive && (
          <button className="fm-btn fm-btn-sm" onClick={onClearSearch}>
            Clear
          </button>
        )}
      </div>
      <div className="fm-toolbar fm-toolbar-modes">
        <ViewModeControls
          openTarget={openTarget}
          folderView={folderView}
          currentDisplay={currentDisplay}
          location={location}
          entryKeys={entryKeys}
          enabledDisplays={enabledDisplays}
          onFolderViewChange={onFolderViewChange}
          onListDisplayChange={onListDisplayChange}
          onAutoOrganize={onAutoOrganize}
        />
      </div>
    </div>
  )
}
