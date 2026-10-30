/**
 * components/Inventory/shopping/shop-source-picker.tsx — Source lists for one view
 *
 * The item-detail list picker: search, folder rows, and a checkbox per list.
 * Selected lists sit as chips. Folder All Items records stay out of the catalog.
 */
"use client"

import { useMemo } from "react"
import { ListPicker } from "@/components/Lists/list-picker"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { useTaskStore } from "@/lib/task-store"

export function ShopSourcePicker({
  selected,
  onChange,
  viewName,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  viewName: string
}) {
  const lists = useTaskStore((state) => state.lists)
  const excludeIds = useMemo(
    () => lists.filter((list) => isFolderAllItemsCategoryId(list.id)).map((list) => list.id),
    [lists],
  )

  return (
    <div className="inv-shop-sources">
      <p className="inv-shop-sources-label">Lists</p>
      <ListPicker
        mode="multi"
        compact
        showCreate={false}
        showSelectedChips
        excludeIds={excludeIds}
        searchLabel={`Search lists for ${viewName}`}
        selected={selected}
        onChange={onChange}
      />
    </div>
  )
}
