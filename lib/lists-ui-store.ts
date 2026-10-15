/**
 * lib/lists-ui-store.ts — UI/preferences store for the Lists "File Manager"
 *
 * Holds purely presentational, per-user state for the Lists panel that does not
 * belong on the task data model: which folders/lists are pinned to "Home", the
 * chosen display type per list, the active folder view, the user's uploaded
 * "orb" icon library (background-removed data URLs), and All Items checkbox
 * filters (per-list / per-folder, including Select all / Deselect all). Persisted to localStorage
 * under `brain2-lists-ui`. List Icons **desktop mode** (`listIconsDesktop`, per
 * open target, default off) and optional **Gravity** (`listIconsGravity`, per
 * open target, default off) are the same kind of pref. Global Gravity field
 * knobs (`listIconsGravityField`: G + source gains) are UI-only too. Per-target
 * **Filter types** prefs (`hiddenItemTypeIdsByTarget`, persist v10) hide items
 * by exact type id without changing membership. None of this affects
 * task/category/folder data. Target: MongoDB `listsUiPrefs` collection
 * (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { computeIconGridPositions } from "@/lib/lists-icon-grid"
import { isListDisplayMode, type ListDisplayMode } from "@/lib/types"
import {
  DEFAULT_GRAVITY_FIELD_PARAMS,
  mergeGravityFieldParams,
  sanitizeGravityFieldParams,
  type GravityFieldParams,
} from "@/components/Lists/lib/list-icon-gravity"

export type { GravityFieldParams }

/** UI-only "active display" preference; canonical union lives in lib/types.ts. */
export type ListDisplay = ListDisplayMode
export type FolderView = "icons" | "list" | "details" | "cards"

interface ListsUiState {
  /**
   * Folder/list ids shown in the Lists Home directory.
   * Built-in singleton lists are inserted here by `lib/home-system-lists.ts`
   * and put back if removed. Ordinary pins still toggle.
   */
  homePinned: string[]
  // Show the auto smart lists (daily/weekly/monthly) in Home.
  showSmartLists: boolean
  /**
   * Global All directory: show period To do / Done / Undone ledger lists
   * (`isPeriodLedgerListId`). Default true — nothing disappears until unchecked.
   */
  showPeriodLedgerListsInAll: boolean
  // Per-list chosen display type for its contents.
  listDisplay: Record<string, ListDisplay>
  // Last-used folder content view.
  folderView: FolderView
  // User-uploaded icon library (data URLs, backgrounds removed).
  iconLibrary: string[]
  /** Icon positions keyed by `${location}:${entryId}`. */
  iconPositions: Record<string, { x: number; y: number }>
  /**
   * Per-location icon layout. Missing = infer from coords.
   * `auto` packs to canvas width (resize may re-flow). `freeform` freezes
   * every saved coordinate after the user has dragged even once.
   */
  iconLayoutMode: Record<string, "auto" | "freeform">
  /**
   * List Icons desktop mode, keyed by `openTargetKey` (a list, All Items, or
   * a smart list). Missing / false keeps the wrapping flex grid. UI-only.
   */
  listIconsDesktop: Record<string, boolean>
  /**
   * List Icons desktop **Gravity** mode, keyed by `openTargetKey`. Missing /
   * false keeps free-drag desktop unchanged. Mutually exclusive with PILE UP
   * at runtime (entering one turns the other off). UI-only; position snapshot
   * for Reset lives in `list-icon-gravity.ts`, not here.
   */
  listIconsGravity: Record<string, boolean>
  /**
   * Global Gravity field knobs (G + per-source gains). One blob for all lists;
   * on/off stays per target. Defaults ≡ shipped GRAVITY_WEIGHT feel.
   */
  listIconsGravityField: GravityFieldParams
  /** Orb gallery paths the user has hidden (not deleted from disk). */
  hiddenGalleryOrbs: string[]
  /** Per-folder All Items view: show only uncategorized items. */
  folderAllUncategorizedOnly: Record<string, boolean>
  /** Per-folder All Items view: hide uncategorized items. */
  folderAllHideUncategorized: Record<string, boolean>
  /**
   * Per-folder All Items view: list ids whose items are hidden in that folder's
   * All Items (every display mode). Empty / missing means every list is visible.
   */
  folderAllHiddenListIds: Record<string, string[]>
  /**
   * Global All Items view: folder ids whose items are hidden (every display
   * mode). Empty means every folder is selected (visible). View-only.
   */
  globalAllHiddenFolderIds: string[]
  /** Global All Items view: show only uncategorized items. */
  globalAllUncategorizedOnly: boolean
  /** Global All Items view: hide uncategorized items. */
  globalAllHideUncategorized: boolean
  /**
   * Per open-target show/hide of item types (exact id). Keyed by
   * `openTargetKey`. Empty / missing = every type visible.
   */
  hiddenItemTypeIdsByTarget: Record<string, string[]>

