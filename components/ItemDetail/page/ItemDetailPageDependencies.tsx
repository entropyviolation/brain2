// Page-only dependencies tab for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import { ItemPicker } from "@/components/Lists/item-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import type { AddDependencyResult } from "@/components/ItemDetail/useItemDetailDraft"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { Task } from "@/lib/types"
import { GitBranch, Trash } from "lucide-react"

export function ItemDetailPageDependencies({
  task,
  isEditing,
  allTasks,
  effectiveId,
  addDependency,
  removeDependency,
  setCycleLabel,
}: {
  task: Task
  isEditing: boolean
  allTasks: Task[]
  effectiveId: string
  addDependency: (dependencyId: string) => AddDependencyResult
  removeDependency: (dependencyId: string) => void
  setCycleLabel: Dispatch<SetStateAction<string | null>>
}) {
  const syncDependencies = useCallback(
    (ids: string[]) => {
      if (!task) return
      const prev = task.dependencies ?? []
      const added = ids.find((id) => !prev.includes(id))
      const removed = prev.filter((id) => !ids.includes(id))
      if (added && removed.length === 0) {
        const result = addDependency(added)
        if (!result.ok) setCycleLabel(result.cycleLabel)
        return
      }
      for (const id of removed) removeDependency(id)
    },
    [task, addDependency, removeDependency, setCycleLabel],
  )

  return (
    <TabsContent value="dependencies" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Task Dependencies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Dependencies</Label>
            {(task.dependencies ?? []).length > 0 ? (
              <div className="space-y-2">
                {(task.dependencies ?? []).map((depId) => {
                  const depTask = allTasks.find((t) => t.id === depId)
                  return (
                    <div key={depId} className="flex justify-between items-center p-2 border rounded-md">
                      <span className="text-sm">{depTask?.description || "Unknown Task"}</span>
                      {isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeDependency(depId)}
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No dependencies</p>
            )}
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>Add dependency</Label>
              <ItemPicker
                mode="multi"
                searchLabel="Add dependency"
                choices={allTasks
                  .filter(
                    (t) =>
                      t.id !== effectiveId &&
                      ((task.dependencies ?? []).includes(t.id) || (!t.completed && t.parentTaskId !== effectiveId)),
                  )
                  .map((t) => ({ id: t.id, title: itemTitleOrUntitled(t), icon: t.icon }))}
                selected={task.dependencies ?? []}
                onChange={syncDependencies}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
