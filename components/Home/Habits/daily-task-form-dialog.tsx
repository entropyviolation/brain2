/**
 * components/Home/Habits/daily-task-form-dialog.tsx — Win95 Add/Edit Habit window
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TaskForm } from "@/components/Home/Habits/daily-task-form"
import type { WeeklyTask, HabitFrequency } from "@/lib/types"
import "./habit-form-dialog.css"

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (task: WeeklyTask) => void
  initialTask: WeeklyTask | null
  defaultFrequency?: HabitFrequency
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialTask,
  defaultFrequency = "daily",
}: TaskFormDialogProps) {
  const title = initialTask ? "Edit Habit" : "Add New Habit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="habit95-dialog flex flex-col sm:max-w-[480px]">
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{title}</DialogTitle>
          <button
            type="button"
            className="habit95-title-btn"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </DialogHeader>
        <div className="habit95-body">
          <TaskForm
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            initialTask={initialTask}
            defaultFrequency={defaultFrequency}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
