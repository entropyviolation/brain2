/**
 * components/ItemTypes/ItemTypeList.tsx — Manage item types (Settings)
 *
 * Thin wrapper around `ItemTypesPanel` for the Settings dialog.
 */
"use client"

import { ItemTypesPanel } from "./ItemTypesPanel"

export function ItemTypeList() {
  return <ItemTypesPanel />
}
