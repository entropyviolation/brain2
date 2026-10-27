/**
 * components/inbox/clarify/assigned-list-plates.tsx
 * Assigned lists plated by folder, with × to remove and double-click to preview.
 * Unfiled lists have no folder plate.
 */
"use client"

import { FolderGlyph } from "@/components/Lists/lib/icon-utils"
import { useTaskStore } from "@/lib/task-store"
import { assignedListFolderGroups } from "@/lib/folder-membership"
import { X } from "lucide-react"

export function AssignedListPlates({
  selected,
  onRemove,
  onPreview,
}: {
  selected: string[]
  onRemove: (id: string) => void
  onPreview: (id: string) => void
}) {
  const lists = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const groups = assignedListFolderGroups(selected, folders)
  if (groups.length === 0) return null
  return (
    <div className="inbox-clarify-assigned" aria-label="Assigned lists">
      {groups.map((group) => (
        <div key={group.key || "loose"} className="inbox-clarify-folder-group">
          {group.label ? <p className="inbox-clarify-folder">{group.label}</p> : null}
          <div className="inbox-clarify-chips">
            {group.listIds.map((id) => {
              const list = lists.find((row) => row.id === id)
              if (!list) return null
              return (
                <span
                  key={id}
                  className="inbox-clarify-chip"
                  title={`Double-click to preview ${list.name}`}
                  onDoubleClick={() => onPreview(id)}
                  onMouseDown={(event) => {
                    if (event.detail > 1) event.preventDefault()
                  }}
                >
                  <FolderGlyph size={14} color={list.color} />
                  <span className="inbox-clarify-chip-name">{list.name}</span>
                  <button
                    type="button"
                    className="inbox-clarify-chip-remove"
                    aria-label={`Remove ${list.name}`}
                    onClick={() => onRemove(id)}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
