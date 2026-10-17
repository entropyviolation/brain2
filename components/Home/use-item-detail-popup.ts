/**
 * components/Home/use-item-detail-popup.ts — Load item detail on first open
 *
 * Home widgets open an item over their own dialog. The popup module loads
 * the first time an item id is set, so a refresh does not parse item detail
 * with the Home strip. Same pattern as `components/friend-mission-sheet.tsx`.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"

export type ItemDetailPopupComponent = ComponentType<{
  taskId: string | null
  open: boolean
  onClose: () => void
  stackAbove?: boolean
}>

export function useItemDetailPopup(itemId: string | null): ItemDetailPopupComponent | null {
  const [Popup, setPopup] = useState<ItemDetailPopupComponent | null>(null)

  useEffect(() => {
    if (!itemId || Popup) return
    let live = true
    void import("@/components/ItemDetail/ItemDetailPopup").then((mod) => {
      if (live) setPopup(() => mod.TaskDetailPopup)
    })
    return () => {
      live = false
    }
  }, [itemId, Popup])

  return Popup
}
