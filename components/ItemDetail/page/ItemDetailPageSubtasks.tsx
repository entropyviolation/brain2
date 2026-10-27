// Page-only subtasks tab for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useCallback } from "react"
import { SubtaskTree } from "@/components/ItemDetail/SubtaskTree"
import { SplitStepsComposer } from "@/components/ItemDetail/page/SplitStepsComposer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { openStepItem } from "@/lib/step-item-stack"
import {
  addStepsAsSubtasks,
  parseSteps,
  setSubtaskContext,
  toggleMolecular,
  toggleSubtaskComplete,
  removeSubtask as removeMolecularStep,
} from "@/lib/molecular"
import type { Subtask, Task } from "@/lib/types"
import { Sparkles, Split, Trash, Users } from "lucide-react"

export function ItemDetailPageSubtasks({
  task,
  effectiveId,
  allTasks,
  setTask,
  updateTask,
  deleteTask,
}: {
  task: Task
  effectiveId: string
  allTasks: Task[]
  setTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
}) {
  // ---- Molecular steps (operate on the Task.subtasks tree directly) --------
  const persistSubtasks = useCallback(
    (subtasks: Subtask[]) => {
      if (!task) return
      const updated = { ...task, subtasks }
      setTask(updated)
      updateTask(updated)
    },
    [task, setTask, updateTask],
  )

  // Older subtasks were also saved as their own Tasks; drop those with the step.
  const removeBackingSubtasks = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        if (allTasks.some((t) => t.id === id && t.parentTaskId === effectiveId)) deleteTask(id)
      }
    },
    [allTasks, effectiveId, deleteTask],
  )

  const splitIntoSteps = useCallback((text: string) => {
    if (!task) return
    const steps = parseSteps(text)
    if (steps.length === 0) return
    persistSubtasks(addStepsAsSubtasks(task.subtasks, steps))
  }, [task, persistSubtasks])

  const handleToggleStepComplete = useCallback(
    (id: string) => {
      if (task) persistSubtasks(toggleSubtaskComplete(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  const handleToggleStepMolecular = useCallback(
    (id: string) => {
      if (task) persistSubtasks(toggleMolecular(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  const handleStepContextChange = useCallback(
    (id: string, context: string) => {
      if (task) persistSubtasks(setSubtaskContext(task.subtasks ?? [], id, context))
    },
    [task, persistSubtasks],
  )

  const handleDeleteStep = useCallback(
    (id: string) => {
      if (task) persistSubtasks(removeMolecularStep(task.subtasks ?? [], id))
    },
    [task, persistSubtasks],
  )

  return (
    <TabsContent value="subtasks" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Subtasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use + on any step to break it down again. Minutes on a step count as its own estimate or the sum of the
            steps inside, whichever is larger.
          </p>
          <SubtaskTree steps={task.subtasks} onChange={persistSubtasks} onRemoved={removeBackingSubtasks} onOpenStep={allTasks.some((t) => t.id === task.id) ? (step) => openStepItem(task.id, step.id) : undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Molecular Breakdown
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Split this task into as many separate steps as you can. If a step can&apos;t be split further, mark it{" "}
            <span className="font-medium">MOLECULAR</span>. Give each step enough context to understand it on its
            own — that&apos;s what &quot;Just Start&quot; focuses on.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="split-steps">Split into steps (one per line)</Label>
            <SplitStepsComposer onSplit={splitIntoSteps} />
          </div>

          <div className="space-y-3">
            <Label>Steps</Label>
            {(task.subtasks ?? []).length > 0 ? (
              <div className="space-y-3">
                {(task.subtasks ?? []).map((step) => (
                  <div key={step.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={step.completed}
                        onCheckedChange={() => handleToggleStepComplete(step.id)}
                        className="mt-1"
                      />
                      <span
                        className={`flex-1 text-sm ${step.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {step.description}
                      </span>
                      <Button
                        variant={step.isMolecular ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleToggleStepMolecular(step.id)}
                        title="Atomic step that can't be split further"
                      >
                        <Sparkles className="h-3 w-3" />
                        {step.isMolecular ? "MOLECULAR" : "Atomic?"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteStep(step.id)}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    </div>
                    <IsolatedInput
                      placeholder="Context — what you need to know to do this step on its own…"
                      value={step.context ?? ""}
                      onCommit={(context) => handleStepContextChange(step.id, context)}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No steps yet — split the task above to begin.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
