import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import type { Folder, List } from "@/lib/types"
import { readListsNavigation, writeListsNavigation, COGS_NAVIGATE_TO_LIST_EVENT } from "@/lib/app-navigation"
import { openTargetFromEntry, openTargetKey, openTargetReducer } from "@/components/Lists/open-target"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import type { GridEntry, OpenTarget } from "@/components/Lists/types"

const ROOT_LOCATIONS = new Set(["home", "all"])

export function useListsNavigation(categories: List[], folders: Folder[]) {
  const [location, setLocation] = useState<string>(() => readListsNavigation().location)
  const [openTarget, dispatchOpenTarget] = useReducer(
    openTargetReducer,
    null as OpenTarget,
    () => readListsNavigation().openTarget,
  )
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

  const openObjectives = useCallback(() => {
    dispatchOpenTarget({ type: "OPEN_OBJECTIVES" })
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
    writeListsNavigation({ location, openTarget })
  }, [location, openTarget])

  // Sync when another surface (e.g. item detail) requests list navigation.
  useEffect(() => {
    const handler = () => {
      const nav = readListsNavigation()
      setLocation(nav.location)
      dispatchOpenTarget({ type: "SET", target: nav.openTarget })
    }
    window.addEventListener(COGS_NAVIGATE_TO_LIST_EVENT, handler)
    return () => window.removeEventListener(COGS_NAVIGATE_TO_LIST_EVENT, handler)
  }, [])

  useEffect(() => {
    if (ROOT_LOCATIONS.has(location)) return
    if (folders.length === 0) return
    if (folders.some((f) => f.id === location)) return
    setLocation("home")
    dispatchOpenTarget({ type: "CLOSE" })
  }, [folders, location])

  useEffect(() => {
    if (openTarget?.type === "category" && !categories.find((c) => c.id === openTarget.id)) {
      dispatchOpenTarget({ type: "CLOSE" })
    }
    if (
      openTarget?.type === "folder-all" &&
      openTarget.folderId !== ROOT_ALL_FOLDER_ID &&
      !folders.some((f) => f.id === openTarget.folderId)
    ) {
      dispatchOpenTarget({ type: "CLOSE" })
    }
  }, [categories, folders, openTarget])

  return {
    location,
    setLocation,
    openTarget,
    setOpenTarget,
    closeTarget,
    openList,
    openSmartList,
    openHabits,
    openObjectives,
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
