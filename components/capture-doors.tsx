/**
 * components/capture-doors.tsx — Ingest, From Notes, and Phone Notes
 *
 * The dialogs stay mounted (`CaptureDoorHost`) so a From Notes listing survives
 * closing the popup. Settings and global Lists settings render the same
 * labeled buttons (`CaptureDoorButtons`); both open that one popup.
 */
"use client"

import { Loader2, MessageSquare, Notebook, StickyNote } from "lucide-react"
import { openCaptureDoor, useNotesTriggerLabel } from "@/components/capture-door-bus"
import { IngestLogDialog } from "@/components/ingest-log-dialog"
import { IphoneNotesStore } from "@/components/iphone-notes-store"
import { NotesIngest } from "@/components/notes-ingest"
import { Button } from "@/components/ui/button"
import { useIngestStore } from "@/lib/ingest/ingest-store"

/** Always mounted from the page. Triggers stay off; the dialogs portal when asked. */
export function CaptureDoorHost() {
  return (
    <>
      <IngestLogDialog hideTrigger />
      <NotesIngest hideTrigger />
      <IphoneNotesStore hideTrigger />
    </>
  )
}

export function CaptureDoorButtons() {
  const pendingCount = useIngestStore((s) => Object.keys(s.pendingByChat).length)
  const notesLabel = useNotesTriggerLabel()
  const listing = notesLabel === "Listing…"

  return (
    <section className="space-y-3" aria-label="Notes and ingest" data-ui-name="Notes and ingest">
      <div className="space-y-1">
        <h3 className="font-semibold">Notes and ingest</h3>
        <p className="text-sm text-muted-foreground">Ingest, From Notes, and Phone Notes.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openCaptureDoor("ingest")}>
          <MessageSquare className="h-4 w-4" />
          <span>Ingest</span>
          {pendingCount > 0 ? (
            <span className="b2-shell-count" title={`${pendingCount} pending ingest chat${pendingCount === 1 ? "" : "s"}`}>
              {pendingCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          aria-busy={listing}
          title={listing ? "Listing continues in the background — click to return" : undefined}
          onClick={() => openCaptureDoor("notes")}
        >
          {listing ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
          <span>{notesLabel}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openCaptureDoor("phone")}>
          <Notebook className="h-4 w-4" />
          <span>Phone Notes</span>
        </Button>
      </div>
    </section>
  )
}
