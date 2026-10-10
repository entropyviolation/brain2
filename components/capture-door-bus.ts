/**
 * components/capture-door-bus.ts — one open signal for the capture doors
 *
 * Ingest, From Notes, and Phone Notes mount the first time that door is
 * opened, then stay mounted so a listing survives closing the popup.
 * A request that arrives before the dialog's listener exists is remembered
 * (one unanswered request per door) and applied on subscribe. The notes
 * button label is published here so
 * Settings can show it before the notes dialog chunk loads. Refresh should
 * not parse those dialog modules until a door is opened.
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"

export type CaptureDoor = "ingest" | "notes" | "phone"

const EVENT = "brain2:open-capture-door"

/**
 * Doors asked for before their dialog listeners existed.
 * One slot per door so a second click does not drop the first.
 */
const pendingDoors = new Set<CaptureDoor>()

export function openCaptureDoor(door: CaptureDoor) {
  pendingDoors.add(door)
  window.dispatchEvent(new CustomEvent<CaptureDoor>(EVENT, { detail: door }))
}

/** Open this door when a settings button asks. */
export function useCaptureDoorRequest(door: CaptureDoor, open: () => void) {
  useEffect(() => {
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<CaptureDoor>).detail !== door) return
      pendingDoors.delete(door)
      open()
    }
    window.addEventListener(EVENT, onOpen)
    if (pendingDoors.has(door)) {
      pendingDoors.delete(door)
      open()
    }
    return () => window.removeEventListener(EVENT, onOpen)
  }, [door, open])
}

/**
 * Hear the same open event without consuming a pending door.
 * Replays requests that landed before this listener existed.
 */
export function subscribeCaptureDoor(listener: (door: CaptureDoor) => void): () => void {
  const onOpen = (event: Event) => {
    const door = (event as CustomEvent<CaptureDoor>).detail
    if (door === "ingest" || door === "notes" || door === "phone") listener(door)
  }
  window.addEventListener(EVENT, onOpen)
  for (const door of pendingDoors) listener(door)
  return () => window.removeEventListener(EVENT, onOpen)
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
