/**
 * components/quick-add.tsx — Quick Add capture (smart-parse, Feature 10)
 *
 * Captures a single free-text idea and runs it through `lib/smart-parse` to pull
 * out a folder/list path, date/time, priority and duration — shown live as chips
 * while you type. The letters paint before that parse, so a fast burst is not
 * waiting on the chips. The date, time, priority, and duration stay in the title.
 * A missing list or folder is created. Optionally lands in the Inbox for
 * clarification, or files straight onto the target list (All Items if none).
 * A leading `log:` or `thought process:` / `tp:` is the tracking log (same write
 * as the Telegram bot) and the Log or Thought Process list under Tracking.
 * Shown as a dark blue LOG or THOUGHT mark, and never sent to Inbox.
 *
 * **Plain** (checkbox, default off) or `-p` / `-plain` on the line stores the
 * text as written: no list, folder, date, time, priority, duration, or Monkey brain.
 *
 * **Bulk** (checkbox in this same dialog) makes the same field taller and
 * writes through `writeBulkCapture` — header lines, `folder: list: item`,
 * `before` dates, and the inbox checkbox. It does not mount a second field.
 * One dialog, one task store.
 *
 * The dialog is optionally controlled (so Cmd/Ctrl-Shift-A in `app/page.tsx`
 * can open it and prefill a page selection); uncontrolled with its own trigger
 * otherwise. `hideTrigger` omits that button when the pin bar owns the key.
 * Header trigger uses `.b2-shell-go` so it reads as the default (bold, framed)
 * press key. Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 * The title-bar × is `KeycapClose` (grey modifier cap; brick on hover).
 *
 * A successful write raises a floating added confirmation (`.qa-wrote` via
 * `quick-add-wrote.tsx` / `QuickAddWroteHost` on the pin bar): where the item
 * went. Bottom-right with a comfortable inset, X to dismiss, auto-dismiss after
 * one minute. The host outlives the dialog. A newer success replaces it. An
 * empty submit, a bulk write of nothing, or a log error does not raise it.
 */
"use client"

import type React from "react"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { Plus, CalendarDays, Clock, Tag, Flag, Timer, Folder, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useTaskStore } from "@/lib/task-store"
import { highlightSkipKey, parseSmartCapture, type SmartHighlight, type SmartSuggestion } from "@/lib/smart-parse"
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
import { QUICK_ADD_LOG_WROTE, QUICK_ADD_THOUGHT_WROTE, raiseQuickAddWrote } from "@/components/quick-add-wrote"

export {
  QUICK_ADD_LOG_WROTE,
  QUICK_ADD_WROTE_MS,
  QuickAddWroteHost,
  dismissQuickAddWrote,
  raiseQuickAddWrote,
} from "@/components/quick-add-wrote"

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

/**
 * iOS keeps a focus zoom when a field under 16px is focused inside a
 * transformed dialog. Bulk used to mount that field. If the page is already
 * scaled, blur and restore the unlocked viewport so a pinch can return.
 */
function releasePageZoom() {
  const view = window.visualViewport
  if (!view || view.scale <= 1.001) return
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) active.blur()
  const meta = document.querySelector('meta[name="viewport"]')
  if (!(meta instanceof HTMLMetaElement)) return
  const content = meta.getAttribute("content")
  if (!content || /maximum-scale|user-scalable\s*=\s*no/i.test(content)) return
  meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover")
  requestAnimationFrame(() => meta.setAttribute("content", content))
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
  /** Omit the header button. The pin bar renders the key and owns `open`. */
  hideTrigger?: boolean
}

/** Dark blue mark: this line is a tracking log or a thought process, not a new list. */
export function LogFlag({ thought = false }: { thought?: boolean }) {
  return (
    <Badge data-log-flag="" className="border-transparent bg-[#12315c] font-normal text-[#f4f8fc] hover:bg-[#12315c]">
      {thought ? "THOUGHT" : "LOG"}
    </Badge>
  )
}

