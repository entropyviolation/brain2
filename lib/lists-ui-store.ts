/**
 * lib/lists-ui-store.ts — UI/preferences store for the Lists "File Manager"
 *
 * Holds purely presentational, per-user state for the Lists panel that does not
 * belong on the task data model: which folders/lists are pinned to "Home", the
 * chosen display type per list, the active folder view, and the user's uploaded
 * "orb" icon library (background-removed data URLs). Persisted to localStorage
 * under `cogs-lists-ui`. None of this affects task/category/folder data, so the
 * rest of the app keeps working unchanged. Target: MongoDB `listsUiPrefs`
 * collection (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { computeIconGridPositions } from "@/lib/lists-icon-grid"
import type { ListDisplayMode } from "@/lib/types"

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
  // Per-list attribute id whose values form the Kanban board columns.
  kanbanStatusAttrId: Record<string, string>
  // Last-used folder content view.
  folderView: FolderView
  // User-uploaded icon library (data URLs, backgrounds removed).
  iconLibrary: string[]
  /** Freeform icon positions keyed by `${location}:${entryId}`. */
  iconPositions: Record<string, { x: number; y: number }>
  /** Orb gallery paths the user has hidden (not deleted from disk). */
  hiddenGalleryOrbs: string[]
  /** Per-folder All Items view: show only uncategorized items. */
  folderAllUncategorizedOnly: Record<string, boolean>

  toggleHomePin: (id: string) => void
  isPinned: (id: string) => boolean
  setShowSmartLists: (v: boolean) => void
  setListDisplay: (id: string, d: ListDisplay) => void
  setKanbanStatusAttrId: (id: string, attrId: string) => void
  setFolderView: (v: FolderView) => void
  addLibraryIcon: (dataUrl: string) => void
  removeLibraryIcon: (dataUrl: string) => void
  setIconPosition: (location: string, entryId: string, x: number, y: number) => void
  getIconPosition: (location: string, entryId: string) => { x: number; y: number } | undefined
  autoOrganizeIcons: (location: string, entryKeys: string[]) => void
  hideGalleryOrb: (path: string) => void
  restoreGalleryOrb: (path: string) => void
  setFolderAllUncategorizedOnly: (folderId: string, value: boolean) => void
}

export const useListsUiStore = create<ListsUiState>()(
  persist(
    (set, get) => ({
      homePinned: [],
      showSmartLists: true,
      listDisplay: {},
      kanbanStatusAttrId: {},
      folderView: "icons",
      iconLibrary: [],
      iconPositions: {},
      hiddenGalleryOrbs: [],
      folderAllUncategorizedOnly: {},

      toggleHomePin: (id) =>
        set((state) => ({
          homePinned: state.homePinned.includes(id)
            ? state.homePinned.filter((x) => x !== id)
            : [...state.homePinned, id],
        })),
      isPinned: (id) => get().homePinned.includes(id),
      setShowSmartLists: (v) => set({ showSmartLists: v }),
      setListDisplay: (id, d) => set((state) => ({ listDisplay: { ...state.listDisplay, [id]: d } })),
      setKanbanStatusAttrId: (id, attrId) =>
        set((state) => ({ kanbanStatusAttrId: { ...state.kanbanStatusAttrId, [id]: attrId } })),
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
        set((state) => ({ iconPositions: { ...state.iconPositions, ...prefixed } }))
      },
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
    }),
    {
      name: "cogs-lists-ui",
      version: 3,
    },
  ),
)
