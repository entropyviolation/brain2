/**
 * components/ItemDetail/popup/PopupRecordTabs.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * Notes, Resources, Links, Body, and History. The shell places each one where that tab already sat.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ItemDetailPanel, List, Task } from "@/lib/types"
import { FileText } from "lucide-react"
import { BodyPanel } from "@/components/ItemDetail/BodyPanel"
import { ItemActivityPanel } from "@/components/ItemDetail/ItemActivityPanel"
import { ItemNotesLog } from "@/components/ItemDetail/ItemNotesLog"
import { ItemResourcesPanel } from "@/components/ItemDetail/ItemResourcesPanel"
import { RichLinksPanel } from "@/components/ItemDetail/links/RichLinksPanel"
import { PersonNotes } from "@/components/People/person-notes"
import { TabsContent } from "@/components/ui/tabs"
import { itemShowsPersonPipelines } from "@/lib/people-i-know"

export function PopupNotesTab({
  visiblePanels,
  task,
  lists,
  touchDraft,
  setTask,
  getDraft,
  writeDraft,
}: {
  visiblePanels: ItemDetailPanel[]
  task: Task
  lists: List[]
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  getDraft: () => Task | null
  writeDraft: (patch: Partial<Task>) => void
}) {
  return (
    <>
                {visiblePanels.includes("notes") && (
                <TabsContent value="notes" className="mt-0">
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
                      onChangeEntries={(noteLog) => writeDraft({ noteLog })}
                      onLiveStanding={(notes) => touchDraft({ notes })}
                      onChangeStanding={(notes) => setTask((prev) => (prev ? { ...prev, notes } : prev))}
                    />
                  )}
                </TabsContent>
                )}
    </>
  )
}

export function PopupResourcesTab({
  visiblePanels,
  task,
  writeDraft,
}: {
  visiblePanels: ItemDetailPanel[]
  task: Task
  writeDraft: (patch: Partial<Task>) => void
}) {
  return (
    <>
                {visiblePanels.includes("resources") && (
                <TabsContent value="resources" className="mt-0">
                  <ItemResourcesPanel resources={task.resources} onChange={(resources) => writeDraft({ resources })} />
                </TabsContent>
                )}
    </>
  )
}

export function PopupLinksTab({
  task,
  addLink,
  removeLink,
  writeDraft,
  openItem,
}: {
  task: Task
  addLink: (relation: string, targetId: string) => void
  removeLink: (linkId: string) => void
  writeDraft: (patch: Partial<Task>) => void
  openItem: (id: string) => void
}) {
  return (
                <TabsContent value="links" className="space-y-4 mt-0">
                  <div className="id-bay">
                    <RichLinksPanel
                      task={task}
                      addLink={addLink}
                      removeLink={removeLink}
                      writeDraft={writeDraft}
                      onOpenItem={openItem}
                    />
                  </div>
                </TabsContent>
  )
}

export function PopupBodyTab({
  visiblePanels,
  task,
}: {
  visiblePanels: ItemDetailPanel[]
  task: Task
}) {
  return (
    <>
                {visiblePanels.includes("body") && (
                <TabsContent value="body" className="space-y-6 mt-0">
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Body
                    </h3>
                    <BodyPanel taskId={task.id} />
                  </div>
                </TabsContent>
                )}
    </>
  )
}

export function PopupHistoryTab({ task }: { task: Task }) {
  return (
                <TabsContent value="history" className="space-y-6 mt-0">
                  <ItemActivityPanel itemId={task.id} />
                </TabsContent>
  )
}
