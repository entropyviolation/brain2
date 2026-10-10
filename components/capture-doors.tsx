/**
 * components/capture-doors.tsx — Ingest, From Notes, and Phone Notes
 *
 * `CaptureDoorHost` mounts each dialog the first time that door is opened,
 * then leaves it mounted so a From Notes listing survives closing the popup.
 * The three dialogs are dynamic imports: a refresh should not parse
 * notes-ingest, Phone Notes, or the ingest log until the button is clicked.
 * Settings and global Lists settings render the same labeled buttons
 * (`CaptureDoorButtons`); both open that one popup.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import { Loader2, MessageSquare, Notebook, StickyNote } from "lucide-react"
import {
  openCaptureDoor,
  subscribeCaptureDoor,
  useNotesTriggerLabel,
  type CaptureDoor,
} from "@/components/capture-door-bus"
import { Button } from "@/components/ui/button"
import { useIngestStore } from "@/lib/ingest/ingest-store"

type DoorDialog = ComponentType<{ hideTrigger?: boolean }>

function loadCaptureDoor(door: CaptureDoor): Promise<DoorDialog> {
  if (door === "ingest") {
    return import("@/components/ingest-log-dialog").then((mod) => mod.IngestLogDialog)
  }
  if (door === "notes") {
    return import("@/components/notes-ingest").then((mod) => mod.NotesIngest)
  }
  return import("@/components/iphone-notes-store").then((mod) => mod.IphoneNotesStore)
}

function CaptureDoorSlot({ door }: { door: CaptureDoor }) {
  const [Dialog, setDialog] = useState<DoorDialog | null>(null)

  useEffect(() => {
    let live = true
    void loadCaptureDoor(door).then((Loaded) => {
      if (live) setDialog(() => Loaded)
    })
    return () => {
      live = false
    }
  }, [door])

  if (!Dialog) return null
  return <Dialog hideTrigger />
}

/** Mounted from the page. Each door's dialog loads on first request and stays. */
export function CaptureDoorHost() {
  const [doors, setDoors] = useState<CaptureDoor[]>([])

  useEffect(
    () =>
      subscribeCaptureDoor((door) => {
        setDoors((prev) => (prev.includes(door) ? prev : [...prev, door]))
      }),
    [],
  )

  return (
    <>
      {doors.map((door) => (
        <CaptureDoorSlot key={door} door={door} />
      ))}
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
