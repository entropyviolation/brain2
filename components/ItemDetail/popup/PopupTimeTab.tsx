/**
 * components/ItemDetail/popup/PopupTimeTab.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Time tab. An empty estimate clears (undefined). Actual duration stays read-only. Pens stay a child.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Task } from "@/lib/types"
import { Timer } from "lucide-react"
import { ItemPenTimeSection } from "@/components/ItemDetail/tabs/time/ItemPenTime"
import { Input } from "@/components/ui/input"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"

export function PopupTimeTab({
  task,
  touchDraft,
  setTask,
  isTask,
  patchItem,
}: {
  task: Task
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  isTask: boolean
  patchItem: (patch: Partial<Task>) => void
}) {
  return (
                <TabsContent value="time" className="space-y-6 mt-0">
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Estimated vs actual time
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Estimated (plan)</Label>
                        <IsolatedInput
                          type="number"
                          value={String(task.estimatedDuration ?? "")}
                          onLiveChange={(v) =>
                            touchDraft({ estimatedDuration: Number.parseInt(v) || undefined })
                          }
                          onCommit={(v) =>
                            setTask((prev) =>
                              prev ? { ...prev, estimatedDuration: Number.parseInt(v) || undefined } : prev,
                            )
                          }
                          placeholder="minutes"
                        />
                      </div>
                      <div>
                        <Label>Actual (logged total)</Label>
                        <Input type="number" value={task.actualDuration ?? ""} readOnly className="bg-muted" />
                      </div>
                    </div>
                  </div>
                  <div className="id-bay">
                    <ItemPenTimeSection
                      task={task}
                      editableTime={isTask}
                      onPatch={patchItem}
                      onPenLinksChange={(penLinks) => {
                        touchDraft({ penLinks })
                        setTask((prev) => (prev ? { ...prev, penLinks } : prev))
                      }}
                    />
                  </div>
                </TabsContent>
  )
}
