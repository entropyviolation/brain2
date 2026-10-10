/**
 * components/quick-add.tsx — Quick Add capture (smart-parse, Feature 10)
 *
 * Captures a single free-text idea and runs it through `lib/smart-parse` to pull
 * out a folder/list path, date/time, priority and duration — shown live as chips
 * while you type. The date, time, priority, and duration stay in the title.
 * A missing list or folder is created. Optionally lands in the Inbox for
 * clarification, or files straight onto the target list (All Items if none).
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
 */
"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
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
import {
  buildCapturedTask,
  ensureCaptureTarget,
  previewCapturePath,
} from "@/lib/capture-target"
import { CaptureShorthandHelp, SendToInboxField } from "@/components/capture-shorthand"
import { bulkReadyCount, writeBulkCapture } from "@/components/enhanced-bulk-add"

interface QuickAddProps {
  /** Controlled open state (e.g. driven by the quick-capture hotkey). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Highlighted page text from Cmd/Ctrl-Shift-A. Applied once per open.
   * A selection that contains a newline opens in Bulk.
   */
  seed?: string
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

export function QuickAdd({ open: openProp, onOpenChange, seed = "" }: QuickAddProps = {}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState

  const [ideaText, setIdeaText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(true)
  const [bulk, setBulk] = useState(false)
  const [plain, setPlain] = useState(false)
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

  const parsed = useMemo(() => parseSmartCapture(ideaText, { plain }), [ideaText, plain])
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
      writeBulkCapture(ideaText, sendToInbox, { plain })
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
    addTask(
      buildCapturedTask({
        suggestion,
        fallbackText: ideaText,
        sendToInbox,
        target,
        folders: useTaskStore.getState().folders,
      }),
    )
    closeFresh()
  }

  return (
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
                header — <span className="text-foreground">list:</span> or{" "}
                <span className="text-foreground">folder: list:</span>.{" "}
                <span className="text-foreground">before 9/12:</span> stamps that due day on the lines under it.
              </>
            ) : (
              <>
                Capture one item. Use colons for folder and list:{" "}
                <span className="text-foreground">folder: list: the item</span>.
                A new list is created when that name is new.
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
              {!bulk && ideaText.trim() ? <SuggestionChips suggestion={parsed.suggestion} /> : null}
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
              checked={sendToInbox}
              onCheckedChange={setSendToInbox}
            />
            <CaptureShorthandHelp variant={bulk ? "bulk" : "quick"} />
            <div className={bulk ? "flex items-center justify-between" : "flex justify-end"}>
              {bulk ? <div className="text-sm text-muted-foreground">{readyCount} tasks ready</div> : null}
              <Button type="submit" disabled={bulk && !ideaText.trim()}>
                {bulk
                  ? "Add Tasks"
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
  )
}
