/**
 * lib/log-photo.ts — A BIM or desk photo filed on the day summary
 *
 * One Photo item, one `idb:` URI. `takenAt` places it on that local day, and
 * `day-photos` attaches the same id. Not a Docs note and not an outfit.
 */
"use client"

import { putAttachment, attachmentUri, dataUrlToBlob } from "@/lib/attachments"
import { useDayPhotosStore } from "@/lib/day-photos-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { PHOTO_ATTR, PHOTO_TYPE_ID } from "@/lib/photo-types"
import { useTaskStore } from "@/lib/task-store"
import type { FileValue, Task } from "@/lib/types"

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `photo_${crypto.randomUUID()}`
  return `photo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function fileLogPhoto(opts: {
  takenAt: Date
  title?: string
  dataUrl?: string
  uri?: string
  name?: string
}): Promise<{ id: string; dayKey: string } | null> {
  const dayKey = formatLocalDateKey(opts.takenAt)
  let uri = opts.uri?.trim() ?? ""
  if (!uri && opts.dataUrl) {
    const id = newId()
    const blob = dataUrlToBlob(opts.dataUrl)
    uri = await putAttachment(id, blob, { name: opts.name || "log.jpg", mime: blob.type || "image/jpeg" })
    if (!uri) uri = attachmentUri(id)
  }
  if (!uri || uri.startsWith("data:")) return null
  const id = newId()
  const title = opts.title?.trim() || `Log ${dayKey}`
  const file: FileValue = {
    id,
    name: opts.name || "log.jpg",
    mime: "image/jpeg",
    uri,
    size: 0,
  }
  const task: Task = {
    id,
    description: title,
    type: PHOTO_TYPE_ID,
    stage: "list",
    createdAt: opts.takenAt,
    completed: false,
    lists: [],
    attributes: {
      [PHOTO_ATTR.image]: file,
      [PHOTO_ATTR.takenAt]: opts.takenAt.toISOString(),
      [PHOTO_ATTR.album]: "Log",
    },
    links: [],
    tags: ["log-photo"],
  }
  useTaskStore.getState().addTask(task)
  useDayPhotosStore.getState().attach(dayKey, id)
  return { id, dayKey }
}
