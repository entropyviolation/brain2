/**
 * components/Inventory/shopping/shop-bindings.ts — Persisted shopping views
 *
 * One JSON record. Version 2 is `{ v: 2, views }`, and each view names the
 * vault lists it aggregates. A missing key means this room has not guessed
 * yet. The older record is one list id per section.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { APP_NAV_KEYS, COGS_NAV_PIN_CHANGED_EVENT } from "@/lib/app-navigation"
import { subscribeNavRestore } from "@/lib/screen-location"
import { readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { shopViewsFromStored, type ShopView } from "./shop-lists"

export function readShopBindings(): ShopView[] | null {
  if (typeof window === "undefined") return null
  const raw = readAliasedLocal(APP_NAV_KEYS.inventoryShoppingLists)
  if (!raw) return null
  try {
    return shopViewsFromStored(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeShopBindings(views: ShopView[]): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(APP_NAV_KEYS.inventoryShoppingLists, JSON.stringify({ v: 2, views }))
  window.dispatchEvent(new Event(COGS_NAV_PIN_CHANGED_EVENT))
}

export function useShopBindings(): [ShopView[] | null, (next: ShopView[]) => void] {
  const [views, setViews] = useState<ShopView[] | null>(() => readShopBindings())

  useEffect(() => subscribeNavRestore(() => setViews(readShopBindings())), [])

  const write = useCallback((next: ShopView[]) => {
    writeShopBindings(next)
    setViews(next)
  }, [])

  return [views, write]
}
