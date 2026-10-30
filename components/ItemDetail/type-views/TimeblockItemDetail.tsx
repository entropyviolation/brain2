/**
 * components/ItemDetail/type-views/TimeblockItemDetail.tsx — Timeblock desk
 *
 * An interval already on the grid opens in EntryDialog. Close dismisses that
 * editor and leaves the item. An instant does not open it. A missing block
 * stays missing.
 */
"use client"

import { useState } from "react"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { TRACKING_ITEM_ATTR } from "@/lib/tracking-item-types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

function entryPointer(task: Task): string {
  const value = task.attributes?.[TRACKING_ITEM_ATTR.entryId]
  return typeof value === "string" ? value.trim() : ""
}

function opensInBlockEditor(kind: string | undefined): boolean {
  return kind == null || kind === "interval"
}

export function TimeblockItemDetail({ task }: { task: Task }) {
  const pointerId = entryPointer(task)
  const entry = useTimeTrackingStore((state) => state.entries.find((row) => row.id === pointerId) ?? null)
  const [open, setOpen] = useState(true)
  const [forTask, setForTask] = useState(task.id)

  if (forTask !== task.id) {
    setForTask(task.id)
    setOpen(true)
  }

  if (!entry) {
    return (
      <section className="id-bay" aria-label="Time block">
        <p>This block is no longer on the grid.</p>
      </section>
    )
  }

  if (!opensInBlockEditor(entry.kind)) {
    return (
      <section className="id-bay" aria-label="Time block">
        <p>This is an instant on the grid.</p>
      </section>
    )
  }

  if (!open) {
    return (
      <section className="id-bay" aria-label="Time block">
        <header className="id-attrs-head">
          <span className="id-attrs-plate">{(entry.title ?? "").trim() || "Time block"}</span>
          <button type="button" className="id-keycap" onClick={() => setOpen(true)}>
            Edit the clock
          </button>
        </header>
      </section>
    )
  }

  return <EntryDialog entry={entry} onClose={() => setOpen(false)} />
}
