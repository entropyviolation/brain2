/**
 * components/friend-details/use-item-detail-popup.ts — Load item detail when a mission task opens
 *
 * The header mission sheet and the mission card share this. The popup module
 * loads when an item id is set, so a refresh does not parse item detail with
 * the friend UI. Home widgets use `components/Home/use-item-detail-popup.ts`,
 * which skips a second load once the popup is already in state. To Do item
 * detail stays on `components/ItemDetail/draft/useItemDetailDraft.ts`.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"

type ItemPopup = ComponentType<{
  taskId: string | null
  open: boolean
  onClose: () => void
  stackAbove?: boolean
}>

export function useItemDetailPopup(itemId: string | null) {
  const [Popup, setPopup] = useState<ItemPopup | null>(null)

  useEffect(() => {
    if (!itemId) return
    let live = true
    void import("@/components/ItemDetail/ItemDetailPopup").then((mod) => {
      if (live) setPopup(() => mod.TaskDetailPopup)
    })
    return () => {
      live = false
    }
  }, [itemId])

  return Popup
}
