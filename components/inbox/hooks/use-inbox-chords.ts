/**
 * components/inbox/hooks/use-inbox-chords.ts
 * Window chord listener for the idea pile.
 * Off while a nested dialog is open, on the Links tab, and in an editable field, except L on the search field.
 */
"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"
import { INBOX_CHORDS, isInboxEditableTarget, toggleSelectedId, type InboxPartition } from "@/lib/inbox-batch"
import type { Task } from "@/lib/types"

type BatchMode = "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null

export function useInboxChords({
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
}: {
  open: boolean
  nestedOpen: boolean
  partition: InboxPartition
  selectedIds: string[]
  focusId: string | null
  moveFocus: (delta: number) => void
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  inboxIdList: string[]
  actionPool: { length: number }
  setSelectCount: Dispatch<SetStateAction<string>>
  setBatchMode: (mode: BatchMode) => void
  selectUnsorted: () => void
  cycleSlice: () => void
  inboxTasks: Task[]
  handleClarifyTask: (task: Task) => void
  startWalk: (fromId?: string | null) => void
  batchTargets: { length: number }
  openApplyList: () => void
  setPendingDeleteIds: Dispatch<SetStateAction<string[]>>
  applyClarifySelection: () => void
  applyTransferToLog: () => void
  movePartition: (toMonkey: boolean) => void
  openBulkEdit: () => void
  pileTasks: Task[]
}) {
  useEffect(() => {
    if (!open || nestedOpen || partition === "links") return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key
      // Search ideas would otherwise take "l" and hide titles that lack that letter.
      // With a selection, L is Apply list — the same opener as the foot button.
      const applyListChord = key === "l" || (key === "L" && !e.shiftKey)
      const searchStealingApplyList =
        applyListChord &&
        selectedIds.length > 0 &&
        e.target instanceof HTMLElement &&
        Boolean(e.target.closest(".inbox-search"))
      if (isInboxEditableTarget(e.target) && !searchStealingApplyList) return
      const go = (list: readonly string[]) => list.includes(key)
      if (go(INBOX_CHORDS.next)) {
        e.preventDefault()
        moveFocus(1)
      } else if (go(INBOX_CHORDS.prev)) {
        e.preventDefault()
        moveFocus(-1)
      } else if (go(INBOX_CHORDS.toggle) || (key === " " && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault()
        if (focusId) setSelectedIds((ids) => toggleSelectedId(ids, focusId))
      } else if (go(INBOX_CHORDS.selectAll)) {
        e.preventDefault()
        setSelectedIds(inboxIdList)
      } else if (go(INBOX_CHORDS.deselectAll)) {
        e.preventDefault()
        setSelectedIds([])
      } else if (go(INBOX_CHORDS.selectN)) {
        e.preventDefault()
        if (actionPool.length > 0) {
          setSelectCount("")
          setBatchMode("select-n")
        }
      } else if (go(INBOX_CHORDS.selectUnsorted)) {
        e.preventDefault()
        selectUnsorted()
      } else if (go(INBOX_CHORDS.slice)) {
        e.preventDefault()
        cycleSlice()
      } else if (go(INBOX_CHORDS.clarify)) {
        if (e.target instanceof HTMLButtonElement && key === "Enter") return
        e.preventDefault()
        const task = inboxTasks.find((item) => item.id === focusId)
        if (task) handleClarifyTask(task)
      } else if (go(INBOX_CHORDS.walk)) {
        e.preventDefault()
        startWalk(focusId)
      } else if (go(INBOX_CHORDS.applyList) || (key === "L" && !e.shiftKey)) {
        e.preventDefault()
        if (batchTargets.length) openApplyList()
      } else if (go(INBOX_CHORDS.applyDeadline)) {
        e.preventDefault()
        if (batchTargets.length) setBatchMode("deadline")
      } else if (go(INBOX_CHORDS.merge)) {
        e.preventDefault()
        if (selectedIds.length >= 2) setBatchMode("merge-confirm")
      } else if (go(INBOX_CHORDS.deleteSelection)) {
        e.preventDefault()
        if (selectedIds.length > 0) {
          setPendingDeleteIds(selectedIds)
          setBatchMode("delete-confirm")
        }
      } else if (go(INBOX_CHORDS.markClarified)) {
        e.preventDefault()
        if (selectedIds.length > 0) applyClarifySelection()
      } else if (go(INBOX_CHORDS.transferLog)) {
        e.preventDefault()
        if (selectedIds.length > 0) applyTransferToLog()
      } else if (go(INBOX_CHORDS.toMonkey) && partition === "inbox") {
        e.preventDefault()
        if (selectedIds.length > 0) movePartition(true)
      } else if (go(INBOX_CHORDS.toInbox) && partition === "monkey") {
        e.preventDefault()
        if (selectedIds.length > 0) movePartition(false)
      } else if (go(INBOX_CHORDS.bulkEdit)) {
        e.preventDefault()
        if (selectedIds.length > 0) openBulkEdit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // Intentional: chords read latest closure each time the list/focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nestedOpen, inboxTasks, inboxIdList, focusId, selectedIds, batchTargets, partition, pileTasks, actionPool])
}
