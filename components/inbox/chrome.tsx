/**
 * Inbox mast, partition keycaps, and the chord legend.
 * Links sits between the keycaps and the legend so that tab keeps its place.
 */
"use client"

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InboxLinks } from "@/components/inbox-links"
import type { InboxPartition } from "@/lib/inbox-batch"
import type { Task } from "@/lib/types"
import { InboxIcon } from "lucide-react"

export function InboxChrome({
  partition,
  showPartition,
  revisitTasks,
  monkeyTasks,
  linkTasks,
}: {
  partition: InboxPartition
  showPartition: (next: InboxPartition) => void
  revisitTasks: Task[]
  monkeyTasks: Task[]
  linkTasks: Task[]
}) {
  return (
    <>
    <DialogHeader className="inbox-mast">
      <DialogTitle className="flex items-center gap-2">
        <InboxIcon className="h-5 w-5" />
        {partition === "monkey" ? "Monkey brain" : partition === "links" ? "Links" : "Inbox — Clarify Your Ideas"}
      </DialogTitle>
      <DialogDescription>
        {partition === "monkey"
          ? "A dump for compulsive, repetitive thoughts. Less weight than Inbox — promote one when you actually mean to revisit it."
          : partition === "links"
            ? "Links sent to BIM, with the note that came after each one."
            : "The pile you mean to revisit."}
      </DialogDescription>
    </DialogHeader>

    <div className="inbox-partitions b2-keycap-tab" role="tablist" aria-label="Inbox partitions">
      <button
        type="button"
        role="tab"
        aria-selected={partition === "inbox"}
        className="inbox-partition"
        onClick={() => showPartition("inbox")}
      >
        <span className="inbox-power-lamp" aria-hidden="true" />
        <span className="inbox-partition-label">Inbox</span>
        <i className="inbox-crt-count" data-heavy={revisitTasks.length >= 10 ? "true" : undefined}>{revisitTasks.length}</i>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={partition === "monkey"}
        className="inbox-partition inbox-partition-monkey"
        onClick={() => showPartition("monkey")}
      >
        <span className="inbox-power-lamp" aria-hidden="true" />
        <span className="inbox-partition-label">Monkey brain</span>
        <i className="inbox-crt-count" data-heavy={monkeyTasks.length >= 10 ? "true" : undefined}>{monkeyTasks.length}</i>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={partition === "links"}
        className="inbox-partition inbox-partition-links"
        onClick={() => showPartition("links")}
      >
        <span className="inbox-power-lamp" aria-hidden="true" />
        <span className="inbox-partition-label">Links</span>
        <i className="inbox-crt-count" data-heavy={linkTasks.length >= 10 ? "true" : undefined}>{linkTasks.length}</i>
      </button>
    </div>
    {partition === "links" ? <InboxLinks links={linkTasks} /> : null}
    <p className="inbox-chord-manual" hidden={partition === "links"}>
      j/k move · x select · shift-click range · a all · n select N · s unsorted · / slice · ↵ clarify · y file · t log · w walk · l list · d due · m merge · b monkey · i inbox · e edit · # delete
    </p>
    </>
  )
}
