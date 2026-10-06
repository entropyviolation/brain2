"use client"

import { useEffect, useMemo, useState } from "react"
import type { Folder, List, Task } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { defaultMergePlan, uniqueNonEmpty, type ListMergePlan } from "@/lib/list-merge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MergeFieldGroup, MergeKeepCheckbox, MergeMembershipToggles } from "./MergeFieldGroup"

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
          <MergeKeepCheckbox
            label="Keep all items"
            checked={plan.keepAllItems}
            onChange={(keepAllItems) => patch({ keepAllItems })}
          />
          <MergeFieldGroup
            label="Title"
            radioName="merge-title"
            options={titles}
            value={plan.name}
            onChange={(name) => patch({ name: name ?? "" })}
            inputFallback
            optionAlign="center"
          />
          {colors.length > 1 && (
            <MergeFieldGroup
              label="Color"
              radioName="merge-color"
              options={colors}
              value={plan.color}
              onChange={(color) => patch({ color: color ?? plan.color })}
              optionAlign="center"
              renderOption={(color) => (
                <>
                  <span className="inline-block h-4 w-4 rounded-sm border" style={{ background: color }} />
                  {color}
                </>
              )}
            />
          )}
          {descriptions.length > 0 && (
            <MergeFieldGroup
              label="Description"
              radioName="merge-desc"
              options={descriptions}
              value={plan.description}
              onChange={(description) => patch({ description })}
              allowNone
            />
          )}
          {labels.length > 1 && (
            <MergeFieldGroup
              label="Item label"
              radioName="merge-label"
              options={labels}
              value={plan.itemLabel}
              onChange={(itemLabel) => patch({ itemLabel: itemLabel ?? plan.itemLabel })}
              optionAlign="center"
              renderOption={(itemLabel) => itemLabel}
            />
          )}
          <MergeMembershipToggles
            label="Folders"
            hint="The merged list can live in more than one folder."
            items={userFolders.map((f) => ({ id: f.id, name: f.name }))}
            selectedIds={plan.folderIds}
            onToggle={toggleFolder}
            emptyMessage="No folders yet."
          />
          <MergeKeepCheckbox
            label="Send to Scheduler"
            checked={plan.scheduleable}
            onChange={(scheduleable) => patch({ scheduleable })}
          />
          <MergeKeepCheckbox
            label="Preserve attributes from every list"
            checked={plan.preserveAttributes}
            onChange={(preserveAttributes) => patch({ preserveAttributes })}
          />
          <MergeKeepCheckbox
            label="Preserve rules from every list"
            checked={plan.preserveRules}
            onChange={(preserveRules) => patch({ preserveRules })}
          />
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
