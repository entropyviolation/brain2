/**
 * components/Home/Habits/daily-task-form-dialog.tsx — Win95 Add/Edit Habit window
 */
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TaskForm } from "@/components/Home/Habits/daily-task-form"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import type { WeeklyTask, HabitFrequency } from "@/lib/types"
import { useWindowSandClose, WindowSandClose } from "@/components/ui/window-sand-close"
import "./habit-form-dialog.css"

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (task: WeeklyTask) => void
  onDelete?: (taskId: string) => void
  initialTask: WeeklyTask | null
  defaultFrequency?: HabitFrequency
}

export function TaskFormDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  initialTask,
  defaultFrequency = "daily",
}: TaskFormDialogProps) {
  const title = initialTask ? "Edit Habit" : "Add New Habit"
  const [dirty, setDirty] = useState(false)
  const sand = useWindowSandClose({ open, onOpenChange })

  const guard = useUnsavedGuard({
    open,
    onOpenChange: (next) => {
      if (next) {
        onOpenChange(true)
        return
      }
      // Only reached on a clean close or after discard/save — never while the
      // unsaved prompt is waiting on the user.
      sand.start()
    },
    isDirty: dirty && !sand.active,
    onSave: () => {
      const form = document.getElementById("habit95-form") as HTMLFormElement | null
      form?.requestSubmit()
    },
  })

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        ref={sand.panelRef}
        className={`habit95-dialog ${sand.hostClass} flex flex-col sm:max-w-[480px]${sand.sourceClass ? ` ${sand.sourceClass}` : ""}`}
        hideClose
        data-ui-name="Habit form"
        data-ui-docs="components/Home/Habits/README.md"
        data-dusting={sand.active ? "true" : undefined}
        {...unsavedDismissProps(guard.requestClose)}
      >
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{title}</DialogTitle>
          <button
            ref={sand.originRef}
            type="button"
            className="habit95-title-btn"
            aria-label="Close"
            onClick={guard.requestClose}
          >
            ×
          </button>
        </DialogHeader>
        <div className="habit95-body">
          <TaskForm
            key={initialTask?.id ?? "new-habit"}
            onSubmit={(task) => {
              onSubmit(task)
            }}
            onCancel={guard.requestClose}
            onDelete={onDelete}
            initialTask={initialTask}
            defaultFrequency={defaultFrequency}
            onDirtyChange={setDirty}
          />
        </div>
      </DialogContent>
    </Dialog>
    {sand.active && sand.geom ? (
      <WindowSandClose geom={sand.geom} capture={sand.capture} onDone={sand.finish} />
    ) : null}
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
