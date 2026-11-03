/**
 * components/inbox/inbox-view.tsx — Inbox walk, batch, and clarification
 *
 * Public door: `components/inbox.tsx` (`@/components/inbox`). This file owns the
 * state, the handlers, and the order of the dialogs. Behavior is the
 * `inbox.tsx` / `inbox.css` row in `components/README.md`.
 *
 * Three partitions: Inbox (revisit), Monkey brain (compulsive dump), and Links
 * (BIM messages that started with a link; `inbox-links.tsx` owns that tab).
 * Lists the open partition newest first. The header trigger counts the revisit
 * pile only: `stage: "inbox"` and `monkeyBrain` not set. Monkey brain does not
 * add to that well, and an empty revisit pile shows no count. Each dialog tab
 * keeps its own count. `hideTrigger` leaves that button to the pin bar, which
 * owns `open`. Omitting it keeps this button and this file's own open state.
 * At rest the foot is Walk plus Select all / Select N / Select unsorted / a Dated-or-Bare slice.
 * A search field is pinned on the idea well; Select all and the other foot actions use that view.
 * L opens Apply list for the current selection (same as the foot button), including
 * when that search field is focused, and does not filter or remove a row.
 * Apply list search `folder: all` or `all folder` selects that folder's All Items
 * (a folder plate and All). Applying adds `__all-items__{folderId}` and keeps other lists.
 * Pencil and trash show on row hover, and stay on the caret row.
 * A check reveals Apply list, Due, File, Transfer to log, Monkey brain, Bulk edit, and Delete. Merge needs two.
 * Transfer to log drops the selected rows on the click, then writes one Tracking
 * log instant per idea at that idea's createdAt after the click returns.
 * The idea list keeps its scroll offset across that drop and the later write.
 * A failed write puts the rows back. createdAt is the inbox arrival.
 * Clarify, file, and bulk edit do not move it later, and they leave `captureOrigin`.
 * Walk shows that door under the subtitle when the idea stored one.
 * Walk with nothing checked starts at the caret; with checks it walks the selection.
 * Delete, including one row’s trash, asks first. Clarifying or filing awards 1 point;
 * emptying the revisit Inbox awards 50. The foot counts this sitting.
 * Recent lists are the first keys on the clarify sheet.
 * Assigned lists sit under the folders they are filed in. Double-click a chip
 * to preview that list; the × removes it. Unfiled lists have no folder plate.
 *
 * Chrome: milled fascia on `.inbox-dialog` (`inbox.css`) — brushed bay, engraved
 * nameplates, raised metal keys, CRT counts, power lamp on the active partition.
 * Looks only; verbs and accessible names stay.
 *
 * Spec: §4.4 (Clarification), §4.5 (Inbox as a living list). Ideas #243, #244.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"
import { ensureFolderAllListsForIds } from "@/lib/folder-all-items"
import { MergeItemsConfirmDialog } from "@/components/Lists/dialogs/MergeItemsConfirmDialog"
import { MergeItemsDialog } from "@/components/Lists/dialogs/MergeItemsDialog"
import { applyItemMerge, itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import { rememberWorld, undoLastAction } from "@/lib/action-history"
import { creditInboxLogTransfer, handOffInboxLogTransfers } from "@/lib/inbox-transfer-queue"
import { prepareInboxLogTransfers } from "@/lib/inbox-transfer-log"
import {
  applyDeadlineToInboxItems,
  applyListsToInboxItems,
  clarifyInboxItems,
  deleteInboxItems,
  filterInboxByQuery,
  firstWalkId,
  inboxAllSelected,
  inboxBatchTargets,
  inInboxPartition,
  isBareInboxCapture,
  isDatedInboxCapture,
  nextWalkId,
  openInboxIds,
  openRevisitInboxIds,
  pickRandomInboxIds,
  rangeSelectIds,
  rotateInboxQueue,
  setInboxMonkeyBrain,
  sortInboxNewestFirst,
  toggleSelectedId,
  walkQueueIds,
  type InboxPartition,
} from "@/lib/inbox-batch"
import { creditInboxBatchHandling, creditInboxHandling, INBOX_CLEAR_BONUS, INBOX_HANDLE_POINTS, shouldAwardInboxClear } from "@/lib/inbox-credit"
import {
  readInboxRecentListIds,
  recentListIdsFromItems,
  rememberInboxListIds,
  suggestedInboxListIds,
} from "@/lib/inbox-recent-lists"
import { ApplyListDialog } from "./dialogs/apply-list-dialog"
import { InboxBulkEditHost } from "./bulk-edit-host"
import { inboxCaretAfterRemoval } from "./caret"
import { InboxChrome } from "./chrome"
import { TaskClarificationDialog } from "./clarify/clarify-dialog"
import { DeadlineDialog } from "./dialogs/deadline-dialog"
import { DeleteConfirmDialog } from "./dialogs/delete-confirm-dialog"
import { InboxFoot } from "./foot"
import { InboxRows } from "./rows"
import { SelectNDialog } from "./dialogs/select-n-dialog"
import { inboxDayGroups } from "./time"
import { InboxTrigger } from "./trigger"
import { InboxUndoBanner } from "./undo-banner"
import { useInboxChords } from "./hooks/use-inbox-chords"
import { useInboxRowsScroll } from "./hooks/use-inbox-rows-scroll"

interface InboxProps {
  onTaskSelect: (taskId: string) => void
  /** Controlled open state. The pin bar owns this when `hideTrigger` is set. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Omit the header button. The parent renders the key and owns `open`. */
  hideTrigger?: boolean
}


