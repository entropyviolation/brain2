/**
 * lib/lists-helper/port.ts — The Lists helper's doors into the real stores
 *
 * `browserPort()` reads the task, list, and item-type stores and writes the way the Lists UI does: an edit through
 * `commitItemEdit` (History shows "agent · Lists helper"), many edits through `commitMany` (one store write, one
 * History save), a merge through `setTasks` with tombstones, new rows through `addTask`, and a list, folder, or item type made by `collect-items` through the store's own add functions. "Not duplicates" answers are kept on this device only (`listshelper-dismissed`).
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { applyItemEditPatch, commitItemEdit } from "@/lib/commit-item-edit"
import { recordItemWritesBatch } from "@/lib/item-activity"
import { useItemTypeStore } from "@/lib/item-type-store"
import { noteClearedTaskTombstones, useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import type { Port } from "./types"

export const LISTS_HELPER_ATTRIBUTION = { surface: "agent", name: "Lists helper" } as const

export const useDismissedDuplicates = create<{ keys: string[]; add: (key: string) => void }>()(
  persist((set) => ({ keys: [], add: (key) => set((s) => (s.keys.includes(key) ? s : { keys: [...s.keys, key].slice(-2000) })) }), {
    name: "listshelper-dismissed",
    storage: createJSONStorage(() => localStorage),
  }),
)

export function browserPort(): Port {
  return {
    world: () => {
      const s = useTaskStore.getState()
      return { tasks: s.tasks, lists: s.lists, types: useItemTypeStore.getState().types, folders: s.folders }
    },
    now: () => new Date(),
    commit: (id, patch) => {
      commitItemEdit(id, patch, LISTS_HELPER_ATTRIBUTION)
    },
    commitMany: (changes) => {
      if (!changes.length) return 0
      const patchById = new Map(changes.map((c) => [c.id, c.patch]))
      const at = new Date()
      const pairs: { before: Task; after: Task }[] = []
      const tasks = useTaskStore.getState().tasks
      const next = tasks.map((t) => {
        const patch = patchById.get(t.id)
        if (!patch) return t
        const after = { ...applyItemEditPatch(t, patch), modifiedAt: at.toISOString() }
        pairs.push({ before: t, after })
        return after
      })
      if (!pairs.length) return 0
      useTaskStore.getState().setTasks(next)
      recordItemWritesBatch(pairs, undefined, at, { attribution: LISTS_HELPER_ATTRIBUTION })
      return pairs.length
    },
    replaceTasks: (next, tombstoneIds) => useTaskStore.getState().setTasks(next, tombstoneIds.length ? { tombstoneIds } : undefined),
    addItem: (task) => useTaskStore.getState().addTask(task, LISTS_HELPER_ATTRIBUTION),
    removeItem: (id) => useTaskStore.getState().deleteTask(id),
    addList: (list) => useTaskStore.getState().addList(list),
    removeList: (id) => {
      const s = useTaskStore.getState()
      for (const f of s.folders) if (f.listIds.includes(id)) s.removeListFromFolder(f.id, id)
      s.deleteList(id)
    },
    addFolder: (folder) => useTaskStore.getState().addFolder(folder),
    removeFolder: (id) => useTaskStore.getState().deleteFolder(id),
    fileList: (folderId, listId) => useTaskStore.getState().addListToFolder(folderId, listId),
    addType: (type) => useItemTypeStore.getState().addType(type),
    removeType: (id) => useItemTypeStore.getState().deleteType(id),
    untombstone: (ids) => {
      if (!ids.length) return
      noteClearedTaskTombstones(ids)
      useTaskStore.setState((s) => ({ removedTaskIds: (s.removedTaskIds ?? []).filter((id) => !ids.includes(id)) }))
    },
    isDismissed: (key) => useDismissedDuplicates.getState().keys.includes(key),
    dismiss: (key) => useDismissedDuplicates.getState().add(key),
  }
}
