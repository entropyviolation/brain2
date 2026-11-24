/**
 * lib/week-log-bimby/file.ts — Put a Week Log in Docs → LOG DOCS → WEEK LOGS
 *
 * One doc per week with a fixed id (`doc_weeklog_<monday>`), in Karla like every
 * Log Doc. A hand edit since our last write is kept as its own copy before a
 * rebuild replaces the body, the same as Day Logs (`lib/day-log-bimby/file.ts`).
 */
"use client"

import { createDocument, documentFont, loadDocumentBody, renameDocument, setDocumentBody, setDocumentFolder, setDocumentFont } from "@/components/Docs/doc-actions"
import { LOG_DOC_FONT, textHash } from "@/lib/day-log-bimby/file"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { previewDocBody, putPersistedDoc, taskToPersistedDoc } from "@/lib/doc-persist"
import { withItemWriteSource } from "@/lib/item-write-source"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { WEEK_LOG_ATTR, WEEK_LOG_FOLDER, weekLogDocId, weekLogTitle } from "./week"

/** True when the doc's words differ from the body we last wrote. */
export async function weekHandEdited(start: string, lastHash: string | undefined): Promise<boolean> {
  if (!lastHash) return false
  const doc = useTaskStore.getState().tasks.find((t) => t.id === weekLogDocId(start))
  if (!doc) return false
  const body = await loadDocumentBody(doc.id, doc.body ?? "")
  return !!body && textHash(body) !== lastHash
}

export function fileWeekLog(start: string, html: string, opts: { keepHandEdits: boolean }): Promise<{ docId: string; bodyHash: string; keptCopyId?: string }> {
  return withItemWriteSource({ surface: "agent", name: "Week Log BIMBY" }, () => fileNow(start, html, opts))
}

async function fileNow(start: string, html: string, opts: { keepHandEdits: boolean }): Promise<{ docId: string; bodyHash: string; keptCopyId?: string }> {
  const id = weekLogDocId(start)
  const store = useTaskStore.getState()
  const title = weekLogTitle(start)
  const held = store.tasks.find((t) => t.id === id)
  if (!held) {
    const now = new Date()
    const doc: Task = {
      id,
      description: title,
      type: NOTE_TYPE_ID,
      stage: "list",
      createdAt: now,
      completed: false,
      lists: [],
      body: previewDocBody(html),
      attributes: {
        [NOTE_ATTR.status]: "evergreen",
        [NOTE_ATTR.folder]: WEEK_LOG_FOLDER,
        [NOTE_ATTR.fontFamily]: LOG_DOC_FONT,
        [NOTE_ATTR.updatedAt]: now.toISOString(),
        [WEEK_LOG_ATTR]: start,
      },
      links: [],
      tags: ["docs", "week-log"],
    }
    store.addTask(doc)
    await putPersistedDoc(taskToPersistedDoc(doc, html))
    return { docId: id, bodyHash: textHash(html) }
  }
  let keptCopyId: string | undefined
  if (opts.keepHandEdits) {
    const old = await loadDocumentBody(id, held.body ?? "")
    const stamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    keptCopyId = createDocument(`${title} · hand-edited copy ${stamp}`, WEEK_LOG_FOLDER, old, documentFont(held)).id
  }
  if ((held.description ?? "") !== title) renameDocument(id, title)
  if (held.attributes?.[NOTE_ATTR.folder] !== WEEK_LOG_FOLDER) setDocumentFolder(id, WEEK_LOG_FOLDER)
  if (documentFont(held) === "Merriweather") setDocumentFont(id, LOG_DOC_FONT)
  await setDocumentBody(id, html)
  return { docId: id, bodyHash: textHash(html), ...(keptCopyId ? { keptCopyId } : {}) }
}