export function Inbox({
  onTaskSelect: _onTaskSelect,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: InboxProps) {
  const allTasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const deleteTask = useTaskStore((state) => state.deleteTask)
  const updateTask = useTaskStore((state) => state.updateTask)
  const setTasks = useTaskStore((state) => state.setTasks)
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const [clarificationTask, setClarificationTask] = useState<Task | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [focusId, setFocusId] = useState<string | null>(null)
  const [walkQueue, setWalkQueue] = useState<string[]>([])
  const [batchMode, setBatchMode] = useState<
    "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  >(null)
  const [batchListIds, setBatchListIds] = useState<string[]>([])
  const [batchDeadline, setBatchDeadline] = useState(formatLocalDateKey(new Date()))
  const [undoLabel, setUndoLabel] = useState<string | null>(null)
  const [partition, setPartition] = useState<InboxPartition>("inbox")
  const [bulkSource, setBulkSource] = useState<{ ids: string[]; text: string; monkey: boolean } | null>(null)
  const [slice, setSlice] = useState<"all" | "bare" | "dated">("all")
  const [query, setQuery] = useState("")
  const [selectCount, setSelectCount] = useState("")
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [sitting, setSitting] = useState({ handled: 0, points: 0 })
  const selectAnchor = useRef<string | null>(null)
  const {
    rowRefs,
    rowsScrollRef,
    pinnedRowsScroll,
    restoringRowsScroll,
    caretScrollSuppressed,
    restorePinnedRowsScroll,
    releaseRowsScrollPin,
  } = useInboxRowsScroll()
  const prevInboxIdsRef = useRef<string[]>([])

  const revisitTasks = useMemo(
    () => sortInboxNewestFirst(allTasks.filter((task) => inInboxPartition(task, "inbox"))),
    [allTasks],
  )
  const monkeyTasks = useMemo(
    () => sortInboxNewestFirst(allTasks.filter((task) => inInboxPartition(task, "monkey"))),
    [allTasks],
  )
  const linkTasks = useMemo(
    () => sortInboxNewestFirst(allTasks.filter((task) => inInboxPartition(task, "links"))),
    [allTasks],
  )
  // Links has its own view. The idea pile behind it is empty so chords and the foot stay idle.
  const pileTasks = partition === "monkey" ? monkeyTasks : partition === "links" ? [] : revisitTasks
  const inboxTasks = useMemo(() => {
    const sliced =
      slice === "bare" ? pileTasks.filter(isBareInboxCapture) : slice === "dated" ? pileTasks.filter(isDatedInboxCapture) : pileTasks
    return filterInboxByQuery(sliced, query)
  }, [pileTasks, slice, query])
  const queryActive = query.trim().length > 0
  /** Select N / unsorted use the whole pile at rest, and only the rows in view while a search is typed. */
  const actionPool = useMemo(() => (queryActive ? inboxTasks : pileTasks), [queryActive, inboxTasks, pileTasks])
  const bareCount = useMemo(() => actionPool.filter(isBareInboxCapture).length, [actionPool])
  const dayGroups = useMemo(() => inboxDayGroups(inboxTasks), [inboxTasks])

  const inboxIdList = useMemo(() => inboxTasks.map((task) => task.id), [inboxTasks])
  const suggestedListIds = useMemo(
    () =>
      suggestedInboxListIds(
        readInboxRecentListIds(),
        recentListIdsFromItems(allTasks),
        lists.map((list) => list.id),
        6,
      ),
    [allTasks, lists],
  )

  useEffect(() => {
    // Slice and search both rewrite the visible ids. Checks that left the view are cleared.
    const prevIds = prevInboxIdsRef.current
    prevInboxIdsRef.current = inboxIdList
    setSelectedIds((ids) => {
      const next = ids.filter((id) => inboxIdList.includes(id))
      return next.length === ids.length ? ids : next
    })
    if (focusId && !inboxIdList.includes(focusId)) {
      // Transfer holds the list still. Park the caret on a neighbor instead of
      // the first row, which scrollIntoView would pull to the top.
      if (pinnedRowsScroll.current != null) {
        const next = inboxCaretAfterRemoval(prevIds, inboxIdList, focusId)
        if (next.stayed && next.id) caretScrollSuppressed.current = next.id
        setFocusId(next.id)
      } else {
        setFocusId(inboxIdList[0] ?? null)
      }
    } else if (open && !focusId && inboxIdList[0]) {
      setFocusId(inboxIdList[0])
    }
  }, [inboxIdList, focusId, open])

  const walking = walkQueue.length > 0
  const nestedOpen = Boolean(clarificationTask) || batchMode !== null
  const batchTargets = inboxBatchTargets(selectedIds, focusId)
  const allSelected = inboxAllSelected(inboxIdList, selectedIds)
  const mergeItems = useMemo(
    () => selectedIds.map((id) => allTasks.find((task) => task.id === id)).filter((task): task is Task => !!task),
    [selectedIds, allTasks],
  )
  const deletePreview = useMemo(
    () =>
      pendingDeleteIds
        .map((id) => allTasks.find((task) => task.id === id))
        .filter((task): task is Task => !!task),
    [pendingDeleteIds, allTasks],
  )

  const resetSession = () => {
    setSelectedIds([])
    setFocusId(null)
    setWalkQueue([])
    setClarificationTask(null)
    setBatchMode(null)
    setUndoLabel(null)
    setSlice("all")
    setQuery("")
    setPendingDeleteIds([])
    setSitting({ handled: 0, points: 0 })
    selectAnchor.current = null
  }

  const noteSitting = (count: number, openBefore: number, openAfter: number) => {
    if (count <= 0) return
    const points = count * INBOX_HANDLE_POINTS + (shouldAwardInboxClear(openBefore, openAfter) ? INBOX_CLEAR_BONUS : 0)
    setSitting((prev) => ({ handled: prev.handled + count, points: prev.points + points }))
  }

  const creditHandled = (task: Task, openBefore: number) => {
    const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
    creditInboxHandling({
      taskId: task.id,
      title: itemTitle(task),
      openBefore,
      openAfter,
    })
    noteSitting(1, openBefore, openAfter)
  }

  const handleClarifyTask = (task: Task) => {
    setClarificationTask(task)
    setFocusId(task.id)
  }

  const handleDeleteIdea = (task: Task) => {
    setPendingDeleteIds([task.id])
    setBatchMode("delete-confirm")
  }

  const deleteIdeaNow = (task: Task) => {
    const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
    deleteTask(task.id)
    creditHandled(task, openBefore)
    setSelectedIds((ids) => ids.filter((id) => id !== task.id))
  }

  const advanceWalk = (afterId: string) => {
    const openIds = openInboxIds(useTaskStore.getState().tasks)
    const nextId = nextWalkId(walkQueue, openIds, afterId)
    if (!nextId) {
      setWalkQueue([])
      setClarificationTask(null)
      return
    }
    const next = useTaskStore.getState().tasks.find((task) => task.id === nextId) ?? null
    setClarificationTask(next)
    if (next) setFocusId(next.id)
  }

  const handleClarificationSave = (updatedTask: Task) => {
    const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
    rememberInboxListIds(updatedTask.lists ?? [])
    updateTask(updatedTask)
    creditHandled(updatedTask, openBefore)
    setSelectedIds((ids) => ids.filter((id) => id !== updatedTask.id))
    if (walking) advanceWalk(updatedTask.id)
    else setClarificationTask(null)
  }

  const handleClarificationClose = () => {
    setClarificationTask(null)
    setWalkQueue([])
  }

  const handleSkip = () => {
    if (!clarificationTask) return
    advanceWalk(clarificationTask.id)
  }

  const handleDiscard = () => {
    if (!clarificationTask) return
    const id = clarificationTask.id
    deleteIdeaNow(clarificationTask)
    if (walking) advanceWalk(id)
    else setClarificationTask(null)
  }

  const startWalk = (fromId?: string | null) => {
    const start = fromId ?? focusId
    const queue =
      selectedIds.length > 0
        ? walkQueueIds(inboxIdList, selectedIds, start)
        : rotateInboxQueue(inboxIdList, start)
    const openIds = openInboxIds(inboxTasks)
    const first = firstWalkId(queue, openIds)
    if (!first) return
    setWalkQueue(queue)
    const task = inboxTasks.find((item) => item.id === first) ?? null
    setClarificationTask(task)
    if (task) setFocusId(task.id)
  }

  const runBatch = (label: string, nextTasks: Task[]) => {
    rememberWorld(label)
    setTasks(nextTasks)
    setUndoLabel(label)
    setBatchMode(null)
    setBatchListIds([])
  }

  const ensureChosenFolderAll = (listIds: string[]) => {
    ensureFolderAllListsForIds(() => {
      const state = useTaskStore.getState()
      return {
        lists: state.lists,
        folders: state.folders,
        addList: state.addList,
        updateList: state.updateList,
        updateFolder: state.updateFolder,
      }
    }, listIds)
  }

  const applyBatchLists = () => {
    if (batchTargets.length === 0 || batchListIds.length === 0) return
    ensureChosenFolderAll(batchListIds)
    rememberInboxListIds(batchListIds)
    runBatch("inbox apply list", applyListsToInboxItems(allTasks, batchTargets, batchListIds))
  }

  const applyBatchListsAndClarify = () => {
    if (batchTargets.length === 0 || batchListIds.length === 0) return
    ensureChosenFolderAll(batchListIds)
    const filed = batchTargets
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    const withLists = applyListsToInboxItems(allTasks, batchTargets, batchListIds)
    rememberInboxListIds(batchListIds)
    runBatch("inbox apply and clarify", clarifyInboxItems(withLists, batchTargets))
    creditInboxBatchHandling(
      filed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openRevisitInboxIds(useTaskStore.getState().tasks).size,
    )
    noteSitting(filed.length, openBefore, openRevisitInboxIds(useTaskStore.getState().tasks).size)
    setSelectedIds((ids) => ids.filter((id) => !batchTargets.includes(id)))
  }

  const applyBatchDeadline = () => {
    const deadline = parseLocalDate(batchDeadline)
    if (batchTargets.length === 0 || !deadline) return
    runBatch("inbox apply deadline", applyDeadlineToInboxItems(allTasks, batchTargets, deadline))
  }

  const applyDeleteSelection = () => {
    const ids = pendingDeleteIds.length > 0 ? pendingDeleteIds : selectedIds
    if (ids.length === 0) return
    const doomed = ids
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    rememberWorld("inbox delete selection")
    setTasks(deleteInboxItems(allTasks, ids), { tombstoneIds: ids })
    const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
    creditInboxBatchHandling(
      doomed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openAfter,
    )
    noteSitting(doomed.length, openBefore, openAfter)
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    setPendingDeleteIds([])
    setUndoLabel("inbox delete selection")
    setBatchMode(null)
  }

  const applyClarifySelection = () => {
    if (selectedIds.length === 0) return
    const filed = selectedIds
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    runBatch("inbox mark clarified", clarifyInboxItems(allTasks, selectedIds))
    creditInboxBatchHandling(
      filed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openRevisitInboxIds(useTaskStore.getState().tasks).size,
    )
    noteSitting(filed.length, openBefore, openRevisitInboxIds(useTaskStore.getState().tasks).size)
    setSelectedIds([])
  }

  const applyTransferToLog = () => {
    const ids = selectedIds.filter((id) => inboxIdList.includes(id))
    if (ids.length === 0) return
    const prepared = prepareInboxLogTransfers(useTaskStore.getState().tasks, ids)
    if (prepared.length === 0) return
    const openBefore = openRevisitInboxIds(allTasks).size
    // Hold the idea-list offset before the rows leave. The caret used to jump
    // to the first row, and scrollIntoView on the next list paint pulled the
    // well to the top. The later log write can paint again; the hold outlives it.
    const scroller = rowsScrollRef.current
    if (scroller) pinnedRowsScroll.current = scroller.scrollTop
    const handed = handOffInboxLogTransfers(prepared, {
      onFailure: ({ tasks, points }) => {
        setSitting((prev) => ({
          handled: Math.max(0, prev.handled - tasks.length),
          points: Math.max(0, prev.points - points),
        }))
        setUndoLabel((label) => (label === "inbox transfer to log" ? "inbox transfer failed" : label))
      },
    })
    if (handed.length === 0) {
      pinnedRowsScroll.current = null
      return
    }
    const handedSet = new Set(handed)
    const moved = prepared.filter((item) => handedSet.has(item.task.id))
    const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
    creditInboxLogTransfer(
      moved.map((item) => ({ taskId: item.task.id, title: itemTitle(item.task) })),
      openBefore,
      openAfter,
    )
    noteSitting(moved.length, openBefore, openAfter)
    setSelectedIds((prev) => prev.filter((id) => !handedSet.has(id)))
    setUndoLabel("inbox transfer to log")
    // Same turn shape as the log write (frame, then a timeout) so the hold
    // is still on when that paint commits, and gone before the next gesture.
    const dropPin = () => {
      pinnedRowsScroll.current = null
    }
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        setTimeout(dropPin, 0)
      })
    } else {
      setTimeout(dropPin, 0)
    }
  }

  const movePartition = (toMonkey: boolean) => {
    if (selectedIds.length === 0) return
    runBatch(
      toMonkey ? "inbox to monkey brain" : "monkey brain to inbox",
      setInboxMonkeyBrain(allTasks, selectedIds, toMonkey),
    )
    setSelectedIds([])
  }

  const showPartition = (next: InboxPartition) => {
    if (next === partition) return
    setPartition(next)
    setSelectedIds([])
    setFocusId(null)
    setWalkQueue([])
    setUndoLabel(null)
  }

  const openBulkEdit = () => {
    const ordered = inboxTasks.filter((task) => selectedIds.includes(task.id))
    if (ordered.length === 0) return
    setBulkSource({
      ids: ordered.map((task) => task.id),
      text: ordered.map((task) => itemTitle(task)).join("\n"),
      monkey: partition === "monkey",
    })
  }

  const applyMerge = (plan: ItemMergePlan) => {
    rememberWorld("inbox merge")
    setTasks(applyItemMerge(allTasks, plan), { tombstoneIds: plan.discardedIds })
    setSelectedIds((ids) => ids.filter((id) => id === plan.survivorId || !plan.discardedIds.includes(id)))
    setFocusId(plan.survivorId)
    setUndoLabel("inbox merge")
    setBatchMode(null)
  }

  const moveFocus = (delta: number) => {
    if (inboxIdList.length === 0) return
    releaseRowsScrollPin()
    const i = Math.max(0, inboxIdList.indexOf(focusId ?? inboxIdList[0]))
    const next = inboxIdList[(i + delta + inboxIdList.length) % inboxIdList.length]
    setFocusId(next)
  }

  const clickRow = (id: string, shift: boolean) => {
    releaseRowsScrollPin()
    setFocusId(id)
    if (shift) {
      setSelectedIds(rangeSelectIds(inboxIdList, selectAnchor.current ?? focusId, id))
      return
    }
    selectAnchor.current = id
    setSelectedIds((ids) => toggleSelectedId(ids, id))
  }

  const applySelectN = () => {
    const n = Number.parseInt(selectCount, 10)
    setBatchMode(null)
    setSelectCount("")
    if (!Number.isFinite(n) || n <= 0) return
    const ids = pickRandomInboxIds(
      actionPool.map((task) => task.id),
      n,
    )
    if (!query.trim()) setSlice("all")
    setSelectedIds(ids)
    selectAnchor.current = ids[0] ?? null
    if (ids[0]) setFocusId(ids[0])
  }

  const selectUnsorted = () => {
    const ids = actionPool.filter(isBareInboxCapture).map((task) => task.id)
    if (!query.trim()) setSlice("all")
    setSelectedIds(ids)
    selectAnchor.current = ids[0] ?? null
    if (ids[0]) setFocusId(ids[0])
  }

  const cycleSlice = () => {
    setSlice((current) => (current === "all" ? "dated" : current === "dated" ? "bare" : "all"))
  }

  /** Same path as the Apply list foot button. Does not touch the selection or the pile. */
  const openApplyList = () => {
    setBatchMode("list")
  }

  // Caret scroll stays here, after the selection effect. The scroll hook's
  // layout restore runs first. `nestedOpen` is known only once the walk and
  // batch dialogs are decided, so this effect is not inside that hook.
  useEffect(() => {
    if (!open || !focusId || nestedOpen) return
    if (pinnedRowsScroll.current != null || caretScrollSuppressed.current === focusId) {
      if (caretScrollSuppressed.current === focusId) caretScrollSuppressed.current = null
      restorePinnedRowsScroll()
      return
    }
    rowRefs.current.get(focusId)?.scrollIntoView?.({ block: "nearest" })
  }, [focusId, open, inboxIdList, nestedOpen])

  useInboxChords({
    open,
    nestedOpen,
    partition,
    selectedIds,
    focusId,
    moveFocus,
    setSelectedIds,
    inboxIdList,
    actionPool,
    setSelectCount,
    setBatchMode,
    selectUnsorted,
    cycleSlice,
    inboxTasks,
    handleClarifyTask,
    startWalk,
    batchTargets,
    openApplyList,
    setPendingDeleteIds,
    applyClarifySelection,
    applyTransferToLog,
    movePartition,
    openBulkEdit,
    pileTasks,
  })

  const handleUndo = useCallback(() => {
    undoLastAction()
    setUndoLabel(null)
  }, [])

  const walkPosition = clarificationTask ? walkQueue.indexOf(clarificationTask.id) + 1 : 0

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetSession()
        }}
      >
        {hideTrigger ? null : (
          <InboxTrigger revisitTasks={revisitTasks} monkeyTasks={monkeyTasks} />
        )}
        <DialogContent className="inbox-dialog fm98-dialog sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-ui-name="Inbox" data-ui-docs="components/README.md">
          <InboxChrome
            partition={partition}
            showPartition={showPartition}
            revisitTasks={revisitTasks}
            monkeyTasks={monkeyTasks}
            linkTasks={linkTasks}
          />

          {undoLabel && partition !== "links" && (
            <InboxUndoBanner undoLabel={undoLabel} handleUndo={handleUndo} />
          )}

          <InboxRows
            partition={partition}
            query={query}
            setQuery={setQuery}
            rowsScrollRef={rowsScrollRef}
            releaseRowsScrollPin={releaseRowsScrollPin}
            restoringRowsScroll={restoringRowsScroll}
            restorePinnedRowsScroll={restorePinnedRowsScroll}
            walking={walking}
            inboxTasks={inboxTasks}
            pileTasks={pileTasks}
            queryActive={queryActive}
            dayGroups={dayGroups}
            selectedIds={selectedIds}
            focusId={focusId}
            rowRefs={rowRefs}
            clickRow={clickRow}
            selectAnchor={selectAnchor}
            setFocusId={setFocusId}
            setSelectedIds={setSelectedIds}
            handleClarifyTask={handleClarifyTask}
            handleDeleteIdea={handleDeleteIdea}
          />

          {pileTasks.length > 0 && (
            <InboxFoot
              inboxTasks={inboxTasks}
              sitting={sitting}
              partition={partition}
              selectedIds={selectedIds}
              allSelected={allSelected}
              inboxIdList={inboxIdList}
              setSelectedIds={setSelectedIds}
              setSelectCount={setSelectCount}
              setBatchMode={setBatchMode}
              bareCount={bareCount}
              selectUnsorted={selectUnsorted}
              cycleSlice={cycleSlice}
              slice={slice}
              openApplyList={openApplyList}
              applyClarifySelection={applyClarifySelection}
              applyTransferToLog={applyTransferToLog}
              movePartition={movePartition}
              openBulkEdit={openBulkEdit}
              setPendingDeleteIds={setPendingDeleteIds}
              startWalk={startWalk}
              focusId={focusId}
            />
          )}
        </DialogContent>
      </Dialog>

      {clarificationTask && (
        <TaskClarificationDialog
          task={clarificationTask}
          open
          walking={walking}
          walkPosition={Math.max(walkPosition, 1)}
          walkTotal={walkQueue.length || 1}
          suggestedListIds={suggestedListIds}
          onClose={handleClarificationClose}
          onSkip={walking ? handleSkip : undefined}
          onDiscard={handleDiscard}
          onSave={handleClarificationSave}
        />
      )}

      <ApplyListDialog
        batchMode={batchMode}
        setBatchMode={setBatchMode}
        batchTargets={batchTargets}
        batchListIds={batchListIds}
        setBatchListIds={setBatchListIds}
        applyBatchLists={applyBatchLists}
        applyBatchListsAndClarify={applyBatchListsAndClarify}
      />

      <DeadlineDialog
        batchMode={batchMode}
        setBatchMode={setBatchMode}
        batchTargets={batchTargets}
        batchDeadline={batchDeadline}
        setBatchDeadline={setBatchDeadline}
        applyBatchDeadline={applyBatchDeadline}
      />

      <SelectNDialog
        batchMode={batchMode}
        setBatchMode={setBatchMode}
        actionPool={actionPool}
        queryActive={queryActive}
        selectCount={selectCount}
        setSelectCount={setSelectCount}
        applySelectN={applySelectN}
      />

      <DeleteConfirmDialog
        batchMode={batchMode}
        setBatchMode={setBatchMode}
        deletePreview={deletePreview}
        partition={partition}
        revisitTasks={revisitTasks}
        pendingDeleteIds={pendingDeleteIds}
        setPendingDeleteIds={setPendingDeleteIds}
        applyDeleteSelection={applyDeleteSelection}
      />

      <MergeItemsConfirmDialog
        open={batchMode === "merge-confirm"}
        itemNames={mergeItems.map(itemMergeLabel)}
        onCancel={() => setBatchMode(null)}
        onContinue={() => setBatchMode("merge-plan")}
      />
      <InboxBulkEditHost
        bulkSource={bulkSource}
        setBulkSource={setBulkSource}
        updateTask={updateTask}
        setTasks={setTasks}
        noteSitting={noteSitting}
        setSelectedIds={setSelectedIds}
        setUndoLabel={setUndoLabel}
      />

      <MergeItemsDialog
        open={batchMode === "merge-plan"}
        items={mergeItems}
        lists={lists}
        onClose={() => setBatchMode(null)}
        onMerge={applyMerge}
      />
    </>
  )
}
