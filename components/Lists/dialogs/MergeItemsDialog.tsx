"use client"

import { useEffect, useMemo, useState } from "react"
import type { List, Task } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { uniqueNonEmpty } from "@/lib/list-merge"
import { defaultItemMergePlan, itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MergeFieldGroup, MergeKeepCheckbox, MergeMembershipToggles } from "./MergeFieldGroup"

export interface MergeItemsDialogProps {
  open: boolean
  items: Task[]
  lists: List[]
  onClose: () => void
  onMerge: (plan: ItemMergePlan) => void
}

export function MergeItemsDialog({ open, items, lists, onClose, onMerge }: MergeItemsDialogProps) {
  const [plan, setPlan] = useState<ItemMergePlan | null>(() => defaultItemMergePlan(items, lists))

  useEffect(() => {
    if (open) setPlan(defaultItemMergePlan(items, lists))
  }, [open, items, lists])

  const titles = useMemo(() => uniqueNonEmpty(items.map(itemMergeLabel)), [items])
  const notes = useMemo(() => uniqueNonEmpty(items.map((item) => item.notes)), [items])
  const whys = useMemo(() => uniqueNonEmpty(items.map((item) => item.why)), [items])
  const membershipLists = useMemo(() => {
    const wanted = new Set(plan?.listIds ?? [])
    const involved = new Set(items.flatMap((item) => item.lists ?? []))
    return lists.filter(
      (l) =>
        (wanted.has(l.id) || involved.has(l.id)) &&
        !isFolderAllItemsCategoryId(l.id) &&
        !isNaSmartCategoryId(l.id),
    )
  }, [lists, items, plan?.listIds])

  if (!plan) return null

  const patch = (partial: Partial<ItemMergePlan>) => setPlan({ ...plan, ...partial })
  const toggleList = (listId: string, on: boolean) => {
    const listIds = on ? [...plan.listIds, listId] : plan.listIds.filter((id) => id !== listId)
    patch({ listIds })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="fm98-dialog sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge items</DialogTitle>
          <DialogDescription>
            Combine {items.length} items into one survivor. Every attribute from the selected items is combined onto
            that survivor (tags, lists, custom fields, links, and the rest). Extra item records are removed after the
            merge — a later search will not find them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <MergeKeepCheckbox
            label="Keep all details"
            checked={plan.keepAllDetails}
            onChange={(keepAllDetails) => patch({ keepAllDetails })}
          />
          <MergeFieldGroup
            label="Title"
            radioName="merge-item-title"
            options={titles}
            value={plan.description}
            onChange={(description) => patch({ description: description ?? "" })}
            inputFallback
          />
          {notes.length > 0 && (
            <MergeFieldGroup
              label="Notes"
              radioName="merge-item-notes"
              options={notes}
              value={plan.notes}
              onChange={(notesValue) => patch({ notes: notesValue })}
              allowNone
              keepAllHint={
                plan.keepAllDetails
                  ? "Every note is kept. The selected one is placed first."
                  : undefined
              }
            />
          )}
          {whys.length > 0 && (
            <MergeFieldGroup
              label="Why"
              radioName="merge-item-why"
              options={whys}
              value={plan.why}
              onChange={(why) => patch({ why })}
              allowNone
              keepAllHint={
                plan.keepAllDetails
                  ? "Every why is kept. The selected one is placed first."
                  : undefined
              }
            />
          )}
          <MergeMembershipToggles
            label="Lists"
            hint="The merged item can belong to more than one list."
            items={membershipLists.map((l) => ({ id: l.id, name: l.name }))}
            selectedIds={plan.listIds}
            onToggle={toggleList}
            emptyMessage="No lists yet."
          />
          <MergeKeepCheckbox
            label="Preserve attributes from every item"
            checked={plan.preserveAttributes}
            onChange={(preserveAttributes) => patch({ preserveAttributes })}
          />
          <MergeKeepCheckbox
            label="Preserve tags from every item"
            checked={plan.preserveTags}
            onChange={(preserveTags) => patch({ preserveTags })}
          />
          <MergeKeepCheckbox
            label="Preserve links from every item"
            checked={plan.preserveLinks}
            onChange={(preserveLinks) => patch({ preserveLinks })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onMerge(plan)} disabled={!plan.description.trim()}>
              Merge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
