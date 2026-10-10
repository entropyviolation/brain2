/**
 * components/Home/Tracking/open-tag-settings.ts — Open tag settings from a chip
 *
 * Double-click a Tracking tag anywhere Habits or Tracking draws one.
 * `TagSettingsHost` (mounted once on the app page) is the dialog. Callers do
 * not each keep a copy. Item tags without a catalog match open create-from-name.
 * After a catalog write in the dialog, `publishTagCatalogEdit` lets open forms
 * retarget a pressed name (via `HabitTagCatalog` → `onEdited`).
 */

import type { CatalogTagEdit } from "@/lib/catalog-tag"

export type TagSettingsTarget =
  | { kind: "id"; tagId: string }
  | { kind: "create"; name: string }

type Listener = (target: TagSettingsTarget) => void
type EditListener = (result: CatalogTagEdit) => void

const listeners = new Set<Listener>()
const editListeners = new Set<EditListener>()

export function openTagSettings(tagId: string) {
  const target: TagSettingsTarget = { kind: "id", tagId }
  listeners.forEach((listener) => listener(target))
}

/** Open settings for a free-text name that is not yet a Tracking catalog tag. */
export function openTagSettingsFromName(name: string) {
  const target: TagSettingsTarget = { kind: "create", name }
  listeners.forEach((listener) => listener(target))
}

export function subscribeTagSettings(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Fired after tag settings commits a real catalog edit (rename / recolor / fold). */
export function publishTagCatalogEdit(result: CatalogTagEdit) {
  editListeners.forEach((listener) => listener(result))
}

export function subscribeTagCatalogEdit(listener: EditListener) {
  editListeners.add(listener)
  return () => {
    editListeners.delete(listener)
  }
}

/** Double-click on a tag chip. Stops the click from also toggling selection. */
export function tagColorDoubleClick(tagId: string) {
  return (event: { preventDefault(): void; stopPropagation(): void }) => {
    event.preventDefault()
    event.stopPropagation()
    openTagSettings(tagId)
  }
}

export const TAG_OPEN_TITLE = "Double-click to open tag settings"
