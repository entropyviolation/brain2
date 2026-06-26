"use client"

import type React from "react"
import type { GridEntry } from "@/components/Lists/types"
import { FolderGlyph, iconFor, orbFor } from "@/components/Lists/lib/icon-utils"

export interface FolderViewListProps {
  entries: GridEntry[]
  activeIconId: string | null
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnEntry: (e: React.DragEvent, entry: GridEntry) => void
  clearDrag: () => void
  setActiveIconId: (id: string) => void
  openEntry: (entry: GridEntry) => void
}

export function FolderViewList({
  entries,
  activeIconId,
  handleCategoryDragStart,
  handleDragOver,
  handleDropOnEntry,
  clearDrag,
  setActiveIconId,
  openEntry,
}: FolderViewListProps) {
  return (
    <div className="fm-sunken">
      <div className="fm-linklist">
        {entries.map((entry) => (
          <div
            key={`${entry.kind}-${entry.id}`}
            className={`fm-link-row${activeIconId === entry.id ? " selected" : ""}`}
            draggable={entry.kind === "list"}
            onDragStart={(e) => entry.kind === "list" && handleCategoryDragStart(e, entry.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnEntry(e, entry)}
            onDragEnd={clearDrag}
            onClick={() => setActiveIconId(entry.id)}
            onDoubleClick={() => openEntry(entry)}
          >
            {entry.kind === "folder" && !entry.icon ? (
              <FolderGlyph size={22} color={entry.color} />
            ) : (
              <img
                className="fm-link-icon"
                src={entry.kind === "smart" || entry.kind === "habits" || entry.kind === "objectives" ? orbFor(entry.id) : iconFor(entry.id, entry.icon)}
                alt=""
                draggable={false}
              />
            )}
            <span className="fm-link-text">{entry.name}</span>
            <span className="fm-icon-badge">{entry.count}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="fm-empty">
            <p>This location is empty.</p>
          </div>
        )}
      </div>
    </div>
  )
}
