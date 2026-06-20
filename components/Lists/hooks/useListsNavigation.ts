import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import type { CategoryFolder, TaskCategory } from "@/lib/types"
import { openTargetFromEntry, openTargetKey, openTargetReducer } from "@/components/Lists/open-target"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import type { GridEntry, OpenTarget } from "@/components/Lists/types"

export function useListsNavigation(categories: TaskCategory[], folders: CategoryFolder[]) {
  const [location, setLocation] = useState<string>("home")
  const [openTarget, dispatchOpenTarget] = useReducer(openTargetReducer, null as OpenTarget)
  const [activeIconId, setActiveIconId] = useState<string | null>(null)

  const setOpenTarget = useCallback((target: OpenTarget) => {
    dispatchOpenTarget({ type: "SET", target })
  }, [])

  const closeTarget = useCallback(() => {
    dispatchOpenTarget({ type: "CLOSE" })
  }, [])

  const isHome = location === "home"
  const isAll = location === "all"
  const currentFolder = useMemo(() => folders.find((f) => f.id === location) || null, [folders, location])

  const navTo = useCallback((loc: string) => {
    setLocation(loc)
    dispatchOpenTarget({ type: "CLOSE" })
    setActiveIconId(null)
  }, [])

  const navigateToFolder = useCallback(
    (folderId: string) => {
      navTo(folderId)
    },
    [navTo],
  )

  const openList = useCallback((listId: string) => {
    dispatchOpenTarget({ type: "OPEN_CATEGORY", id: listId })
  }, [])

  const openSmartList = useCallback((id: "daily" | "weekly" | "monthly") => {
    dispatchOpenTarget({ type: "OPEN_SMART", id })
  }, [])

  const openHabits = useCallback((id: "habits" | "weekly-habits" | "monthly-habits") => {
    dispatchOpenTarget({ type: "OPEN_HABITS", id })
  }, [])

  const openFolderAll = useCallback((folderId: string) => {
    dispatchOpenTarget({ type: "OPEN_FOLDER_ALL", folderId })
  }, [])

  const openEntry = useCallback(
    (entry: GridEntry) => {
      if (entry.kind === "folder") {
        setLocation(entry.id)
        dispatchOpenTarget({ type: "CLOSE" })
        setActiveIconId(null)
        return
      }
      const target = openTargetFromEntry(entry, {
        isAll,
        currentFolderId: currentFolder?.id ?? null,
        rootAllFolderId: ROOT_ALL_FOLDER_ID,
      })
      if (target) dispatchOpenTarget({ type: "SET", target })
    },
    [isAll, currentFolder],
  )

  useEffect(() => {
    if (openTarget?.type === "category" && !categories.find((c) => c.id === openTarget.id)) {
      dispatchOpenTarget({ type: "CLOSE" })
    }
  }, [categories, openTarget])

  return {
    location,
    setLocation,
    openTarget,
    setOpenTarget,
    closeTarget,
    openList,
    openSmartList,
    openHabits,
    openFolderAll,
    activeIconId,
    setActiveIconId,
    isHome,
    isAll,
    currentFolder,
    navTo,
    navigateToFolder,
    openEntry,
    openTargetKey,
  }
}
