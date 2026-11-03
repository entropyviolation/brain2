/**
 * components/Inventory/phone/use-inventory-phone.ts — Phone gate for Inventory
 *
 * Phone layout mounts only when this matches. The desktop tree stays mounted
 * otherwise, including on the server (snapshot is false). 767px is the phone
 * width, the same cut as Plan and Tracking.
 */
"use client"

import { useSyncExternalStore } from "react"

export const INVENTORY_PHONE_QUERY = "(max-width: 767px)"

function subscribeQuery(query: string, onChange: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

export function useInventoryPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {}
      return subscribeQuery(INVENTORY_PHONE_QUERY, onChange)
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(INVENTORY_PHONE_QUERY).matches,
    () => false,
  )
}
