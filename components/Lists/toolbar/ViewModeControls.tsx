"use client"

import type { FolderView, ListDisplay } from "@/lib/lists-ui-store"
import type { ListDisplayMode } from "@/lib/types"
import type { OpenTarget } from "@/components/Lists/types"
import { openTargetKey } from "@/components/Lists/open-target"

export interface ViewModeControlsProps {
  openTarget: OpenTarget
  folderView: FolderView
  currentDisplay: ListDisplay
  location: string
  entryKeys: string[]
  /** Which display modes the open list offers; undefined = all modes. */
  enabledDisplays?: ListDisplayMode[]
  onFolderViewChange: (view: FolderView) => void
  onListDisplayChange: (key: string, display: ListDisplay) => void
  onAutoOrganize: () => void
}

export function ViewModeControls({
  openTarget,
  folderView,
  currentDisplay,
  enabledDisplays,
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

  if (openTarget.type === "habits" || openTarget.type === "objectives") return null

  const allModes: ListDisplay[] = ["default", "checklist", "icons", "table", "spreadsheet", "kanban"]
  // Only filter for real lists (which carry `enabledDisplays`); smart lists and
  // folder "All Items" views always offer every mode.
  const modes =
    openTarget.type === "category" && enabledDisplays && enabledDisplays.length > 0
      ? allModes.filter((d) => enabledDisplays.includes(d))
      : allModes

  return (
    <>
      <span style={{ fontSize: 11 }}>Display:</span>
      {modes.map((d) => (
        <button
          key={d}
          className={`fm-btn fm-btn-sm${currentDisplay === d ? " active" : ""}`}
          onClick={() => onListDisplayChange(openTargetKey(openTarget), d)}
        >
          {d === "table"
            ? "Details"
            : d === "spreadsheet"
              ? "Spreadsheet"
              : d === "kanban"
                ? "Kanban"
                : d[0].toUpperCase() + d.slice(1)}
        </button>
      ))}
    </>
  )
}
