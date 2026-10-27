/**
 * components/ItemDetail/popup/PopupSchedulingTab.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Scheduling tab. Popup markup on purpose. A date, week, month, or year still clears the other placements. Move to Weekly still writes immediately.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Task } from "@/lib/types"
import { ArrowRight, Calendar, Settings, Target } from "lucide-react"
import { ItemScheduleFlags } from "@/components/ItemDetail/ItemScheduleFlags"
import { SchedulingSummary } from "@/components/ItemDetail/SchedulingSummary"
import { TodoCommitmentFields } from "@/components/ItemDetail/TodoCommitmentFields"
import { Button } from "@/components/ui/button"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Input } from "@/components/ui/input"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { dateInputValue, parseLocalDate } from "@/lib/date-utils"

export function PopupSchedulingTab({
  task,
  scheduleableCategoryIds,
  setTask,
  touchDraft,
  handleMoveToWeeklyTodo,
  handleScheduleToWeek,
}: {
  task: Task
  scheduleableCategoryIds: Set<string>
  setTask: Dispatch<SetStateAction<Task | null>>
  touchDraft: (patch: Partial<Task>) => void
  handleMoveToWeeklyTodo: () => void
  handleScheduleToWeek: (date: Date) => void
}) {
  return (
                <TabsContent value="scheduling" className="space-y-6 mt-0">
                  <div className="id-sched">
                    <SchedulingSummary task={task} scheduleableCategoryIds={scheduleableCategoryIds} />
                    <section className="id-sched-sec" aria-label="Where it shows up">
                      <header className="id-sched-sechead"><span className="id-sched-num">01</span><h2>Where it shows up</h2><p>Which lists read this item: the Scheduler, and the To Do periods.</p></header>
                    <ItemScheduleFlags
                      task={task}
                      scheduleableCategoryIds={scheduleableCategoryIds}
                      onChange={setTask}
                    />
                    <TodoCommitmentFields task={task} onChange={setTask} />
                    {task.scheduledDate && !task.scheduledWeek && (
                      <div className="id-sched-callout">
                        <div>
                          <p className="font-semibold text-sm">On daily to-do list</p>
                          <p className="text-xs text-muted-foreground">
                            Move this task to the weekly to-do list instead of today.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleMoveToWeeklyTodo}>
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Move to Weekly
                        </Button>
                      </div>
                    )}
                    </section>
                    <section className="id-sched-sec" aria-label="When">
                      <header className="id-sched-sechead"><span className="id-sched-num">02</span><h2>When</h2><p>Pick one placement. Setting a date clears the looser ones.</p></header>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">
                            <Calendar className="h-4 w-4" />
                            Specific Date & Time
                          </h3>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="scheduled-date" className="text-sm font-medium">
                                Scheduled Date
                              </Label>
                              <Input
                                id="scheduled-date"
                                type="date"
                                value={dateInputValue(task.scheduledDate)}
                                onChange={(e) => {
                                  const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
                                  setTask({
                                    ...task,
                                    scheduledDate: date,
                                    scheduledWeek: undefined,
                                    scheduledMonth: undefined,
                                    scheduledYear: undefined,
                                  })
                                }}
                                className="focus-ring"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-time" className="text-sm font-medium">
                                Scheduled Time
                              </Label>
                              <ClockPicker
                                id="scheduled-time"
                                value={task.scheduledTime || ""}
                                onChange={(scheduledTime) => {
                                  touchDraft({ scheduledTime })
                                  setTask((prev) => (prev ? { ...prev, scheduledTime } : prev))
                                }}
                                className="focus-ring"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">Flexible Scheduling</h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="scheduled-week" className="text-sm font-medium">
                                Scheduled Week
                              </Label>
                              <Input
                                id="scheduled-week"
                                type="date"
                                onChange={(e) => {
                                  const date = e.target.value ? parseLocalDate(e.target.value) : null
                                  if (date) handleScheduleToWeek(date)
                                }}
                                placeholder="Select any day in the week"
                                className="focus-ring"
                              />
                              {task.scheduledWeek && (
                                <p className="text-xs text-muted-foreground">Currently: {task.scheduledWeek}</p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-month" className="text-sm font-medium">
                                Scheduled Month
                              </Label>
                              <Input
                                id="scheduled-month"
                                type="month"
                                value={task.scheduledMonth || ""}
                                onChange={(e) =>
                                  setTask({
                                    ...task,
                                    scheduledMonth: e.target.value,
                                    scheduledWeek: undefined,
                                    scheduledDate: undefined,
                                    scheduledYear: undefined,
                                  })
                                }
                                className="focus-ring"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="scheduled-year" className="text-sm font-medium">
                                Scheduled Year
                              </Label>
                              <IsolatedInput
                                id="scheduled-year"
                                type="number"
                                min="2024"
                                max="2030"
                                value={task.scheduledYear || ""}
                                onLiveChange={(scheduledYear) =>
                                  touchDraft({
                                    scheduledYear,
                                    scheduledMonth: undefined,
                                    scheduledWeek: undefined,
                                    scheduledDate: undefined,
                                  })
                                }
                                onCommit={(scheduledYear) =>
                                  setTask((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          scheduledYear,
                                          scheduledMonth: undefined,
                                          scheduledWeek: undefined,
                                          scheduledDate: undefined,
                                        }
                                      : prev,
                                  )
                                }
                                className="focus-ring"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </section>
                    <section className="id-sched-sec" aria-label="Deadline and limits">
                      <header className="id-sched-sechead"><span className="id-sched-num">03</span><h2>Deadline and limits</h2><p>What it must beat, and the windows it must stay inside.</p></header>

                        <div className="id-sched-card">
                          <h3 className="id-sched-card-title">
                            <Target className="h-4 w-4" />
                            Deadline
                          </h3>
                          <div className="space-y-2">
                            <Label htmlFor="deadline" className="text-sm font-medium">
                              Deadline Date
                            </Label>
                            <Input
                              id="deadline"
                              type="date"
                              value={dateInputValue(task.deadline)}
                              onChange={(e) => {
                                const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
                                setTask({ ...task, deadline: date })
                              }}
                              className="focus-ring"
                            />
                          </div>
                        </div>
                    <div className="id-sched-card">
                      <h3 className="id-sched-card-title">
                        <Settings className="h-4 w-4" />
                        Scheduling Constraints
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="must-be-done-after" className="text-sm font-medium">
                            Must be done after
                          </Label>
                          <Input
                            id="must-be-done-after"
                            type="date"
                            value={dateInputValue(task.schedulingConstraints?.mustBeDoneAfter)}
                            onChange={(e) => {
                              const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
                              setTask({
                                ...task,
                                schedulingConstraints: {
                                  ...task.schedulingConstraints,
                                  mustBeDoneAfter: date,
                                },
                              })
                            }}
                            className="focus-ring"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="must-be-done-before" className="text-sm font-medium">
                            Must be done before
                          </Label>
                          <Input
                            id="must-be-done-before"
                            type="date"
                            value={dateInputValue(task.schedulingConstraints?.mustBeDoneBefore)}
                            onChange={(e) => {
                              const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
                              setTask({
                                ...task,
                                schedulingConstraints: {
                                  ...task.schedulingConstraints,
                                  mustBeDoneBefore: date,
                                },
                              })
                            }}
                            className="focus-ring"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="time-preference" className="text-sm font-medium">
                          Time of day preference
                        </Label>
                        <Select
                          value={task.schedulingConstraints?.timeOfDayPreference || "none"}
                          onValueChange={(value: "morning" | "afternoon" | "evening" | "night" | "none") =>
                            setTask({
                              ...task,
                              schedulingConstraints: {
                                ...task.schedulingConstraints,
                                timeOfDayPreference: value === "none" ? undefined : value,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="focus-ring">
                            <SelectValue placeholder="No preference" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No preference</SelectItem>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="day-constraints" className="text-sm font-medium">
                          Day constraints
                        </Label>
                        <IsolatedTextarea
                          id="day-constraints"
                          value={task.schedulingConstraints?.dayConstraints || ""}
                          onLiveChange={(dayConstraints) =>
                            touchDraft({
                              schedulingConstraints: { ...task.schedulingConstraints, dayConstraints },
                            })
                          }
                          onCommit={(dayConstraints) =>
                            setTask((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    schedulingConstraints: { ...prev.schedulingConstraints, dayConstraints },
                                  }
                                : prev,
                            )
                          }
                          placeholder="e.g., Only on weekdays, Not on Mondays, etc."
                          rows={2}
                          className="focus-ring"
                        />
                      </div>
                    </div>
                    </section>
                  </div>
                </TabsContent>
  )
}
