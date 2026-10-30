/**
 * components/Inventory/inventory-scenes.ts — Scene contract for the Inventory room
 *
 * Later streams import this module. Bookshelf names one list. Closet does not:
 * its pieces live in `useWardrobeStore` (`lib/wardrobe.ts`). Kitchen does not:
 * stock lives in `useKitchenStore` (`lib/kitchen-store.ts`). Shopping names
 * named views. Those views live in `shopping/shop-bindings.ts`.
 * Gems and Trinkets has no list: it counts finished daily habits and tasks.
 *
 * `coverAttrId` is an optional cover-attribute override for a later stream.
 * This stream persists the scene and the bookshelf list id only.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import {
  APP_NAV_KEYS,
  readStoredId,
  readStoredTab,
  writeStoredId,
  writeStoredTab,
} from "@/lib/app-navigation"
import { subscribeNavRestore } from "@/lib/screen-location"
import { usePersistedTab } from "@/lib/use-persisted-tab"

export const INVENTORY_SCENE_IDS = ["bookshelf", "closet", "kitchen", "shopping", "gems"] as const

export type InventorySceneId = (typeof INVENTORY_SCENE_IDS)[number]

/** Bookshelf names one list. `coverAttrId` is not written by this stream. */
export interface BookshelfBinding {
  listId: string
  coverAttrId?: string
}

/** Closet has no list. The wardrobe store is implicit. */
export interface ClosetBinding {
  scene: "closet"
}

/** Kitchen has no list. The kitchen store is implicit. */
export interface KitchenBinding {
  scene: "kitchen"
}

/** Shopping names its own views. The ids are not this binding. */
export interface ShoppingBinding {
  scene: "shopping"
}

/** Gems and Trinkets has no list. Completions are the stock. */
export interface GemsBinding {
  scene: "gems"
}

export type InventorySceneBinding =
  | (BookshelfBinding & { scene: "bookshelf" })
  | ClosetBinding
  | KitchenBinding
  | ShoppingBinding
  | GemsBinding

export interface InventorySceneMeta {
  id: InventorySceneId
  label: string
  description: string
}

export const INVENTORY_SCENES: readonly InventorySceneMeta[] = [
  { id: "bookshelf", label: "Bookshelf", description: "Items on one list." },
  { id: "closet", label: "Closet", description: "Pieces in the wardrobe." },
  { id: "kitchen", label: "Kitchen", description: "The pantry drawn as a room." },
  { id: "shopping", label: "Shopping", description: "Named lists, each drawn from one or more vault lists." },
  {
    id: "gems",
    label: "Gems and Trinkets",
    description: "Gems from finished daily habits, and trinkets from finished tasks.",
  },
]

export function readInventoryScene(): InventorySceneId {
  return readStoredTab(APP_NAV_KEYS.inventoryScene, INVENTORY_SCENE_IDS, "bookshelf")
}

export function writeInventoryScene(id: InventorySceneId): void {
  writeStoredTab(APP_NAV_KEYS.inventoryScene, id)
}

export function readBookshelfListId(): string | null {
  return readStoredId(APP_NAV_KEYS.inventoryBookshelfList)
}

export function writeBookshelfListId(id: string | null): void {
  writeStoredId(APP_NAV_KEYS.inventoryBookshelfList, id)
}

/** `listId` is `""` when no shelf list is stored. */
export function readInventoryBinding(): InventorySceneBinding {
  const scene = readInventoryScene()
  if (scene === "closet") return { scene: "closet" }
  if (scene === "kitchen") return { scene: "kitchen" }
  if (scene === "shopping") return { scene: "shopping" }
  if (scene === "gems") return { scene: "gems" }
  return { scene: "bookshelf", listId: readBookshelfListId() ?? "" }
}

export function useInventoryScene(): [InventorySceneId, (id: InventorySceneId) => void] {
  const [scene, setScene] = usePersistedTab(APP_NAV_KEYS.inventoryScene, INVENTORY_SCENE_IDS, "bookshelf")
  return [scene, setScene]
}

export function useBookshelfListId(): [string | null, (id: string | null) => void] {
  const [listId, setListIdState] = useState<string | null>(() => readBookshelfListId())

  useEffect(() => subscribeNavRestore(() => setListIdState(readBookshelfListId())), [])

  const setListId = useCallback((id: string | null) => {
    const next = id && id.length > 0 ? id : null
    writeBookshelfListId(next)
    setListIdState(next)
  }, [])

  return [listId, setListId]
}
