/**
 * components/ItemDetail/draft/useItemDetailUnloadGuard.ts — Item detail across a reload
 *
 * While a detail surface is open, its item id is pinned (`brain2-item-detail-dock`).
 * Refresh or a closed window saves the live draft and leaves that pin, so the
 * next load opens the minimized dock instead of the full editor. Closing the
 * surface (Back, or the popup ×) drops the pin. Another open detail keeps it.
 *
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useEffect, useRef } from "react"
import { flushScheduledPersist } from "@/lib/persist-storage"
import { persistKey, readAliasedLocal, removeAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

const DOCK_KEY = persistKey("item-detail-dock")

/** How many open surfaces are showing each item. The pin follows whoever is still open. */
const openCounts = new Map<string, number>()

export function readItemDetailDock(): string | null {
  if (typeof window === "undefined") return null
  const stored = readAliasedLocal(DOCK_KEY)
  return stored && stored.length > 0 ? stored : null
}

export function clearItemDetailDock(id?: string): void {
  if (typeof window === "undefined") return
  if (id && readItemDetailDock() !== id) return
  removeAliasedLocal(DOCK_KEY)
}

/** Test helper. A leaked holder would keep the next close from dropping the pin. */
export function resetItemDetailSessionForTests(): void {
  openCounts.clear()
}

function retainItem(id: string): void {
  openCounts.set(id, (openCounts.get(id) ?? 0) + 1)
  writeItemDetailDock(id)
}

function releaseItem(id: string): void {
  const next = (openCounts.get(id) ?? 1) - 1
  if (next <= 0) openCounts.delete(id)
  else openCounts.set(id, next)
  if (openCounts.size === 0) {
    clearItemDetailDock()
    return
  }
  const pinned = readItemDetailDock()
  if (pinned && openCounts.has(pinned)) return
  const still = openCounts.keys().next().value
  if (still) writeItemDetailDock(still)
}

export function writeItemDetailDock(id: string): void {
  writeAliasedLocal(DOCK_KEY, id)
}

/**
 * Remember `itemId` while `active`. Save on the way out of the page.
 * The browser does not ask to leave — the draft is written instead.
 */
export function useItemDetailSession(active: boolean, itemId: string | null, save: () => void): void {
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (!active || !itemId) return
    retainItem(itemId)
    let leavingPage = false
    const persist = () => {
      leavingPage = true
      saveRef.current()
      flushScheduledPersist()
    }
    window.addEventListener("pagehide", persist)
    window.addEventListener("beforeunload", persist)
    return () => {
      window.removeEventListener("pagehide", persist)
      window.removeEventListener("beforeunload", persist)
      if (!leavingPage) releaseItem(itemId)
    }
  }, [active, itemId])
}
