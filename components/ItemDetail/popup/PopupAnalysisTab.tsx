/**
 * components/ItemDetail/popup/PopupAnalysisTab.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Analysis tab: why, and what happens if you do not do it.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Task } from "@/lib/types"
import { Brain } from "lucide-react"
import { IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"

export function PopupAnalysisTab({
  task,
  touchDraft,
  setTask,
}: {
  task: Task
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
}) {
  return (
                <TabsContent value="analysis" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Task Analysis
                      </h3>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="why" className="text-sm font-semibold">
                            Why do you need to do this task?
                          </Label>
                          <IsolatedTextarea
                            id="why"
                            value={task.why || ""}
                            onLiveChange={(why) => touchDraft({ why })}
                            onCommit={(why) => setTask((prev) => (prev ? { ...prev, why } : prev))}
                            placeholder="Explain the purpose and motivation behind this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="consequences" className="text-sm font-semibold">
                            What happens if you don't do it?
                          </Label>
                          <IsolatedTextarea
                            id="consequences"
                            value={task.consequences || ""}
                            onLiveChange={(consequences) => touchDraft({ consequences })}
                            onCommit={(consequences) => setTask((prev) => (prev ? { ...prev, consequences } : prev))}
                            placeholder="Describe the potential consequences of not completing this task..."
                            rows={3}
                            className="focus-ring"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
  )
}
