/**
 * components/inbox.tsx — Inbox & clarification
 *
 * Lists unclarified captures and hosts the per-item Clarification dialog where a
 * raw thought is turned into a fully-specified task (description, duration,
 * reward, urgency/importance, categories), plus a "Clarify All" helper. Clarified
 * items leave the Inbox and live in their assigned categories/lists.
 *
 * Spec: §4.4 (Clarification), §4.5 (Inbox as a living list).
 */
"use client"

import { useState, useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash, ArrowRight, InboxIcon, Clock, Award, AlertTriangle, Star, Save, X, ChevronDown, CalendarDays, Timer, Tag, Flag } from "lucide-react"
import { format } from "date-fns"
import { safeToDate } from "@/lib/date-utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Task, AttributeDefinition, AttributeValue } from "@/lib/types"
import { listIsNextActions, withCategoryDefaults } from "@/lib/item-utils"
import { ListPicker } from "@/components/Lists/list-picker"
import { AdHocAttributesEditor, mergeListAttributes, AttributeValuesEditor } from "@/components/Lists/attribute-editor"

interface InboxProps {
  onTaskSelect: (taskId: string) => void
}

function asDate(value: Date | string | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatTaskDate(value: Date | string | undefined): string {
  const d = asDate(value)
  return d ? d.toLocaleDateString() : "—"
}

function formatTaskDateTime(value: Date | string | undefined): string {
  const d = asDate(value)
  return d ? d.toLocaleString() : "—"
}

/**
 * Chips for the fields smart-parse pulled out of a captured idea (date/time/
 * duration/priority/list), so the parse is visible during clarification.
 */
function CaptureChips({ task }: { task: Task }) {
  const categories = useTaskStore((state) => state.lists)
  const chips: { key: string; icon: React.ReactNode; label: string }[] = []

  const categoryName =
    task.lists
      ?.map((cid) => categories.find((c) => c.id === cid)?.name)
      .find(Boolean) || task.tags?.[0]
  if (categoryName) chips.push({ key: "cat", icon: <Tag className="h-3 w-3" />, label: categoryName })

  const scheduled = safeToDate(task.scheduledDate)
  if (scheduled) chips.push({ key: "date", icon: <CalendarDays className="h-3 w-3" />, label: format(scheduled, "EEE MMM d") })
  if (task.scheduledTime) chips.push({ key: "time", icon: <Clock className="h-3 w-3" />, label: task.scheduledTime })
  if (task.estimatedDuration && task.estimatedDuration > 1)
    chips.push({ key: "dur", icon: <Timer className="h-3 w-3" />, label: `${task.estimatedDuration}m` })
  if (task.urgency && task.urgency >= 4)
    chips.push({ key: "urg", icon: <Flag className="h-3 w-3" />, label: `urgency ${task.urgency}` })
  if (task.importance && task.importance >= 4)
    chips.push({ key: "imp", icon: <Flag className="h-3 w-3" />, label: `importance ${task.importance}` })

  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c) => (
        <Badge key={c.key} variant="secondary" className="flex items-center gap-1 font-normal text-xs">
          {c.icon}
          {c.label}
        </Badge>
      ))}
    </div>
  )
}

