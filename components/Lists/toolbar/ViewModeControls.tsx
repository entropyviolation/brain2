"use client"

import type { FolderView, ListDisplay } from "@/lib/lists-ui-store"
import { LIST_DISPLAY_MODES, type ListDisplayMode } from "@/lib/types"
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

const FOLDER_VIEWS: { id: FolderView; full: string; abbr: string }[] = [
  { id: "icons", full: "Icons", abbr: "Icons" },
  { id: "list", full: "List", abbr: "List" },
  { id: "details", full: "Details", abbr: "Det" },
  { id: "cards", full: "Cards", abbr: "Cards" },
]

const LIST_DISPLAY_KEYS: { id: ListDisplay; full: string; abbr: string }[] = [
  { id: "default", full: "Default", abbr: "Def" },
  { id: "checklist", full: "Checklist", abbr: "Check" },
  { id: "icons", full: "Icons", abbr: "Icon" },
  { id: "table", full: "Details", abbr: "Det" },
  { id: "spreadsheet", full: "Spreadsheet", abbr: "Sheet" },
]

function ModeKey({
  full,
  abbr,
  active,
  onClick,
}: {
  full: string
  abbr: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={full}
      title={full}
      className={`fm-btn fm-btn-sm fm-view-key${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="fm-view-key-led" aria-hidden="true" />
      <span className="fm-view-key-label">
        <span className="fm-view-key-full">{full}</span>
        <span className="fm-view-key-abbr">{abbr}</span>
      </span>
    </button>
  )
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
      <div className="fm-mode-deck" data-ui-name="View">
        <span className="fm-nameplate">View</span>
        <div className="fm-view-keys" role="radiogroup" aria-label="Folder view">
          {FOLDER_VIEWS.map((v) => (
            <ModeKey
              key={v.id}
              full={v.full}
              abbr={v.abbr}
              active={folderView === v.id}
              onClick={() => onFolderViewChange(v.id)}
            />
          ))}
        </div>
        {folderView === "icons" && (
          <>
            <div className="fm-toolbar-sep" role="separator" aria-label="Organize" />
            <button className="fm-btn fm-btn-sm" title="Reset icon positions to a tidy grid" onClick={onAutoOrganize}>
              Auto-organize
            </button>
          </>
        )}
      </div>
    )
  }

  if (openTarget.type === "habits" || openTarget.type === "objectives") return null

  const allModes: ListDisplay[] = [...LIST_DISPLAY_MODES]
  // Only filter for real lists (which carry `enabledDisplays`); smart lists and
  // folder "All Items" views always offer every mode.
  const modes =
    openTarget.type === "category" && enabledDisplays && enabledDisplays.length > 0
      ? allModes.filter((d) => enabledDisplays.includes(d))
      : allModes

  const keys = LIST_DISPLAY_KEYS.filter((k) => modes.includes(k.id))

  return (
    <div className="fm-mode-deck" data-ui-name="Display">
      <span className="fm-nameplate">Display</span>
      <div className="fm-view-keys" role="radiogroup" aria-label="List display">
        {keys.map((k) => (
          <ModeKey
            key={k.id}
            full={k.full}
            abbr={k.abbr}
            active={currentDisplay === k.id}
            onClick={() => onListDisplayChange(openTargetKey(openTarget), k.id)}
          />
        ))}
      </div>
    </div>
  )
}
