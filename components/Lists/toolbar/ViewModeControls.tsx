"use client"

import type { FolderView, ListDisplay } from "@/lib/lists-ui-store"
import { LIST_DISPLAY_MODES, type ListDisplayMode } from "@/lib/types"
import type { OpenTarget } from "@/components/Lists/types"
import { openTargetKey } from "@/components/Lists/open-target"
import { listDisplayCaption } from "@/components/Lists/lib/velvet-icon-grid"

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
  /** Open list is on Icons desktop. Auto-organize, Gravity, and PILE UP sit in this toolbar. */
  listIconsDesktop?: boolean
  onListDesktopOrganize?: () => void
  onPileUp?: () => void
  /** Optional Gravity / connection-field mode (default off). */
  listIconsGravity?: boolean
  onListIconsGravityChange?: (on: boolean) => void
  /** Restore pre-Gravity freeform snapshot and turn Gravity off. */
  onGravityReset?: () => void
  /** Fast-forward Gravity to settled layout (keeps Gravity on). */
  onGravitySettle?: () => void
  /** Open Gravity settings (field knobs; does not toggle on/off). */
  onGravitySettings?: () => void
}

const FOLDER_VIEWS: { id: FolderView; full: string; abbr: string }[] = [
  { id: "icons", full: "Icons", abbr: "Icons" },
  { id: "list", full: "List", abbr: "List" },
  { id: "details", full: "Details", abbr: "Det" },
  { id: "cards", full: "Cards", abbr: "Cards" },
]

const LIST_DISPLAY_ABBR: Record<ListDisplay, string> = {
  default: "Def",
  checklist: "Check",
  icons: "Icon",
  table: "Det",
  spreadsheet: "Sheet",
}

const LIST_DISPLAY_KEYS: { id: ListDisplay; full: string; abbr: string }[] = (
  LIST_DISPLAY_MODES as readonly ListDisplay[]
).map((id) => ({
  id,
  full: listDisplayCaption(id),
  abbr: LIST_DISPLAY_ABBR[id],
}))

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
  listIconsDesktop = false,
  onListDesktopOrganize,
  onPileUp,
  listIconsGravity = false,
  onListIconsGravityChange,
  onGravityReset,
  onGravitySettle,
  onGravitySettings,
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
      {/*
        Reserve Auto-organize / Gravity / PILE UP space whenever Icons is the
        display — visibility-only when Desktop is off — so turning Desktop on
        does not grow the mode deck and lift the velvet stage bottom.
      */}
      {currentDisplay === "icons" && (
        <div
          className="fm-desktop-desk-keys"
          data-desktop-ready={listIconsDesktop ? "on" : "off"}
          aria-hidden={listIconsDesktop ? undefined : true}
        >
          <div className="fm-toolbar-sep" role="separator" aria-label="Organize" />
          <button
            type="button"
            className="fm-btn fm-btn-sm"
            title="Reset icon positions to a tidy grid"
            disabled={!listIconsDesktop}
            tabIndex={listIconsDesktop ? undefined : -1}
            onClick={onListDesktopOrganize}
          >
            Auto-organize
          </button>
          <button
            type="button"
            className={`fm-btn fm-btn-sm fm-gravity-key${listIconsGravity ? " active" : ""}`}
            aria-pressed={listIconsGravity}
            aria-label={listIconsGravity ? "Gravity on" : "Gravity off"}
            title={
              listIconsGravity
                ? "Gravity on — connection-field active (linked icons pull by information weight)"
                : "Gravity off — turn on connection-field (linked icons pull by information weight)"
            }
            data-ui-name="Gravity"
            disabled={!listIconsDesktop}
            tabIndex={listIconsDesktop ? undefined : -1}
            onClick={() => onListIconsGravityChange?.(!listIconsGravity)}
          >
            <span className="fm-view-key-led" aria-hidden="true" />
            <span className="fm-gravity-key-copy">
              <span className="fm-gravity-key-name">Gravity</span>
              <span className="fm-gravity-key-state" aria-hidden="true">
                {listIconsGravity ? "On" : "Off"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="fm-btn fm-btn-sm fm-gravity-settings-key"
            aria-label="Gravity settings"
            title="Gravity settings — global strength and connection-source gains"
            data-ui-name="Gravity settings"
            disabled={!listIconsDesktop}
            tabIndex={listIconsDesktop ? undefined : -1}
            onClick={() => onGravitySettings?.()}
          >
            ⚙
          </button>
          {listIconsGravity && listIconsDesktop && (
            <button
              type="button"
              className="fm-btn fm-btn-sm"
              title="Restore positions from before Gravity and turn forces off"
              onClick={onGravityReset}
            >
              Reset
            </button>
          )}
          {listIconsGravity && listIconsDesktop && (
            <button
              type="button"
              className="fm-btn fm-btn-sm"
              title="Jump the gravity field to its settled layout (keeps Gravity on)"
              onClick={onGravitySettle}
            >
              Skip to stable
            </button>
          )}
          <button
            type="button"
            className="fm-btn fm-btn-sm"
            title="Live pile physics (turns Gravity off)"
            disabled={!listIconsDesktop}
            tabIndex={listIconsDesktop ? undefined : -1}
            onClick={onPileUp}
          >
            PILE UP
          </button>
        </div>
      )}
    </div>
  )
}