  toggleHomePin: (id: string) => void
  /** Add ids that are not already on Home. Does not remove anything. */
  pinHomeLists: (ids: readonly string[]) => void
  isPinned: (id: string) => boolean
  setShowSmartLists: (v: boolean) => void
  setShowPeriodLedgerListsInAll: (v: boolean) => void
  setListDisplay: (id: string, d: ListDisplay) => void
  setFolderView: (v: FolderView) => void
  addLibraryIcon: (dataUrl: string) => void
  removeLibraryIcon: (dataUrl: string) => void
  setIconPosition: (location: string, entryId: string, x: number, y: number) => void
  getIconPosition: (location: string, entryId: string) => { x: number; y: number } | undefined
  autoOrganizeIcons: (location: string, entryKeys: string[]) => void
  /** Write a full location snapshot and set auto vs freeform in one persist. */
  commitIconLayout: (
    location: string,
    positions: Record<string, { x: number; y: number }>,
    mode: "auto" | "freeform",
  ) => void
  setIconLayoutMode: (location: string, mode: "auto" | "freeform") => void
  setListIconsDesktop: (openTargetKey: string, on: boolean) => void
  setListIconsGravity: (openTargetKey: string, on: boolean) => void
  setListIconsGravityField: (patch: Partial<GravityFieldParams> | GravityFieldParams) => void
  /** Restore field params to defaults; does not change Gravity on/off. */
  resetListIconsGravityField: () => void
  hideGalleryOrb: (path: string) => void
  restoreGalleryOrb: (path: string) => void
  setFolderAllUncategorizedOnly: (folderId: string, value: boolean) => void
  setFolderAllHideUncategorized: (folderId: string, hidden: boolean) => void
  setFolderAllListHidden: (folderId: string, listId: string, hidden: boolean) => void
  /** Replace which lists are hidden in a folder All Items view (Select all / Deselect all). */
  setFolderAllHiddenListIds: (folderId: string, hiddenIds: string[]) => void
  setGlobalAllFolderHidden: (folderId: string, hidden: boolean) => void
  /** Replace which folders are hidden in global All Items (Select all / Deselect all). */
  setGlobalAllHiddenFolderIds: (hiddenIds: string[]) => void
  setGlobalAllUncategorizedOnly: (value: boolean) => void
  setGlobalAllHideUncategorized: (hidden: boolean) => void
  setItemTypeHidden: (openTargetKey: string, typeId: string, hidden: boolean) => void
  /** Replace which types are hidden for a target (Select all / Deselect all). */
  setHiddenItemTypeIds: (openTargetKey: string, hiddenIds: string[]) => void
}

/**
 * Persist migrate for `brain2-lists-ui`. v7 adds `listIconsDesktop` (default
 * off) and does not touch `iconPositions` — folder `home:…` keys stay put.
 * v8 adds `listIconsGravity` (default off) without rewriting positions.
 * v9 adds `listIconsGravityField` (defaults ≡ current GRAVITY_WEIGHT feel).
 * v10 adds `hiddenItemTypeIdsByTarget` (empty = show all types).
 */
export function migrateListsUiPersisted(persistedState: unknown, version: number): Record<string, unknown> {
  const state = { ...((persistedState ?? {}) as Record<string, unknown>) }
  if (version < 4) {
    delete state.kanbanStatusAttrId
    const listDisplay = { ...((state.listDisplay as Record<string, unknown>) ?? {}) }
    for (const [id, mode] of Object.entries(listDisplay)) {
      if (!isListDisplayMode(mode)) delete listDisplay[id]
    }
    state.listDisplay = listDisplay
  }
  if (version < 5) {
    state.iconLayoutMode = (state.iconLayoutMode as Record<string, "auto" | "freeform">) ?? {}
  }
  if (version < 6) {
    state.showPeriodLedgerListsInAll = true
  }
  if (version < 7) {
    const desktop = state.listIconsDesktop
    state.listIconsDesktop =
      desktop && typeof desktop === "object" && !Array.isArray(desktop) ? desktop : {}
  }
  if (version < 8) {
    const gravity = state.listIconsGravity
    state.listIconsGravity =
      gravity && typeof gravity === "object" && !Array.isArray(gravity) ? gravity : {}
  }
  if (version < 10) {
    const hidden = state.hiddenItemTypeIdsByTarget
    state.hiddenItemTypeIdsByTarget =
      hidden && typeof hidden === "object" && !Array.isArray(hidden) ? hidden : {}
  }
  // Always sanitize field prefs (v9 introduce + heal partial blobs).
  state.listIconsGravityField = sanitizeGravityFieldParams(state.listIconsGravityField)
  return state
}

