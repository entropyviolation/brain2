/**
 * components/quick-add.tsx — Quick Add capture (smart-parse, Feature 10)
 *
 * Captures a single free-text idea and runs it through `lib/smart-parse` to pull
 * out a folder/list path, date/time, priority and duration — shown live as chips
 * while you type. Optionally lands in the Inbox for clarification, or files
 * straight onto the target list (All Items if none).
 *
 * The dialog is optionally controlled (so the quick-capture hotkey in
 * `app/page.tsx` can open it); uncontrolled with its own trigger otherwise.
 */
"use client"

import type React from "react"

import { useMemo, useState } from "react"
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

interface QuickAddProps {
  /** Controlled open state (e.g. driven by the quick-capture hotkey). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
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

export function QuickAdd({ open: openProp, onOpenChange }: QuickAddProps = {}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState

  const [ideaText, setIdeaText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(true)
  const addTask = useTaskStore((state) => state.addTask)

  const parsed = useMemo(() => parseSmartCapture(ideaText), [ideaText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaText.trim()) return

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
    setIdeaText("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          <span>Quick Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Idea</DialogTitle>
          <DialogDescription>
            Capture one item. Use colons for folder and list:{" "}
            <span className="text-foreground">folder: list: the item</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea">Idea</Label>
            {ideaText.trim() && <SuggestionChips suggestion={parsed.suggestion} />}
            <Input
              id="idea"
              placeholder="next actions: eventually: write the memoir"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              autoFocus
            />
          </div>
          <SendToInboxField
            id="quick-add-inbox"
            checked={sendToInbox}
            onCheckedChange={setSendToInbox}
          />
          <CaptureShorthandHelp variant="quick" />
          <div className="flex justify-end">
            <Button type="submit">{sendToInbox ? "Add to Inbox" : "Add item"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
