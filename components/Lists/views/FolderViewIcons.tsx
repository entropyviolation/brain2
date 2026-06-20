"use client"

import type React from "react"
import { useState } from "react"
import type { GridEntry, IconPickerTarget } from "@/components/Lists/types"
import { PRESET_ICON_POSITIONS } from "@/components/Lists/constants"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"
import { hashIconSlot } from "@/lib/string-utils"

function renderEntryIcon(entry: GridEntry, px: number) {
  if ((entry.kind === "folder" || entry.kind === "folder-all") && !entry.icon)
    return <FolderGlyph size={px} color={entry.color} />
  const src = entry.kind === "smart" || entry.kind === "habits" ? orbFor(entry.id) : iconFor(entry.id, entry.icon)
  return <img className="fm-icon-img" src={src} alt="" draggable={false} style={{ maxWidth: px, maxHeight: px }} />
}

function iconPosKey(entry: GridEntry) {
  return `${entry.kind}-${entry.id}`
}

export interface FolderViewIconsProps {
  location: string
  entries: GridEntry[]
  isHome: boolean
  selectMode: boolean
  selectedCategories: string[]
  activeIconId: string | null
  dropTargetId: string | null
  homePinned: string[]
  getIconPosition: (location: string, key: string) => { x: number; y: number } | undefined
  setIconPosition: (location: string, key: string, x: number, y: number) => void
  handleDragOver: (e: React.DragEvent) => void
  handleIconCanvasDrop: (e: React.DragEvent) => void
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  clearDrag: () => void
  setActiveIconId: (id: string) => void
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>
  setDropTargetId: React.Dispatch<React.SetStateAction<string | null>>
  openEntry: (entry: GridEntry) => void
  toggleHomePin: (id: string) => void
  setIconPickerFor: (target: IconPickerTarget) => void
  openNewCategoryDialog: () => void
}

export function FolderViewIcons({
  location,
  entries,
  isHome,
  selectMode,
  selectedCategories,
  activeIconId,
  dropTargetId,
  homePinned,
  getIconPosition,
  setIconPosition,
  handleDragOver,
  handleIconCanvasDrop,
  handleCategoryDragStart,
  handleDropOnEntry,
  clearDrag,
  setActiveIconId,
  setSelectedCategories,
  setDropTargetId,
  openEntry,
  toggleHomePin,
  setIconPickerFor,
  openNewCategoryDialog,
}: FolderViewIconsProps) {
  const [iconLayoutDrag, setIconLayoutDrag] = useState<{
    key: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const getEntryPosition = (entry: GridEntry) => {
    const key = iconPosKey(entry)
    const stored = getIconPosition(location, key)
    if (stored) return stored
    const preset = PRESET_ICON_POSITIONS[key]
    if (preset) return preset
    return hashIconSlot(key)
  }

  return (
    <div
      key={`icons-${location}`}
      className="fm-sunken fm-desktop velvet fm-icon-canvas"
      onDragOver={handleDragOver}
      onDrop={handleIconCanvasDrop}
      onMouseMove={(e) => {
        if (!iconLayoutDrag) return
        const dx = e.clientX - iconLayoutDrag.startX
        const dy = e.clientY - iconLayoutDrag.startY
        setIconPosition(location, iconLayoutDrag.key, iconLayoutDrag.origX + dx, iconLayoutDrag.origY + dy)
      }}
      onMouseUp={() => setIconLayoutDrag(null)}
      onMouseLeave={() => setIconLayoutDrag(null)}
    >
      <div
        className="fm-icon-grid fm-icon-grid-free"
        style={{ position: "relative", minHeight: Math.max(480, Math.ceil(entries.length / 8) * 100 + 32), width: "100%" }}
      >
        {entries.map((entry) => {
          const pos = getEntryPosition(entry)
          const isSel = selectedCategories.includes(entry.id)
          const isActive = activeIconId === entry.id
          const pinned = homePinned.includes(entry.id)
          return (
            <div
              key={`${entry.kind}-${entry.id}`}
              className={`fm-icon fm-icon-free${isActive || isSel ? " selected" : ""}${dropTargetId === entry.id ? " drop-target" : ""}`}
              style={{ position: "absolute", left: pos.x, top: pos.y }}
              draggable={entry.kind === "list" && !selectMode}
              onDragStart={(e) => entry.kind === "list" && handleCategoryDragStart(e, entry.id)}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).closest(".fm-icon-pin, .fm-icon-edit")) return
                if (e.altKey || entry.kind === "folder" || entry.kind === "folder-all" || entry.kind === "smart" || entry.kind === "habits") {
                  e.preventDefault()
                  const p = getEntryPosition(entry)
                  setIconLayoutDrag({ key: iconPosKey(entry), startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y })
                }
              }}
              onDragOver={(e) => {
                handleDragOver(e)
                if (dropTargetId !== entry.id) setDropTargetId(entry.id)
              }}
              onDragLeave={() => setDropTargetId((id) => (id === entry.id ? null : id))}
              onDrop={(e) => handleDropOnEntry(e, entry)}
              onDragEnd={clearDrag}
              title={`${entry.name}${entry.kind === "list" ? "" : " (Alt+drag to move)"}`}
              onClick={() => {
                setActiveIconId(entry.id)
                if (selectMode && entry.kind === "list") {
                  setSelectedCategories((prev) => (isSel ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]))
                }
              }}
              onDoubleClick={() => !selectMode && openEntry(entry)}
            >
              {entry.kind !== "smart" && entry.kind !== "folder-all" && (
                <button
                  className={`fm-icon-pin${pinned ? " pinned" : ""}`}
                  title={pinned ? "Remove from Home" : "Add to Home"}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleHomePin(entry.id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ★
                </button>
              )}
              {entry.kind === "list" && (
                <button
                  className="fm-icon-edit"
                  title="Change icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIconPickerFor({ kind: "category", id: entry.id })
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ✎
                </button>
              )}
              {entry.kind === "folder" && (
                <button
                  className="fm-icon-edit"
                  title="Change icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIconPickerFor({ kind: "folder", id: entry.id })
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ✎
                </button>
              )}
              <div className="fm-icon-img-wrap">
                {renderEntryIcon(entry, 60)}
                {entry.color && entry.kind !== "folder-all" && <span className="fm-icon-swatch" style={{ background: entry.color }} />}
              </div>
              <span className="fm-icon-label">
                {entry.name}
                {entry.count > 0 ? ` (${entry.count})` : ""}
              </span>
            </div>
          )
        })}
        {entries.length === 0 && (
          <div className="fm-empty" style={{ color: "#fff", textShadow: "0 1px 2px #000" }}>
            <FolderGlyph size={48} />
            <p>{isHome ? "Pin lists/folders here, or create one." : "This location is empty."}</p>
            <button className="fm-btn fm-btn-sm" onClick={openNewCategoryDialog}>
              Create a list
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
