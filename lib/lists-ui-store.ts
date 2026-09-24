/**
 * lib/lists-ui-store.ts — UI/preferences store for the Lists "File Manager"
 *
 * Holds purely presentational, per-user state for the Lists panel that does not
 * belong on the task data model: which folders/lists are pinned to "Home", the
 * chosen display type per list, the active folder view, the user's uploaded
 * "orb" icon library (background-removed data URLs), and All Items checkbox
 * filters (per-list / per-folder, including Select all / Deselect all). Persisted to localStorage
 * under `brain2-lists-ui`. None of this affects task/category/folder data, so the
 * rest of the app keeps working unchanged. Target: MongoDB `listsUiPrefs`
 * collection (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { computeIconGridPositions } from "@/lib/lists-icon-grid"
import { isListDisplayMode, type ListDisplayMode } from "@/lib/types"

/** UI-only "active display" preference; canonical union lives in lib/types.ts. */
export type ListDisplay = ListDisplayMode
export type FolderView = "icons" | "list" | "details" | "cards"

interface ListsUiState {
  // Folder/list ids the user has pinned to the Home directory.
  homePinned: string[]
  // Show the auto smart lists (daily/weekly/monthly) in Home.
  showSmartLists: boolean
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

  toggleHomePin: (id: string) => void
  isPinned: (id: string) => boolean
  setShowSmartLists: (v: boolean) => void
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
}

export const useListsUiStore = create<ListsUiState>()(
  persist(
    (set, get) => ({
      homePinned: [],
      showSmartLists: true,
      listDisplay: {},
      folderView: "icons",
      iconLibrary: [],
      iconPositions: {},
      iconLayoutMode: {},
      hiddenGalleryOrbs: [],
      folderAllUncategorizedOnly: {},
      folderAllHideUncategorized: {},
      folderAllHiddenListIds: {},
      globalAllHiddenFolderIds: [],
      globalAllUncategorizedOnly: false,
      globalAllHideUncategorized: false,

      toggleHomePin: (id) =>
        set((state) => ({
          homePinned: state.homePinned.includes(id)
            ? state.homePinned.filter((x) => x !== id)
            : [...state.homePinned, id],
        })),
      isPinned: (id) => get().homePinned.includes(id),
      setShowSmartLists: (v) => set({ showSmartLists: v }),
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
    }),
    {
      name: persistKey("lists-ui"),
      version: 5,
      storage: createCogsJSONStorage(),
      migrate: (persistedState, version) => {
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
        return state as unknown as ListsUiState
      },
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<ListsUiState>),
      }),
    },
  ),
)
