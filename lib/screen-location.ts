/**
 * lib/screen-location.ts — Snapshot / restore of the main-view screen
 *
 * A "screen" is the main desk the user is looking at: top-level app tab, nested
 * Home/Scheduler/Analytics tabs, Lists folder/list, Docs/Operations/Modules
 * selection, or full-page item detail. Modal dialogs, the Cmd-K search palette,
 * and the item-detail *popup* are not screens.
 *
 * Writes go through `app-navigation` helpers so refresh still restores the last
 * place; back/forward re-applies a snapshot and fires `COGS_NAV_RESTORE_EVENT`
 * so mounted views re-read without remounting Lists.
 */
import type { OpenTarget } from "@/components/Lists/types"
import {
  APP_NAV_KEYS,
  APP_TABS,
  readListsNavigation,
  readStoredId,
  readStoredRecord,
  readStoredTab,
  writeListsNavigation,
  writeStoredId,
  writeStoredRecordField,
  writeStoredTab,
  type AppTab,
  type ListsNavigationState,
} from "@/lib/app-navigation"
import { readAliasedLocal } from "@/lib/storage-keys"

export const COGS_NAV_RESTORE_EVENT = "cogs-nav-restore"
export const COGS_SCREEN_HISTORY_EVENT = "cogs-screen-history"

export interface ScreenLocation {
  appTab: AppTab
  itemId: string | null
  homeTab: string | null
  homeHabitsTab: string | null
  homePlanTab: string | null
  homeTodoTab: string | null
  homeTrackingTab: string | null
  homeGoalsPeriod: string | null
  homeGoalsFilter: string | null
  lists: ListsNavigationState
  schedulerTab: string | null
  schedulerView: string | null
  docsDocId: string | null
  docsFolder: string | null
  opsId: string | null
  opsPanel: string | null
  modulesWorkspaceId: string | null
  modulesView: string | null
  analyticsTab: string | null
  itemDetailTab: string | null
}

function rawOrNull(key: string): string | null {
  if (typeof window === "undefined") return null
  const v = readAliasedLocal(key)
  return v && v.length > 0 ? v : null
}

function openTargetKey(target: OpenTarget): string {
  if (!target) return "null"
  switch (target.type) {
    case "category":
    case "smart":
    case "habits":
      return `${target.type}:${target.id}`
    case "folder-all":
      return `folder-all:${target.folderId}`
    case "objectives":
      return "objectives"
    default:
      return "unknown"
  }
}

/** Stable fingerprint for duplicate detection. */
export function screenLocationKey(loc: ScreenLocation): string {
  return [
    loc.appTab,
    loc.itemId ?? "",
    loc.homeTab ?? "",
    loc.homeHabitsTab ?? "",
    loc.homePlanTab ?? "",
    loc.homeTodoTab ?? "",
    loc.homeTrackingTab ?? "",
    loc.homeGoalsPeriod ?? "",
    loc.homeGoalsFilter ?? "",
    loc.lists.location,
    openTargetKey(loc.lists.openTarget),
    loc.schedulerTab ?? "",
    loc.schedulerView ?? "",
    loc.docsDocId ?? "",
    loc.docsFolder ?? "",
    loc.opsId ?? "",
    loc.opsPanel ?? "",
    loc.modulesWorkspaceId ?? "",
    loc.modulesView ?? "",
    loc.analyticsTab ?? "",
    loc.itemDetailTab ?? "",
  ].join("|")
}

/** Read the current main-view screen from persisted navigation pins. */
export function readScreenLocation(): ScreenLocation {
  const appTab = readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")
  const itemId = readStoredId(APP_NAV_KEYS.appItemId)
  const opsId = readStoredId(APP_NAV_KEYS.opsId)
  const modulesWorkspaceId = readStoredId(APP_NAV_KEYS.modulesWorkspaceId)
  const opsPanels = readStoredRecord(APP_NAV_KEYS.opsPanel)
  const moduleViews = readStoredRecord(APP_NAV_KEYS.modulesView)
  const detailTabs = readStoredRecord(APP_NAV_KEYS.itemDetailTab)

  return {
    appTab,
    itemId,
    homeTab: rawOrNull(APP_NAV_KEYS.homeTab),
    homeHabitsTab: rawOrNull(APP_NAV_KEYS.homeHabitsTab),
    homePlanTab: rawOrNull(APP_NAV_KEYS.homePlanTab),
    homeTodoTab: rawOrNull(APP_NAV_KEYS.homeTodoTab),
    homeTrackingTab: rawOrNull(APP_NAV_KEYS.homeTrackingTab),
    homeGoalsPeriod: rawOrNull(APP_NAV_KEYS.homeGoalsPeriod),
    homeGoalsFilter: rawOrNull(APP_NAV_KEYS.homeGoalsFilter),
    lists: readListsNavigation(),
    schedulerTab: rawOrNull(APP_NAV_KEYS.schedulerTab),
    schedulerView: rawOrNull(APP_NAV_KEYS.schedulerView),
    docsDocId: readStoredId(APP_NAV_KEYS.docsDocId),
    docsFolder: rawOrNull(APP_NAV_KEYS.docsFolder),
    opsId,
    opsPanel: opsId ? opsPanels[opsId] ?? null : null,
    modulesWorkspaceId,
    modulesView: modulesWorkspaceId ? moduleViews[modulesWorkspaceId] ?? null : null,
    analyticsTab: rawOrNull(APP_NAV_KEYS.analyticsTab),
    itemDetailTab: itemId ? detailTabs[itemId] ?? null : null,
  }
}

