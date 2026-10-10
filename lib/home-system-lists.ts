/**
 * lib/home-system-lists.ts — Pin built-in singleton lists to Lists Home
 *
 * Lists Home is `homePinned` on `lists-ui-store` (Show in Home / Pin to Home).
 * This module adds the app's own singleton lists to that array. It does not
 * add a second pin, and it does not touch Send to Scheduler (`scheduleable`).
 *
 * A list belongs here when the app creates it with a fixed identity: a stable
 * id, or the exact name that feature already adopts. An adopted Reminders
 * list (or the same kind of adoption for a sibling) is pinned by that list's
 * id. Ordinary lists, folders, All Items, dated To Do lists, period ledgers,
 * per-operation lists, and module template lists are not.
 *
 * There is no stored "user unpinned" flag — `homePinned` is only the ids
 * currently on Home. These lists are put back if that id is removed, so they
 * stay on Home. A person's other pins are left as they are.
 */
"use client"

import { useEffect } from "react"
import {
  IPHONE_NOTES_STORE_LIST_ID,
  IPHONE_NOTES_STORE_LIST_NAME,
  NOTES_TO_INGEST_LIST_ID,
  NOTES_TO_INGEST_LIST_NAME,
} from "@/lib/apple-notes"
import { resolveArchiveListId } from "@/lib/archive-lists"
import { findAffirmationsCategory } from "@/lib/affirmations"
import { findEventuallyList } from "@/lib/eventually-list"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { HABIT_STANDING_LIST_ID } from "@/lib/habit-list-item"
import { INVENTORY_LIST_ID } from "@/lib/ingest/apply-inventory"
import { NEEDED_LIST_NAME } from "@/lib/ingest/apply-needed"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { findInstagramFollowersList, findInstagramFollowingList } from "@/lib/instagram-lists"
import { findPeopleIKnowList } from "@/lib/people-i-know"
import { findRemindersList } from "@/lib/reminders"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List } from "@/lib/types"

const liveSlot: HydratedStoreSyncSlot = { stopper: null }
const hydrateSlot: HydratedStoreSyncSlot = { stopper: null }

function namedList(lists: List[], name: string): List | undefined {
  const wanted = name.trim().toLowerCase()
  return lists.find(
    (list) => !isFolderAllItemsCategoryId(list.id) && list.name.trim().toLowerCase() === wanted,
  )
}

function existingId(lists: List[], id: string | undefined, into: string[]): void {
  if (!id || into.includes(id)) return
  if (!lists.some((list) => list.id === id)) return
  into.push(id)
}

/**
 * Ids of built-in singleton lists that should be on Lists Home.
 * Only ids that exist in `lists` are returned.
 */
export function systemHomeListIds(lists: List[], folders: Folder[]): string[] {
  const ids: string[] = []

  existingId(lists, findRemindersList(lists)?.id, ids)
  existingId(lists, findPeopleIKnowList(lists)?.id, ids)
  existingId(lists, findInstagramFollowingList(lists)?.id, ids)
  existingId(lists, findInstagramFollowersList(lists)?.id, ids)
  existingId(lists, findEventuallyList(lists, folders)?.id, ids)
  existingId(lists, resolveArchiveListId(lists, folders, "completed"), ids)
  existingId(lists, resolveArchiveListId(lists, folders, "missed"), ids)

  const habits =
    lists.find((list) => list.id === HABIT_STANDING_LIST_ID) ?? namedList(lists, "Habits")
  existingId(lists, habits?.id, ids)

  existingId(lists, lists.find((list) => list.id === INVENTORY_LIST_ID)?.id, ids)
  existingId(lists, findAffirmationsCategory(lists)?.id, ids)
  existingId(lists, namedList(lists, NEEDED_LIST_NAME)?.id, ids)

  const notes =
    lists.find((list) => list.id === NOTES_TO_INGEST_LIST_ID) ??
    namedList(lists, NOTES_TO_INGEST_LIST_NAME)
  existingId(lists, notes?.id, ids)

  const parked =
    lists.find((list) => list.id === IPHONE_NOTES_STORE_LIST_ID) ??
    namedList(lists, IPHONE_NOTES_STORE_LIST_NAME)
  existingId(lists, parked?.id, ids)

  return ids
}

/** Write any missing built-in list ids into `homePinned`. Returns those ids. */
export function pinSystemListsToHome(): string[] {
  const { lists, folders } = useTaskStore.getState()
  const ids = systemHomeListIds(lists, folders)
  useListsUiStore.getState().pinHomeLists(ids)
  return ids
}

/**
 * Keep built-in singleton lists on Lists Home.
 * Pins immediately, again after both vaults hydrate (so a late snapshot
 * cannot drop them), and whenever lists or Home pins change.
 */
export function startSystemHomeListPins(): () => void {
  if (liveSlot.stopper) return liveSlot.stopper

  const unsubTasks = useTaskStore.subscribe((state, prev) => {
    if (state.lists === prev.lists && state.folders === prev.folders) return
    pinSystemListsToHome()
  })
  const unsubUi = useListsUiStore.subscribe((state, prev) => {
    if (state.homePinned === prev.homePinned) return
    pinSystemListsToHome()
  })
  pinSystemListsToHome()

  const stopHydrate = startHydratedStoreSync({
    slot: hydrateSlot,
    persists: [useTaskStore.persist, useListsUiStore.persist],
    onReady: () => {
      pinSystemListsToHome()
      return () => {}
    },
  })

  liveSlot.stopper = () => {
    unsubTasks()
    unsubUi()
    stopHydrate()
    liveSlot.stopper = null
  }
  return liveSlot.stopper
}

/** App-shell mount. Stops when the shell unmounts so a test cannot leave the pin watcher running. */
export function useSystemHomeListPins(): void {
  useEffect(() => {
    return startSystemHomeListPins()
  }, [])
}
