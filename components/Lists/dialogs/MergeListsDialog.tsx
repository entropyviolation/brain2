"use client"

import { useEffect, useMemo, useState } from "react"
import type { Folder, List, Task } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { defaultMergePlan, uniqueNonEmpty, type ListMergePlan } from "@/lib/list-merge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface MergeListsDialogProps {
  open: boolean
  lists: List[]
  folders: Folder[]
  tasks: Task[]
  onClose: () => void
  onMerge: (plan: ListMergePlan) => void
}

export function MergeListsDialog({ open, lists, folders, tasks, onClose, onMerge }: MergeListsDialogProps) {
  const [plan, setPlan] = useState<ListMergePlan | null>(() => defaultMergePlan(lists, folders))

  useEffect(() => {
    if (open) setPlan(defaultMergePlan(lists, folders))
  }, [open, lists, folders])

  const titles = useMemo(() => uniqueNonEmpty(lists.map((l) => l.name)), [lists])
  const colors = useMemo(() => uniqueNonEmpty(lists.map((l) => l.color)), [lists])
  const descriptions = useMemo(() => uniqueNonEmpty(lists.map((l) => l.description)), [lists])
  const labels = useMemo(() => uniqueNonEmpty(lists.map((l) => l.itemLabel)), [lists])
  const userFolders = useMemo(() => folders.filter((f) => !isScheduledFolderId(f.id)), [folders])
  const itemCount = useMemo(() => {
    const ids = new Set(lists.map((l) => l.id))
    return tasks.filter((t) => (t.lists ?? []).some((id) => ids.has(id))).length
  }, [lists, tasks])

  if (!plan) return null

  const patch = (partial: Partial<ListMergePlan>) => setPlan({ ...plan, ...partial })
  const toggleFolder = (folderId: string, on: boolean) => {
    const folderIds = on ? [...plan.folderIds, folderId] : plan.folderIds.filter((id) => id !== folderId)
    patch({ folderIds })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="fm98-dialog sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge lists</DialogTitle>
          <DialogDescription>
            Combine {lists.length} lists. {itemCount} item{itemCount === 1 ? "" : "s"} involved. Choose what to keep on
            the merged list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.keepAllItems}
              onChange={(e) => patch({ keepAllItems: e.target.checked })}
            />
            Keep all items
          </label>
          <div className="space-y-2">
            <Label>Title</Label>
            {titles.length > 1 ? (
              titles.map((name) => (
                <label key={name} className="flex items-center gap-2">
                  <input type="radio" name="merge-title" checked={plan.name === name} onChange={() => patch({ name })} />
                  {name}
                </label>
              ))
            ) : (
              <Input value={plan.name} onChange={(e) => patch({ name: e.target.value })} />
            )}
          </div>
          {colors.length > 1 && (
            <div className="space-y-2">
              <Label>Color</Label>
              {colors.map((color) => (
                <label key={color} className="flex items-center gap-2">
                  <input type="radio" name="merge-color" checked={plan.color === color} onChange={() => patch({ color })} />
                  <span className="inline-block h-4 w-4 rounded-sm border" style={{ background: color }} />
                  {color}
                </label>
              ))}
            </div>
          )}
          {descriptions.length > 0 && (
            <div className="space-y-2">
              <Label>Description</Label>
              <label className="flex items-center gap-2">
                <input type="radio" name="merge-desc" checked={!plan.description} onChange={() => patch({ description: undefined })} />
                None
              </label>
              {descriptions.map((description) => (
                <label key={description} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="merge-desc"
                    checked={plan.description === description}
                    onChange={() => patch({ description })}
                  />
                  <span>{description}</span>
                </label>
              ))}
            </div>
          )}
          {labels.length > 1 && (
            <div className="space-y-2">
              <Label>Item label</Label>
              {labels.map((itemLabel) => (
                <label key={itemLabel} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="merge-label"
                    checked={plan.itemLabel === itemLabel}
                    onChange={() => patch({ itemLabel })}
                  />
                  {itemLabel}
                </label>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label>Folders</Label>
            <p className="text-xs text-muted-foreground">The merged list can live in more than one folder.</p>
            {userFolders.map((folder) => (
              <label key={folder.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={plan.folderIds.includes(folder.id)}
                  onChange={(e) => toggleFolder(folder.id, e.target.checked)}
                />
                {folder.name}
              </label>
            ))}
            {userFolders.length === 0 && <p className="text-xs text-muted-foreground">No folders yet.</p>}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.scheduleable}
              onChange={(e) => patch({ scheduleable: e.target.checked })}
            />
            Scheduleable
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.preserveAttributes}
              onChange={(e) => patch({ preserveAttributes: e.target.checked })}
            />
            Preserve attributes from every list
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.preserveRules}
              onChange={(e) => patch({ preserveRules: e.target.checked })}
            />
            Preserve rules from every list
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onMerge(plan)} disabled={!plan.name.trim()}>
              Merge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
