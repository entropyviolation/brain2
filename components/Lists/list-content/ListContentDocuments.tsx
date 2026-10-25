"use client"

import { useAttachmentSrc } from "@/components/use-attachment-src"
import { DOCUMENT_ATTR } from "@/lib/document-types"
import { itemTitle } from "@/lib/item-utils"
import type { FileValue, Task } from "@/lib/types"
import { MediaAddWrap } from "./MediaAddBar"
import { ItemSelectCheckbox, activateListItem } from "./item-select"
import type { ListContentTaskHandlers, MediaDraft } from "./types"

const str = (t: Task, id: string) => {
  const v = t.attributes?.[id]
  return typeof v === "string" ? v : ""
}

function extOf(t: Task): string {
  const f = t.attributes?.[DOCUMENT_ATTR.file] as FileValue | undefined
  const name = f?.name ?? str(t, DOCUMENT_ATTR.url)
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(name)
  return m ? m[1].toUpperCase() : f ? "FILE" : str(t, DOCUMENT_ATTR.url) ? "LINK" : "DOC"
}

function Volume({ task, selected, h }: { task: Task; selected: boolean; h: ListContentTaskHandlers }) {
  const cover = useAttachmentSrc(typeof task.attributes?.[DOCUMENT_ATTR.cover] === "string" ? (task.attributes[DOCUMENT_ATTR.cover] as string) : undefined)
  const title = itemTitle(task)
  const author = str(task, DOCUMENT_ATTR.author)
  const excerpt = str(task, DOCUMENT_ATTR.excerpt)
  const status = str(task, DOCUMENT_ATTR.status)
  const pages = task.attributes?.[DOCUMENT_ATTR.pages]
  return (
    <article
      className={`fm-vol${h.selectMode && selected ? " selected" : ""}`}
      draggable={!h.selectMode}
      onDragStart={(e) => !h.selectMode && h.onTaskDragStart(e, task)}
      onDragEnd={h.onDragEnd}
      onClick={() => activateListItem(h.selectMode, task.id, h.onToggleTaskSelect, h.onTaskSelect)}
      title={title}
    >
      <ItemSelectCheckbox selectMode={h.selectMode} selected={selected} label={title} onToggle={() => h.onToggleTaskSelect?.(task.id)} />
      <div className="fm-vol-cover">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : (
          <div className="fm-vol-jacket">
            <strong>{title}</strong>
            {author && <em>{author}</em>}
            {excerpt && <p>{excerpt.slice(0, 160)}</p>}
          </div>
        )}
        <span className="fm-vol-ext">{extOf(task)}</span>
      </div>
      <div className="fm-vol-meta">
        <strong>{title}</strong>
        <span>{[author, typeof pages === "number" ? `${pages} pp` : "", status].filter(Boolean).join(" · ")}</span>
        {cover && excerpt && <p>{excerpt.slice(0, 120)}</p>}
      </div>
    </article>
  )
}

/** The Lists "Document gallery" display: a library shelf of covers with a text preview. */
export function ListContentDocuments({
  onAddMedia,
  ...h
}: ListContentTaskHandlers & { onAddMedia?: (drafts: MediaDraft[]) => void | Promise<void> }) {
  const selected = new Set(h.selectedTaskIds)
  return (
    <MediaAddWrap noun="document" accept=".pdf,.md,.markdown,.txt,.epub,.html,application/pdf,text/*" onAddMedia={onAddMedia}>
      <div className="fm-shelf">
        {h.tasks.map((task) => (
          <Volume key={task.id} task={task} selected={selected.has(task.id)} h={h} />
        ))}
        {h.tasks.length === 0 && <p className="fm-media-empty">Drop PDFs or Markdown here, or add a pointer by description.</p>}
      </div>
    </MediaAddWrap>
  )
}
