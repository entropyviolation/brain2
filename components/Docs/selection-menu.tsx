/**
 * components/Docs/selection-menu.tsx — right-click menu for highlighted Docs text
 *
 * Highlight text in a document and right-click. Five doors lead out of the
 * page: Add to Quick Add (opens it seeded with the exact text), Add to BIM
 * chat (puts it in the compose well), Add to list (the text becomes an item
 * in a list you search for), Attach to item as note (a dated note on an item
 * you search for), and Turn into log (a tracking-log tick; a clock in the text
 * such as "10:30 walked outside" is picked up and can be edited). Every send
 * is recorded per document in `lib/doc-selection/doc-out-links.ts`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListPicker } from "@/components/Lists/list-picker"
import { ItemPicker, type ItemChoice } from "@/components/Lists/item-picker"
import { useTaskStore } from "@/lib/task-store"
import { createListItem } from "@/lib/item-utils"
import { makeNoteEntry, localClock, localDayIso } from "@/lib/item-notes"
import { applyDiscreteLog } from "@/lib/ingest/apply-discrete-event"
import { detectClock } from "@/lib/doc-selection/detect-clock"
import { useDocOutLinks, type DocOutKind } from "@/lib/doc-selection/doc-out-links"
import { addToBimChat, openQuickAddWith } from "@/lib/doc-selection/doc-selection-bus"
import { NOTE_TYPE_ID } from "@/lib/note-types"

export type SelectionAsk = { text: string; x: number; y: number }
type Door = "list" | "note" | "log"

const squash = (text: string) => text.replace(/\s+/g, " ").trim()

export function DocSelectionMenu({ docId, ask, onClose }: { docId: string; ask: SelectionAsk | null; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [door, setDoor] = useState<{ kind: Door; text: string } | null>(null)
  const [toast, setToast] = useState("")
  const record = useDocOutLinks((s) => s.record)

  useEffect(() => {
    if (!ask) return
    const away = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("mousedown", away)
    window.addEventListener("scroll", away, true)
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("mousedown", away)
      window.removeEventListener("scroll", away, true)
      window.removeEventListener("keydown", key)
    }
  }, [ask, onClose])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(""), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const sent = (kind: DocOutKind, text: string, label: string, targetId?: string) => {
    record({ docId, kind, text, targetId, targetLabel: label })
    setToast(label)
  }

  const text = ask?.text ?? ""
  const pick = (run: () => void) => () => {
    run()
    onClose()
  }

  return (
    <>
      {ask ? (
        <div
          ref={menuRef}
          className="docs-selmenu"
          role="menu"
          aria-label="Selected text"
          style={{ left: Math.min(ask.x, window.innerWidth - 230), top: Math.min(ask.y, window.innerHeight - 190) }}
        >
          <button role="menuitem" type="button" onClick={pick(() => { openQuickAddWith(text); sent("quick-add", text, "Quick Add") })}>Add to Quick Add</button>
          <button role="menuitem" type="button" onClick={pick(() => { addToBimChat(text); sent("bim-chat", text, "BIM chat") })}>Add to BIM chat</button>
          <button role="menuitem" type="button" onClick={() => { setDoor({ kind: "list", text }); onClose() }}>Add to list…</button>
          <button role="menuitem" type="button" onClick={() => { setDoor({ kind: "note", text }); onClose() }}>Attach to item as note…</button>
          <button role="menuitem" type="button" onClick={() => { setDoor({ kind: "log", text }); onClose() }}>Turn into log…</button>
        </div>
      ) : null}
      {door?.kind === "list" ? <ListDoor text={door.text} onDone={(label, id) => { sent("list-item", door.text, label, id); setDoor(null) }} onCancel={() => setDoor(null)} /> : null}
      {door?.kind === "note" ? <NoteDoor docId={docId} text={door.text} onDone={(label, id) => { sent("item-note", door.text, label, id); setDoor(null) }} onCancel={() => setDoor(null)} /> : null}
      {door?.kind === "log" ? <LogDoor text={door.text} onDone={(label) => { sent("log", door.text, label); setDoor(null) }} onCancel={() => setDoor(null)} /> : null}
      {toast ? <div className="docs-selmenu-toast" role="status">Sent to {toast}</div> : null}
    </>
  )
}

function ListDoor({ text, onDone, onCancel }: { text: string; onDone: (label: string, id: string) => void; onCancel: () => void }) {
  const lists = useTaskStore((s) => s.lists)
  const addTask = useTaskStore((s) => s.addTask)
  const [listId, setListId] = useState<string[]>([])
  const [title, setTitle] = useState(squash(text))
  const chosen = lists.find((l) => l.id === listId[0])
  const add = () => {
    if (!chosen || !title.trim()) return
    const item = createListItem(title.trim(), [chosen.id])
    addTask(item, { surface: "docs", name: chosen.name })
    onDone(chosen.name, item.id)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="docs-selmenu-dialog">
        <DialogTitle>Add to list</DialogTitle>
        <DialogDescription>The text becomes an item. Pick the list.</DialogDescription>
        <Input aria-label="Item text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <ListPicker selected={listId} onChange={setListId} mode="single" showCreate={false} searchLabel="Search lists" />
        <div className="docs-selmenu-row">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!chosen || !title.trim()} onClick={add}>{chosen ? `Add to ${chosen.name}` : "Pick a list"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NoteDoor({ docId, text, onDone, onCancel }: { docId: string; text: string; onDone: (label: string, id: string) => void; onCancel: () => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState(text.trim())
  const choices = useMemo<ItemChoice[]>(
    () =>
      tasks
        .filter((t) => t.id !== docId && t.type !== NOTE_TYPE_ID)
        .map((t) => ({ id: t.id, title: t.description || t.title || "Untitled", hint: t.type })),
    [tasks, docId],
  )
  const target = tasks.find((t) => t.id === picked[0])
  const attach = () => {
    if (!target) return
    const entry = makeNoteEntry(note)
    if (!entry) return
    updateTask({ ...target, noteLog: [...(target.noteLog ?? []), entry] }, undefined, { attribution: { surface: "docs" } })
    onDone(target.description, target.id)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="docs-selmenu-dialog">
        <DialogTitle>Attach to item as note</DialogTitle>
        <DialogDescription>The text becomes a dated note on the item you pick.</DialogDescription>
        <textarea className="docs-selmenu-area" aria-label="Note text" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <ItemPicker choices={choices} selected={picked} onChange={setPicked} mode="single" />
        <div className="docs-selmenu-row">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!target || !note.trim()} onClick={attach}>{target ? `Attach to ${target.description}` : "Pick an item"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LogDoor({ text, onDone, onCancel }: { text: string; onDone: (label: string) => void; onCancel: () => void }) {
  const found = useMemo(() => detectClock(squash(text)), [text])
  const [what, setWhat] = useState(found ? found.rest : squash(text))
  const [time, setTime] = useState(found?.time ?? localClock())
  const [day, setDay] = useState(localDayIso())
  const [error, setError] = useState("")
  const add = () => {
    const [h, m] = time.split(":").map(Number)
    const [y, mo, d] = day.split("-").map(Number)
    if (!what.trim() || h === undefined || m === undefined || !y || !mo || !d) return
    const at = new Date(y, mo - 1, d, h, m)
    const result = applyDiscreteLog(what.trim(), at, { keywordQuery: false })
    if (result.status !== "ok") {
      setError(result.reply || "Could not log that.")
      return
    }
    onDone("the tracking log")
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="docs-selmenu-dialog">
        <DialogTitle>Turn into log</DialogTitle>
        <DialogDescription>{found ? `Found ${found.time} in the text. Change it if it is wrong.` : "No time in the text. Set when it happened."}</DialogDescription>
        <Input aria-label="Log text" value={what} onChange={(e) => setWhat(e.target.value)} />
        <div className="docs-selmenu-row">
          <Input aria-label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Input aria-label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="docs-selmenu-row">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!what.trim() || !time} onClick={add}>Add log</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
