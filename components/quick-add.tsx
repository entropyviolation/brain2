/**
 * components/quick-add.tsx — Quick Add capture (smart-parse, Feature 10)
 *
 * Captures a single free-text idea and runs it through `lib/smart-parse` to pull
 * out a folder/list path, date/time, priority and duration — shown live as chips
 * while you type. The date, time, priority, and duration stay in the title.
 * A missing list or folder is created. Optionally lands in the Inbox for
 * clarification, or files straight onto the target list (All Items if none).
 * A leading `log:` is the tracking log (same write as the Telegram bot), shown
 * as a dark blue LOG mark, and never sent to Inbox.
 *
 * **Plain** (checkbox, default off) or `-p` / `-plain` on the line stores the
 * text as written: no list, folder, date, time, priority, duration, or Monkey brain.
 *
 * **Bulk** (checkbox in this same dialog) switches the field to a taller box and
 * writes through `writeBulkCapture` — header lines, `folder: list: item`,
 * `before` dates, and the inbox checkbox. One dialog, one task store.
 *
 * The dialog is optionally controlled (so Cmd/Ctrl-Shift-A in `app/page.tsx`
 * can open it and prefill a page selection); uncontrolled with its own trigger
 * otherwise. Header trigger uses `.b2-shell-go` so it reads as the default
 * (bold, framed) press key. Dialog shell is milled fascia
 * (`.hpp95` / `header-popup-chrome.css`).
 *
 * A successful write raises one fixed flag (`.qa-wrote`): where the item went,
 * then it leaves. Click the flag or its ×, or wait a few seconds. A newer
 * success replaces it. An empty submit, a bulk write of nothing, or a log
 * error does not raise it.
 */
"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, CalendarDays, Clock, Tag, Flag, Timer, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useTaskStore } from "@/lib/task-store"
import { parseSmartCapture, type SmartSuggestion } from "@/lib/smart-parse"
import { lineCaptureOrigin } from "@/lib/capture-origin"
import {
  buildCapturedTask,
  ensureCaptureTarget,
  previewCapturePath,
} from "@/lib/capture-target"
import { CaptureShorthandHelp, SendToInboxField } from "@/components/capture-shorthand"
import { bulkReadyCount, writeBulkCapture } from "@/components/enhanced-bulk-add"
import { applyQuickAddLog, quickAddLogIntent } from "@/lib/quick-add-log"
import { FOLDER_ALL_PREFIX, GLOBAL_ALL_ITEMS_KEY, isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import type { Folder as FolderRecord, List, Task } from "@/lib/types"

/** How long the wrote-flag stays if nobody dismisses it. */
const QUICK_ADD_WROTE_MS = 4000

/** Successful `log:` / `log-` / `log ` write. Not Inbox. */
export const QUICK_ADD_LOG_WROTE = "Item added to the tracking log from Quick Add"

/** Where one captured task actually landed. */
export function quickAddWroteLabel(task: Task, lists: List[], folders: FolderRecord[]): string {
  if (task.monkeyBrain) return "Monkey brain"
  if (task.stage === "inbox") return "Inbox"
  const ids = task.lists ?? []
  const allItems = ids.length === 0 || ids.every((id) => isFolderAllItemsCategoryId(id))
  if (allItems) {
    const folderId = ids[0]?.startsWith(FOLDER_ALL_PREFIX) ? ids[0].slice(FOLDER_ALL_PREFIX.length) : ""
    const folder =
      folderId && folderId !== GLOBAL_ALL_ITEMS_KEY ? folders.find((row) => row.id === folderId) : undefined
    return folder?.name ? `${folder.name} All Items` : "All Items"
  }
  const list = lists.find((row) => row.id === ids[0])
  return list?.name?.trim() || "All Items"
}

/** One line for a successful Quick Add write. Null when nothing was written. */
export function quickAddWroteMessage(labels: string[]): string | null {
  if (labels.length === 0) return null
  const unique = [...new Set(labels)]
  const destination = unique.length === 1 ? unique[0] : null
  if (labels.length === 1 && destination) return `Item added to ${destination} from Quick Add`
  if (destination) return `${labels.length} items added to ${destination} from Quick Add`
  return `${labels.length} items added from Quick Add`
}

function QuickAddWroteFlag({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  if (typeof document === "undefined") return null
  return createPortal(
    <div className="qa-wrote" role="status" data-quick-add-notice="" onClick={onDismiss}>
      <span className="qa-wrote-lamp" aria-hidden />
      <span className="qa-wrote-text" title={text}>
        {text}
      </span>
      <button
        type="button"
        className="qa-wrote-x"
        data-no95=""
        aria-label="Dismiss"
        onClick={(event) => {
          event.stopPropagation()
          onDismiss()
        }}
      >
        ×
      </button>
    </div>,
    document.body,
  )
}

interface QuickAddProps {
  /** Controlled open state (e.g. driven by the quick-capture hotkey). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Highlighted page text from Cmd/Ctrl-Shift-A. Applied once per open.
   * A selection that contains a newline opens in Bulk.
   */
  seed?: string
  /** How long the success flag stays. Tests pass a shorter wait. */
  wroteMs?: number
}

/** Dark blue mark: this line is a tracking log, not a list. */
export function LogFlag() {
  return (
    <Badge data-log-flag="" className="border-transparent bg-[#12315c] font-normal text-[#f4f8fc] hover:bg-[#12315c]">
      LOG
    </Badge>
  )
}

/** Render the parsed fields of a suggestion as inline chips. */
export function SuggestionChips({ suggestion }: { suggestion: SmartSuggestion }) {
  const lists = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const preview = previewCapturePath(suggestion.folderPath, suggestion.category, folders, lists)

  const chips: { key: string; icon: React.ReactNode; label: string }[] = []
  preview.folders.forEach((f, i) => {
    chips.push({
      key: `folder-${i}`,
      icon: <Folder className="h-3 w-3" />,
      label: `${f.name}${f.exists ? "" : " (new folder)"}`,
    })
  })
  if (preview.list) {
    chips.push({
      key: "list",
      icon: <Tag className="h-3 w-3" />,
      label: `${preview.list.name}${preview.list.exists ? "" : " (new list)"}`,
    })
  } else if (suggestion.category) {
    chips.push({ key: "cat", icon: <Tag className="h-3 w-3" />, label: suggestion.category })
  }
  if (suggestion.scheduledDate)
    chips.push({ key: "date", icon: <CalendarDays className="h-3 w-3" />, label: format(suggestion.scheduledDate, "EEE MMM d") })
  if (suggestion.scheduledTime)
    chips.push({ key: "time", icon: <Clock className="h-3 w-3" />, label: suggestion.scheduledTime })
  if (suggestion.estimatedDuration)
    chips.push({ key: "dur", icon: <Timer className="h-3 w-3" />, label: `${suggestion.estimatedDuration}m` })
  if (suggestion.urgency)
    chips.push({ key: "urg", icon: <Flag className="h-3 w-3" />, label: `urgency ${suggestion.urgency}` })
  if (suggestion.importance)
    chips.push({ key: "imp", icon: <Flag className="h-3 w-3" />, label: `importance ${suggestion.importance}` })
  if (suggestion.monkeyBrain)
    chips.push({ key: "monkey", icon: <Flag className="h-3 w-3" />, label: "Monkey brain" })
  if (suggestion.plain)
    chips.push({ key: "plain", icon: null, label: "Plain" })

  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Badge key={c.key} variant="secondary" className="flex items-center gap-1 font-normal">
          {c.icon}
          {c.label}
        </Badge>
      ))}
    </div>
  )
}