export const useListsUiStore = create<ListsUiState>()(
  persist(
    (set, get) => ({
      homePinned: [],
      showSmartLists: true,
      showPeriodLedgerListsInAll: true,
      listDisplay: {},
      folderView: "icons",
      iconLibrary: [],
      iconPositions: {},
      iconLayoutMode: {},
      listIconsDesktop: {},
      listIconsGravity: {},
      listIconsGravityField: {
        globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
        sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
        attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
      },
      hiddenGalleryOrbs: [],
      folderAllUncategorizedOnly: {},
      folderAllHideUncategorized: {},
      folderAllHiddenListIds: {},
      globalAllHiddenFolderIds: [],
      globalAllUncategorizedOnly: false,
      globalAllHideUncategorized: false,
      hiddenItemTypeIdsByTarget: {},

      toggleHomePin: (id) =>
        set((state) => ({
          homePinned: state.homePinned.includes(id)
            ? state.homePinned.filter((x) => x !== id)
            : [...state.homePinned, id],
        })),
      pinHomeLists: (ids) =>
        set((state) => {
          const missing = ids.filter((id) => id && !state.homePinned.includes(id))
          if (missing.length === 0) return state
          return { homePinned: [...state.homePinned, ...missing] }
        }),
      isPinned: (id) => get().homePinned.includes(id),
      setShowSmartLists: (v) => set({ showSmartLists: v }),
      setShowPeriodLedgerListsInAll: (v) => set({ showPeriodLedgerListsInAll: v }),
      setListDisplay: (id, d) => set((state) => ({ listDisplay: { ...state.listDisplay, [id]: d } })),
      setFolderView: (v) => set({ folderView: v }),
      addLibraryIcon: (dataUrl) =>
        set((state) =>
          state.iconLibrary.includes(dataUrl)
            ? state
            : { iconLibrary: [dataUrl, ...state.iconLibrary].slice(0, 200) },
        ),
      removeLibraryIcon: (dataUrl) =>
        set((state) => ({ iconLibrary: state.iconLibrary.filter((x) => x !== dataUrl) })),
      setIconPosition: (location, entryId, x, y) =>
        set((state) => ({
          iconPositions: { ...state.iconPositions, [`${location}:${entryId}`]: { x, y } },
        })),
      getIconPosition: (location, entryId) => get().iconPositions[`${location}:${entryId}`],
      autoOrganizeIcons: (location, entryKeys) => {
        const positions = computeIconGridPositions(entryKeys)
        const prefixed: Record<string, { x: number; y: number }> = {}
        for (const [key, pos] of Object.entries(positions)) {
          prefixed[`${location}:${key}`] = pos
        }
        set((state) => ({
          iconPositions: { ...state.iconPositions, ...prefixed },
          iconLayoutMode: { ...state.iconLayoutMode, [location]: "auto" },
        }))
      },
      commitIconLayout: (location, positions, mode) =>
        set((state) => {
          const next = { ...state.iconPositions }
          for (const [key, pos] of Object.entries(positions)) {
            next[`${location}:${key}`] = pos
          }
          return {
            iconPositions: next,
            iconLayoutMode: { ...state.iconLayoutMode, [location]: mode },
          }
        }),
      setIconLayoutMode: (location, mode) =>
        set((state) => ({
          iconLayoutMode: { ...state.iconLayoutMode, [location]: mode },
        })),
      setListIconsDesktop: (openTargetKey, on) =>
        set((state) => ({
          listIconsDesktop: { ...(state.listIconsDesktop ?? {}), [openTargetKey]: on },
          // Desktop off: drop Gravity so the next Desktop on starts clean.
          ...(on
            ? {}
            : {
                listIconsGravity: {
                  ...(state.listIconsGravity ?? {}),
                  [openTargetKey]: false,
                },
              }),
        })),
      setListIconsGravity: (openTargetKey, on) =>
        set((state) => ({
          listIconsGravity: { ...(state.listIconsGravity ?? {}), [openTargetKey]: on },
        })),
      setListIconsGravityField: (patch) =>
        set((state) => ({
          listIconsGravityField: mergeGravityFieldParams(
            sanitizeGravityFieldParams(state.listIconsGravityField),
            patch,
          ),
        })),
      resetListIconsGravityField: () =>
        set({
          listIconsGravityField: {
            globalG: DEFAULT_GRAVITY_FIELD_PARAMS.globalG,
            sources: { ...DEFAULT_GRAVITY_FIELD_PARAMS.sources },
            attributeDrift: DEFAULT_GRAVITY_FIELD_PARAMS.attributeDrift,
          },
        }),
      hideGalleryOrb: (path) =>
        set((state) =>
          state.hiddenGalleryOrbs.includes(path)
            ? state
            : { hiddenGalleryOrbs: [...state.hiddenGalleryOrbs, path] },
        ),
      restoreGalleryOrb: (path) =>
        set((state) => ({ hiddenGalleryOrbs: state.hiddenGalleryOrbs.filter((p) => p !== path) })),
      setFolderAllUncategorizedOnly: (folderId, value) =>
        set((state) => ({
          folderAllUncategorizedOnly: { ...state.folderAllUncategorizedOnly, [folderId]: value },
        })),
      setFolderAllHideUncategorized: (folderId, hidden) =>
        set((state) => ({
          folderAllHideUncategorized: { ...state.folderAllHideUncategorized, [folderId]: hidden },
        })),
      setFolderAllListHidden: (folderId, listId, hidden) =>
        set((state) => {
          const current = state.folderAllHiddenListIds?.[folderId] ?? []
          const isHidden = current.includes(listId)
          if (hidden === isHidden) return state
          const nextForFolder = hidden ? [...current, listId] : current.filter((id) => id !== listId)
          return {
            folderAllHiddenListIds: {
              ...(state.folderAllHiddenListIds ?? {}),
              [folderId]: nextForFolder,
            },
          }
        }),
      setFolderAllHiddenListIds: (folderId, hiddenIds) =>
        set((state) => ({
          folderAllHiddenListIds: {
            ...(state.folderAllHiddenListIds ?? {}),
            [folderId]: hiddenIds,
          },
        })),
      setGlobalAllFolderHidden: (folderId, hidden) =>
        set((state) => {
          const current = state.globalAllHiddenFolderIds ?? []
          const isHidden = current.includes(folderId)
          if (hidden === isHidden) return state
          return {
            globalAllHiddenFolderIds: hidden
              ? [...current, folderId]
              : current.filter((id) => id !== folderId),
          }
        }),
      setGlobalAllHiddenFolderIds: (hiddenIds) => set({ globalAllHiddenFolderIds: hiddenIds }),
      setGlobalAllUncategorizedOnly: (value) => set({ globalAllUncategorizedOnly: value }),
      setGlobalAllHideUncategorized: (hidden) => set({ globalAllHideUncategorized: hidden }),
      setItemTypeHidden: (openTargetKey, typeId, hidden) =>
        set((state) => {
          const current = state.hiddenItemTypeIdsByTarget?.[openTargetKey] ?? []
          const isHidden = current.includes(typeId)
          if (hidden === isHidden) return state
          const nextForTarget = hidden ? [...current, typeId] : current.filter((id) => id !== typeId)
          return {
            hiddenItemTypeIdsByTarget: {
              ...(state.hiddenItemTypeIdsByTarget ?? {}),
              [openTargetKey]: nextForTarget,
            },
          }
        }),
      setHiddenItemTypeIds: (openTargetKey, hiddenIds) =>
        set((state) => ({
          hiddenItemTypeIdsByTarget: {
            ...(state.hiddenItemTypeIdsByTarget ?? {}),
            [openTargetKey]: hiddenIds,
          },
        })),
    }),
    {
      name: persistKey("lists-ui"),
      version: 10,
      storage: createCogsJSONStorage(),
      migrate: (persistedState, version) => migrateListsUiPersisted(persistedState, version) as ListsUiState,
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<ListsUiState>),
      }),
    },
  ),
)
