/**
 * components/ItemDetail/popup/PopupDetailsMain.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The Details main column: reminders, person, computer-project desk, attributes, description, duration, and repeated settings.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { AttributeDefinition, AttributeValue, ItemTypeCapabilities, List, Task } from "@/lib/types"
import { AlertTriangle, FileText, Star } from "lucide-react"
import { ComputerProjectDetail } from "@/components/ItemDetail/ComputerProjectDetail"
import { ItemAttributesSection } from "@/components/ItemDetail/ItemAttributesSection"
import { ItemEstimateField } from "@/components/ItemDetail/ItemEstimateField"
import { ItemRewardField } from "@/components/ItemDetail/ItemRewardField"
import { ReminderScheduleFields } from "@/components/ItemDetail/ReminderScheduleFields"
import { PopupRepeatedTaskSettings } from "@/components/ItemDetail/popup/PopupRepeatedTaskSettings"
import { PersonDetail } from "@/components/People/person-detail"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COMPUTER_PROJECT_DESK_ATTRS, COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import { PERSON_ATTR } from "@/lib/person-types"
import { isReminderTask } from "@/lib/reminders"
import type { DetailViewResolution } from "@/lib/item-types"

export function PopupDetailsMain({
  task,
  lists,
  commitReminder,
  touchDraft,
  setTask,
  getDraft,
  handleNavigateToList,
  activeTypeId,
  openItem,
  viewAsTypeId,
  detailView,
  handleCreateAttribute,
  bindTextList,
  caps,
  isTask,
}: {
  task: Task
  lists: List[]
  commitReminder: (patch: Pick<Task, "scheduledDate" | "scheduledTime" | "reminder">) => void
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  getDraft: () => Task | null
  handleNavigateToList: (listId: string) => void
  activeTypeId: string
  openItem: (id: string) => void
  viewAsTypeId: string | undefined
  detailView: DetailViewResolution
  handleCreateAttribute: (def: AttributeDefinition, value: AttributeValue, listId: string | null) => void
  bindTextList: (attributeId: string, listId: string) => void
  caps: ItemTypeCapabilities
  isTask: boolean
}) {
  return (
                    <div className="id-details-main">
                      {isReminderTask(task, lists) ? (
                        <ReminderScheduleFields
                          task={task}
                          onChange={(patch) => commitReminder(patch)}
                        />
                      ) : null}
                      {itemShowsPersonPipelines(task, lists) ? (
                        <PersonDetail
                          person={task}
                          onChange={(patch) => {
                            touchDraft(patch)
                            setTask((prev) => (prev ? { ...prev, ...patch } : prev))
                          }}
                          onLive={touchDraft}
                          readDraft={getDraft}
                          onNavigateToList={handleNavigateToList}
                          pipelines={
                            <PersonPipelinesEditor
                              mode="person"
                              person={task}
                              onChange={(personPipelines) => {
                                const next = personPipelines.length > 0 ? personPipelines : undefined
                                touchDraft({ personPipelines: next })
                                setTask((prev) => (prev ? { ...prev, personPipelines: next } : prev))
                              }}
                            />
                          }
                        />
                      ) : null}
                      {activeTypeId === COMPUTER_PROJECT_TYPE_ID ? (
                        <ComputerProjectDetail
                          task={task}
                          onLiveAttr={(id, value) =>
                            touchDraft({ attributes: { ...(getDraft()?.attributes ?? {}), [id]: value } })
                          }
                          onCommitAttr={(id, value) => {
                            const attributes = { ...(getDraft()?.attributes ?? {}), [id]: value }
                            touchDraft({ attributes })
                            setTask((prev) => (prev ? { ...prev, attributes } : prev))
                          }}
                          onPatch={(patch) => {
                            touchDraft(patch)
                            setTask((prev) => (prev ? { ...prev, ...patch } : prev))
                          }}
                          onOpenItem={openItem}
                        />
                      ) : null}
                      <div className="id-bay">
                        <ItemAttributesSection
                          attributes={task.attributes || {}}
                          itemCategoryIds={task.lists ?? []}
                          categories={lists}
                          itemAttributeDefinitions={task.itemAttributeDefinitions}
                          itemType={viewAsTypeId ?? task.type}
                          layout={detailView.layout}
                          omitAttributeIds={[
                            ...(itemShowsPersonPipelines(task, lists)
                              ? [PERSON_ATTR.birthday, PERSON_ATTR.phone, PERSON_ATTR.notes]
                              : []),
                            ...(activeTypeId === COMPUTER_PROJECT_TYPE_ID || task.type === COMPUTER_PROJECT_TYPE_ID
                              ? [...COMPUTER_PROJECT_DESK_ATTRS]
                              : []),
                          ]}
                          onLiveValue={(id, value) =>
                            touchDraft({ attributes: { ...(getDraft()?.attributes ?? {}), [id]: value } })
                          }
                          onChangeValues={(attributes) => {
                            touchDraft({ attributes })
                            setTask((prev) => (prev ? { ...prev, attributes } : prev))
                          }}
                          onChangeItemAttributeDefinitions={(itemAttributeDefinitions) =>
                            setTask({ ...task, itemAttributeDefinitions })
                          }
                          onCreateAttribute={handleCreateAttribute}
                          onOpenItem={openItem}
                          attributeLabels={task.attributeLabels}
                          hiddenAttributeIds={task.hiddenAttributeIds}
                          textListIds={task.textListIds}
                          onBindTextList={bindTextList}
                          onOpenTextList={handleNavigateToList}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="task-description" className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Detailed Description
                        </Label>
                        <IsolatedTextarea
                          id="task-description"
                          sizeKey={`id-desc:${task.id}`}
                          value={task.taskDescription || ""}
                          onLiveChange={(taskDescription) => touchDraft({ taskDescription })}
                          onCommit={(taskDescription) =>
                            setTask((prev) => (prev ? { ...prev, taskDescription } : prev))
                          }
                          placeholder="Detailed description…"
                          rows={4}
                          className="focus-ring"
                        />
                      </div>

                      {(caps.duration || isTask) && (
                      <div className="grid grid-cols-2 gap-4">
                        <ItemEstimateField
                          estimatedDuration={task.estimatedDuration}
                          touchDraft={touchDraft}
                          setTask={setTask}
                          variant="popup"
                        />

                        <ItemRewardField
                          task={task}
                          touchDraft={touchDraft}
                          setTask={setTask}
                          variant="popup"
                        />

                        <div className="space-y-3">
                          <Label htmlFor="urgency" className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Urgency
                          </Label>
                          <Select
                            value={(task.urgency ?? 3).toString()}
                            onValueChange={(value) => setTask({ ...task, urgency: Number.parseInt(value) })}
                          >
                            <SelectTrigger className="focus-ring">
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

                        <div className="space-y-3">
                          <Label htmlFor="importance" className="text-sm font-semibold flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Importance
                          </Label>
                          <Select
                            value={(task.importance ?? 3).toString()}
                            onValueChange={(value) => setTask({ ...task, importance: Number.parseInt(value) })}
                          >
                            <SelectTrigger className="focus-ring">
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

                      <PopupRepeatedTaskSettings task={task} setTask={setTask} caps={caps} />
                    </div>
  )
}