/** Render the parsed fields of a suggestion as inline chips. */
export function SuggestionChips({
  suggestion,
  highlights = [],
  onSkip,
}: {
  suggestion: SmartSuggestion
  highlights?: SmartHighlight[]
  /** Called with skip keys when a chip's × is pressed. Chips with no span (Plain) have no ×. */
  onSkip?: (keys: string[]) => void
}) {
  const lists = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const preview = previewCapturePath(suggestion.folderPath, suggestion.category, folders, lists)

  const chips: { key: string; icon: React.ReactNode; label: string }[] = []
  const spans = (type: SmartHighlight["type"]) => highlights.filter((h) => h.type === type)
  const skipKeys = (key: string): string[] => {
    if (key.startsWith("folder-")) return spans("folder").slice(Number(key.slice(7)), Number(key.slice(7)) + 1).map((h) => highlightSkipKey(h.type, h.text))
    const type = key === "list" || key === "cat" ? "category"
      : key === "attached" || key === "due" || key === "date" ? "date"
      : key === "time" ? "time"
      : key === "dur" ? "duration"
      : key === "urg" || key === "imp" ? "priority"
      : key === "monkey" ? "flag" : null
    if (!type) return []
    const all = spans(type).map((h) => highlightSkipKey(h.type, h.text))
    return type === "priority" ? all : all.slice(0, 1)
  }
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
  if (suggestion.attachedDate)
    chips.push({ key: "attached", icon: <CalendarDays className="h-3 w-3" />, label: `${format(suggestion.attachedDate, "EEE MMM d")} (attached)` })
  if (suggestion.deadline)
    chips.push({ key: "due", icon: <CalendarDays className="h-3 w-3" />, label: `due ${format(suggestion.deadline, "EEE MMM d")}` })
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
      {chips.map((c) => {
        const keys = onSkip ? skipKeys(c.key) : []
        return (
          <Badge key={c.key} variant="secondary" className="qa-chip relative flex items-center gap-1 font-normal">
            {c.icon}
            {c.label}
            {keys.length ? (
              <button
                type="button"
                className="qa-chip-x"
                aria-label={`Don't tag ${c.label}`}
                title="Don't tag this"
                onClick={() => onSkip?.(keys)}
              >
                <X aria-hidden />
              </button>
            ) : null}
          </Badge>
        )
      })}
    </div>
  )
}

