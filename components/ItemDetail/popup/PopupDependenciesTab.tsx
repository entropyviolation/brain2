/**
 * components/ItemDetail/popup/PopupDependenciesTab.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Dependencies tab. Adding a loop still only opens the cycle dialog.
 */
"use client"

import type { Task } from "@/lib/types"
import { Trash2, Users } from "lucide-react"
import { ItemPicker } from "@/components/Lists/item-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabsContent } from "@/components/ui/tabs"
import { itemTitleOrUntitled } from "@/lib/item-utils"

export function PopupDependenciesTab({
  task,
  allTasks,
  syncDependencies,
  removeDependency,
}: {
  task: Task
  allTasks: Task[]
  syncDependencies: (ids: string[]) => void
  removeDependency: (dependencyId: string) => void
}) {
  return (
                <TabsContent value="dependencies" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Task Dependencies
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Tasks that must be completed before this task can be started.
                      </p>

                      <ItemPicker
                        mode="multi"
                        searchLabel="Add dependency"
                        choices={allTasks
                          .filter((t) => t.id !== task.id)
                          .map((t) => ({ id: t.id, title: itemTitleOrUntitled(t), icon: t.icon }))}
                        selected={task.dependencies ?? []}
                        onChange={syncDependencies}
                      />

                      <div className="space-y-2">
                        {(task.dependencies ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No dependencies set</p>
                        ) : (
                          (task.dependencies ?? []).map((depId) => {
                            const depTask = allTasks.find((t) => t.id === depId)
                            if (!depTask) return null

                            return (
                              <div
                                key={depId}
                                className="flex items-center justify-between p-3 bg-background/50 rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-2 h-2 rounded-full ${depTask.completed ? "bg-green-500" : "bg-yellow-500"}`}
                                  />
                                  <span className="text-sm font-medium">{depTask.description}</span>
                                  <Badge variant={depTask.completed ? "default" : "secondary"} className="text-xs">
                                    {depTask.completed ? "Completed" : "Pending"}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDependency(depId)}
                                  className="h-6 w-6 focus-ring"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
  )
}
