/**
 * components/enhanced-bulk-add.tsx — Bulk Add capture
 *
 * Multi-line capture using the v1 line-based syntax: a line ending in ":" starts
 * a new category block; following lines become items in that category; unknown
 * categories are auto-created. Items go directly into their lists (not Inbox).
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
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { parseSmartCapture, type SmartSuggestion } from "@/lib/smart-parse"
import type { Task, List } from "@/lib/types"

export function EnhancedBulkAdd() {
  const [open, setOpen] = useState(false)
  const [tasksText, setTasksText] = useState("")
  const addTask = useTaskStore((state) => state.addTask)
  const addList = useTaskStore((state) => state.addList)
  const categories = useTaskStore((state) => state.lists)

  const parseTasksWithCategories = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const result: { [categoryName: string]: string[] } = {}
    let currentCategory = "General"

    for (const line of lines) {
      if (line.endsWith(":")) {
        currentCategory = line.slice(0, -1).trim()
        if (!result[currentCategory]) result[currentCategory] = []
      } else {
        if (!result[currentCategory]) result[currentCategory] = []
        result[currentCategory].push(line)
      }
    }
    return result
  }

  const applySuggestion = (task: Task, suggestion: SmartSuggestion): Task => ({
    ...task,
    ...(suggestion.scheduledDate ? { scheduledDate: suggestion.scheduledDate } : {}),
    ...(suggestion.scheduledTime ? { scheduledTime: suggestion.scheduledTime } : {}),
    ...(suggestion.estimatedDuration ? { estimatedDuration: suggestion.estimatedDuration } : {}),
    ...(suggestion.urgency ? { urgency: suggestion.urgency } : {}),
    ...(suggestion.importance ? { importance: suggestion.importance } : {}),
  })

  const getRandomColor = () => {
    const colors = ["#3B82F6", "#EF4444", "#10B981", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899", "#6366F1"]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tasksText.trim()) return

    const parsedTasks = parseTasksWithCategories(tasksText)

    Object.entries(parsedTasks).forEach(([categoryName, taskDescriptions]) => {
      let category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())

      if (!category) {
        const newCategory: List = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          name: categoryName,
          color: getRandomColor(),
          description: `Auto-created category for ${categoryName}`,
          createdAt: new Date(),
        }
        addList(newCategory)
        category = newCategory
      }

      taskDescriptions.forEach((line) => {
        const { suggestion } = parseSmartCapture(line)
        const description = suggestion.description || line
        const baseTask = withCategoryDefaults(createListItem(description, [category!.id]), category)
        addTask(applySuggestion(baseTask, suggestion))
      })
    })

    setTasksText("")
    setOpen(false)
  }

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
            Add multiple tasks at once. Use list names followed by &apos;:&apos; to organize tasks.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <Label htmlFor="tasks">Tasks and Lists</Label>
            <Textarea
              id="tasks"
              placeholder={"Writing:\nDraft chapter 1\nEdit outline\n\nGroceries:\nMilk\nBread"}
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              className="flex-1 resize-none font-mono text-sm"
              autoFocus
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Lines ending with &apos;:&apos; create lists. Items go directly into those lists.</p>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {tasksText.split("\n").filter((line) => line.trim() && !line.trim().endsWith(":")).length} tasks ready
            </div>
            <Button type="submit" disabled={!tasksText.trim()}>
              Add Tasks
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
