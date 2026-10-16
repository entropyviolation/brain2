/**
 * components/inbox-links.tsx — Inbox → Links
 *
 * Saved links from BIM: a message whose first word is a link
 * (`lib/ingest/apply-link.ts`). Rows are open `stage: "inbox"` tasks with
 * `savedLink` set, newest first under day plates. Each row is the source
 * (TikTok, Instagram reel, Article …), the link, and the note sent after it.
 * The link opens in the browser. The note edits in place. File moves the row
 * to All Items with the link kept. Delete asks first. Cmd/Ctrl-Z undoes both.
 * Not the idea walk: no clarify sheet, no chords, no points.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Check, Copy, Edit, ExternalLink, Link2, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { rememberWorld, undoLastAction } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import { clarifyInboxItems, deleteInboxItems } from "@/lib/inbox-batch"
import { linkHost, linkKindLabel } from "@/lib/saved-links"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

function asDate(value: Date | string | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function dayPlate(key: string, now: Date): string {
  if (key === "undated") return "Undated"
  if (key === formatLocalDateKey(now)) return "Today"
  const [y, m, d] = key.split("-").map(Number)
  return format(new Date(y!, m! - 1, d!), "EEE MMM d")
}

/** Path and query after the host, for the row's link line. */
function linkTail(url: string): string {
  try {
    const u = new URL(url)
    const tail = `${u.pathname === "/" ? "" : u.pathname}${u.search}`
    return tail.length > 60 ? `${tail.slice(0, 57)}…` : tail
  } catch {
    return ""
  }
}

