/**
 * components/ItemDetail/popup/PopupFascia.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The fascia: working-now strip, CRT title, window keys, type cards, and the save / complete / missed / card / delete row.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ItemType, ItemTypeCapabilities, ItemTypeDefinition, Task } from "@/lib/types"
import { CheckCircle, Save, Timer, TimerOff, Trash2, Undo2 } from "lucide-react"
import { FasciaOrb } from "@/components/ItemDetail/chrome/FasciaOrb"
import { InboxClarifyKey } from "@/components/ItemDetail/chrome/InboxClarifyKey"
import { ItemSaveFlag } from "@/components/ItemDetail/chrome/ItemSaveFlag"
import { ItemSettingsKey } from "@/components/ItemDetail/chrome/ItemSettingsKey"
import { ItemTypeViewCards } from "@/components/ItemDetail/type-views/ItemTypeViewCards"
import { WorkingNowBanner } from "@/components/ItemDetail/chrome/WorkingNowBanner"
import { KeycapClose } from "@/components/keycap-close"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { isClearedFromWork } from "@/lib/completion-status"
import { isStepItem } from "@/lib/step-items"
import { clearItemLayers } from "@/lib/step-item-stack"
import { openTaskCard } from "@/lib/task-card"

export function PopupFascia({
  task,
  writeDraft,
  touchDraft,
  setTask,
  settingsLock,
  setItemSettingsOpen,
  minimize,
  guard,
  assignedTypes,
  activeTypeId,
  primaryTypeId,
  setTypePick,
  setEditingItemType,
  getDraft,
  commitDraft,
  originalTask,
  subscribeDraft,
  handleSave,
  caps,
  handleReopen,
  handleComplete,
  handleMissed,
  cardTarget,
  stackAbove,
  handleDelete,
}: {
  task: Task
  writeDraft: (patch: Partial<Task>) => void
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  settingsLock: { current: boolean }
  setItemSettingsOpen: (open: boolean) => void
  minimize: () => void
  guard: { requestClose: () => void }
  assignedTypes: ItemTypeDefinition[]
  activeTypeId: string
  primaryTypeId: ItemType
  setTypePick: Dispatch<SetStateAction<{ itemId: string | undefined; typeId: string | null }>>
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
  getDraft: () => Task | null
  commitDraft: (next: Task, source?: string) => Task
  originalTask: Task | null
  subscribeDraft: (listener: () => void) => () => void
  handleSave: () => void
  caps: ItemTypeCapabilities
  handleReopen: () => void
  handleComplete: () => void
  handleMissed: () => void
  cardTarget: { taskId: string; stepId: string | undefined } | null
  stackAbove: boolean
  handleDelete: () => void
}) {
  return (
          <div className="id-fascia">
            <WorkingNowBanner itemId={task.id} />
            <div className="id-fascia-row">
              <div className="id-mark">
                <span className="id-power-lamp is-on" aria-hidden />
                <FasciaOrb id={task.id} icon={task.icon} onPick={(icon) => writeDraft({ icon })} />
                <IsolatedInput
                  value={task.description}
                  onLiveChange={(description) => touchDraft({ description, title: description })}
                  onCommit={(description) =>
                    setTask((prev) => (prev ? { ...prev, description, title: description } : prev))
                  }
                  className="id-title-input id-title"
                  placeholder="Item name"
                />
              </div>
              <div className="id-window-keys">
                <ItemSettingsKey
                  onClick={() => {
                    settingsLock.current = true
                    setItemSettingsOpen(true)
                  }}
                />
                <button type="button" className="id-window-key id-minimize-key" data-no95 aria-label="Minimize" title="Minimize" onClick={minimize}>
                  <span className="id-minimize-mark" aria-hidden />
                </button>
                <KeycapClose onClick={() => guard.requestClose()} />
              </div>
            </div>
            <div className="id-fascia-row id-meta">
              <ItemTypeViewCards
                types={assignedTypes}
                activeId={activeTypeId}
                primaryId={String(primaryTypeId)}
                onSelect={(typeId) => setTypePick({ itemId: task.id, typeId })}
                onEdit={setEditingItemType}
              />
              <Badge variant={task.completed ? "default" : "secondary"} className="id-chip">
                {task.completed ? "Completed" : task.stage}
              </Badge>
              <InboxClarifyKey task={task} getDraft={getDraft} commitDraft={commitDraft} />
              {task.actualDuration && (
                <Badge variant="outline" className="id-chip">
                  <Timer className="h-3 w-3" />
                  Took {task.actualDuration}m
                </Badge>
              )}
            </div>
            <div className="id-fascia-row">
              <div className="id-key-row" style={{ marginLeft: 0 }}>
                <div className="id-save-cluster">
                  <ItemSaveFlag originalTask={originalTask} getDraft={getDraft} subscribeDraft={subscribeDraft} />
                  <Button onClick={handleSave} className="id-btn id-btn-primary" title="Cmd/Ctrl+S">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
                {task.completed && caps.completable && !isStepItem(task) && (
                  <Button
                    variant="outline"
                    onClick={handleReopen}
                    className="id-btn id-btn-reopen"
                    title="Mark incomplete: undo Complete and keep everything else"
                  >
                    <Undo2 className="h-4 w-4" />
                    Mark incomplete
                  </Button>
                )}
                {!isClearedFromWork(task) && caps.completable && (
                  <Button
                    variant="outline"
                    onClick={handleComplete}
                    className="id-btn id-btn-primary"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </Button>
                )}
                {!isClearedFromWork(task) && caps.completable && !isStepItem(task) && (
                  <Button
                    variant="outline"
                    onClick={handleMissed}
                    className="id-btn id-btn-secondary"
                    title="Too late — file as a missed opportunity"
                  >
                    <TimerOff className="h-4 w-4" />
                    Missed
                  </Button>
                )}
                {cardTarget ? (
                  <Button
                    variant="outline"
                    className="id-btn id-btn-secondary"
                    title="Open the To Do task card"
                    onClick={() => {
                      if (stackAbove) clearItemLayers()
                      else guard.requestClose()
                      openTaskCard(cardTarget.taskId, cardTarget.stepId)
                    }}
                  >
                    Card
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="id-btn id-btn-danger id-btn-quiet"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
  )
}
