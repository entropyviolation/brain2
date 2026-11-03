/**
 * components/Lists/hooks/useListsShelfMaintenance.ts
 *
 * Dedupe on mount, the task-store hydration flag, and the idle shelf sync.
 * The orchestrator passes tasks and modules in. This hook does not subscribe.
 * Equality checks bail out so a wash sync does not publish a new tree.
 */
import { startTransition, useEffect, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import {
  syncNextActionsSmartLists,
  syncScheduledFolderHierarchy,
} from "@/lib/scheduled-lists-sync"
import { joinArchiveListMembership } from "@/lib/archive-lists"
import {
  syncFolderAllItemsCategories,
  syncGlobalAllItemsList,
} from "@/lib/folder-all-items"
import {
  syncModuleListFolders,
  taskStoreModuleListsMutators,
} from "@/lib/module-lists"
import { syncModuleListContents } from "@/lib/module-list-import"
import { ensureFilmTypeOnFilmsLists } from "@/lib/film-types"
import type { ModuleInstance } from "@/lib/modules-store"
import type { Folder, List, Task } from "@/lib/types"
import { sameFolderTree, sameListShelf, scheduleMaintenanceKey } from "@/components/Lists/lib/lists-shelf-sync"

export function useListsShelfMaintenance({
  allTasks,
  modules,
  dedupeFolders,
  dedupeLists,
}: {
  allTasks: Task[]
  modules: ModuleInstance[]
  dedupeFolders: () => void
  dedupeLists: () => void
}) {
  useEffect(() => {
    dedupeFolders()
    dedupeLists()
  }, [dedupeFolders, dedupeLists])

  const [taskStoreHydrated, setTaskStoreHydrated] = useState(() => useTaskStore.persist.hasHydrated())
  useEffect(() => {
    if (taskStoreHydrated) return
    return useTaskStore.persist.onFinishHydration(() => setTaskStoreHydrated(true))
  }, [taskStoreHydrated])

  const taskScheduleKey = useMemo(() => scheduleMaintenanceKey(allTasks), [allTasks])

  useEffect(() => {
    if (!taskStoreHydrated) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      startTransition(() => {
        const state = useTaskStore.getState()
        let folders = state.folders
        let lists = state.lists
        let tasks = state.tasks
        let foldersDirty = false
        let listsDirty = false
        let tasksDirty = false
        const mut = {
          get folders() { return folders },
          get lists() { return lists },
          get tasks() { return tasks },
          addList: (list: List) => {
            if (lists.some((l) => l.id === list.id)) return
            lists = [...lists, list]
            listsDirty = true
          },
          updateList: (list: List) => {
            lists = lists.map((l) => (l.id === list.id ? list : l))
            listsDirty = true
          },
          addFolder: (folder: Folder) => {
            if (folders.some((f) => f.id === folder.id)) return
            folders = [...folders, folder]
            foldersDirty = true
          },
          updateFolder: (folder: Folder) => {
            folders = folders.map((f) => (f.id === folder.id ? folder : f))
            foldersDirty = true
          },
          deleteFolder: (id: string) => {
            folders = folders.filter((f) => f.id !== id)
            foldersDirty = true
          },
          deleteList: (id: string) => {
            lists = lists.filter((list) => list.id !== id)
            listsDirty = true
          },
        }
        syncNextActionsSmartLists(mut)
        syncScheduledFolderHierarchy(tasks, mut)
        syncFolderAllItemsCategories(mut)
        syncGlobalAllItemsList(mut)
        const joined = joinArchiveListMembership(tasks, lists, folders)
        if (joined !== tasks) {
          tasks = joined
          tasksDirty = true
        }
        if (foldersDirty && sameFolderTree(state.folders, folders)) foldersDirty = false
        if (listsDirty && sameListShelf(state.lists, lists)) listsDirty = false
        if (foldersDirty || listsDirty || tasksDirty) {
          useTaskStore.setState({
            ...(foldersDirty ? { folders } : {}),
            ...(listsDirty ? { lists } : {}),
            ...(tasksDirty ? { tasks } : {}),
          })
        }
        const moduleMut = taskStoreModuleListsMutators()
        syncModuleListFolders(moduleMut, modules)
        syncModuleListContents(moduleMut, modules)
        const filmsIds = modules
          .map((m) => m.config?.filmsCategoryId)
          .filter((id): id is string => typeof id === "string" && !!id)
        const afterModules = useTaskStore.getState().lists
        const withFilm = ensureFilmTypeOnFilmsLists(afterModules, filmsIds)
        if (withFilm !== afterModules) useTaskStore.setState({ lists: withFilm })
      })
    }
    const idle = typeof requestIdleCallback === "function"
      ? requestIdleCallback(run, { timeout: 400 })
      : window.setTimeout(run, 32)
    return () => {
      cancelled = true
      if (typeof cancelIdleCallback === "function" && typeof idle === "number") cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [taskStoreHydrated, taskScheduleKey, modules])
}
