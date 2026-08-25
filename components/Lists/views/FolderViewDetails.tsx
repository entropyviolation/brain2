"use client"

import { useState } from "react"
import type React from "react"
import type { Folder } from "@/lib/types"
import type { GridEntry } from "@/components/Lists/types"
import { entryHasFolderMembership, foldersContainingEntry, formatWithinValue } from "@/lib/folder-membership"

export interface FolderViewDetailsProps {
  entries: GridEntry[]
  folders: Folder[]
  activeIconId: string | null
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  setActiveIconId: (id: string) => void
  openEntry: (entry: GridEntry) => void
  getCategoryCompletionRate: (id: string) => number
}

export function FolderViewDetails({
  entries,
  folders,
  activeIconId,
  handleCategoryDragStart,
  setActiveIconId,
  openEntry,
  getCategoryCompletionRate,
}: FolderViewDetailsProps) {
  const [listWithinNames, setListWithinNames] = useState(false)

  return (
    <div className="fm-sunken">
      <div className="fm-toolbar" style={{ marginBottom: 6, padding: "4px 8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={listWithinNames}
            onChange={(e) => setListWithinNames(e.target.checked)}
          />
          List within folder names
        </label>
      </div>
      <table className="fm-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Items</th>
            <th>Complete</th>
            <th>Within</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const containing = entryHasFolderMembership(entry.kind) ? foldersContainingEntry(entry, folders) : []
            const within = entryHasFolderMembership(entry.kind)
              ? formatWithinValue(containing, listWithinNames)
              : "—"
            return (
              <tr
                key={`${entry.kind}-${entry.id}`}
                className={activeIconId === entry.id ? "selected" : ""}
                draggable={entry.kind === "list"}
                onDragStart={(e) => entry.kind === "list" && handleCategoryDragStart(e, entry.id)}
                onClick={() => setActiveIconId(entry.id)}
                onDoubleClick={() => openEntry(entry)}
              >
                <td>
                  <span
                    style={{ display: "inline-block", width: 9, height: 9, marginRight: 6, background: entry.color || "#999" }}
                  />
                  {entry.name}
                </td>
                <td>
                  {entry.kind === "folder"
                    ? "Folder"
                    : entry.kind === "smart"
                      ? "Smart List"
                      : entry.kind === "objectives"
                        ? "Objectives"
                        : entry.kind === "habits"
                          ? "Habits"
                          : entry.kind === "folder-all"
                            ? "All Items"
                            : "List"}
                </td>
                <td>{entry.kind === "folder" ? `${entry.count} lists` : `${entry.count} active`}</td>
                <td>{entry.kind === "list" ? `${getCategoryCompletionRate(entry.id)}%` : "—"}</td>
                <td className="fm-within" title={formatWithinValue(containing, true)}>{within}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {entries.length === 0 && (
        <div className="fm-empty">
          <p>This location is empty.</p>
        </div>
      )}
    </div>
  )
}
