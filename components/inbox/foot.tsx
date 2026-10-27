/**
 * Sitting line and foot keys for the idea pile.
 * Rendered when the pile has ideas. An empty visible slice adds `inbox-foot-empty`.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import type { InboxPartition } from "@/lib/inbox-batch"

export function InboxFoot({
  inboxTasks,
  sitting,
  partition,
  selectedIds,
  allSelected,
  inboxIdList,
  setSelectedIds,
  setSelectCount,
  setBatchMode,
  bareCount,
  selectUnsorted,
  cycleSlice,
  slice,
  openApplyList,
  applyClarifySelection,
  applyTransferToLog,
  movePartition,
  openBulkEdit,
  setPendingDeleteIds,
  startWalk,
  focusId,
}: {
  inboxTasks: { id: string }[]
  sitting: { handled: number; points: number }
  partition: InboxPartition
  selectedIds: string[]
  allSelected: boolean
  inboxIdList: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setSelectCount: Dispatch<SetStateAction<string>>
  setBatchMode: (mode: "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null) => void
  bareCount: number
  selectUnsorted: () => void
  cycleSlice: () => void
  slice: "all" | "bare" | "dated"
  openApplyList: () => void
  applyClarifySelection: () => void
  applyTransferToLog: () => void
  movePartition: (toMonkey: boolean) => void
  openBulkEdit: () => void
  setPendingDeleteIds: Dispatch<SetStateAction<string[]>>
  startWalk: (fromId?: string | null) => void
  focusId: string | null
}) {
  return (
    <div className={`inbox-foot${inboxTasks.length === 0 ? " inbox-foot-empty" : ""}`}>
      <p className="inbox-foot-meta">
        <span>
          {sitting.handled > 0
            ? `${sitting.handled} this sitting · ${sitting.points} pts`
            : "This sitting"}
          {partition === "inbox" ? " · 50 when this pile hits 0" : ""}
          {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ""}
        </span>
      </p>
      {inboxTasks.length === 0 ? null : (
      <div className="inbox-foot-actions">
        {!allSelected && inboxIdList.length > 0 && (
          <Button variant="outline" onClick={() => setSelectedIds(inboxIdList)} title="Select every visible idea (A)">
            <i className="inbox-keycap">A</i>Select all
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setSelectCount("")
            setBatchMode("select-n")
          }}
          title="Pick a number of ideas at random (N)"
        >
          <i className="inbox-keycap">N</i>Select N
        </Button>
        {bareCount > 0 && (
          <Button variant="outline" onClick={selectUnsorted} title="Select ideas that are only a name (S)">
            <i className="inbox-keycap">S</i>Select unsorted
          </Button>
        )}
        {selectedIds.length > 0 && (
          <Button variant="outline" onClick={() => setSelectedIds([])} title="Clear the selection (U)">
            <i className="inbox-keycap">U</i>Deselect
          </Button>
        )}
        <Button variant="outline" onClick={cycleSlice} title="Cycle All, Dated, Bare (/)">
          <i className="inbox-keycap">/</i>
          {slice === "dated" ? "Dated" : slice === "bare" ? "Bare" : "All"}
        </Button>
        {selectedIds.length > 0 && (
          <>
            <Button variant="outline" onClick={openApplyList} title="Apply a list (L)">
              <i className="inbox-keycap">L</i>Apply list
            </Button>
            <Button variant="outline" onClick={() => setBatchMode("deadline")} title="Set a due day (D)">
              <i className="inbox-keycap">D</i>Due
            </Button>
            <Button variant="outline" onClick={applyClarifySelection} title="File the selection onto its lists, or All Items (Y)">
              <i className="inbox-keycap">Y</i>File
            </Button>
            <Button
              variant="outline"
              onClick={applyTransferToLog}
              title="Put the selection on the Tracking log at each idea's original time (T)"
            >
              <i className="inbox-keycap">T</i>Transfer to log
            </Button>
            <Button
              variant="outline"
              onClick={() => movePartition(partition !== "monkey")}
              title={partition === "monkey" ? "Send the selection to Inbox (I)" : "Send the selection to Monkey brain (B)"}
            >
              <i className="inbox-keycap">{partition === "monkey" ? "I" : "B"}</i>
              {partition === "monkey" ? "To inbox" : "Monkey brain"}
            </Button>
            <Button variant="outline" onClick={openBulkEdit} title="Edit the selection as bulk-add text (E)">
              <i className="inbox-keycap">E</i>Bulk edit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDeleteIds(selectedIds)
                setBatchMode("delete-confirm")
              }}
              title="Delete the selected ideas (#)"
            >
              <i className="inbox-keycap">#</i>Delete
            </Button>
          </>
        )}
        {selectedIds.length >= 2 && (
          <Button variant="outline" onClick={() => setBatchMode("merge-confirm")} title="Merge the selection (M)">
            <i className="inbox-keycap">M</i>Merge
          </Button>
        )}
        {inboxIdList.length > 0 && (
          <Button
            onClick={() => startWalk(focusId)}
            className="gap-2"
            title={selectedIds.length > 0 ? "Walk the checked ideas (W)" : "Walk from the caret (W)"}
          >
            <i className="inbox-keycap">W</i>
            {selectedIds.length > 0 ? "Walk selected" : "Walk"}
          </Button>
        )}
      </div>
      )}
    </div>
  )
}
