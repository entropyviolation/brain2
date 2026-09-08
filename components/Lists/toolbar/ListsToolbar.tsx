"use client"

import { useEffect, useRef, useState } from "react"
import type { FolderView } from "@/lib/lists-ui-store"
import type { ListDisplayMode } from "@/lib/types"
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
  enabledDisplays?: ListDisplayMode[]
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
  enabledDisplays,
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
      <button className="fm-btn fm-btn-sm" onClick={onImportCsv} title="Import CSV, TSV, or Excel spreadsheet">
        Import spreadsheet
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
        enabledDisplays={enabledDisplays}
        onFolderViewChange={onFolderViewChange}
        onListDisplayChange={onListDisplayChange}
        onAutoOrganize={onAutoOrganize}
      />
      <div className="fm-toolbar-spacer" />
      <ToolbarSearch value={searchTerm} onChange={onSearchChange} />
      {searchActive && (
        <button className="fm-btn fm-btn-sm" onClick={onClearSearch}>
          Clear
        </button>
      )}
    </div>
  )
}

/** Owns typed text so the Lists board does not re-render on every keystroke. */
function ToolbarSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText(value)
    if (timer.current) clearTimeout(timer.current)
  }, [value])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <input
      className="fm-input"
      style={{ width: 180 }}
      placeholder="Search folders, lists, items…"
      value={text}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => onChange(next), 150)
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return
        if (timer.current) clearTimeout(timer.current)
        onChange(text)
      }}
    />
  )
}
