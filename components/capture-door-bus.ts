/**
 * components/capture-door-bus.ts — one open signal for the capture doors
 *
 * Ingest, From Notes, and Phone Notes stay mounted on the page so a listing
 * session survives closing the dialog. Settings and Lists settings ask this
 * bus to open that same popup.
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"

export type CaptureDoor = "ingest" | "notes" | "phone"

const EVENT = "brain2:open-capture-door"

export function openCaptureDoor(door: CaptureDoor) {
  window.dispatchEvent(new CustomEvent<CaptureDoor>(EVENT, { detail: door }))
}

/** Open this door when a settings button asks. */
export function useCaptureDoorRequest(door: CaptureDoor, open: () => void) {
  useEffect(() => {
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<CaptureDoor>).detail === door) open()
    }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [door, open])
}

let notesTriggerLabel = "From Notes"
const notesLabelSubs = new Set<() => void>()

export function publishNotesTriggerLabel(label: string) {
  if (notesTriggerLabel === label) return
  notesTriggerLabel = label
  notesLabelSubs.forEach((notify) => notify())
}

export function useNotesTriggerLabel(): string {
  return useSyncExternalStore(
    (notify) => {
      notesLabelSubs.add(notify)
      return () => notesLabelSubs.delete(notify)
    },
    () => notesTriggerLabel,
    () => "From Notes",
  )
}
