/**
 * components/enhanced-bulk-add.tsx — Bulk Add capture
 *
 * Multi-line capture: a line ending in ":" is a folder/list header; following
 * lines become items. Inline `folder: list: item` paths work on a single line.
 * `before 9/12:` stamps due that day. Unknown folders/lists are auto-created.
 * Date, time, duration, and priority stay in the item title. `plain` stores
 * every line as written. Optionally send items to Inbox.
 *
 * The header no longer mounts this dialog. Quick Add's **Bulk** toggle calls
 * `writeBulkCapture` (same task store, no second capture path). Inbox bulk
 * edit and the mobile shell still open this dialog. Shell is milled fascia
 * (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ListPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useTaskStore } from "@/lib/task-store"
import { parsePathHeader, parseSmartCapture } from "@/lib/smart-parse"
import { buildCapturedTask, ensureCaptureTarget } from "@/lib/capture-target"
import { CaptureShorthandHelp, SendToInboxField } from "@/components/capture-shorthand"
import { stampMustBeDoneBefore } from "@/lib/ingest/apply-bulk"
import { parseBulkBuckets } from "@/lib/ingest/parse-bulk"
import { runAsAction } from "@/lib/action-history"
import type { Task } from "@/lib/types"

export interface EnhancedBulkAddProps {
  /** Prefill when opening (Inbox bulk edit). Seeded once per open. */
  initialText?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  title?: string
  description?: string
  /** Inbox checkbox when the dialog opens. Header Bulk Add stays off. */
  defaultSendToInbox?: boolean
  /** One undo step around the write, including `afterAdd`. */
  actionLabel?: string
  afterAdd?: (info: { sendToInbox: boolean; tasks: Task[] }) => void
}

function storeMutators() {
  const s = useTaskStore.getState()
  return {
    lists: s.lists,
    folders: s.folders,
    addList: s.addList,
    addFolder: s.addFolder,
    addListToFolder: s.addListToFolder,
    updateList: s.updateList,
    updateFolder: s.updateFolder,
  }
}

/** Lines that become items. Header lines ending in ":" are not items, unless Plain is on. */
export function bulkReadyCount(tasksText: string, plain = false): number {
  return tasksText.split("\n").filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (plain) return true
    return !parsePathHeader(trimmed)
  }).length
}

/**
 * Write a bulk-add draft through the same capture target as Quick Add.
 * One undo step when `actionLabel` is set. Returns the tasks just added.
 */
export function writeBulkCapture(
  tasksText: string,
  sendToInbox: boolean,
  options?: {
    actionLabel?: string
    /** Store every line as written. Headers, dates, and list paths are not read. */
    plain?: boolean
    afterAdd?: (info: { sendToInbox: boolean; tasks: Task[] }) => void
  },
): Task[] {
  const created: Task[] = []
  const write = () => {
    const addTask = useTaskStore.getState().addTask
    if (options?.plain) {
      for (const raw of tasksText.split(/\r\n|\r|\n/)) {
        const line = raw.trim()
        if (!line) continue
        const { suggestion } = parseSmartCapture(line, { plain: true })
        const target = ensureCaptureTarget(suggestion, storeMutators)
        const task = buildCapturedTask({
          suggestion,
          fallbackText: line,
          sendToInbox,
          target,
          folders: useTaskStore.getState().folders,
        })
        created.push(task)
        addTask(task)
      }
      options?.afterAdd?.({ sendToInbox, tasks: created })
      return
    }
    const buckets = parseBulkBuckets(tasksText)
    for (const bucket of buckets) {
      for (const line of bucket.lines) {
        const { suggestion } = parseSmartCapture(line)
        const folderPath = suggestion.folderPath?.length ? suggestion.folderPath : bucket.folderPath
        const listName = suggestion.category || bucket.listName
        const merged = {
          ...suggestion,
          folderPath: folderPath.length ? folderPath : undefined,
          category: listName,
        }
        const target = ensureCaptureTarget(merged, storeMutators)
        const task = stampMustBeDoneBefore(
          buildCapturedTask({
            suggestion: { ...suggestion, description: suggestion.description || line },
            fallbackText: line,
            sendToInbox,
            target,
            folders: useTaskStore.getState().folders,
          }),
          bucket.dueBefore,
        )
        created.push(task)
        addTask(task)
      }
    }
    options?.afterAdd?.({ sendToInbox, tasks: created })
  }

  if (options?.actionLabel) runAsAction(options.actionLabel, write)
  else write()
  return created
}

export function EnhancedBulkAdd({
  initialText,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  title = "Bulk Add Tasks with Lists",
  description,
  defaultSendToInbox = false,
  actionLabel,
  afterAdd,
}: EnhancedBulkAddProps = {}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setOpenState(next)
  }
  const [tasksText, setTasksText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(false)
  const seeded = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      seeded.current = null
      return
    }
    if (initialText == null || seeded.current === initialText) return
    seeded.current = initialText
    setTasksText(initialText)
    setSendToInbox(defaultSendToInbox)
  }, [open, initialText, defaultSendToInbox])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tasksText.trim()) return

    writeBulkCapture(tasksText, sendToInbox, { actionLabel, afterAdd })

    setTasksText("")
    setOpen(false)
  }

  const itemCount = bulkReadyCount(tasksText)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1">
            <ListPlus className="h-4 w-4" />
            <span>Bulk Add</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="hpp95 hpp95-dialog sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-ui-name="Bulk Add" data-ui-docs="components/README.md">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            {description ?? (
              <>
                One item per line. Header lines end with &apos;:&apos; —{" "}
                <span className="text-foreground">list:</span> or{" "}
                <span className="text-foreground">folder: list:</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body flex-1 min-h-0 overflow-hidden flex flex-col">
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <Label htmlFor="tasks">Tasks and Lists</Label>
              <Textarea
                id="tasks"
                placeholder={"Writing:\nDraft chapter 1\nEdit outline\n\nNext Actions: Eventually:\nGo through old pages"}
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                className="flex-1 resize-none font-mono text-sm"
                autoFocus
              />
            </div>
            <SendToInboxField
              id="bulk-add-inbox"
              checked={sendToInbox}
              onCheckedChange={setSendToInbox}
            />
            <CaptureShorthandHelp variant="bulk" />
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">{itemCount} tasks ready</div>
              <Button type="submit" disabled={!tasksText.trim()}>
                Add Tasks
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