export function InboxLinks({ links }: { links: Task[] }) {
  const setTasks = useTaskStore((state) => state.setTasks)
  const updateTask = useTaskStore((state) => state.updateTask)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<string>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [undoLabel, setUndoLabel] = useState<string | null>(null)
  /** The row whose note is open. Enter and blur both save; only the first one counts. */
  const editingRef = useRef<string | null>(null)

  const kinds = useMemo(() => {
    const seen = new Map<string, number>()
    for (const task of links) {
      const label = linkKindLabel(task.savedLink!)
      seen.set(label, (seen.get(label) ?? 0) + 1)
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1])
  }, [links])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return links.filter((task) => {
      if (kind !== "all" && linkKindLabel(task.savedLink!) !== kind) return false
      if (!q) return true
      return `${task.savedLink!.url}\n${task.notes ?? ""}`.toLowerCase().includes(q)
    })
  }, [links, query, kind])

  const groups = useMemo(() => {
    const out: { key: string; tasks: Task[] }[] = []
    for (const task of shown) {
      const d = asDate(task.createdAt)
      const key = d ? formatLocalDateKey(d) : "undated"
      const last = out[out.length - 1]
      if (!last || last.key !== key) out.push({ key, tasks: [task] })
      else last.tasks.push(task)
    }
    return out
  }, [shown])

  const now = new Date()

  const startEdit = (task: Task) => {
    editingRef.current = task.id
    setDraft(task.notes ?? "")
    setEditingId(task.id)
  }

  const stopEdit = () => {
    editingRef.current = null
    setEditingId(null)
  }

  const saveNote = (task: Task) => {
    if (editingRef.current !== task.id) return
    const next = draft.trim()
    stopEdit()
    if (next === (task.notes ?? "").trim()) return
    rememberWorld("links edit note")
    const { notes: _old, ...rest } = task
    updateTask(next ? { ...task, notes: next } : (rest as Task))
    setUndoLabel("links edit note")
  }

  const fileLink = (task: Task) => {
    rememberWorld("links file")
    setTasks(clarifyInboxItems(useTaskStore.getState().tasks, [task.id]))
    setUndoLabel("links file")
  }

  const deleteLink = (task: Task) => {
    rememberWorld("links delete")
    setTasks(deleteInboxItems(useTaskStore.getState().tasks, [task.id]), { tombstoneIds: [task.id] })
    setConfirmDeleteId(null)
    setUndoLabel("links delete")
  }

  const copyLink = (task: Task) => {
    void navigator.clipboard?.writeText(task.savedLink!.url).then(
      () => setCopiedId(task.id),
      () => setCopiedId(null),
    )
  }

  return (
    <>
      {undoLabel && (
        <div className="inbox-undo">
          <span>
            {undoLabel === "links file"
              ? "Filed to All Items. The link stays on it. Cmd/Ctrl-Z undoes."
              : undoLabel === "links delete"
                ? "Deleted. Cmd/Ctrl-Z undoes."
                : "Note saved. Cmd/Ctrl-Z undoes."}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              undoLastAction()
              setUndoLabel(null)
            }}
          >
            Undo
          </Button>
        </div>
      )}

      <div className="inbox-list-well">
        <div className="inbox-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search links and notes"
            aria-label="Search links"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {kinds.length > 1 && (
          <div className="inbox-links-kinds" role="group" aria-label="Link sources">
            <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All <i>{links.length}</i>
            </button>
            {kinds.map(([label, count]) => (
              <button key={label} type="button" aria-pressed={kind === label} onClick={() => setKind(label)}>
                {label} <i>{count}</i>
              </button>
            ))}
          </div>
        )}
        <div className="inbox-rows-scroll">
          {shown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {links.length > 0 ? (
                <p>Nothing matches.</p>
              ) : (
                <>
                  <p>No saved links.</p>
                  <p className="text-sm">Send BIM a message that starts with a link. Words after it become the note.</p>
                </>
              )}
            </div>
          ) : (
            <div className="inbox-rows">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="inbox-day-plate">{dayPlate(group.key, now)}</div>
                  {group.tasks.map((task) => {
                    const link = task.savedLink!
                    const when = asDate(task.createdAt)
                    const editing = editingId === task.id
                    return (
                      <div key={task.id} className="inbox-link-row" data-inbox-link={task.id}>
                        <span className="inbox-link-kind" data-kind={link.kind}>
                          {linkKindLabel(link)}
                        </span>
                        <div className="inbox-link-body">
                          <a className="inbox-link-url" href={link.url} target="_blank" rel="noreferrer" title={link.url}>
                            <b>{linkHost(link.url)}</b>
                            <span>{linkTail(link.url)}</span>
                          </a>
                          {editing ? (
                            <textarea
                              className="inbox-link-note-edit"
                              value={draft}
                              autoFocus
                              rows={2}
                              aria-label="Link note"
                              onChange={(event) => setDraft(event.target.value)}
                              onBlur={() => saveNote(task)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault()
                                  saveNote(task)
                                } else if (event.key === "Escape") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  stopEdit()
                                }
                              }}
                            />
                          ) : task.notes?.trim() ? (
                            <p className="inbox-link-note">{task.notes.trim()}</p>
                          ) : null}
                        </div>
                        <span className="inbox-row-when">{when ? format(when, "h:mm a") : ""}</span>
                        <span className="inbox-link-tools">
                          {confirmDeleteId === task.id ? (
                            <>
                              <span className="inbox-link-confirm">Delete?</span>
                              <Button type="button" variant="outline" size="sm" onClick={() => deleteLink(task)}>
                                Delete
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                                Keep
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button asChild type="button" variant="outline" size="icon" className="inbox-row-tool" title="Open link">
                                <a href={link.url} target="_blank" rel="noreferrer" aria-label="Open link">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="inbox-row-tool"
                                title={copiedId === task.id ? "Copied" : "Copy link"}
                                onClick={() => copyLink(task)}
                              >
                                {copiedId === task.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="inbox-row-tool"
                                title="Edit note"
                                onClick={() => startEdit(task)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="outline" size="sm" title="File to All Items" onClick={() => fileLink(task)}>
                                File
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="inbox-row-tool"
                                title="Delete link"
                                onClick={() => setConfirmDeleteId(task.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
