/**
 * components/Inventory/bookshelf/use-shelf-covers.ts — Fetch covers button
 *
 * Shared by the desk shelf and the phone cover browser. The lookup itself
 * lives in `lib/book-lookup.ts`. This only starts it from a click and keeps
 * the status line.
 */
"use client"

import { useState } from "react"
import { bookLookupBusy, fetchShelfBookCovers, type ShelfCoverReport } from "@/lib/book-lookup"
import { useTaskStore } from "@/lib/task-store"
import { tasksForShelf } from "./shelf-books"

export function useShelfCovers(listId: string | null) {
  const [note, setNote] = useState("")
  const [fetching, setFetching] = useState(false)
  const [forList, setForList] = useState(listId)
  if (forList !== listId) {
    setForList(listId)
    setNote("")
  }

  const fetchCovers = () => {
    if (!listId || fetching || bookLookupBusy()) return
    setFetching(true)
    setNote("Fetching covers…")
    const current = tasksForShelf(useTaskStore.getState().tasks, listId)
    void fetchShelfBookCovers(current, (task) => useTaskStore.getState().updateTask(task))
      .then((report) => {
        if (!report.busy) setNote(coverStatus(report))
      })
      .finally(() => setFetching(false))
  }

  return { note, fetching, fetchCovers }
}

export function coverStatus(report: ShelfCoverReport): string {
  if (report.found === 0 && report.unmatched === 0 && report.failed === 0) {
    return report.skipped > 0 ? "Covers already saved." : "Nothing to fetch."
  }
  const pictures = report.covers === 1 ? "1 cover saved." : `${report.covers} covers saved.`
  const reached = report.failed ? ` ${report.failed} could not be reached.` : ""
  return `${pictures} ${report.found} matched. ${report.unmatched} unmatched.${reached}`
}
