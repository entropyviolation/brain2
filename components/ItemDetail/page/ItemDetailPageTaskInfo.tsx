// Page-only Task Information card for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.

import type { Dispatch, SetStateAction } from "react"
import { ItemEstimateField } from "@/components/ItemDetail/ItemEstimateField"
import { ItemRewardField } from "@/components/ItemDetail/ItemRewardField"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Task } from "@/lib/types"
import { AlertTriangle, Star } from "lucide-react"

export function ItemDetailPageTaskInfo({
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
    <Card>
      <CardHeader>
        <CardTitle>Task Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <ItemEstimateField
            estimatedDuration={task.estimatedDuration}
            touchDraft={touchDraft}
            setTask={setTask}
            variant="page"
            isEditing={isEditing}
          />

          <ItemRewardField
            task={task}
            touchDraft={touchDraft}
            setTask={setTask}
            variant="page"
            isEditing={isEditing}
          />

          <div className="space-y-2">
            <Label htmlFor="urgency">Urgency</Label>
            {isEditing ? (
              <Select
                value={(task.urgency ?? 3).toString()}
                onValueChange={(value) => setTask({ ...task, urgency: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Low</SelectItem>
                  <SelectItem value="2">2 - Medium-Low</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Critical</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span>{task.urgency ?? 3}/5</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="importance">Importance</Label>
            {isEditing ? (
              <Select
                value={(task.importance ?? 3).toString()}
                onValueChange={(value) => setTask({ ...task, importance: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Low</SelectItem>
                  <SelectItem value="2">2 - Medium-Low</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - High</SelectItem>
                  <SelectItem value="5">5 - Critical</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span>{task.importance ?? 3}/5</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Context</Label>
            {isEditing ? (
              <IsolatedInput
                id="context"
                value={task.context || ""}
                onLiveChange={(context) => touchDraft({ context })}
                onCommit={(context) => setTask((prev) => (prev ? { ...prev, context } : prev))}
              />
            ) : (
              <Badge variant="outline">{task.context}</Badge>
            )}
          </div>
        </div>

        {/* Partial Completion Settings */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-medium">Partial Completion Settings</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-partial"
                checked={task.allowPartialCompletion}
                onCheckedChange={(checked) =>
                  isEditing && setTask({ ...task, allowPartialCompletion: !!checked })
                }
                disabled={!isEditing}
              />
              <Label htmlFor="allow-partial">Allow partial completion</Label>
            </div>

            {task.allowPartialCompletion && (
              <div className="space-y-2">
                <Label htmlFor="chunk-size">Minimum chunk size (minutes)</Label>
                {isEditing ? (
                  <IsolatedInput
                    id="chunk-size"
                    type="number"
                    min="5"
                    value={String(task.minimumChunkSize ?? "")}
                    onLiveChange={(v) =>
                      touchDraft({ minimumChunkSize: Number.parseInt(v) || 15 })
                    }
                    onCommit={(v) =>
                      setTask((prev) =>
                        prev ? { ...prev, minimumChunkSize: Number.parseInt(v) || 15 } : prev,
                      )
                    }
                  />
                ) : (
                  <span className="text-sm">{task.minimumChunkSize} minutes</span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
