"use client"

import type React from "react"
import type { GridEntry } from "@/components/Lists/types"

export interface FolderViewDetailsProps {
  entries: GridEntry[]
  activeIconId: string | null
  handleCategoryDragStart: (e: React.DragEvent, id: string) => void
  setActiveIconId: (id: string) => void
  openEntry: (entry: GridEntry) => void
  getCategoryCompletionRate: (id: string) => number
}

export function FolderViewDetails({
  entries,
  activeIconId,
  handleCategoryDragStart,
  setActiveIconId,
  openEntry,
  getCategoryCompletionRate,
}: FolderViewDetailsProps) {
  return (
    <div className="fm-sunken">
      <table className="fm-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Items</th>
            <th>Complete</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
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
              <td>{entry.kind === "folder" ? "Folder" : entry.kind === "smart" ? "Smart List" : entry.kind === "objectives" ? "Objectives" : entry.kind === "habits" ? "Habits" : "List"}</td>
              <td>{entry.kind === "folder" ? `${entry.count} lists` : `${entry.count} active`}</td>
              <td>{entry.kind === "list" ? `${getCategoryCompletionRate(entry.id)}%` : "—"}</td>
            </tr>
          ))}
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
