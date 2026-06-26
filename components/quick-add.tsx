/**
 * components/quick-add.tsx — Quick Add capture (smart-parse, Feature 10)
 *
 * Captures a single free-text idea and runs it through `lib/smart-parse` to pull
 * out a date/time, a `Category:` hint, priority and duration — shown live as
 * chips while you type. Captures still land in the Inbox for clarification, but
 * the parsed scheduling fields ride along so the Inbox can surface them.
 *
 * The dialog is optionally controlled (so the quick-capture hotkey in
 * `app/page.tsx` can open it); uncontrolled with its own trigger otherwise.
 */
"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { Plus, CalendarDays, Clock, Tag, Flag, Timer } from "lucide-react"
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

interface QuickAddProps {
  /** Controlled open state (e.g. driven by the quick-capture hotkey). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Render the parsed fields of a suggestion as inline chips. */
export function SuggestionChips({ suggestion }: { suggestion: SmartSuggestion }) {
  const chips: { key: string; icon: React.ReactNode; label: string }[] = []
  if (suggestion.category) chips.push({ key: "cat", icon: <Tag className="h-3 w-3" />, label: suggestion.category })
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
  const addTask = useTaskStore((state) => state.addTask)
  const categories = useTaskStore((state) => state.lists)

  const parsed = useMemo(() => parseSmartCapture(ideaText), [ideaText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ideaText.trim()) return

    const { suggestion } = parsed
    const description = suggestion.description || ideaText.trim()

    // Resolve a category hint to an existing list (pre-selects it during clarify);
    // otherwise keep the raw hint as a tag so it isn't lost.
    const matchedCategory = suggestion.category
      ? categories.find((c) => c.name.toLowerCase() === suggestion.category!.toLowerCase())
      : undefined

    addTask({
      id: Date.now().toString(),
      description,
      title: description,
      stage: "inbox",
      type: "task",
      tags: !matchedCategory && suggestion.category ? [suggestion.category] : [],
      links: [],
      createdAt: new Date(),
      estimatedDuration: suggestion.estimatedDuration ?? 1,
      cognitiveLoad: 1,
      urgency: suggestion.urgency ?? 3,
      importance: suggestion.importance ?? 3,
      dependencies: [],
      context: "@inbox",
      entropy: 0.5,
      rewardValue: 1,
      completed: false,
      lists: matchedCategory ? [matchedCategory.id] : [],
      allowPartialCompletion: false,
      minimumChunkSize: 15,
      scheduledDate: suggestion.scheduledDate,
      scheduledTime: suggestion.scheduledTime,
      subtasks: [],
    })
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Idea</DialogTitle>
          <DialogDescription>
            Quickly capture an idea. Try &ldquo;Work: call dentist tomorrow at 3pm for 30m&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea">Idea</Label>
            <Input
              id="idea"
              placeholder="What's on your mind?"
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              autoFocus
            />
            {ideaText.trim() && <SuggestionChips suggestion={parsed.suggestion} />}
          </div>
          <div className="flex justify-end">
            <Button type="submit">Add to Inbox</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