// Clarification Dialog Component
function TaskClarificationDialog({
  task,
  open,
  onClose,
  onSave,
}: {
  task: Task
  open: boolean
  onClose: () => void
  onSave: (updatedTask: Task) => void
}) {
  const categories = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const [taskDescription, setTaskDescription] = useState(task.taskDescription || "")
  const [estimatedDuration, setEstimatedDuration] = useState(task.estimatedDuration?.toString() || "30")
  const [rewardValue, setRewardValue] = useState(task.rewardValue?.toString() || "1")
  const [urgency, setUrgency] = useState(task.urgency?.toString() || "3")
  const [importance, setImportance] = useState(task.importance?.toString() || "3")
  const [selectedCategories, setSelectedCategories] = useState<string[]>(task.lists || [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [adhocDefs, setAdhocDefs] = useState<AttributeDefinition[]>([])
  const [attributeValues, setAttributeValues] = useState<Record<string, AttributeValue>>(task.attributes || {})

  const listAttributeDefs = useMemo(
    () => mergeListAttributes(categories, selectedCategories),
    [categories, selectedCategories],
  )

  const isNextActionTarget = selectedCategories.some((cid) => listIsNextActions(cid, folders))

  const handleSave = () => {
    let updatedTask: Task = {
      ...task,
      createdAt: asDate(task.createdAt) ?? new Date(),
      taskDescription,
      lists: selectedCategories,
      stage: selectedCategories.length ? "clarified" : "list",
      attributes: { ...attributeValues },
    }
    selectedCategories.forEach((cid) => {
      const cat = categories.find((c) => c.id === cid)
      updatedTask = withCategoryDefaults(updatedTask, cat)
    })
    if (isNextActionTarget) {
      updatedTask.estimatedDuration = Number.parseInt(estimatedDuration) || 30
      updatedTask.rewardValue = Number.parseInt(rewardValue) || 1
      updatedTask.urgency = Number.parseInt(urgency) || 3
      updatedTask.importance = Number.parseInt(importance) || 3
      updatedTask.cognitiveLoad = task.cognitiveLoad || 2
      updatedTask.entropy = task.entropy || 0.5
      updatedTask.context = task.context || "@general"
      updatedTask.dependencies = task.dependencies || []
      updatedTask.allowPartialCompletion = task.allowPartialCompletion || false
      updatedTask.minimumChunkSize = task.minimumChunkSize || 15
    }
    onSave(updatedTask)
    onClose()
  }

  const removeFromCategory = (categoryId: string) => {
    setSelectedCategories(selectedCategories.filter((id) => id !== categoryId))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Clarify Idea: {task.description}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CaptureChips task={task} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-description" className="text-sm font-medium flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Detailed Description
                </Label>
                <Textarea
                  id="task-description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Provide more details about this task..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {isNextActionTarget && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated-duration" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Estimated Duration
                  </Label>
                  <div className="relative">
                    <Input
                      id="estimated-duration"
                      type="number"
                      value={estimatedDuration}
                      onChange={(e) => setEstimatedDuration(e.target.value)}
                      className="pr-12"
                      min="1"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                      min
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward-value" className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Reward Value
                  </Label>
                  <Input
                    id="reward-value"
                    type="number"
                    value={rewardValue}
                    onChange={(e) => setRewardValue(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
              )}

              {isNextActionTarget && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="urgency" className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Urgency
                  </Label>
                  <Select value={urgency} onValueChange={setUrgency}>
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="importance" className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Importance
                  </Label>
                  <Select value={importance} onValueChange={setImportance}>
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
                </div>
              </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Lists</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((categoryId) => {
                    const category = categories.find((c) => c.id === categoryId)
                    if (!category) return null

                    return (
                      <Badge
                        key={categoryId}
                        variant="secondary"
                        className="flex items-center gap-2 px-3 py-1"
                        style={{ backgroundColor: `${category.color}20`, borderColor: category.color }}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                        <button
                          onClick={() => removeFromCategory(categoryId)}
                          className="ml-1 hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>

                <ListPicker
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  allowMultiToggle
                />
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Advanced — attributes
                    <ChevronDown className={`h-4 w-4 transition-transform${showAdvanced ? " rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {listAttributeDefs.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">From selected lists</Label>
                      <AttributeValuesEditor
                        definitions={listAttributeDefs}
                        values={attributeValues}
                        onChange={setAttributeValues}
                      />
                    </div>
                  )}
                  <AdHocAttributesEditor
                    definitions={adhocDefs}
                    values={attributeValues}
                    onDefinitionsChange={setAdhocDefs}
                    onValuesChange={setAttributeValues}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                <h3 className="font-medium text-sm">Task Information</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatTaskDate(task.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Status:</span>
                    <span className="capitalize">{task.stage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Will become:</span>
                    <span className="font-medium text-foreground">Clarified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            Save & Clarify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Inbox({ onTaskSelect }: InboxProps) {
  const allTasks = useTaskStore((state) => state.tasks)
  const deleteTask = useTaskStore((state) => state.deleteTask)
  const updateTask = useTaskStore((state) => state.updateTask)
  const [open, setOpen] = useState(false)
  const [clarificationTask, setClarificationTask] = useState<Task | null>(null)

  // Filter tasks in the inbox
  const inboxTasks = useMemo(() => {
    return allTasks.filter((task) => task.stage === "inbox" && !task.completed)
  }, [allTasks])

  const handleClarifyTask = (task: Task) => {
    setClarificationTask(task)
  }

  const handleClarificationSave = (updatedTask: Task) => {
    updateTask(updatedTask)
    setClarificationTask(null)
  }

  const handleClarifyAll = () => {
    inboxTasks.forEach((task) => {
      updateTask({
        ...task,
        stage: task.lists?.length ? "clarified" : "list",
      })
    })
    setOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <InboxIcon className="h-4 w-4" />
            Inbox
            {inboxTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {inboxTasks.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InboxIcon className="h-5 w-5" />
              Inbox — Clarify Your Ideas
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {inboxTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Your inbox is empty!</p>
                <p className="text-sm">Use Quick Add or Bulk Add to capture new ideas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inboxTasks.map((task) => (
                  <Card key={task.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{task.description}</p>
                          <p className="text-sm text-muted-foreground mt-1">Added {formatTaskDateTime(task.createdAt)}</p>
                          <CaptureChips task={task} />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleClarifyTask(task)}
                            title="Clarify this idea"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            title="Delete this idea"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {inboxTasks.length > 0 && (
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {inboxTasks.length} idea{inboxTasks.length !== 1 ? "s" : ""} to clarify
              </p>
              <Button onClick={handleClarifyAll} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Clarify All Ideas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Task Clarification Dialog */}
      {clarificationTask && (
        <TaskClarificationDialog
          task={clarificationTask}
          open={!!clarificationTask}
          onClose={() => setClarificationTask(null)}
          onSave={handleClarificationSave}
        />
      )}
    </>
  )
}
