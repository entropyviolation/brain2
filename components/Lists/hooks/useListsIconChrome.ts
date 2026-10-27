/**
 * components/Lists/hooks/useListsIconChrome.ts
 *
 * Icon picker, folder auto-organize, and list-desktop epochs. Folder organize
 * and list-desktop epochs stay separate counters. Gravity clears when
 * auto-organize or pile-up runs.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import type { ListDisplay } from "@/lib/lists-ui-store"
import { openTargetKey } from "@/components/Lists/open-target"
import type { GridEntry, IconPickerTarget, OpenTarget } from "@/components/Lists/types"
import {
  layoutVelvetIconGrid,
  VELVET_GRID_FALLBACK_WIDTH,
} from "@/components/Lists/lib/velvet-icon-grid"
import type { Folder, List, Task } from "@/lib/types"

export function useListsIconChrome({
  openTarget,
  currentDisplay,
  location,
  entries,
  categories,
  folders,
  allTasks,
  iconPositions,
  listIconsDesktop,
  listIconsGravity,
  setListIconsGravity,
  commitIconLayout,
  updateList,
  updateFolder,
  updateTask,
}: {
  openTarget: OpenTarget
  currentDisplay: ListDisplay
  location: string
  entries: GridEntry[]
  categories: List[]
  folders: Folder[]
  allTasks: Task[]
  iconPositions: Record<string, { x: number; y: number }>
  listIconsDesktop: Record<string, boolean> | undefined
  listIconsGravity: Record<string, boolean> | undefined
  setListIconsGravity: (key: string, on: boolean) => void
  commitIconLayout: (location: string, laid: Record<string, { x: number; y: number }>, mode: "auto") => void
  updateList: (list: List) => void
  updateFolder: (folder: Folder) => void
  updateTask: (task: Task) => void
}) {
  const [iconPickerFor, setIconPickerFor] = useState<IconPickerTarget>(null)
  const [organizeEpoch, setOrganizeEpoch] = useState(0)
  const [listDesktopOrganizeEpoch, setListDesktopOrganizeEpoch] = useState(0)
  const [listPileEpoch, setListPileEpoch] = useState(0)
  const [listGravityResetEpoch, setListGravityResetEpoch] = useState(0)
  const [listGravitySettleEpoch, setListGravitySettleEpoch] = useState(0)
  const [gravitySettingsOpen, setGravitySettingsOpen] = useState(false)
  const [organizeFromSnapshot, setOrganizeFromSnapshot] = useState<Record<string, { x: number; y: number }> | null>(
    null,
  )
  const velvetCanvasWidthRef = useRef(VELVET_GRID_FALLBACK_WIDTH)

  const openListKey = openTarget && openTarget.type !== "habits" && openTarget.type !== "objectives" ? openTargetKey(openTarget) : ""
  const listIconsDesktopOn = currentDisplay === "icons" && !!openListKey && !!listIconsDesktop?.[openListKey]
  const listIconsGravityOn = !!openListKey && !!listIconsGravity?.[openListKey]

  const applyIcon = (icon: string | undefined) => {
    if (!iconPickerFor) return
    if (iconPickerFor.kind === "category") {
      const c = categories.find((x) => x.id === iconPickerFor.id)
      if (c) updateList({ ...c, icon })
    } else if (iconPickerFor.kind === "folder") {
      const f = folders.find((x) => x.id === iconPickerFor.id)
      if (f) updateFolder({ ...f, icon })
    } else {
      const t = allTasks.find((x) => x.id === iconPickerFor.id)
      if (t) updateTask({ ...t, icon })
    }
    setIconPickerFor(null)
  }

  const handleCanvasWidth = useCallback((width: number) => {
    velvetCanvasWidthRef.current = width
  }, [])

  const handleAutoOrganize = useCallback(() => {
    const keys = entries.map((e) => `${e.kind}-${e.id}`)
    const laid = layoutVelvetIconGrid(keys, velvetCanvasWidthRef.current)
    const snap: Record<string, { x: number; y: number }> = {}
    for (const e of entries) {
      const key = `${e.kind}-${e.id}`
      snap[key] = iconPositions[`${location}:${key}`] ?? laid[key] ?? { x: 16, y: 16 }
    }
    setOrganizeFromSnapshot(snap)
    commitIconLayout(location, laid, "auto")
    setOrganizeEpoch((n) => n + 1)
  }, [location, entries, iconPositions, commitIconLayout])

  const iconPickerCurrent = useMemo(() => {
    if (!iconPickerFor) return undefined
    if (iconPickerFor.kind === "category") return categories.find((x) => x.id === iconPickerFor.id)?.icon
    if (iconPickerFor.kind === "folder") return folders.find((x) => x.id === iconPickerFor.id)?.icon
    return allTasks.find((x) => x.id === iconPickerFor.id)?.icon
  }, [iconPickerFor, categories, folders, allTasks])

  const onListDesktopOrganize = useCallback(() => {
    if (openListKey) setListIconsGravity(openListKey, false)
    setListDesktopOrganizeEpoch((n) => n + 1)
  }, [openListKey, setListIconsGravity])

  const onListIconsGravityChange = useCallback((on: boolean) => {
    if (!openListKey) return
    setListIconsGravity(openListKey, on)
  }, [openListKey, setListIconsGravity])

  const onGravityReset = useCallback(() => {
    if (!openListKey) return
    setListGravityResetEpoch((n) => n + 1)
  }, [openListKey])

  const onGravitySettle = useCallback(() => {
    if (!openListKey) return
    setListGravitySettleEpoch((n) => n + 1)
  }, [openListKey])

  const onGravitySettings = useCallback(() => setGravitySettingsOpen(true), [])

  const onPileUp = useCallback(() => {
    if (openListKey) setListIconsGravity(openListKey, false)
    setListPileEpoch((n) => n + 1)
  }, [openListKey, setListIconsGravity])

  return {
    iconPickerFor,
    setIconPickerFor,
    applyIcon,
    iconPickerCurrent,
    organizeEpoch,
    organizeFromSnapshot,
    setOrganizeFromSnapshot,
    handleAutoOrganize,
    handleCanvasWidth,
    listDesktopOrganizeEpoch,
    listPileEpoch,
    listGravityResetEpoch,
    listGravitySettleEpoch,
    gravitySettingsOpen,
    setGravitySettingsOpen,
    openListKey,
    listIconsDesktopOn,
    listIconsGravityOn,
    onListDesktopOrganize,
    onListIconsGravityChange,
    onGravityReset,
    onGravitySettle,
    onGravitySettings,
    onPileUp,
  }
}
