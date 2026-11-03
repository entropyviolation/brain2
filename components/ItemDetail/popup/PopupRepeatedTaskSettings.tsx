/**
 * components/ItemDetail/popup/PopupRepeatedTaskSettings.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Repeated Task Settings block. Used only by the popup Details column.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ItemTypeCapabilities, Task } from "@/lib/types"
import { Zap } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function PopupRepeatedTaskSettings({
  task,
  setTask,
  caps,
}: {
  task: Task
  setTask: Dispatch<SetStateAction<Task | null>>
  caps: ItemTypeCapabilities
}) {
  return (
    <>
                      {caps.scheduleable && (
                      <>
                      {/* Repeated Task Settings */}
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Repeated Task Settings
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="is-repeated"
                              checked={task.isRepeated || false}
                              onCheckedChange={(checked) => setTask({ ...task, isRepeated: !!checked })}
                            />
                            <Label htmlFor="is-repeated" className="text-sm font-medium">
                              This is a repeated task
                            </Label>
                          </div>

                          {task.isRepeated && (
                            <div className="space-y-4 ml-6 p-4 bg-background/50 rounded-lg border">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Repeat Type</Label>
                                <Select
                                  value={task.repeatSettings?.type || "count"}
                                  onValueChange={(value: "count" | "frequency") =>
                                    setTask({
                                      ...task,
                                      repeatSettings: { ...task.repeatSettings, type: value },
                                    })
                                  }
                                >
                                  <SelectTrigger className="focus-ring">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="count">Must be completed X times total</SelectItem>
                                    <SelectItem value="frequency">Must be completed X times per period</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {task.repeatSettings?.type === "count" && (
                                <div className="space-y-2">
                                  <Label htmlFor="total-count" className="text-sm font-medium">
                                    Total times to complete
                                  </Label>
                                  <Input
                                    id="total-count"
                                    type="number"
                                    min="1"
                                    value={task.repeatSettings?.totalCount || 1}
                                    onChange={(e) =>
                                      setTask({
                                        ...task,
                                        repeatSettings: {
                                          ...task.repeatSettings,
                                          type: "count",
                                          totalCount: Number.parseInt(e.target.value) || 1,
                                        },
                                      })
                                    }
                                    className="focus-ring"
                                  />
                                </div>
                              )}

                              {task.repeatSettings?.type === "frequency" && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="frequency-times" className="text-sm font-medium">
                                      Times per period
                                    </Label>
                                    <Input
                                      id="frequency-times"
                                      type="number"
                                      min="1"
                                      value={task.repeatSettings?.frequency?.times || 1}
                                      onChange={(e) =>
                                        setTask({
                                          ...task,
                                          repeatSettings: {
                                            ...task.repeatSettings,
                                            type: "frequency",
                                            frequency: {
                                              ...task.repeatSettings?.frequency,
                                              times: Number.parseInt(e.target.value) || 1,
                                              period: task.repeatSettings?.frequency?.period || "week",
                                            },
                                          },
                                        })
                                      }
                                      className="focus-ring"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="frequency-period" className="text-sm font-medium">
                                      Period
                                    </Label>
                                    <Select
                                      value={task.repeatSettings?.frequency?.period || "week"}
                                      onValueChange={(value: "day" | "week" | "month") =>
                                        setTask({
                                          ...task,
                                          repeatSettings: {
                                            ...task.repeatSettings,
                                            type: "frequency",
                                            frequency: {
                                              ...task.repeatSettings?.frequency,
                                              times: task.repeatSettings?.frequency?.times || 1,
                                              period: value,
                                            },
                                          },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="focus-ring">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="day">Day</SelectItem>
                                        <SelectItem value="week">Week</SelectItem>
                                        <SelectItem value="month">Month</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      </>
                      )}
    </>
  )
}
