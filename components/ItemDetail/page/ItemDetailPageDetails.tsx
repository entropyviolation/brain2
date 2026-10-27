// Page-only Details tab for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import { ComputerProjectDetail } from "@/components/ItemDetail/ComputerProjectDetail"
import { HabitLinkedDetail } from "@/components/ItemDetail/HabitLinkedDetail"
import { ItemAttributesSection } from "@/components/ItemDetail/ItemAttributesSection"
import { ItemDetailPageRail } from "@/components/ItemDetail/page/ItemDetailPageRail"
import { ItemDetailPageTaskInfo } from "@/components/ItemDetail/page/ItemDetailPageTaskInfo"
import { ReminderScheduleFields } from "@/components/ItemDetail/ReminderScheduleFields"
import type { ItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { PersonDetail } from "@/components/People/person-detail"
import { PersonPipelinesEditor } from "@/components/People/person-pipelines"
import { TabsContent } from "@/components/ui/tabs"
import { COMPUTER_PROJECT_DESK_ATTRS, COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import { armHabitSettingsReturn, sourceHabitIdOf } from "@/lib/habit-list-item"
import type { DetailViewResolution } from "@/lib/item-types"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import { PERSON_ATTR } from "@/lib/person-types"
import { isReminderTask } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import { asListReference } from "@/lib/text-list-to-list"
import type { AttributeDefinition, AttributeValue, ItemType, ItemTypeDefinition, Task } from "@/lib/types"

type TypePick = { itemId: string | undefined; typeId: string | null }

export function ItemDetailPageDetails({
  task,
  isEditing,
  isTask,
  lists,
  touchDraft,
  setTask,
  getDraft,
  commitDraft,
  originalTask,
  setOriginalTask,
  updateTask,
  activeTypeId,
  viewAsTypeId,
  detailView,
  openItem,
  handleNavigateToList,
  onBack,
  guardAction,
  itemTypesAssigned,
  primaryTypeId,
  setTypePick,
  setEditingItemType,
  removeFromCategory,
  setLists,
  addTag,
  removeTag,
  addLink,
  removeLink,
  allTasks,
  requestClose,
}: {
  task: Task
  isEditing: boolean
  isTask: boolean
  lists: ItemDetailDraft["lists"]
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  getDraft: () => Task | null
  commitDraft: (next: Task) => Task
  originalTask: Task | null
  setOriginalTask: (task: Task | null) => void
  updateTask: (task: Task) => void
  activeTypeId: string
  viewAsTypeId: string | undefined
  detailView: DetailViewResolution
  openItem: (id: string) => void
  handleNavigateToList: (listId: string) => void
  onBack: () => void
  guardAction: (action: () => void) => void
  itemTypesAssigned: ItemTypeDefinition[]
  primaryTypeId: ItemType
  setTypePick: Dispatch<SetStateAction<TypePick>>
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
  removeFromCategory: ItemDetailDraft["removeFromCategory"]
  setLists: ItemDetailDraft["setLists"]
  addTag: ItemDetailDraft["addTag"]
  removeTag: ItemDetailDraft["removeTag"]
  addLink: ItemDetailDraft["addLink"]
  removeLink: ItemDetailDraft["removeLink"]
  allTasks: Task[]
  requestClose: () => void
}) {
  const updateList = useTaskStore((state) => state.updateList)
  const sourceHabitId = sourceHabitIdOf(task?.attributes)

  // Create a new attribute from the detail view. Targeting a list persists the
  // definition onto that list's schema immediately; the value lands on the draft
  // and persists with Save Changes.
  const handleCreateAttribute = useCallback(
    (def: AttributeDefinition, value: AttributeValue, listId: string | null) => {
      if (!task) return
      if (listId) {
        const cat = lists.find((c) => c.id === listId)
        if (cat) {
          updateList({ ...cat, itemAttributes: [...(cat.itemAttributes ?? []), def] })
        }
        setTask({ ...task, attributes: { ...(task.attributes || {}), [def.id]: value } })
        return
      }
      setTask({
        ...task,
        itemAttributeDefinitions: [...(task.itemAttributeDefinitions ?? []), def],
        attributes: { ...(task.attributes || {}), [def.id]: value },
      })
    },
    [task, lists, updateList, setTask],
  )

  const commitReminder = useCallback(
    (patch: Pick<Task, "scheduledDate" | "scheduledTime" | "reminder">) => {
      touchDraft(patch)
      setTask((prev) => (prev ? { ...prev, ...patch } : prev))
      const next = getDraft()
      if (!next) return
      commitDraft(next)
    },
    [touchDraft, setTask, getDraft, commitDraft],
  )

  const bindTextList = useCallback(
    (attributeId: string, listId: string) => {
      const id = task?.id
      if (!id) return
      const current = getDraft()
      if (!current || current.id !== id) return
      const converted = asListReference(current, attributeId, listId)
      const owns = current.itemAttributeDefinitions?.some((def) => def.id === attributeId) ?? false
      const stamp = (base: Task): Task => ({
        ...base,
        attributes: owns ? { ...(base.attributes ?? {}), [attributeId]: listId } : base.attributes,
        itemAttributeDefinitions: owns ? converted.itemAttributeDefinitions : base.itemAttributeDefinitions,
        textListIds: converted.textListIds,
      })
      const stored = useTaskStore.getState().tasks.find((row) => row.id === id)
      if (stored) updateTask(stamp(stored))
      setOriginalTask(originalTask?.id === id ? stamp(originalTask) : stored ? stamp(stored) : converted)
      setTask(converted)
    },
    [task?.id, originalTask, getDraft, updateTask, setOriginalTask, setTask],
  )

  const commitNotes = useCallback(
    (notes: string) => {
      touchDraft({ notes })
      setTask((prev) => (prev ? { ...prev, notes } : prev))
      if (isEditing) return
      const base = getDraft()
      if (!base) return
      commitDraft({ ...base, notes })
    },
    [touchDraft, setTask, isEditing, getDraft, commitDraft],
  )

  const openHabitSettings = useCallback(() => {
    if (!sourceHabitId) return
    guardAction(() => {
      armHabitSettingsReturn(sourceHabitId)
      onBack()
    })
  }, [sourceHabitId, guardAction, onBack])

  return (
    <TabsContent value="details" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={sourceHabitId ? "id-detail-main lg:col-span-2" : "lg:col-span-2 space-y-6"}>
          {task && isReminderTask(task, lists) ? (
            <ReminderScheduleFields
              task={task}
              onChange={(patch) => commitReminder(patch)}
            />
          ) : null}
          {task && itemShowsPersonPipelines(task, lists) ? (
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
          {sourceHabitId ? (
            <HabitLinkedDetail
              habitId={sourceHabitId}
              notes={task.notes || ""}
              onNotesLive={(notes) => touchDraft({ notes })}
              onNotesCommit={commitNotes}
              onHabitSettings={openHabitSettings}
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
          {isTask && (
            <ItemDetailPageTaskInfo
              task={task}
              isEditing={isEditing}
              touchDraft={touchDraft}
              setTask={setTask}
            />
          )}
        </div>

        <ItemDetailPageRail
          isTask={isTask}
          task={task}
          itemTypesAssigned={itemTypesAssigned}
          primaryTypeId={primaryTypeId}
          setTypePick={setTypePick}
          setEditingItemType={setEditingItemType}
          lists={lists}
          isEditing={isEditing}
          handleNavigateToList={handleNavigateToList}
          removeFromCategory={removeFromCategory}
          setLists={setLists}
          addTag={addTag}
          removeTag={removeTag}
          addLink={addLink}
          removeLink={removeLink}
          touchDraft={touchDraft}
          setTask={setTask}
          openItem={openItem}
          allTasks={allTasks}
          requestClose={requestClose}
        />
      </div>
    </TabsContent>
  )
}
