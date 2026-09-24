/**
 * components/iphone-notes-store.tsx — Header Phone Notes store
 *
 * Queue of On My iPhone notes dumped via the signed iOS Shortcut → Telegram bot
 * onto Lists → iPhone Notes Store → Parked. AirDrop
 * docs/shortcuts/Dump iPhone Notes to Brain2.shortcut. Bulk-add, keep parked, or skip.
 * Mac From Notes parking is a different folder.
 * Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Notebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { requestNavigateToList } from "@/lib/app-navigation"
import {
  APPLE_NOTE_ATTR,
  IPHONE_NOTES_STORE_FOLDER_NAME,
  IPHONE_NOTES_STORE_LIST_NAME,
  IPHONE_NOTES_STORE_SOURCE,
  ensureIphoneNotesStoreDestination,
  notePreviewSnippet,
  noteToBulkAddDraft,
  parkedIphoneStoreItems,
  parseBulkAddText,
  persistIphoneNoteIds,
  summarizeBulkAdd,
} from "@/lib/apple-notes"
import { ensureCaptureTarget } from "@/lib/capture-target"
import { taskStoreMutators } from "@/lib/ingest/apply-capture"
import { createListItem, itemTitleOrUntitled, withCategoryDefaults } from "@/lib/item-utils"
import { parseSmartCapture } from "@/lib/smart-parse"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

function asAppleNote(task: Task): { title: string; body: string } {
  return {
    title: String(task.title || "").trim(),
    body: String(task.body || task.description || "").trim(),
  }
}

export function IphoneNotesStore() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [draftText, setDraftText] = useState("")
  const [addedCount, setAddedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  const tasks = useTaskStore((s) => s.tasks)
  const addTask = useTaskStore((s) => s.addTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)

  const parked = useMemo(() => parkedIphoneStoreItems(tasks), [tasks])
  const current = parked[index] ?? parked[parked.length - 1]
  const currentNote = current ? asAppleNote(current) : null

  useEffect(() => {
    if (!open) return
    const state = useTaskStore.getState()
    ensureIphoneNotesStoreDestination({
      lists: state.lists,
      folders: state.folders,
      addList: state.addList,
      addFolder: state.addFolder,
      addListToFolder: state.addListToFolder,
    })
  }, [open])

  useEffect(() => {
    if (index >= parked.length) setIndex(Math.max(0, parked.length - 1))
  }, [index, parked.length])

  useEffect(() => {
    if (!current) {
      setDraftText("")
      return
    }
    setDraftText(noteToBulkAddDraft(asAppleNote(current)))
  }, [current?.id])

  const bulkSummary = useMemo(() => summarizeBulkAdd(draftText), [draftText])

  const markNote = (task: Task) => {
    const id = task.attributes?.[APPLE_NOTE_ATTR.id]
    if (typeof id === "string" && id) persistIphoneNoteIds([id])
  }

  const bulkAddNow = () => {
    if (!current || !draftText.trim()) return
    const blocks = parseBulkAddText(draftText)
    if (blocks.length === 0) return
    let created = 0
    const noteId = current.attributes?.[APPLE_NOTE_ATTR.id]

    for (const block of blocks) {
      // Same door as Quick/Bulk Add: creates the folder chain, then the list.
      const target = ensureCaptureTarget(
        { folderPath: block.folderPath.length ? block.folderPath : undefined, category: block.listName },
        taskStoreMutators,
      )
      const list = target.list
      if (!list) continue
      for (const line of block.items) {
        const { suggestion } = parseSmartCapture(line)
        const description = suggestion.description || line
        const base = withCategoryDefaults(createListItem(description, [list.id]), list)
        addTask({
          ...base,
          ...(suggestion.scheduledDate ? { scheduledDate: suggestion.scheduledDate } : {}),
          ...(suggestion.scheduledTime ? { scheduledTime: suggestion.scheduledTime } : {}),
          ...(suggestion.estimatedDuration ? { estimatedDuration: suggestion.estimatedDuration } : {}),
          ...(suggestion.urgency ? { urgency: suggestion.urgency } : {}),
          ...(suggestion.importance ? { importance: suggestion.importance } : {}),
          attributes: {
            ...(base.attributes || {}),
            source: IPHONE_NOTES_STORE_SOURCE,
            ...(typeof noteId === "string" && noteId ? { appleNoteId: noteId } : {}),
          },
        })
        created += 1
      }
    }
    markNote(current)
    deleteTask(current.id)
    setAddedCount((n) => n + created)
  }

  const skip = () => {
    if (!current) return
    markNote(current)
    deleteTask(current.id)
    setSkippedCount((n) => n + 1)
  }

  const keepParked = () => {
    if (!current) return
    setIndex((i) => i + 1)
  }

  const openInLists = () => {
    const state = useTaskStore.getState()
    const dest = ensureIphoneNotesStoreDestination({
      lists: state.lists,
      folders: state.folders,
      addList: state.addList,
      addFolder: state.addFolder,
      addListToFolder: state.addListToFolder,
    })
    requestNavigateToList(dest.list.id, useTaskStore.getState().folders)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setIndex(0)
      setAddedCount(0)
      setSkippedCount(0)
    }
  }

  const preview =
    currentNote && (notePreviewSnippet(currentNote, 600) || currentNote.body || "Empty note.")

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => handleOpenChange(true)}
        disabled={open}
      >
        <Notebook className="h-4 w-4" />
        <span>Phone Notes</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="hpp95 hpp95-dialog sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col z-[200]"
          data-ui-name="Phone Notes"
          data-ui-docs="components/README.md"
        >
          <DialogHeader className="hpp-caption">
            <div className="hpp-caption-mark">
              <span className="hpp-power-lamp" aria-hidden />
              <DialogTitle>iPhone Notes Store</DialogTitle>
            </div>
            <DialogDescription className="hpp-caption-lead">
              Notes dumped from the iOS Shortcut via Telegram land here on “{IPHONE_NOTES_STORE_LIST_NAME}”
              in {IPHONE_NOTES_STORE_FOLDER_NAME}. Bulk-add, keep parked, or skip. Mac From Notes is a
              different folder.
            </DialogDescription>
          </DialogHeader>

          <div className="hpp-body flex-1 min-h-0 overflow-hidden flex flex-col">
          {parked.length === 0 ? (
            <div className="space-y-3 text-sm">
              {addedCount > 0 || skippedCount > 0 ? (
                <p>
                  {addedCount > 0 ? `Bulk-added ${addedCount} item${addedCount === 1 ? "" : "s"}. ` : null}
                  {skippedCount > 0 ? `Skipped ${skippedCount}. ` : null}
                  Nothing else is parked.
                </p>
              ) : (
                <>
                  <p>Nothing parked yet. The bot cannot open Notes on the phone — run the Shortcut there.</p>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Pair Telegram in Settings → Message ingest.</li>
                    <li>
                      AirDrop <code className="text-foreground">Dump iPhone Notes to Brain2.shortcut</code>{" "}
                      from docs/shortcuts/ (or open it on this Mac).
                    </li>
                    <li>
                      Run it (or share one note). Each note is one{" "}
                      <code className="text-foreground">iphone-notes:</code> message.
                    </li>
                    <li>This queue fills when the desktop or phone hub is polling.</li>
                  </ol>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={openInLists}>
                  Open in Lists
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : current ? (
            <div className="space-y-3 overflow-hidden flex flex-col min-h-0">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Note {Math.min(index + 1, parked.length)} / {parked.length}
                </span>
                <span>
                  {IPHONE_NOTES_STORE_FOLDER_NAME} → {IPHONE_NOTES_STORE_LIST_NAME}
                </span>
              </div>
              <h3 className="text-base font-semibold leading-snug">{itemTitleOrUntitled(current)}</h3>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto border rounded-md p-2 bg-muted/40">
                {preview}
              </p>
              <div className="space-y-1 flex-1 min-h-0 flex flex-col">
                <Label htmlFor="iphone-notes-bulk-draft">Bulk add (edit before adding)</Label>
                <Textarea
                  id="iphone-notes-bulk-draft"
                  className="min-h-[140px] font-mono text-sm flex-1"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={"Groceries:\nMilk\nEggs\n\nTrip ideas: Packing:\nPassport"}
                />
                <p className="text-xs text-muted-foreground">
                  Lines ending with “:” are list names; add another colon to name a new folder —{" "}
                  <code className="text-foreground">Trip ideas: Packing:</code>. {bulkSummary.items} item
                  {bulkSummary.items === 1 ? "" : "s"} in {bulkSummary.lists} list
                  {bulkSummary.lists === 1 ? "" : "s"}
                  {bulkSummary.folders > 0
                    ? `, ${bulkSummary.folders} folder${bulkSummary.folders === 1 ? "" : "s"}`
                    : ""}
                  .
                </p>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={openInLists}>
                  Open in Lists
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={skip}>
                    Skip
                  </Button>
                  <Button type="button" variant="outline" onClick={keepParked} disabled={index + 1 >= parked.length}>
                    Keep parked
                  </Button>
                  <Button type="button" onClick={bulkAddNow} disabled={bulkSummary.items === 0}>
                    Bulk add {bulkSummary.items || ""}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
