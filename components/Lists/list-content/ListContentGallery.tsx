"use client"

/**
 * components/Lists/list-content/ListContentGallery.tsx — Photo gallery display
 *
 * Offered when a list allows the photo type (`lib/photo-types.ts`), and that
 * list opens here. Tiles plus the shared add bar (`MediaAddBar.tsx`).
 */

import { useAttachmentSrc } from "@/components/use-attachment-src"
import { itemTitle } from "@/lib/item-utils"
import { PHOTO_ATTR } from "@/lib/photo-types"
import type { FileValue, Task } from "@/lib/types"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import { MediaAddWrap } from "./MediaAddBar"
import type { ListContentTaskHandlers, MediaDraft } from "./types"

function photoUri(task: Task): string | undefined {
  const v = task.attributes?.[PHOTO_ATTR.image]
  const first = Array.isArray(v) ? v[0] : v
  return first && typeof first === "object" ? (first as FileValue).uri : typeof first === "string" ? first : undefined
}

function takenLabel(task: Task): string {
  const v = task.attributes?.[PHOTO_ATTR.takenAt]
  const d = typeof v === "string" ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : ""
}

function GalleryTile({ task, selected, handlers }: { task: Task; selected: boolean; handlers: ListContentTaskHandlers }) {
  const src = useAttachmentSrc(photoUri(task))
  const { selectMode, onTaskSelect, onToggleTaskSelect, onTaskDragStart, onDragEnd } = handlers
  const title = itemTitle(task)
  return (
    <figure
      className={`fm-gallery-tile${selectMode && selected ? " selected" : ""}`}
      draggable={!selectMode}
      onDragStart={(e) => !selectMode && onTaskDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => activateListItem(selectMode, task.id, onToggleTaskSelect, onTaskSelect)}
      title={title}
    >
      <ItemSelectCheckbox
        selectMode={selectMode}
        selected={selected}
        label={title}
        onToggle={() => onToggleTaskSelect?.(task.id)}
      />
      {src ? <img src={src} alt={title} loading="lazy" decoding="async" draggable={false} /> : <div className="fm-gallery-empty">No image</div>}
      <figcaption>
        <span>{title}</span>
        <small>{takenLabel(task)}</small>
      </figcaption>
    </figure>
  )
}

/** The Lists "Photo gallery" display: a thumbnail wall of Photo items. */
export function ListContentGallery({
  onAddMedia,
  ...handlers
}: ListContentTaskHandlers & { onAddMedia?: (drafts: MediaDraft[]) => void | Promise<void> }) {
  const selected = new Set(handlers.selectedTaskIds)
  return (
    <MediaAddWrap noun="photo" accept="image/*" onAddMedia={onAddMedia}>
      <div className="fm-gallery">
        {handlers.tasks.map((task) => (
          <GalleryTile key={task.id} task={task} selected={selected.has(task.id)} handlers={handlers} />
        ))}
        {handlers.tasks.length === 0 && <p className="fm-media-empty">Drop photos here, or add one by description.</p>}
      </div>
    </MediaAddWrap>
  )
}
