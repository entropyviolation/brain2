// Page-only Time, Body, Notes, Resources, and History tabs. Not for ItemDetailPopup, the To do drawer, or the task card.

import type { Dispatch, SetStateAction } from "react"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ItemActivityPanel } from "@/components/ItemDetail/ItemActivityPanel"
import { ItemNotesLog } from "@/components/ItemDetail/ItemNotesLog"
import { ItemPenTimeSection } from "@/components/ItemDetail/ItemPenTime"
import { ItemResourcesPanel } from "@/components/ItemDetail/ItemResourcesPanel"
import { PersonNotes } from "@/components/People/person-notes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TabsContent } from "@/components/ui/tabs"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"
import type { ItemDetailPanel, Task } from "@/lib/types"
import type { ItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"

export function ItemDetailPageLedgerTabs({
  visiblePanels,
  task,
  isTask,
  isEditing,
  patchItem,
  touchDraft,
  setTask,
  lists,
  getDraft,
}: {
  visiblePanels: ItemDetailPanel[]
  task: Task
  isTask: boolean
  isEditing: boolean
  patchItem: (patch: Partial<Task>) => void
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  lists: ItemDetailDraft["lists"]
  getDraft: () => Task | null
}) {
  return (
    <>
      {visiblePanels.includes("time") && (
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <ItemPenTimeSection
                task={task}
                editableTime={isTask}
                readOnly={!isEditing}
                onPatch={patchItem}
                onPenLinksChange={(penLinks) => {
                  touchDraft({ penLinks })
                  setTask((prev) => (prev ? { ...prev, penLinks } : prev))
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {visiblePanels.includes("body") && (
        <TabsContent value="body" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Body</CardTitle>
            </CardHeader>
            <CardContent>
              <BodyPanel taskId={task.id} />
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {visiblePanels.includes("notes") && (
        <TabsContent value="notes">
          {itemShowsPersonPipelines(task, lists) ? (
            <PersonNotes
              person={task}
              onChange={(patch) => {
                touchDraft(patch)
                setTask((prev) => (prev ? { ...prev, ...patch } : prev))
              }}
              onLive={touchDraft}
              readDraft={getDraft}
            />
          ) : (
            <ItemNotesLog
              entries={task.noteLog}
              standing={task.notes}
              onChangeEntries={(noteLog) => {
                touchDraft({ noteLog })
                setTask((prev) => (prev ? { ...prev, noteLog } : prev))
              }}
              onLiveStanding={(notes) => touchDraft({ notes })}
              onChangeStanding={(notes) => setTask((prev) => (prev ? { ...prev, notes } : prev))}
            />
          )}
        </TabsContent>
      )}

      {visiblePanels.includes("resources") && (
        <TabsContent value="resources">
          <ItemResourcesPanel
            resources={task.resources}
            onChange={(resources) => {
              touchDraft({ resources })
              setTask((prev) => (prev ? { ...prev, resources } : prev))
            }}
          />
        </TabsContent>
      )}

      <TabsContent value="history" className="space-y-6">
        <ItemActivityPanel itemId={task.id} />
      </TabsContent>
    </>
  )
}
