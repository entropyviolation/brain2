// Page-only analysis tab for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.

import type { Dispatch, SetStateAction } from "react"
import { IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import type { Task } from "@/lib/types"

export function ItemDetailPageAnalysis({
  task,
  isEditing,
  touchDraft,
  setTask,
}: {
  task: Task
  isEditing: boolean
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
}) {
  return (
    <TabsContent value="analysis" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Task Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="why">Why do you need to do this task?</Label>
            {isEditing ? (
              <IsolatedTextarea
                id="why"
                value={task.why || ""}
                onLiveChange={(why) => touchDraft({ why })}
                onCommit={(why) => setTask((prev) => (prev ? { ...prev, why } : prev))}
                placeholder="Explain the purpose and motivation behind this task..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{task.why || "No reason specified"}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="consequences">What happens if you don't do it?</Label>
            {isEditing ? (
              <IsolatedTextarea
                id="consequences"
                value={task.consequences || ""}
                onLiveChange={(consequences) => touchDraft({ consequences })}
                onCommit={(consequences) =>
                  setTask((prev) => (prev ? { ...prev, consequences } : prev))
                }
                placeholder="Describe the potential consequences of not completing this task..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{task.consequences || "No consequences specified"}</p>
            )}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Task Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Entropy:</span>
                <span className="font-medium">{(task.entropy ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Reward Value:</span>
                <span className="font-medium">{task.pointsOverride == null ? "—" : task.pointsOverride}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cognitive Load:</span>
                <span className="font-medium">{task.cognitiveLoad}/3</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Estimated Duration:</span>
                <span className="font-medium">{task.estimatedDuration} minutes</span>
              </div>
              {task.actualDuration && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Actual Duration:</span>
                  <span className="font-medium">{task.actualDuration} minutes</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}
