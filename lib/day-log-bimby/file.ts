/**
 * lib/day-log-bimby/file.ts — Put a Day Log in Docs → LOG DOCS → DAY LOGS
 *
 * One doc per day with a fixed id (`doc_daylog_<date>`), so two windows that
 * build the same day write one doc, not twins. A rebuild replaces the body.
 * When the body was edited by hand since our last write, the edited version is
 * first kept as its own doc ("… · hand-edited copy"), so a rebuild never loses
 * a word the person typed. The text hash ignores markup, so the editor's own
 * re-save of the same words is not a hand edit.
 */
"use client"

import { createDocument, loadDocumentBody, renameDocument, setDocumentBody, setDocumentFolder } from "@/components/Docs/doc-actions"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { previewDocBody, putPersistedDoc, taskToPersistedDoc } from "@/lib/doc-persist"
import { withItemWriteSource } from "@/lib/item-write-source"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { DAY_LOG_FOLDER, dayLogTitle } from "./render"

export const dayLogDocId = (date: string): string => `doc_daylog_${date}`

/** The attribute that marks a doc as a Day Log, holding its date. */
export const DAY_LOG_ATTR = "dayLogDate"

/** Plain words of an HTML body, hashed (FNV-1a). */
export function textHash(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

export function dayLogDateOf(doc: Pick<Task, "id" | "attributes">): string | null {
  const raw = doc.attributes?.[DAY_LOG_ATTR]
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = /^doc_daylog_(\d{4}-\d{2}-\d{2})$/.exec(doc.id)
  return m ? m[1]! : null
}

/** True when the doc's words differ from the body we last wrote. */
export async function handEdited(date: string, lastHash: string | undefined): Promise<boolean> {
  if (!lastHash) return false
  const doc = useTaskStore.getState().tasks.find((t) => t.id === dayLogDocId(date))
  if (!doc) return false
  const body = await loadDocumentBody(doc.id, doc.body ?? "")
  return !!body && textHash(body) !== lastHash
}

/** Write the day's doc. Returns its id and the new body's hash. Item writes are stamped as the Day Log BIMBY. */
export function fileDayLog(date: string, html: string, opts: { keepHandEdits: boolean }): Promise<{ docId: string; bodyHash: string; keptCopyId?: string }> {
  return withItemWriteSource({ surface: "agent", name: "Day Log BIMBY" }, () => fileNow(date, html, opts))
}

async function fileNow(date: string, html: string, opts: { keepHandEdits: boolean }): Promise<{ docId: string; bodyHash: string; keptCopyId?: string }> {
  const id = dayLogDocId(date)
  const store = useTaskStore.getState()
  const title = dayLogTitle(date)
  let keptCopyId: string | undefined
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
        [NOTE_ATTR.folder]: DAY_LOG_FOLDER,
        [NOTE_ATTR.fontFamily]: "Merriweather",
        [NOTE_ATTR.updatedAt]: now.toISOString(),
        [DAY_LOG_ATTR]: date,
      },
      links: [],
      tags: ["docs", "day-log"],
    }
    store.addTask(doc)
    await putPersistedDoc(taskToPersistedDoc(doc, html))
    return { docId: id, bodyHash: textHash(html) }
  }
  if (opts.keepHandEdits) {
    const old = await loadDocumentBody(id, held.body ?? "")
    const stamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    const copy = createDocument(`${title} · hand-edited copy ${stamp}`, DAY_LOG_FOLDER, old)
    keptCopyId = copy.id
  }
  if ((held.description ?? "") !== title) renameDocument(id, title)
  if (held.attributes?.[NOTE_ATTR.folder] !== DAY_LOG_FOLDER) setDocumentFolder(id, DAY_LOG_FOLDER)
  if (held.attributes?.[DAY_LOG_ATTR] !== date) {
    const fresh = useTaskStore.getState().tasks.find((t) => t.id === id)
    if (fresh) useTaskStore.getState().updateTask({ ...fresh, attributes: { ...(fresh.attributes ?? {}), [DAY_LOG_ATTR]: date } })
  }
  await setDocumentBody(id, html)
  return { docId: id, bodyHash: textHash(html), ...(keptCopyId ? { keptCopyId } : {}) }
}
