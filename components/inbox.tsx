/**
 * components/inbox.tsx — Inbox walk, batch, and clarification
 *
 * Two partitions: Inbox (revisit) and Monkey brain (compulsive dump).
 * Lists the open partition newest first. The header trigger counts the revisit pile.
 * At rest the foot is Walk plus Select all / Select N / Select unsorted / a Dated-or-Bare slice.
 * A check reveals Apply list, Due, File, Monkey brain, Bulk edit, and Delete. Merge needs two.
 * Walk with nothing checked starts at the caret; with checks it walks the selection.
 * Delete, including one row’s trash, asks first. Clarifying or filing awards 1 point;
 * emptying the revisit Inbox awards 50. The foot counts this sitting.
 * Recent lists are the first keys on the clarify sheet.
 *
 * Chrome: milled fascia on `.inbox-dialog` (`inbox.css`) — brushed bay, engraved
 * nameplates, raised metal keys, CRT counts, power lamp on the active partition.
 * Looks only; verbs and accessible names stay.
 *
 * Spec: §4.4 (Clarification), §4.5 (Inbox as a living list). Ideas #243, #244.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Edit,
  Trash,
  InboxIcon,
  Clock,
  Award,
  AlertTriangle,
  Star,
  Save,
  X,
  ChevronDown,
  CalendarDays,
  Timer,
  Tag,
  Flag,
} from "lucide-react"
import { format } from "date-fns"
import { formatLocalDateKey, parseLocalDate, safeToDate } from "@/lib/date-utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Task, AttributeDefinition, AttributeValue } from "@/lib/types"
import { listIsNextActions, withCategoryDefaults, itemTitle } from "@/lib/item-utils"
import { ListPicker } from "@/components/Lists/list-picker"
import { AdHocAttributesEditor, mergeListAttributes, AttributeValuesEditor } from "@/components/Lists/attribute-editor"
import { MergeItemsConfirmDialog } from "@/components/Lists/dialogs/MergeItemsConfirmDialog"
import { MergeItemsDialog } from "@/components/Lists/dialogs/MergeItemsDialog"
import { applyItemMerge, itemMergeLabel, type ItemMergePlan } from "@/lib/item-merge"
import { rememberWorld, undoLastAction } from "@/lib/action-history"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import {
  applyDeadlineToInboxItems,
  applyListsToInboxItems,
  clarifyInboxItems,
  deleteInboxItems,
  firstWalkId,
  inboxAllSelected,
  inboxBatchTargets,
  inboxTitleLines,
  INBOX_CHORDS,
  inInboxPartition,
  isBareInboxCapture,
  isDatedInboxCapture,
  isInboxEditableTarget,
  nextWalkId,
  openInboxIds,
  openRevisitInboxIds,
  pickRandomInboxIds,
  rangeSelectIds,
  renameInboxIdea,
  rotateInboxQueue,
  setInboxMonkeyBrain,
  sortInboxNewestFirst,
  toggleSelectedId,
  walkQueueIds,
  type InboxPartition,
} from "@/lib/inbox-batch"
import { creditInboxBatchHandling, creditInboxHandling, INBOX_CLEAR_BONUS, INBOX_HANDLE_POINTS, shouldAwardInboxClear } from "@/lib/inbox-credit"
import {
  readInboxRecentListIds,
  recentListIdsFromItems,
  rememberInboxListIds,
  suggestedInboxListIds,
} from "@/lib/inbox-recent-lists"
import "./inbox.css"

interface InboxProps {
  onTaskSelect: (taskId: string) => void
}

function asDate(value: Date | string | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function inboxClock(value: Date | string | undefined): string {
  const d = asDate(value)
  return d ? format(d, "h:mm a") : ""
}

function inboxAgeMark(value: Date | string | undefined, now = new Date()): string | null {
  const d = asDate(value)
  if (!d) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (day >= start) return null
  const days = Math.max(1, Math.round((start.getTime() - day.getTime()) / 86_400_000))
  return `${days}d`
}

function inboxDayGroups(tasks: Task[], now = new Date()): { key: string; plate: string; tasks: Task[] }[] {
  const today = formatLocalDateKey(now)
  const groups: { key: string; plate: string; tasks: Task[] }[] = []
  for (const task of tasks) {
    const d = asDate(task.createdAt)
    const key = d ? formatLocalDateKey(d) : "undated"
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) groups.push({ key, plate: "", tasks: [task] })
    else last.tasks.push(task)
  }
  for (const group of groups) {
    const minutes = group.tasks
      .map((task) => asDate(task.createdAt))
      .filter((d): d is Date => !!d)
      .map((d) => d.getHours() * 60 + d.getMinutes())
    const clock = (m: number) => format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), "h:mm a")
    const span =
      minutes.length === 0
        ? ""
        : Math.min(...minutes) === Math.max(...minutes)
          ? clock(Math.min(...minutes))
          : `${clock(Math.min(...minutes))}–${clock(Math.max(...minutes))}`
    const day =
      group.key === today
        ? "Today"
        : group.key === "undated"
          ? "Undated"
          : format(parseLocalDate(group.key) ?? now, "EEE MMM d")
    group.plate = span ? `${day} · ${span}` : day
  }
  return groups
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
  const deadline = asDate(task.deadline)
  if (deadline) chips.push({ key: "due", icon: <CalendarDays className="h-3 w-3" />, label: `due ${format(deadline, "EEE MMM d")}` })

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

function TaskClarificationDialog({
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
      createdAt: asDate(task.createdAt) ?? new Date(),
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
      <DialogContent className="inbox-dialog fm98-dialog sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Clarify idea" data-ui-docs="components/README.md">
        <DialogHeader className="pb-3">
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
          {walking && (
            <div className="inbox-walk-progress" role="progressbar" aria-valuenow={walkPosition} aria-valuemin={1} aria-valuemax={walkTotal}>
              <i style={{ width: `${walkPct}%` }} />
            </div>
          )}
          <CaptureChips task={task} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className={walking ? "inbox-walk-body" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
            <div className="space-y-4">
              <div className="inbox-walk-name">
                <Label htmlFor="inbox-idea-name" className="text-sm font-medium">
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
                          type="button"
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
                  key={task.id}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  allowMultiToggle
                  suggestedIds={suggestedListIds}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description" className="text-sm font-medium flex items-center gap-2">
                  <Edit className="h-4 w-4" />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated-duration" className="text-sm font-medium flex items-center gap-2">
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

                <div className="space-y-2">
                  <Label htmlFor="reward-value" className="text-sm font-medium flex items-center gap-2">
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

            </div>
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
            <Button onClick={handleSave} className="bg-[#000080] hover:bg-[#000060]">
              <Save className="h-4 w-4 mr-2" />
              {walking ? "Save & next" : "Save & Clarify"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Inbox({ onTaskSelect: _onTaskSelect }: InboxProps) {
  const allTasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const deleteTask = useTaskStore((state) => state.deleteTask)
  const updateTask = useTaskStore((state) => state.updateTask)
  const setTasks = useTaskStore((state) => state.setTasks)
  const [open, setOpen] = useState(false)
  const [clarificationTask, setClarificationTask] = useState<Task | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [focusId, setFocusId] = useState<string | null>(null)
  const [walkQueue, setWalkQueue] = useState<string[]>([])
  const [batchMode, setBatchMode] = useState<
    "list" | "deadline" | "merge-confirm" | "merge-plan" | "delete-confirm" | "select-n" | null
  >(null)
  const [batchListIds, setBatchListIds] = useState<string[]>([])
  const [batchDeadline, setBatchDeadline] = useState(formatLocalDateKey(new Date()))
  const [undoLabel, setUndoLabel] = useState<string | null>(null)
  const [partition, setPartition] = useState<InboxPartition>("inbox")
  const [bulkSource, setBulkSource] = useState<{ ids: string[]; text: string; monkey: boolean } | null>(null)
  const [slice, setSlice] = useState<"all" | "bare" | "dated">("all")
  const [selectCount, setSelectCount] = useState("")
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [sitting, setSitting] = useState({ handled: 0, points: 0 })
  const selectAnchor = useRef<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const revisitTasks = useMemo(
    () => sortInboxNewestFirst(allTasks.filter((task) => inInboxPartition(task, "inbox"))),
    [allTasks],
  )
  const monkeyTasks = useMemo(
    () => sortInboxNewestFirst(allTasks.filter((task) => inInboxPartition(task, "monkey"))),
    [allTasks],
  )
  const pileTasks = partition === "monkey" ? monkeyTasks : revisitTasks
  const inboxTasks = useMemo(() => {
    if (slice === "bare") return pileTasks.filter(isBareInboxCapture)
    if (slice === "dated") return pileTasks.filter(isDatedInboxCapture)
    return pileTasks
  }, [pileTasks, slice])
  const bareCount = useMemo(() => pileTasks.filter(isBareInboxCapture).length, [pileTasks])
  const dayGroups = useMemo(() => inboxDayGroups(inboxTasks), [inboxTasks])

  const inboxIdList = useMemo(() => inboxTasks.map((task) => task.id), [inboxTasks])
  const suggestedListIds = useMemo(
    () =>
      suggestedInboxListIds(
        readInboxRecentListIds(),
        recentListIdsFromItems(allTasks),
        lists.map((list) => list.id),
        6,
      ),
    [allTasks, lists],
  )

  useEffect(() => {
    setSelectedIds((ids) => {
      const next = ids.filter((id) => inboxIdList.includes(id))
      return next.length === ids.length ? ids : next
    })
    if (focusId && !inboxIdList.includes(focusId)) {
      setFocusId(inboxIdList[0] ?? null)
    } else if (open && !focusId && inboxIdList[0]) {
      setFocusId(inboxIdList[0])
    }
  }, [inboxIdList, focusId, open])

  const walking = walkQueue.length > 0
  const nestedOpen = Boolean(clarificationTask) || batchMode !== null
  const batchTargets = inboxBatchTargets(selectedIds, focusId)
  const allSelected = inboxAllSelected(inboxIdList, selectedIds)
  const mergeItems = useMemo(
    () => selectedIds.map((id) => allTasks.find((task) => task.id === id)).filter((task): task is Task => !!task),
    [selectedIds, allTasks],
  )
  const deletePreview = useMemo(
    () =>
      pendingDeleteIds
        .map((id) => allTasks.find((task) => task.id === id))
        .filter((task): task is Task => !!task),
    [pendingDeleteIds, allTasks],
  )

  const resetSession = () => {
    setSelectedIds([])
    setFocusId(null)
    setWalkQueue([])
    setClarificationTask(null)
    setBatchMode(null)
    setUndoLabel(null)
    setSlice("all")
    setPendingDeleteIds([])
    setSitting({ handled: 0, points: 0 })
    selectAnchor.current = null
  }

  const noteSitting = (count: number, openBefore: number, openAfter: number) => {
    if (count <= 0) return
    const points = count * INBOX_HANDLE_POINTS + (shouldAwardInboxClear(openBefore, openAfter) ? INBOX_CLEAR_BONUS : 0)
    setSitting((prev) => ({ handled: prev.handled + count, points: prev.points + points }))
  }

  const creditHandled = (task: Task, openBefore: number) => {
    const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
    creditInboxHandling({
      taskId: task.id,
      title: itemTitle(task),
      openBefore,
      openAfter,
    })
    noteSitting(1, openBefore, openAfter)
  }

  const handleClarifyTask = (task: Task) => {
    setClarificationTask(task)
    setFocusId(task.id)
  }

  const handleDeleteIdea = (task: Task) => {
    setPendingDeleteIds([task.id])
    setBatchMode("delete-confirm")
  }

  const deleteIdeaNow = (task: Task) => {
    const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
    deleteTask(task.id)
    creditHandled(task, openBefore)
    setSelectedIds((ids) => ids.filter((id) => id !== task.id))
  }

  const advanceWalk = (afterId: string) => {
    const openIds = openInboxIds(useTaskStore.getState().tasks)
    const nextId = nextWalkId(walkQueue, openIds, afterId)
    if (!nextId) {
      setWalkQueue([])
      setClarificationTask(null)
      return
    }
    const next = useTaskStore.getState().tasks.find((task) => task.id === nextId) ?? null
    setClarificationTask(next)
    if (next) setFocusId(next.id)
  }

  const handleClarificationSave = (updatedTask: Task) => {
    const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
    rememberInboxListIds(updatedTask.lists ?? [])
    updateTask(updatedTask)
    creditHandled(updatedTask, openBefore)
    setSelectedIds((ids) => ids.filter((id) => id !== updatedTask.id))
    if (walking) advanceWalk(updatedTask.id)
    else setClarificationTask(null)
  }

  const handleClarificationClose = () => {
    setClarificationTask(null)
    setWalkQueue([])
  }

  const handleSkip = () => {
    if (!clarificationTask) return
    advanceWalk(clarificationTask.id)
  }

  const handleDiscard = () => {
    if (!clarificationTask) return
    const id = clarificationTask.id
    deleteIdeaNow(clarificationTask)
    if (walking) advanceWalk(id)
    else setClarificationTask(null)
  }

  const startWalk = (fromId?: string | null) => {
    const start = fromId ?? focusId
    const queue =
      selectedIds.length > 0
        ? walkQueueIds(inboxIdList, selectedIds, start)
        : rotateInboxQueue(inboxIdList, start)
    const openIds = openInboxIds(inboxTasks)
    const first = firstWalkId(queue, openIds)
    if (!first) return
    setWalkQueue(queue)
    const task = inboxTasks.find((item) => item.id === first) ?? null
    setClarificationTask(task)
    if (task) setFocusId(task.id)
  }

  const runBatch = (label: string, nextTasks: Task[]) => {
    rememberWorld(label)
    setTasks(nextTasks)
    setUndoLabel(label)
    setBatchMode(null)
    setBatchListIds([])
  }

  const applyBatchLists = () => {
    if (batchTargets.length === 0 || batchListIds.length === 0) return
    rememberInboxListIds(batchListIds)
    runBatch("inbox apply list", applyListsToInboxItems(allTasks, batchTargets, batchListIds))
  }

  const applyBatchListsAndClarify = () => {
    if (batchTargets.length === 0 || batchListIds.length === 0) return
    const filed = batchTargets
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    const withLists = applyListsToInboxItems(allTasks, batchTargets, batchListIds)
    rememberInboxListIds(batchListIds)
    runBatch("inbox apply and clarify", clarifyInboxItems(withLists, batchTargets))
    creditInboxBatchHandling(
      filed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openRevisitInboxIds(useTaskStore.getState().tasks).size,
    )
    noteSitting(filed.length, openBefore, openRevisitInboxIds(useTaskStore.getState().tasks).size)
    setSelectedIds((ids) => ids.filter((id) => !batchTargets.includes(id)))
  }

  const applyBatchDeadline = () => {
    const deadline = parseLocalDate(batchDeadline)
    if (batchTargets.length === 0 || !deadline) return
    runBatch("inbox apply deadline", applyDeadlineToInboxItems(allTasks, batchTargets, deadline))
  }

  const applyDeleteSelection = () => {
    const ids = pendingDeleteIds.length > 0 ? pendingDeleteIds : selectedIds
    if (ids.length === 0) return
    const doomed = ids
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    rememberWorld("inbox delete selection")
    setTasks(deleteInboxItems(allTasks, ids), { tombstoneIds: ids })
    const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
    creditInboxBatchHandling(
      doomed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openAfter,
    )
    noteSitting(doomed.length, openBefore, openAfter)
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    setPendingDeleteIds([])
    setUndoLabel("inbox delete selection")
    setBatchMode(null)
  }

  const applyClarifySelection = () => {
    if (selectedIds.length === 0) return
    const filed = selectedIds
      .map((id) => allTasks.find((task) => task.id === id))
      .filter((task): task is Task => !!task)
    const openBefore = openRevisitInboxIds(allTasks).size
    runBatch("inbox mark clarified", clarifyInboxItems(allTasks, selectedIds))
    creditInboxBatchHandling(
      filed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
      openBefore,
      openRevisitInboxIds(useTaskStore.getState().tasks).size,
    )
    noteSitting(filed.length, openBefore, openRevisitInboxIds(useTaskStore.getState().tasks).size)
    setSelectedIds([])
  }

  const movePartition = (toMonkey: boolean) => {
    if (selectedIds.length === 0) return
    runBatch(
      toMonkey ? "inbox to monkey brain" : "monkey brain to inbox",
      setInboxMonkeyBrain(allTasks, selectedIds, toMonkey),
    )
    setSelectedIds([])
  }

  const showPartition = (next: InboxPartition) => {
    if (next === partition) return
    setPartition(next)
    setSelectedIds([])
    setFocusId(null)
    setWalkQueue([])
    setUndoLabel(null)
  }

  const openBulkEdit = () => {
    const ordered = inboxTasks.filter((task) => selectedIds.includes(task.id))
    if (ordered.length === 0) return
    setBulkSource({
      ids: ordered.map((task) => task.id),
      text: ordered.map((task) => itemTitle(task)).join("\n"),
      monkey: partition === "monkey",
    })
  }

  const applyMerge = (plan: ItemMergePlan) => {
    rememberWorld("inbox merge")
    setTasks(applyItemMerge(allTasks, plan), { tombstoneIds: plan.discardedIds })
    setSelectedIds((ids) => ids.filter((id) => id === plan.survivorId || !plan.discardedIds.includes(id)))
    setFocusId(plan.survivorId)
    setUndoLabel("inbox merge")
    setBatchMode(null)
  }

  const moveFocus = (delta: number) => {
    if (inboxIdList.length === 0) return
    const i = Math.max(0, inboxIdList.indexOf(focusId ?? inboxIdList[0]))
    const next = inboxIdList[(i + delta + inboxIdList.length) % inboxIdList.length]
    setFocusId(next)
  }

  const clickRow = (id: string, shift: boolean) => {
    setFocusId(id)
    if (shift) {
      setSelectedIds(rangeSelectIds(inboxIdList, selectAnchor.current ?? focusId, id))
      return
    }
    selectAnchor.current = id
    setSelectedIds((ids) => toggleSelectedId(ids, id))
  }

  const applySelectN = () => {
    const n = Number.parseInt(selectCount, 10)
    setBatchMode(null)
    setSelectCount("")
    if (!Number.isFinite(n) || n <= 0) return
    const ids = pickRandomInboxIds(
      pileTasks.map((task) => task.id),
      n,
    )
    setSlice("all")
    setSelectedIds(ids)
    selectAnchor.current = ids[0] ?? null
    if (ids[0]) setFocusId(ids[0])
  }

  const selectUnsorted = () => {
    const ids = pileTasks.filter(isBareInboxCapture).map((task) => task.id)
    setSlice("all")
    setSelectedIds(ids)
    selectAnchor.current = ids[0] ?? null
    if (ids[0]) setFocusId(ids[0])
  }

  const cycleSlice = () => {
    setSlice((current) => (current === "all" ? "dated" : current === "dated" ? "bare" : "all"))
  }

  useEffect(() => {
    if (!open || !focusId || nestedOpen) return
    rowRefs.current.get(focusId)?.scrollIntoView?.({ block: "nearest" })
  }, [focusId, open, inboxIdList, nestedOpen])

  useEffect(() => {
    if (!open || nestedOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isInboxEditableTarget(e.target)) return
      const key = e.key
      const go = (list: readonly string[]) => list.includes(key)
      if (go(INBOX_CHORDS.next)) {
        e.preventDefault()
        moveFocus(1)
      } else if (go(INBOX_CHORDS.prev)) {
        e.preventDefault()
        moveFocus(-1)
      } else if (go(INBOX_CHORDS.toggle) || (key === " " && !(e.target instanceof HTMLButtonElement))) {
        e.preventDefault()
        if (focusId) setSelectedIds((ids) => toggleSelectedId(ids, focusId))
      } else if (go(INBOX_CHORDS.selectAll)) {
        e.preventDefault()
        setSelectedIds(inboxIdList)
      } else if (go(INBOX_CHORDS.deselectAll)) {
        e.preventDefault()
        setSelectedIds([])
      } else if (go(INBOX_CHORDS.selectN)) {
        e.preventDefault()
        if (pileTasks.length > 0) {
          setSelectCount("")
          setBatchMode("select-n")
        }
      } else if (go(INBOX_CHORDS.selectUnsorted)) {
        e.preventDefault()
        selectUnsorted()
      } else if (go(INBOX_CHORDS.slice)) {
        e.preventDefault()
        cycleSlice()
      } else if (go(INBOX_CHORDS.clarify)) {
        if (e.target instanceof HTMLButtonElement && key === "Enter") return
        e.preventDefault()
        const task = inboxTasks.find((item) => item.id === focusId)
        if (task) handleClarifyTask(task)
      } else if (go(INBOX_CHORDS.walk)) {
        e.preventDefault()
        startWalk(focusId)
      } else if (go(INBOX_CHORDS.applyList)) {
        e.preventDefault()
        if (batchTargets.length) setBatchMode("list")
      } else if (go(INBOX_CHORDS.applyDeadline)) {
        e.preventDefault()
        if (batchTargets.length) setBatchMode("deadline")
      } else if (go(INBOX_CHORDS.merge)) {
        e.preventDefault()
        if (selectedIds.length >= 2) setBatchMode("merge-confirm")
      } else if (go(INBOX_CHORDS.deleteSelection)) {
        e.preventDefault()
        if (selectedIds.length > 0) {
          setPendingDeleteIds(selectedIds)
          setBatchMode("delete-confirm")
        }
      } else if (go(INBOX_CHORDS.markClarified)) {
        e.preventDefault()
        if (selectedIds.length > 0) applyClarifySelection()
      } else if (go(INBOX_CHORDS.toMonkey) && partition === "inbox") {
        e.preventDefault()
        if (selectedIds.length > 0) movePartition(true)
      } else if (go(INBOX_CHORDS.toInbox) && partition === "monkey") {
        e.preventDefault()
        if (selectedIds.length > 0) movePartition(false)
      } else if (go(INBOX_CHORDS.bulkEdit)) {
        e.preventDefault()
        if (selectedIds.length > 0) openBulkEdit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // Intentional: chords read latest closure each time the list/focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nestedOpen, inboxTasks, inboxIdList, focusId, selectedIds, batchTargets, partition, pileTasks])

  const handleUndo = useCallback(() => {
    undoLastAction()
    setUndoLabel(null)
  }, [])

  const walkPosition = clarificationTask ? walkQueue.indexOf(clarificationTask.id) + 1 : 0

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetSession()
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-inbox-entry=""
            title={
              revisitTasks.length > 0
                ? `${revisitTasks.length} to revisit${monkeyTasks.length ? ` · ${monkeyTasks.length} in monkey brain` : ""}`
                : monkeyTasks.length > 0
                  ? `${monkeyTasks.length} in monkey brain · inbox is clear`
                  : "Inbox — nothing to revisit"
            }
          >
            <InboxIcon className="h-4 w-4" />
            Inbox
            {revisitTasks.length > 0 && (
              <Badge variant="secondary" className="b2-shell-count">
                {revisitTasks.length}
              </Badge>
            )}
            {revisitTasks.length === 0 && monkeyTasks.length > 0 && (
              <Badge variant="secondary" className="b2-shell-count inbox-mb-count">
                {monkeyTasks.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="inbox-dialog fm98-dialog sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-ui-name="Inbox" data-ui-docs="components/README.md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InboxIcon className="h-5 w-5" />
              {partition === "monkey" ? "Monkey brain" : "Inbox — Clarify Your Ideas"}
            </DialogTitle>
            <DialogDescription>
              {partition === "monkey"
                ? "A dump for compulsive, repetitive thoughts. Less weight than Inbox — promote one when you actually mean to revisit it."
                : "The pile you mean to revisit."}
            </DialogDescription>
          </DialogHeader>

          <div className="inbox-partitions" role="tablist" aria-label="Inbox partitions">
            <button
              type="button"
              role="tab"
              aria-selected={partition === "inbox"}
              className="inbox-partition"
              onClick={() => showPartition("inbox")}
            >
              <span className="inbox-power-lamp" aria-hidden="true" />
              <span className="inbox-partition-label">Inbox</span>
              <i className="inbox-crt-count" data-heavy={revisitTasks.length >= 10 ? "true" : undefined}>{revisitTasks.length}</i>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={partition === "monkey"}
              className="inbox-partition inbox-partition-monkey"
              onClick={() => showPartition("monkey")}
            >
              <span className="inbox-power-lamp" aria-hidden="true" />
              <span className="inbox-partition-label">Monkey brain</span>
              <i className="inbox-crt-count" data-heavy={monkeyTasks.length >= 10 ? "true" : undefined}>{monkeyTasks.length}</i>
            </button>
          </div>
          <p className="inbox-chord-manual">
            j/k move · x select · shift-click range · a all · n select N · s unsorted · / slice · ↵ clarify · y file · w walk · l list · d due · m merge · b monkey · i inbox · e edit · # delete
          </p>

          {undoLabel && (
            <div className="inbox-undo">
              <span>
                {undoLabel === "inbox merge"
                  ? "Merged. Cmd/Ctrl-Z undoes."
                  : undoLabel === "inbox delete selection"
                    ? "Deleted. Cmd/Ctrl-Z undoes."
                      : undoLabel === "inbox mark clarified" || undoLabel === "inbox apply and clarify"
                      ? "Filed onto their lists, or All Items. Cmd/Ctrl-Z undoes."
                      : undoLabel === "inbox to monkey brain"
                        ? "Sent to Monkey brain. Cmd/Ctrl-Z undoes."
                        : undoLabel === "monkey brain to inbox"
                          ? "Sent to Inbox. Cmd/Ctrl-Z undoes."
                          : undoLabel === "inbox bulk edit"
                            ? "Bulk edit saved. Cmd/Ctrl-Z undoes."
                            : "Applied. Cmd/Ctrl-Z undoes."}
              </span>
              <Button variant="outline" size="sm" onClick={handleUndo}>
                Undo
              </Button>
            </div>
          )}

          <div className="inbox-list-well flex-1 overflow-y-auto">
            {walking ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Walking this pile.</p>
              </div>
            ) : inboxTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {pileTasks.length > 0 ? (
                  <p>Nothing in this slice.</p>
                ) : partition === "monkey" ? (
                  <>
                    <p>Monkey brain is quiet.</p>
                    <p className="text-sm">Flag a capture with -mb or -monkey, or send a selection here from Inbox.</p>
                  </>
                ) : (
                  <>
                    <p>Nothing waiting to revisit.</p>
                    <p className="text-sm">Use Quick Add or Bulk Add to capture new ideas.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="inbox-rows">
                {dayGroups.map((group) => (
                  <div key={group.key}>
                    <div className="inbox-day-plate">{group.plate}</div>
                    {group.tasks.map((task) => {
                      const selected = selectedIds.includes(task.id)
                      const focused = focusId === task.id
                      const { line, aside } = inboxTitleLines(itemTitle(task))
                      const age = inboxAgeMark(task.createdAt)
                      return (
                        <div
                          key={task.id}
                          ref={(node) => {
                            if (node) rowRefs.current.set(task.id, node)
                            else rowRefs.current.delete(task.id)
                          }}
                          data-inbox-row={task.id}
                          data-focused={focused ? "true" : undefined}
                          data-selected={selected ? "true" : undefined}
                          className="inbox-row"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={`Select ${itemTitle(task)}`}
                            onClick={(event) => {
                              if (!event.shiftKey) return
                              event.preventDefault()
                              clickRow(task.id, true)
                            }}
                            onChange={() => {
                              selectAnchor.current = task.id
                              setFocusId(task.id)
                              setSelectedIds((ids) => toggleSelectedId(ids, task.id))
                            }}
                          />
                          <button
                            type="button"
                            className="inbox-row-title"
                            onClick={(event) => clickRow(task.id, event.shiftKey)}
                          >
                            <span>{line || "Untitled"}</span>
                            {aside ? <span className="inbox-row-aside">{aside}</span> : null}
                            <CaptureChips task={task} />
                          </button>
                          <span className="inbox-row-when">
                            {inboxClock(task.createdAt)}
                            {age ? <i className="inbox-age">{age}</i> : null}
                          </span>
                          {focused ? (
                            <span className="inbox-row-tools">
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
                                onClick={() => handleDeleteIdea(task)}
                                title="Delete this idea"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </span>
                          ) : (
                            <span className="inbox-row-tools" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {pileTasks.length > 0 && (
            <div className="inbox-foot">
              <p className="inbox-foot-meta">
                <span>
                  {sitting.handled > 0
                    ? `${sitting.handled} this sitting · ${sitting.points} pts`
                    : "This sitting"}
                  {partition === "inbox" ? " · 50 when this pile hits 0" : ""}
                  {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ""}
                </span>
              </p>
              <div className="inbox-foot-actions">
                {!allSelected && inboxIdList.length > 0 && (
                  <Button variant="outline" onClick={() => setSelectedIds(inboxIdList)} title="Select every visible idea (A)">
                    <i className="inbox-keycap">A</i>Select all
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectCount("")
                    setBatchMode("select-n")
                  }}
                  title="Pick a number of ideas at random (N)"
                >
                  <i className="inbox-keycap">N</i>Select N
                </Button>
                {bareCount > 0 && (
                  <Button variant="outline" onClick={selectUnsorted} title="Select ideas that are only a name (S)">
                    <i className="inbox-keycap">S</i>Select unsorted
                  </Button>
                )}
                {selectedIds.length > 0 && (
                  <Button variant="outline" onClick={() => setSelectedIds([])} title="Clear the selection (U)">
                    <i className="inbox-keycap">U</i>Deselect
                  </Button>
                )}
                <Button variant="outline" onClick={cycleSlice} title="Cycle All, Dated, Bare (/)">
                  <i className="inbox-keycap">/</i>
                  {slice === "dated" ? "Dated" : slice === "bare" ? "Bare" : "All"}
                </Button>
                {selectedIds.length > 0 && (
                  <>
                    <Button variant="outline" onClick={() => setBatchMode("list")} title="Apply a list (L)">
                      <i className="inbox-keycap">L</i>Apply list
                    </Button>
                    <Button variant="outline" onClick={() => setBatchMode("deadline")} title="Set a due day (D)">
                      <i className="inbox-keycap">D</i>Due
                    </Button>
                    <Button variant="outline" onClick={applyClarifySelection} title="File the selection onto its lists, or All Items (Y)">
                      <i className="inbox-keycap">Y</i>File
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => movePartition(partition !== "monkey")}
                      title={partition === "monkey" ? "Send the selection to Inbox (I)" : "Send the selection to Monkey brain (B)"}
                    >
                      <i className="inbox-keycap">{partition === "monkey" ? "I" : "B"}</i>
                      {partition === "monkey" ? "To inbox" : "Monkey brain"}
                    </Button>
                    <Button variant="outline" onClick={openBulkEdit} title="Edit the selection as bulk-add text (E)">
                      <i className="inbox-keycap">E</i>Bulk edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingDeleteIds(selectedIds)
                        setBatchMode("delete-confirm")
                      }}
                      title="Delete the selected ideas (#)"
                    >
                      <i className="inbox-keycap">#</i>Delete
                    </Button>
                  </>
                )}
                {selectedIds.length >= 2 && (
                  <Button variant="outline" onClick={() => setBatchMode("merge-confirm")} title="Merge the selection (M)">
                    <i className="inbox-keycap">M</i>Merge
                  </Button>
                )}
                {inboxIdList.length > 0 && (
                  <Button
                    onClick={() => startWalk(focusId)}
                    className="gap-2"
                    title={selectedIds.length > 0 ? "Walk the checked ideas (W)" : "Walk from the caret (W)"}
                  >
                    <i className="inbox-keycap">W</i>
                    {selectedIds.length > 0 ? "Walk selected" : "Walk"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {clarificationTask && (
        <TaskClarificationDialog
          task={clarificationTask}
          open
          walking={walking}
          walkPosition={Math.max(walkPosition, 1)}
          walkTotal={walkQueue.length || 1}
          suggestedListIds={suggestedListIds}
          onClose={handleClarificationClose}
          onSkip={walking ? handleSkip : undefined}
          onDiscard={handleDiscard}
          onSave={handleClarificationSave}
        />
      )}

      <Dialog open={batchMode === "list"} onOpenChange={(next) => { if (!next) setBatchMode(null) }}>
        <DialogContent className="fm98-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply list</DialogTitle>
            <DialogDescription>
              Add the chosen lists to {batchTargets.length} selected idea{batchTargets.length === 1 ? "" : "s"}. Apply leaves them here. Apply and clarify files them onto those lists and clears them from this pile.
            </DialogDescription>
          </DialogHeader>
          <ListPicker selected={batchListIds} onChange={setBatchListIds} allowMultiToggle />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
            <Button variant="outline" onClick={applyBatchLists} disabled={batchListIds.length === 0}>Apply</Button>
            <Button onClick={applyBatchListsAndClarify} disabled={batchListIds.length === 0} className="bg-[#000080] hover:bg-[#000060]">
              Apply and clarify
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchMode === "deadline"} onOpenChange={(next) => { if (!next) setBatchMode(null) }}>
        <DialogContent className="fm98-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set deadline</DialogTitle>
            <DialogDescription>
              Same due date on {batchTargets.length} idea{batchTargets.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="inbox-batch-deadline">Deadline</Label>
          <IsolatedInput
            id="inbox-batch-deadline"
            type="date"
            value={batchDeadline}
            onLiveChange={setBatchDeadline}
            onCommit={setBatchDeadline}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
            <Button onClick={applyBatchDeadline}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchMode === "select-n"}
        onOpenChange={(next) => {
          if (!next) setBatchMode(null)
        }}
      >
        <DialogContent className="inbox-dialog fm98-dialog sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Select N</DialogTitle>
            <DialogDescription>
              How many ideas? {pileTasks.length} or fewer picks that many at random. More selects the whole pile.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              applySelectN()
            }}
          >
            <input
              className="fm98-input w-full"
              inputMode="numeric"
              aria-label="How many ideas"
              value={selectCount}
              autoFocus
              onChange={(event) => setSelectCount(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBatchMode(null)}>Cancel</Button>
              <Button type="submit">Select</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchMode === "delete-confirm"}
        onOpenChange={(next) => {
          if (!next) {
            setBatchMode(null)
            setPendingDeleteIds([])
          }
        }}
      >
        <DialogContent className="inbox-dialog fm98-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              Delete {deletePreview.length} idea{deletePreview.length === 1 ? "" : "s"} from{" "}
              {partition === "monkey" ? "Monkey brain" : "the Inbox"}?
              This cannot be undone from this dialog. Each idea still earns 1 point
              {partition === "inbox" &&
              revisitTasks.length > 0 &&
              revisitTasks.every((task) => pendingDeleteIds.includes(task.id))
                ? ", and clearing the Inbox earns 50 more"
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto border px-2 py-1 text-sm">
            {deletePreview.map((task) => (
              <p key={task.id}>{itemTitle(task) || "Untitled"}</p>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBatchMode(null)
                setPendingDeleteIds([])
              }}
            >
              Cancel
            </Button>
            <Button onClick={applyDeleteSelection} className="bg-[#000080] hover:bg-[#000060]">
              Yes, delete {deletePreview.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MergeItemsConfirmDialog
        open={batchMode === "merge-confirm"}
        itemNames={mergeItems.map(itemMergeLabel)}
        onCancel={() => setBatchMode(null)}
        onContinue={() => setBatchMode("merge-plan")}
      />
      <EnhancedBulkAdd
        hideTrigger
        open={bulkSource !== null}
        initialText={bulkSource?.text ?? ""}
        defaultSendToInbox
        actionLabel="inbox bulk edit"
        title="Bulk edit"
        description="Each selected idea is one line. Edit freely, then add them the same way as Bulk Add. Leave “Send to Inbox” checked to put them back in this pile, or uncheck to file them onto their lists (or All Items)."
        onOpenChange={(next) => {
          if (!next) setBulkSource(null)
        }}
        afterAdd={({ sendToInbox, tasks }) => {
          if (!bulkSource) return
          if (bulkSource.monkey && sendToInbox) {
            for (const task of tasks) {
              if (task.stage === "inbox" && !task.monkeyBrain) updateTask({ ...task, monkeyBrain: true })
            }
          }
          const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
          const removed = bulkSource.ids
            .map((id) => useTaskStore.getState().tasks.find((task) => task.id === id))
            .filter((task): task is Task => !!task)
          setTasks(deleteInboxItems(useTaskStore.getState().tasks, bulkSource.ids), {
            tombstoneIds: bulkSource.ids,
          })
          if (!sendToInbox) {
            const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
            creditInboxBatchHandling(
              removed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
              openBefore,
              openAfter,
            )
            noteSitting(removed.length, openBefore, openAfter)
          }
          setSelectedIds([])
          setUndoLabel("inbox bulk edit")
          setBulkSource(null)
        }}
      />

      <MergeItemsDialog
        open={batchMode === "merge-plan"}
        items={mergeItems}
        lists={lists}
        onClose={() => setBatchMode(null)}
        onMerge={applyMerge}
      />
    </>
  )
}
