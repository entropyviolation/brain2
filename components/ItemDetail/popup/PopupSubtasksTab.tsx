/**
 * components/ItemDetail/popup/PopupSubtasksTab.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Subtasks tab. A step item shows the steps inside that step. Anything else uses SubtaskTree.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Task } from "@/lib/types"
import { CheckCircle } from "lucide-react"
import { StepItemSubtasks, SubtaskTree } from "@/components/ItemDetail/tabs/subtasks/SubtaskTree"
import { openStepItem } from "@/lib/step-item-stack"
import { TabsContent } from "@/components/ui/tabs"

export function PopupSubtasksTab({
  task,
  setTask,
  allTasks,
}: {
  task: Task
  setTask: Dispatch<SetStateAction<Task | null>>
  allTasks: Task[]
}) {
  return (
                <TabsContent value="subtasks" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Subtasks
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Break this into steps, and use + on any step to break it down again. Minutes on a step count as its own estimate or the sum of the steps inside, whichever is larger.
                      </p>

                      {task.stepOf ? (
                        <StepItemSubtasks stepOf={task.stepOf} />
                      ) : (
                        <SubtaskTree
                          steps={task.subtasks}
                          onChange={(subtasks) => setTask({ ...task, subtasks })}
                          onOpenStep={
                            allTasks.some((t) => t.id === task.id) ? (step) => openStepItem(task.id, step.id) : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>
  )
}
