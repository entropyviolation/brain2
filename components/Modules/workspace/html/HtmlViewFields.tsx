/**
 * components/Modules/workspace/html/HtmlViewFields.tsx — Grants for an uploaded HTML page
 *
 * The two choices the user makes about an `html` view: which lists the page
 * may see, and whether it may edit them. Shared by the upload dialog and the
 * view editor so both say the same thing.
 */
"use client"

import { useTaskStore } from "@/lib/task-store"
import { Label } from "@/components/ui/label"

export function HtmlViewFields({
  listIds,
  canWrite,
  onListIds,
  onCanWrite,
}: {
  listIds: string[]
  canWrite: boolean
  onListIds: (ids: string[]) => void
  onCanWrite: (v: boolean) => void
}) {
  const lists = useTaskStore((s) => s.lists)
  const toggle = (id: string) => onListIds(listIds.includes(id) ? listIds.filter((x) => x !== id) : [...listIds, id])
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Lists this page can see (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Leave all unticked for a page that needs no data. A page only ever sees the lists ticked here.
        </p>
        <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
          {lists.length === 0 && <p className="text-xs text-muted-foreground">No lists yet.</p>}
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggle(l.id)} />
              <span className="truncate">{l.name}</span>
            </label>
          ))}
        </div>
      </div>
      <label className={`flex items-start gap-2 text-sm ${listIds.length ? "cursor-pointer" : "opacity-50"}`}>
        <input
          type="checkbox"
          className="mt-1"
          disabled={!listIds.length}
          checked={canWrite && listIds.length > 0}
          onChange={(e) => onCanWrite(e.target.checked)}
        />
        <span>
          Allow edits
          <span className="block text-xs text-muted-foreground">
            The page may add items to those lists, and change or complete the items on them. It can never delete.
          </span>
        </span>
      </label>
    </div>
  )
}
