"use client"

import { useEffect, useMemo, useState } from "react"
import type { List, Task } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { uniqueNonEmpty } from "@/lib/list-merge"
import { defaultItemMergePlan, itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
            Combine {items.length} items into one. Choose what to keep on the merged item. Extra item records are
            removed after the merge.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.keepAllDetails}
              onChange={(e) => patch({ keepAllDetails: e.target.checked })}
            />
            Keep all details
          </label>
          <div className="space-y-2">
            <Label>Title</Label>
            {titles.length > 1 ? (
              titles.map((description) => (
                <label key={description} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="merge-item-title"
                    checked={plan.description === description}
                    onChange={() => patch({ description })}
                  />
                  <span>{description}</span>
                </label>
              ))
            ) : (
              <Input value={plan.description} onChange={(e) => patch({ description: e.target.value })} />
            )}
          </div>
          {notes.length > 0 && (
            <div className="space-y-2">
              <Label>Notes</Label>
              <label className="flex items-center gap-2">
                <input type="radio" name="merge-item-notes" checked={!plan.notes} onChange={() => patch({ notes: undefined })} />
                None
              </label>
              {notes.map((value) => (
                <label key={value} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="merge-item-notes"
                    checked={plan.notes === value}
                    onChange={() => patch({ notes: value })}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          )}
          {whys.length > 0 && (
            <div className="space-y-2">
              <Label>Why</Label>
              <label className="flex items-center gap-2">
                <input type="radio" name="merge-item-why" checked={!plan.why} onChange={() => patch({ why: undefined })} />
                None
              </label>
              {whys.map((value) => (
                <label key={value} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="merge-item-why"
                    checked={plan.why === value}
                    onChange={() => patch({ why: value })}
                  />
                  <span>{value}</span>
                </label>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Label>Lists</Label>
            <p className="text-xs text-muted-foreground">The merged item can belong to more than one list.</p>
            {membershipLists.map((list) => (
              <label key={list.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={plan.listIds.includes(list.id)}
                  onChange={(e) => toggleList(list.id, e.target.checked)}
                />
                {list.name}
              </label>
            ))}
            {membershipLists.length === 0 && <p className="text-xs text-muted-foreground">No lists yet.</p>}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.preserveAttributes}
              onChange={(e) => patch({ preserveAttributes: e.target.checked })}
            />
            Preserve attributes from every item
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.preserveTags}
              onChange={(e) => patch({ preserveTags: e.target.checked })}
            />
            Preserve tags from every item
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.preserveLinks}
              onChange={(e) => patch({ preserveLinks: e.target.checked })}
            />
            Preserve links from every item
          </label>
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