export function QuickAdd({ open: openProp, onOpenChange, seed = "", wroteMs = QUICK_ADD_WROTE_MS }: QuickAddProps = {}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState

  const [ideaText, setIdeaText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(true)
  const [bulk, setBulk] = useState(false)
  const [plain, setPlain] = useState(false)
  const addTask = useTaskStore((state) => state.addTask)
  const seeded = useRef<string | null>(null)
  const wroteSeq = useRef(0)
  const [wrote, setWrote] = useState<{ id: number; text: string } | null>(null)

  const showWrote = (text: string) => {
    wroteSeq.current += 1
    setWrote({ id: wroteSeq.current, text })
  }

  useEffect(() => {
    if (!wrote) return
    const id = wrote.id
    const timer = window.setTimeout(() => {
      setWrote((current) => (current?.id === id ? null : current))
    }, wroteMs)
    return () => window.clearTimeout(timer)
  }, [wrote, wroteMs])

  useEffect(() => {
    if (!open) {
      seeded.current = null
      return
    }
    if (!seed || seeded.current === seed) return
    seeded.current = seed
    setIdeaText(seed)
    if (seed.includes("\n")) setBulk(true)
  }, [open, seed])

  const parsed = useMemo(() => parseSmartCapture(ideaText, { plain }), [ideaText, plain])
  const logIntent = useMemo(
    () => (bulk ? null : quickAddLogIntent(ideaText, plain)),
    [bulk, ideaText, plain],
  )
  const readyCount = bulk ? bulkReadyCount(ideaText, plain) : 0

  const closeFresh = () => {
    setIdeaText("")
    setBulk(false)
    setPlain(false)
    setSendToInbox(true)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIdeaText("")
      setBulk(false)
      setPlain(false)
      setSendToInbox(true)
    }
    setOpen(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaText.trim()) return

    if (bulk) {
      const created = writeBulkCapture(ideaText, sendToInbox, { plain, originKind: "quick-add" })
      const state = useTaskStore.getState()
      const message = quickAddWroteMessage(created.map((task) => quickAddWroteLabel(task, state.lists, state.folders)))
      if (message) showWrote(message)
      closeFresh()
      return
    }

    if (logIntent) {
      const logged = applyQuickAddLog(logIntent)
      if (logged.status === "error") return
      if (logged.status === "ok") showWrote(QUICK_ADD_LOG_WROTE)
      closeFresh()
      return
    }

    const { suggestion } = parsed
    const target = ensureCaptureTarget(suggestion, () => {
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
    })
    const task = buildCapturedTask({
      suggestion,
      fallbackText: ideaText,
      sendToInbox,
      target,
      folders: useTaskStore.getState().folders,
      origin: lineCaptureOrigin("quick-add", ideaText),
    })
    addTask(task)
    const state = useTaskStore.getState()
    const message = quickAddWroteMessage([quickAddWroteLabel(task, state.lists, state.folders)])
    if (message) showWrote(message)
    closeFresh()
  }

  return (
    <>
    {wrote ? <QuickAddWroteFlag text={wrote.text} onDismiss={() => setWrote(null)} /> : null}
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="b2-shell-go gap-1">
          <Plus className="h-4 w-4" />
          <span>Quick Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="hpp95 hpp95-dialog sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Quick Add" data-ui-docs="components/README.md">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>Add Idea</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            {plain ? (
              <>
                Plain is on. {bulk ? "Each line is" : "This line is"} stored as written — no list, folder, date, time, or priority.
              </>
            ) : bulk ? (
              <>
                One item per line. A line that ends with <span className="text-foreground">:</span> is a
                header — <span className="text-foreground">list:</span>,{" "}
                <span className="text-foreground">folder: list:</span>, or{" "}
                <span className="text-foreground">folder: all:</span> for that folder&apos;s All Items.{" "}
                <span className="text-foreground">before 9/12:</span> stamps that due day on the lines under it.
              </>
            ) : (
              <>
                Capture one item. Use colons for folder and list:{" "}
                <span className="text-foreground">folder: list: the item</span>.{" "}
                <span className="text-foreground">folder: all: the item</span> files on that folder&apos;s All Items.
                A new list is created when that name is new.{" "}
                <span className="text-foreground">log: the event</span> is a tracking log, not a list.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
              <input
                id="quick-add-bulk"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border border-primary"
                checked={bulk}
                onChange={(e) => setBulk(e.target.checked)}
              />
              <Label htmlFor="quick-add-bulk" className="font-normal cursor-pointer">
                Bulk
              </Label>
              <input
                id="quick-add-plain"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border border-primary"
                checked={plain}
                onChange={(e) => setPlain(e.target.checked)}
              />
              <Label htmlFor="quick-add-plain" className="font-normal cursor-pointer">
                Plain
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea">{bulk ? "Tasks and Lists" : "Idea"}</Label>
              {!bulk && logIntent ? <LogFlag /> : null}
              {!bulk && !logIntent && ideaText.trim() ? <SuggestionChips suggestion={parsed.suggestion} /> : null}
              {bulk ? (
                <Textarea
                  id="idea"
                  placeholder={"Writing:\nDraft chapter 1\nEdit outline\n\nNext Actions: Eventually:\nGo through old pages"}
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  className="hpp-bulk-box resize-none font-mono text-sm"
                  autoFocus
                />
              ) : (
                <Input
                  id="idea"
                  placeholder="next actions: eventually: write the memoir"
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <SendToInboxField
              id="quick-add-inbox"
              checked={logIntent ? false : sendToInbox}
              disabled={Boolean(logIntent)}
              note={logIntent ? "This line is a tracking log. It does not go to Inbox." : undefined}
              onCheckedChange={setSendToInbox}
            />
            <CaptureShorthandHelp variant={bulk ? "bulk" : "quick"} />
            <div className={bulk ? "flex items-center justify-between" : "flex justify-end"}>
              {bulk ? <div className="text-sm text-muted-foreground">{readyCount} tasks ready</div> : null}
              <Button
                type="submit"
                disabled={(bulk && !ideaText.trim()) || (Boolean(logIntent) && !logIntent?.payload.trim() && logIntent?.kind !== "log-categories")}
              >
                {bulk
                  ? "Add Tasks"
                  : logIntent
                    ? "Log"
                    : parsed.suggestion.monkeyBrain
                      ? "Add to Monkey brain"
                      : sendToInbox
                        ? "Add to Inbox"
                        : "Add item"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
