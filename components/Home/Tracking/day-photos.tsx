"use client"

import { useMemo } from "react"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { photoIdsForDay, useDayPhotosStore } from "@/lib/day-photos-store"
import { itemTitle } from "@/lib/item-utils"
import { PHOTO_ATTR, PHOTO_TYPE_ID, photoDayKey } from "@/lib/photo-types"
import { useTaskStore } from "@/lib/task-store"
import type { FileValue, Task } from "@/lib/types"

function uriOf(task: Task): string | undefined {
  const v = task.attributes?.[PHOTO_ATTR.image]
  const first = Array.isArray(v) ? v[0] : v
  return first && typeof first === "object" ? (first as FileValue).uri : undefined
}

function Thumb({ task, onRemove, canRemove }: { task: Task; onRemove: () => void; canRemove: boolean }) {
  const src = useAttachmentSrc(uriOf(task))
  return (
    <span className="trk-day-photo" title={itemTitle(task)}>
      {src ? <img src={src} alt={itemTitle(task)} width={64} height={64} style={{ objectFit: "cover" }} /> : itemTitle(task)}
      {canRemove ? (
        <button type="button" aria-label={`Detach ${itemTitle(task)}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  )
}

/** Photos on one day: attached by hand, plus any whose Taken date is that day. */
export function DayPhotos({ dayKey }: { dayKey: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const byDay = useDayPhotosStore((s) => s.byDay)
  const attach = useDayPhotosStore((s) => s.attach)
  const detach = useDayPhotosStore((s) => s.detach)
  const photos = useMemo(() => tasks.filter((t) => t.type === PHOTO_TYPE_ID), [tasks])
  const ids = useMemo(
    () =>
      photoIdsForDay(
        dayKey,
        byDay,
        photos.map((p) => ({ id: p.id, takenDayKey: photoDayKey(p.attributes?.[PHOTO_ATTR.takenAt]) })),
      ),
    [dayKey, byDay, photos],
  )
  if (photos.length === 0) return null
  const onDay = new Set(ids)
  const manual = new Set(byDay[dayKey] ?? [])
  return (
    <div className="trk-day-photos">
      <p className="trk-silk">Photos</p>
      {photos
        .filter((p) => onDay.has(p.id))
        .map((p) => (
          <Thumb key={p.id} task={p} canRemove={manual.has(p.id)} onRemove={() => detach(dayKey, p.id)} />
        ))}
      <select
        aria-label="Attach a photo to this day"
        value=""
        onChange={(e) => e.target.value && attach(dayKey, e.target.value)}
      >
        <option value="">Attach photo…</option>
        {photos
          .filter((p) => !onDay.has(p.id))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {itemTitle(p)}
            </option>
          ))}
      </select>
    </div>
  )
}
