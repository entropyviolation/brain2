/**
 * components/Inventory/shopping/shopping-scene.tsx — Desk shopping scene
 *
 * Warm paper ledger. Named views, each drawn from one or more vault lists.
 */
"use client"

import { ShoppingBoard } from "./shopping-board"

export function ShoppingScene() {
  return <ShoppingBoard testId="shopping-scene" className="inv-stage" />
}