let restoreDepth = 0

export function isScreenRestoreInProgress(): boolean {
  return restoreDepth > 0
}

function beginRestore(): void {
  restoreDepth += 1
}

function endRestore(): void {
  restoreDepth = Math.max(0, restoreDepth - 1)
}

function writeOptionalTab(key: string, value: string | null): void {
  if (value) writeStoredTab(key, value)
}

/**
 * Re-apply a screen snapshot to storage and notify mounted views.
 * Does not push onto history (caller owns the stack).
 */
export function applyScreenLocation(loc: ScreenLocation): void {
  if (typeof window === "undefined") return
  beginRestore()
  try {
    writeStoredTab(APP_NAV_KEYS.appTab, loc.appTab)
    writeStoredId(APP_NAV_KEYS.appItemId, loc.itemId)

    writeOptionalTab(APP_NAV_KEYS.homeTab, loc.homeTab)
    writeOptionalTab(APP_NAV_KEYS.homeHabitsTab, loc.homeHabitsTab)
    writeOptionalTab(APP_NAV_KEYS.homePlanTab, loc.homePlanTab)
    writeOptionalTab(APP_NAV_KEYS.homeTodoTab, loc.homeTodoTab)
    writeOptionalTab(APP_NAV_KEYS.homeTrackingTab, loc.homeTrackingTab)
    writeOptionalTab(APP_NAV_KEYS.homeGoalsPeriod, loc.homeGoalsPeriod)
    writeOptionalTab(APP_NAV_KEYS.homeGoalsFilter, loc.homeGoalsFilter)
    writeOptionalTab(APP_NAV_KEYS.schedulerTab, loc.schedulerTab)
    writeOptionalTab(APP_NAV_KEYS.schedulerView, loc.schedulerView)
    writeOptionalTab(APP_NAV_KEYS.analyticsTab, loc.analyticsTab)
    writeOptionalTab(APP_NAV_KEYS.docsFolder, loc.docsFolder)

    writeStoredId(APP_NAV_KEYS.docsDocId, loc.docsDocId)
    writeStoredId(APP_NAV_KEYS.opsId, loc.opsId)
    writeStoredId(APP_NAV_KEYS.modulesWorkspaceId, loc.modulesWorkspaceId)

    if (loc.opsId && loc.opsPanel) {
      writeStoredRecordField(APP_NAV_KEYS.opsPanel, loc.opsId, loc.opsPanel)
    }
    if (loc.modulesWorkspaceId && loc.modulesView) {
      writeStoredRecordField(APP_NAV_KEYS.modulesView, loc.modulesWorkspaceId, loc.modulesView)
    }
    if (loc.itemId && loc.itemDetailTab) {
      writeStoredRecordField(APP_NAV_KEYS.itemDetailTab, loc.itemId, loc.itemDetailTab)
    }

    // Lists: persist only — do not use applyListsNavigation here (that event
    // forces the shell onto the Lists tab). Lists re-reads on cogs-nav-restore.
    writeListsNavigation(loc.lists)

    window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT, { detail: { location: loc } }))
  } finally {
    // Wait for restore listeners' setState + their persist effects before
    // accepting new history recordings again.
    setTimeout(() => {
      endRestore()
    }, 0)
  }
}

export function subscribeNavRestore(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = () => handler()
  window.addEventListener(COGS_NAV_RESTORE_EVENT, listener)
  return () => window.removeEventListener(COGS_NAV_RESTORE_EVENT, listener)
}
