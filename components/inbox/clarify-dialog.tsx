/**
 * Clarify / walk sheet (`data-ui-name="Clarify idea"`).
 * Stays one mounted dialog for the whole walk. `boundTaskId` resets the draft when the idea changes.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle,
  Award,
  ChevronDown,
  Clock,
  Edit,
  Save,
  Star,
  Trash,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { AttributeDefinition, AttributeValue, Task } from "@/lib/types"
import { itemTitle, listIsNextActions, withCategoryDefaults } from "@/lib/item-utils"
import { ListPicker } from "@/components/Lists/list-picker"
import { HabitListPopup } from "@/components/Home/Habits/habit-list-popup"
import { AdHocAttributesEditor, AttributeValuesEditor, mergeListAttributes } from "@/components/Lists/attribute-editor"
import { renameInboxIdea } from "@/lib/inbox-batch"
import { AssignedListPlates } from "./assigned-list-plates"
import { CaptureChips } from "./capture-chips"
import { WalkOrigin } from "./walk-origin"

export function TaskClarificationDialog({
  task,
  open,
  walking,
  walkPosition,
  walkTotal,
  suggestedListIds,
  onClose,
  onSkip,
  onDiscard,
  onSave,
}: {
  task: Task
  open: boolean
  walking: boolean
  walkPosition: number
  walkTotal: number
  suggestedListIds: string[]
  onClose: () => void
  onSkip?: () => void
  onDiscard: () => void
  onSave: (updatedTask: Task) => void
}) {
  const categories = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const titleRef = useRef(itemTitle(task))
  const descRef = useRef(task.taskDescription || "")
  const durationRef = useRef(task.estimatedDuration?.toString() || "30")
  const rewardRef = useRef(task.rewardValue?.toString() || "1")
  const [urgency, setUrgency] = useState(task.urgency?.toString() || "3")
  const [importance, setImportance] = useState(task.importance?.toString() || "3")
  const [selectedCategories, setSelectedCategories] = useState<string[]>(task.lists || [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [adhocDefs, setAdhocDefs] = useState<AttributeDefinition[]>([])
  const [attributeValues, setAttributeValues] = useState<Record<string, AttributeValue>>(task.attributes || {})
  const [boundTaskId, setBoundTaskId] = useState(task.id)
  const [previewListId, setPreviewListId] = useState<string | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)

  // Keep the dialog mounted across a walk. Remounting it replayed the open
  // animation and rebuilt the list picker on every step.
  if (task.id !== boundTaskId) {
    setBoundTaskId(task.id)
    savingRef.current = false
    titleRef.current = itemTitle(task)
    descRef.current = task.taskDescription || ""
    durationRef.current = task.estimatedDuration?.toString() || "30"
    rewardRef.current = task.rewardValue?.toString() || "1"
    setUrgency(task.urgency?.toString() || "3")
    setImportance(task.importance?.toString() || "3")
    setSelectedCategories(task.lists || [])
    setShowAdvanced(false)
    setAdhocDefs([])
    setAttributeValues(task.attributes || {})
    setPreviewListId(null)
  }

  const listAttributeDefs = useMemo(
    () => mergeListAttributes(categories, selectedCategories),
    [categories, selectedCategories],
  )

  const isNextActionTarget = selectedCategories.some((cid) => listIsNextActions(cid, folders))

  const handleSave = () => {
    if (savingRef.current) return
    savingRef.current = true
    const named = renameInboxIdea(task, titleRef.current)
    let updatedTask: Task = {
      ...task,
      ...named,
      taskDescription: descRef.current,
      lists: selectedCategories,
      stage: selectedCategories.length ? "clarified" : "list",
      attributes: { ...attributeValues },
    }
    selectedCategories.forEach((cid) => {
      const cat = categories.find((c) => c.id === cid)
      updatedTask = withCategoryDefaults(updatedTask, cat)
    })
    if (isNextActionTarget) {
      updatedTask.estimatedDuration = Number.parseInt(durationRef.current) || 30
      updatedTask.rewardValue = Number.parseInt(rewardRef.current) || 1
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
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // handleSave reads latest refs/state on each render this effect is set up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task.id, selectedCategories, urgency, importance, isNextActionTarget, attributeValues])

  const removeFromCategory = (categoryId: string) => {
    setSelectedCategories(selectedCategories.filter((id) => id !== categoryId))
  }

  const walkPct = walkTotal > 0 ? Math.round((walkPosition / walkTotal) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent ref={hostRef} className="inbox-dialog inbox-clarify fm98-dialog max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Clarify idea" data-ui-docs="components/README.md">
        <DialogHeader className="inbox-clarify-head">
          <DialogTitle className="text-lg font-bold">
            {walking ? "Walk — file this idea" : "Clarify idea"}
          </DialogTitle>
          {walking ? (
            <div className="inbox-walk-meta">
              <span className="inbox-walk-step">
                {walkPosition} of {walkTotal}
              </span>
              <DialogDescription className="m-0">
                ⌘/Ctrl+Enter saves · Skip keeps it · Discard deletes it
              </DialogDescription>
            </div>
          ) : (
            <DialogDescription>
              Name it, pick lists, or discard. Smart-parse chips stay visible.
            </DialogDescription>
          )}
          {walking ? <WalkOrigin task={task} /> : null}
          {walking && (
            <div className="inbox-walk-progress" role="progressbar" aria-valuenow={walkPosition} aria-valuemin={1} aria-valuemax={walkTotal}>
              <i style={{ width: `${walkPct}%` }} />
            </div>
          )}
          <CaptureChips task={task} />
        </DialogHeader>

        <div className="inbox-clarify-scroll">
          <div className="inbox-clarify-body">
              <div className="inbox-clarify-field">
                <Label htmlFor="inbox-idea-name">
                  Name
                </Label>
                <IsolatedInput
                  key={task.id}
                  id="inbox-idea-name"
                  value={itemTitle(task)}
                  onLiveChange={(v) => {
                    titleRef.current = v
                  }}
                  placeholder="What is this idea?"
                  aria-label="Idea name"
                />
              </div>
              <div className="inbox-clarify-field">
                <Label>Lists</Label>
                <AssignedListPlates
                  selected={selectedCategories}
                  onRemove={removeFromCategory}
                  onPreview={setPreviewListId}
                />
                <div className="inbox-clarify-picker">
                  <ListPicker
                    key={task.id}
                    selected={selectedCategories}
                    onChange={setSelectedCategories}
                    allowMultiToggle
                    suggestedIds={suggestedListIds}
                  />
                </div>
              </div>
              <div className="inbox-clarify-field">
                <Label htmlFor="task-description" className="inbox-clarify-notes-label">
                  <Edit className="h-3.5 w-3.5" />
                  Notes
                </Label>
                <IsolatedTextarea
                  key={task.id}
                  id="task-description"
                  value={task.taskDescription || ""}
                  onLiveChange={(v) => {
                    descRef.current = v
                  }}
                  placeholder="Provide more details about this task..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {isNextActionTarget && (
              <div className="inbox-clarify-pair">
                <div className="inbox-clarify-field">
                  <Label htmlFor="estimated-duration" className="inbox-clarify-notes-label">
                    <Clock className="h-4 w-4" />
                    Estimated Duration
                  </Label>
                  <div className="relative">
                    <IsolatedInput
                      key={`${task.id}-duration`}
                      id="estimated-duration"
                      type="number"
                      value={task.estimatedDuration?.toString() || "30"}
                      onLiveChange={(v) => {
                        durationRef.current = v
                      }}
                      className="pr-12"
                      min="1"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                      min
                    </span>
                  </div>
                </div>

                <div className="inbox-clarify-field">
                  <Label htmlFor="reward-value" className="inbox-clarify-notes-label">
                    <Award className="h-4 w-4" />
                    Reward Value
                  </Label>
                  <IsolatedInput
                    key={`${task.id}-reward`}
                    id="reward-value"
                    type="number"
                    value={task.rewardValue?.toString() || "1"}
                    onLiveChange={(v) => {
                      rewardRef.current = v
                    }}
                    min="1"
                  />
                </div>
              </div>
              )}

              {isNextActionTarget && (
              <div className="inbox-clarify-pair">
                <div className="inbox-clarify-field">
                  <Label htmlFor="urgency" className="inbox-clarify-notes-label">
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

                <div className="inbox-clarify-field">
                  <Label htmlFor="importance" className="inbox-clarify-notes-label">
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
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="inbox-clarify-advanced">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    Advanced — attributes
                    <ChevronDown className={`h-4 w-4 transition-transform${showAdvanced ? " rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="inbox-clarify-advanced-body">
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
          </div>
        </div>

        <div className="inbox-walk-foot">
          <Button variant="outline" onClick={onDiscard} title="Delete this idea and credit 1 point">
            <Trash className="h-4 w-4 mr-2" />
            Discard idea
          </Button>
          <div className="inbox-walk-foot-end">
            {walking && onSkip && (
              <Button variant="outline" onClick={onSkip}>
                Skip
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {walking ? "End walk" : "Cancel"}
            </Button>
            <Button onClick={handleSave} className="inbox-clarify-save">
              <Save className="h-4 w-4 mr-2" />
              {walking ? "Save & next" : "Save & Clarify"}
            </Button>
          </div>
        </div>
        <HabitListPopup
          listId={previewListId}
          link={null}
          frequency={undefined}
          container={hostRef.current}
          browse
          onClose={() => setPreviewListId(null)}
        />
      </DialogContent>
    </Dialog>
  )
}
