// Page-only details rail for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.

import type { Dispatch, SetStateAction } from "react"
import { ItemTagChip } from "@/components/ItemDetail/tags/ItemTagChip"
import { ItemTaskCardKey } from "@/components/ItemDetail/chrome/ItemTaskCardKey"
import { TagInput } from "@/components/ItemDetail/tags/TagInput"
import { RichLinksPanel } from "@/components/ItemDetail/tabs/links/RichLinksPanel"
import { ListPicker } from "@/components/Lists/list-picker"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { ItemDetailDraft } from "@/components/ItemDetail/draft/useItemDetailDraft"
import { safeDateFormat } from "@/lib/date-utils"
import type { ItemType, ItemTypeDefinition, Task } from "@/lib/types"
import { XCircle } from "lucide-react"

type TypePick = { itemId: string | undefined; typeId: string | null }

export function ItemDetailPageRail({
  isTask,
  task,
  itemTypesAssigned,
  primaryTypeId,
  setTypePick,
  setEditingItemType,
  lists,
  isEditing,
  handleNavigateToList,
  removeFromCategory,
  setLists,
  addTag,
  removeTag,
  addLink,
  removeLink,
  touchDraft,
  setTask,
  openItem,
  allTasks,
  requestClose,
}: {
  isTask: boolean
  task: Task
  itemTypesAssigned: ItemTypeDefinition[]
  primaryTypeId: ItemType
  setTypePick: Dispatch<SetStateAction<TypePick>>
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
  lists: ItemDetailDraft["lists"]
  isEditing: boolean
  handleNavigateToList: (listId: string) => void
  removeFromCategory: ItemDetailDraft["removeFromCategory"]
  setLists: ItemDetailDraft["setLists"]
  addTag: ItemDetailDraft["addTag"]
  removeTag: ItemDetailDraft["removeTag"]
  addLink: ItemDetailDraft["addLink"]
  removeLink: ItemDetailDraft["removeLink"]
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  openItem: (id: string) => void
  allTasks: Task[]
  requestClose: () => void
}) {
  return (
    <div className="space-y-6">
      {isTask && (
        <Card>
          <CardHeader>
            <CardTitle>Task card</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemTaskCardKey task={task} onBeforeOpen={requestClose} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {itemTypesAssigned.map((type) => (
              <Badge
                key={type.id}
                variant="secondary"
                className="flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: `${type.color ?? "#cbd5e1"}20`,
                  borderColor: type.color ?? "#cbd5e1",
                }}
                title={
                  itemTypesAssigned.length > 1
                    ? "Show this type's detail view. Double-click to edit the type."
                    : "Double-click to view or edit this type"
                }
                onClick={() => {
                  if (itemTypesAssigned.length > 1) setTypePick({ itemId: task.id, typeId: String(type.id) })
                }}
                onDoubleClick={() => setEditingItemType(type)}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: type.color ?? "#cbd5e1" }}
                />
                {type.name}
                {type.id === primaryTypeId && itemTypesAssigned.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">primary</span>
                )}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {task.lists?.map((categoryId) => {
              const category = lists.find((c) => c.id === categoryId)
              if (!category) return null

              return (
                <Badge
                  key={categoryId}
                  variant="secondary"
                  className="flex items-center gap-1 cursor-pointer"
                  style={{ backgroundColor: `${category.color}20`, borderColor: category.color }}
                  title="Double-click to open this list"
                  onDoubleClick={() => handleNavigateToList(categoryId)}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFromCategory(categoryId)
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="ml-1 hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              )
            })}
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>Add to List</Label>
              <ListPicker
                selected={task.lists ?? []}
                onChange={setLists}
                mode="multi"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <TagInput tags={task.tags ?? []} onAdd={addTag} onRemove={removeTag} />
          ) : (task.tags?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.tags!.map((tag) => (
                <ItemTagChip key={tag} name={tag} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RichLinksPanel
            task={task}
            editable={isEditing}
            addLink={addLink}
            removeLink={removeLink}
            writeDraft={(patch) => {
              touchDraft(patch)
              setTask((prev) => (prev ? { ...prev, ...patch } : prev))
            }}
            onOpenItem={openItem}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Created: {safeDateFormat(task.createdAt)}</div>
          <div>Status: {task.stage}</div>
          <div>Completed: {task.completed ? "Yes" : "No"}</div>
          {task.deadline && <div>Deadline: {safeDateFormat(task.deadline)}</div>}
          {task.parentTaskId && (
            <div>Parent Task: {allTasks.find((t) => t.id === task.parentTaskId)?.description}</div>
          )}
          {task.actualDuration && <div>Actual Duration: {task.actualDuration} minutes</div>}
        </CardContent>
      </Card>
    </div>
  )
}
