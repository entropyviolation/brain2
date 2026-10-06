/**
 * Shared select-mode action chrome — count CRT, select/deselect, keep/move,
 * merge/delete. Destination picker stays a slot in each public toolbar.
 */
"use client"

import type { ReactNode } from "react"

export function SelectModeActionChrome({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  placementName,
  placementMode,
  onPlacementModeChange,
  keepLabel,
  moveLabel,
  moveDisabled,
  moveTitle,
  onMerge,
  mergeLabel,
  mergeDisabled,
  mergeTitle,
  onDelete,
  beforeMerge,
  afterMerge,
}: {
  selectedCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  placementName: string
  placementMode: "keep" | "move"
  onPlacementModeChange: (mode: "keep" | "move") => void
  keepLabel: string
  moveLabel: string
  moveDisabled: boolean
  moveTitle?: string
  onMerge: () => void
  mergeLabel: string
  mergeDisabled: boolean
  mergeTitle: string
  onDelete: () => void
  /** e.g. Add to New Folder / Add to New List — rendered before Merge. */
  beforeMerge?: ReactNode
  /** e.g. Duplicate selection — rendered after Merge, before Delete. */
  afterMerge?: ReactNode
}) {
  return (
    <>
      <span className="fm-crt-count">{selectedCount} selected</span>
      <button type="button" className="fm-btn fm-btn-sm" onClick={onSelectAll}>
        Select All
      </button>
      <button
        type="button"
        className="fm-btn fm-btn-sm"
        onClick={onDeselectAll}
        disabled={selectedCount === 0}
      >
        Deselect All
      </button>
      <div className="fm-toolbar-sep" />
      <label className="fm-radio-row" style={{ padding: "0 4px" }}>
        <input
          type="radio"
          name={placementName}
          checked={placementMode === "keep"}
          onChange={() => onPlacementModeChange("keep")}
        />
        {keepLabel}
      </label>
      <label className="fm-radio-row" style={{ padding: "0 4px" }} title={moveTitle}>
        <input
          type="radio"
          name={placementName}
          checked={placementMode === "move"}
          disabled={moveDisabled}
          onChange={() => onPlacementModeChange("move")}
        />
        {moveLabel}
      </label>
      <div className="fm-toolbar-sep" />
      {beforeMerge}
      <button
        type="button"
        className="fm-btn fm-btn-sm"
        onClick={onMerge}
        disabled={mergeDisabled}
        title={mergeTitle}
      >
        {mergeLabel}
      </button>
      {afterMerge}
      <button
        type="button"
        className="fm-btn fm-btn-sm fm-btn-danger"
        onClick={onDelete}
        disabled={selectedCount === 0}
      >
        Delete selected
      </button>
    </>
  )
}
