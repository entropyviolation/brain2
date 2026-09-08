/**
 * components/enhanced-bulk-add.tsx — Bulk Add capture
 *
 * Multi-line capture: a line ending in ":" is a folder/list header; following
 * lines become items. Inline `folder: list: item` paths work on a single line.
 * Unknown folders/lists are auto-created. Optionally send items to Inbox.
 */
"use client"

import type React from "react"
import { useState } from "react"
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

type Bucket = { folderPath: string[]; listName: string; lines: string[] }

function parseBulkBuckets(text: string): Bucket[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const buckets: Bucket[] = []
  let current: Bucket = { folderPath: [], listName: "General", lines: [] }

  const flush = () => {
    if (current.lines.length === 0) return
    buckets.push(current)
  }

  for (const line of lines) {
    const header = parsePathHeader(line)
    if (header) {
      flush()
      current = { folderPath: header.folderPath, listName: header.listName, lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  flush()
  return buckets
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

export function EnhancedBulkAdd() {
  const [open, setOpen] = useState(false)
  const [tasksText, setTasksText] = useState("")
  const [sendToInbox, setSendToInbox] = useState(false)
  const addTask = useTaskStore((state) => state.addTask)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tasksText.trim()) return

    const buckets = parseBulkBuckets(tasksText)

    for (const bucket of buckets) {
      for (const line of bucket.lines) {
        const { suggestion } = parseSmartCapture(line)
        const folderPath = suggestion.folderPath?.length
          ? suggestion.folderPath
          : bucket.folderPath
        const listName = suggestion.category || bucket.listName
        const merged = { ...suggestion, folderPath: folderPath.length ? folderPath : undefined, category: listName }
        const target = ensureCaptureTarget(merged, storeMutators)
        addTask(
          buildCapturedTask({
            suggestion: { ...suggestion, description: suggestion.description || line },
            fallbackText: line,
            sendToInbox,
            target,
            folders: useTaskStore.getState().folders,
          }),
        )
      }
    }

    setTasksText("")
    setOpen(false)
  }

  const itemCount = tasksText
    .split("\n")
    .filter((line) => line.trim() && !parsePathHeader(line.trim()))
    .length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <ListPlus className="h-4 w-4" />
          <span>Bulk Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Add Tasks with Lists</DialogTitle>
          <DialogDescription>
            One item per line. Header lines end with &apos;:&apos; —{" "}
            <span className="text-foreground">list:</span> or{" "}
            <span className="text-foreground">folder: list:</span>.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