export function QuickAdd({
  open: openProp,
  onOpenChange,
  seed = "",
  hideTrigger = false,
}: QuickAddProps = {}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState

  const [ideaText, setIdeaText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(true)
  const [bulk, setBulk] = useState(false)
  const [plain, setPlain] = useState(false)
  const [skip, setSkip] = useState<string[]>([])
  const [grown, setGrown] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const addTask = useTaskStore((state) => state.addTask)
  const seeded = useRef<string | null>(null)

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

  // Chips and the button label follow a deferred copy so the letters paint
  // before the parse. Submit reads the live field, below.
  const previewText = useDeferredValue(ideaText)
  const parsed = useMemo(() => parseSmartCapture(previewText, { plain, skip }), [previewText, plain, skip])
  const logIntent = useMemo(
    () => (bulk ? null : quickAddLogIntent(previewText, plain)),
    [bulk, previewText, plain],
  )
  // The same field grows once the text wraps or has a newline. It stays big
  // until the text is cleared. The measure runs after paint, so a keystroke
  // is not waiting on layout. Bulk does not swap in a new control: a new
  // focused field under 16px, inside a transformed dialog, is what locks
  // iOS zoom.
  const bigBox = bulk || grown
  useEffect(() => {
    if (!ideaText) {
      setGrown(false)
      setSkip([])
      return
    }
    if (bulk || grown) return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      const el = areaRef.current
      if (cancelled || !el) return
      if (ideaText.includes("\n") || el.scrollHeight > el.clientHeight + 1) setGrown(true)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [ideaText, bulk, grown])
  useEffect(() => {
    if (!open || !bulk) return
    const frame = requestAnimationFrame(() => releasePageZoom())
    return () => cancelAnimationFrame(frame)
  }, [open, bulk])
  const readyCount = bulk ? bulkReadyCount(previewText, plain) : 0

  const closeFresh = () => {
    setIdeaText("")
    setBulk(false)
    setPlain(false)
    setSkip([])
    setGrown(false)
    setSendToInbox(true)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIdeaText("")
      setBulk(false)
      setPlain(false)
      setSkip([])
      setGrown(false)
      setSendToInbox(true)
    }
    setOpen(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaText.trim()) return

    const liveLog = bulk ? null : quickAddLogIntent(ideaText, plain)
    const liveParsed = parseSmartCapture(ideaText, { plain, skip })

    if (bulk) {
      const created = writeBulkCapture(ideaText, sendToInbox, { plain, originKind: "quick-add" })
      const state = useTaskStore.getState()
      const message = quickAddWroteMessage(created.map((task) => quickAddWroteLabel(task, state.lists, state.folders)))
      if (message) raiseQuickAddWrote(message)
      closeFresh()
      return
    }

    if (liveLog) {
      const logged = applyQuickAddLog(liveLog)
      if (logged.status === "error") return
      if (logged.status === "ok") {
        raiseQuickAddWrote(liveLog.kind === "thought-process" ? QUICK_ADD_THOUGHT_WROTE : QUICK_ADD_LOG_WROTE)
      }
      closeFresh()
      return
    }

    const { suggestion } = liveParsed
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
    const listName = target.list?.name?.trim()
    addTask(task, listName ? { surface: "quick-add", name: listName } : { surface: "quick-add" })
    const state = useTaskStore.getState()
    const message = quickAddWroteMessage([quickAddWroteLabel(task, state.lists, state.folders)])
    if (message) raiseQuickAddWrote(message)
    closeFresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button size="sm" className="b2-shell-go gap-1">
            <Plus className="h-4 w-4" />
            <span>Quick Add</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent hideClose className="hpp95 hpp95-dialog qa-dialog sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Quick Add" data-ui-docs="components/README.md">
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
                <span className="text-foreground">log: the event</span> and{" "}
                <span className="text-foreground">thought process: the strand</span> go to the tracking log
                and the Tracking folder, not a new list.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idea" className="text-base font-semibold">
                {bulk ? "Tasks and Lists" : "Idea"}
              </Label>
              {!bulk && logIntent ? <LogFlag thought={logIntent.kind === "thought-process"} /> : null}
              {!bulk && !logIntent && ideaText.trim() ? <SuggestionChips suggestion={parsed.suggestion} highlights={parsed.highlights} onSkip={(keys) => setSkip((prev) => [...new Set([...prev, ...keys])])} /> : null}
              <Textarea
                id="idea"
                ref={areaRef}
                rows={bigBox ? 8 : 2}
                placeholder={bulk ? "Writing:\nDraft chapter 1\nEdit outline\n\nNext Actions: Eventually:\nGo through old pages" : "next actions: eventually: write the memoir"}
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                onKeyDown={(e) => {
                  // One item: Enter still adds it, Shift-Enter breaks the line.
                  if (!bulk && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                className={bigBox ? "hpp-bulk-box qa-idea resize-none font-mono" : "qa-idea-line qa-idea resize-none"}
                autoFocus
              />
            </div>
            <SendToInboxField
              id="quick-add-inbox"
              checked={logIntent ? false : sendToInbox}
              disabled={Boolean(logIntent)}
              note={
                logIntent
                  ? logIntent.kind === "thought-process"
                    ? "This line is a thought process. It does not go to Inbox."
                    : "This line is a tracking log. It does not go to Inbox."
                  : undefined
              }
              onCheckedChange={setSendToInbox}
            />
            <div className="qa-modes">
              <Label className="qa-mode-key" data-on={bulk ? "true" : "false"}>
                <input
                  id="quick-add-bulk"
                  type="checkbox"
                  checked={bulk}
                  onChange={(e) => setBulk(e.target.checked)}
                />
                Bulk
              </Label>
              <Label className="qa-mode-key" data-on={plain ? "true" : "false"}>
                <input
                  id="quick-add-plain"
                  type="checkbox"
                  checked={plain}
                  onChange={(e) => setPlain(e.target.checked)}
                />
                Plain
              </Label>
            </div>
            <details className="hpp-qa-more">
              <summary className="cursor-pointer text-sm text-muted-foreground">Shorthand</summary>
              <div className="mt-3 space-y-3">
                <CaptureShorthandHelp variant={bulk ? "bulk" : "quick"} />
              </div>
            </details>
            <div className={bulk ? "flex items-center justify-between" : "flex justify-end"}>
              {bulk ? <div className="text-sm text-muted-foreground">{readyCount} tasks ready</div> : null}
              <Button
                type="submit"
                className="qa-key"
                disabled={(bulk && !ideaText.trim()) || (Boolean(logIntent) && !logIntent?.payload.trim() && logIntent?.kind !== "log-categories")}
              >
                {bulk
                  ? "Add Tasks"
                  : logIntent
                    ? logIntent.kind === "thought-process"
                      ? "Add"
                      : "Log"
                    : parsed.suggestion.monkeyBrain
                      ? "Add to Monkey brain"
                      : sendToInbox
                        ? "Add to Inbox"
                        : "Add item"}
              </Button>
            </div>
          </form>
        </div>
        <DialogClose asChild>
          <KeycapClose corner />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
