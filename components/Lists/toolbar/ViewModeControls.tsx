"use client"

import type { FolderView, ListDisplay } from "@/lib/lists-ui-store"
import type { OpenTarget } from "@/components/Lists/types"
import { openTargetKey } from "@/components/Lists/open-target"

export interface ViewModeControlsProps {
  openTarget: OpenTarget
  folderView: FolderView
  currentDisplay: ListDisplay
  location: string
  entryKeys: string[]
  onFolderViewChange: (view: FolderView) => void
  onListDisplayChange: (key: string, display: ListDisplay) => void
  onAutoOrganize: () => void
}

export function ViewModeControls({
  openTarget,
  folderView,
  currentDisplay,
  onFolderViewChange,
  onListDisplayChange,
  onAutoOrganize,
}: ViewModeControlsProps) {
  if (!openTarget) {
    return (
      <>
        <span style={{ fontSize: 11 }}>View:</span>
        {(["icons", "list", "details", "cards"] as FolderView[]).map((v) => (
          <button
            key={v}
            className={`fm-btn fm-btn-sm${folderView === v ? " active" : ""}`}
            onClick={() => onFolderViewChange(v)}
          >
            {v === "cards" ? "Cards" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        {folderView === "icons" && (
          <button className="fm-btn fm-btn-sm" title="Reset icon positions to a tidy grid" onClick={onAutoOrganize}>
            Auto-organize
          </button>
        )}
      </>
    )
  }

  if (openTarget.type === "habits") return null

  return (
    <>
      <span style={{ fontSize: 11 }}>Display:</span>
      {(["default", "checklist", "icons", "table"] as ListDisplay[]).map((d) => (
        <button
          key={d}
          className={`fm-btn fm-btn-sm${currentDisplay === d ? " active" : ""}`}
          onClick={() => onListDisplayChange(openTargetKey(openTarget), d)}
        >
          {d === "table" ? "Details" : d[0].toUpperCase() + d.slice(1)}
        </button>
      ))}
    </>
  )
}
