/**
 * components/ItemDetail/popup/PopupDetailsRail.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Details rail: open task card, lists, tags, notes peek, Sent, and status.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CompletionStatus, ItemDetailPanel, ItemTypeCapabilities, List, Task } from "@/lib/types"
import { XCircle } from "lucide-react"
import { ItemTaskCardKey } from "@/components/ItemDetail/chrome/ItemTaskCardKey"
import { NotesPeek } from "@/components/ItemDetail/tabs/notes/ItemNotesLog"
import { TagInput } from "@/components/ItemDetail/tags/TagInput"
import { ListPicker } from "@/components/Lists/list-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  COMPLETION_STATUSES,
  COMPLETION_STATUS_LABELS,
  COMPLETION_STATUS_DESCRIPTIONS,
  effectiveStatus,
} from "@/lib/completion-status"
import { safeDateFormat } from "@/lib/date-utils"
import { isStepItem } from "@/lib/step-items"
import { clearItemLayers } from "@/lib/step-item-stack"

export function PopupDetailsRail({
  isTask,
  task,
  stackAbove,
  guard,
  removeFromCategory,
  lists,
  handleNavigateToList,
  setLists,
  addTag,
  removeTag,
  visiblePanels,
  writeDraft,
  setDetailTab,
  sentListIds,
  sentOnThoseLists,
  handleToggleSent,
  caps,
  handleStatusChange,
}: {
  isTask: boolean
  task: Task
  stackAbove: boolean
  guard: { requestClose: () => void }
  removeFromCategory: (categoryId: string) => void
  lists: List[]
  handleNavigateToList: (listId: string) => void
  setLists: (listIds: string[]) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  visiblePanels: ItemDetailPanel[]
  writeDraft: (patch: Partial<Task>) => void
  setDetailTab: Dispatch<SetStateAction<string>>
  sentListIds: string[]
  sentOnThoseLists: boolean
  handleToggleSent: () => void
  caps: ItemTypeCapabilities
  handleStatusChange: (status: CompletionStatus) => void
}) {
  return (
                    <aside className="id-details-rail" aria-label="Where this item lives">
                      {isTask && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Task card</Label>
                          <ItemTaskCardKey
                            task={task}
                            onBeforeOpen={() => {
                              if (stackAbove) clearItemLayers()
                              else guard.requestClose()
                            }}
                          />
                        </div>
                      )}
                      <div className="space-y-3">
                        <Label className="id-rail-plate">Lists</Label>
                        <div className="flex flex-wrap gap-2">
                          {task.lists?.map((categoryId) => {
                            const category = lists.find((c) => c.id === categoryId)
                            if (!category) return null

                            return (
                              <Badge
                                key={categoryId}
                                variant="secondary"
                                className="flex items-center gap-2 px-3 py-1 text-sm font-medium cursor-pointer"
                                style={{ backgroundColor: `${category.color}20`, borderColor: category.color }}
                                title="Double-click to open this list"
                                onDoubleClick={() => handleNavigateToList(categoryId)}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                                {category.name}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFromCategory(categoryId)
                                  }}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className="ml-1 hover:text-destructive transition-colors"
                                >
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            )
                          })}
                        </div>

                        <div className="space-y-2">
                          <ListPicker
                            selected={task.lists ?? []}
                            onChange={setLists}
                            mode="multi"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="id-rail-plate">Tags</Label>
                        <TagInput tags={task.tags ?? []} onAdd={addTag} onRemove={removeTag} />
                      </div>

                      {visiblePanels.includes("notes") && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Notes</Label>
                          <NotesPeek
                            entries={task.noteLog}
                            onChangeEntries={(noteLog) => writeDraft({ noteLog })}
                            onOpenAll={() => setDetailTab("notes")}
                          />
                        </div>
                      )}

                      {sentListIds.length > 0 && (
                        <div className="space-y-2">
                          <Label className="id-rail-plate">Sent</Label>
                          <Button
                            type="button"
                            variant="outline"
                            className="id-btn"
                            aria-pressed={sentOnThoseLists}
                            onClick={handleToggleSent}
                          >
                            Sent
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Marks this item sent. It stays in the vault and is not deleted. Sent items hide in the list
                            until Show sent, and leave the list next week.
                          </p>
                        </div>
                      )}

                      {caps.completable && !isStepItem(task) && (
                      <div className="space-y-3 text-sm">
                        <h3 className="id-rail-plate">Status</h3>
                        <div className="space-y-2">
                          <Label htmlFor="completion-status" className="text-sm font-medium">
                            Completion status
                          </Label>
                          <Select value={effectiveStatus(task)} onValueChange={(v) => handleStatusChange(v as CompletionStatus)}>
                            <SelectTrigger id="completion-status" className="focus-ring">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMPLETION_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {COMPLETION_STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {COMPLETION_STATUS_DESCRIPTIONS[effectiveStatus(task)]}
                          </p>
                        </div>
                        <div className="space-y-2 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Created:</span>
                            <span className="font-medium">{safeDateFormat(task.createdAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lifecycle:</span>
                            <span className="font-medium">{task.stage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Completed:</span>
                            <span className="font-medium">{task.completed ? "Yes" : "No"}</span>
                          </div>
                          {task.deadline && (
                            <div className="flex justify-between">
                              <span>Deadline:</span>
                              <span className="font-medium">{safeDateFormat(task.deadline)}</span>
                            </div>
                          )}
                          {task.actualDuration && (
                            <div className="flex justify-between">
                              <span>Actual Duration:</span>
                              <span className="font-medium">{task.actualDuration} minutes</span>
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </aside>
  )
}
