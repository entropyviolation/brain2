// Page-only fascia for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.

import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { FasciaOrb } from "@/components/ItemDetail/chrome/FasciaOrb"
import { InboxClarifyKey } from "@/components/ItemDetail/chrome/InboxClarifyKey"
import { ItemDoneBanner } from "@/components/ItemDetail/chrome/ItemDoneBanner"
import { ItemSaveFlag } from "@/components/ItemDetail/chrome/ItemSaveFlag"
import { ItemSettingsKey } from "@/components/ItemDetail/chrome/ItemSettingsKey"
import { ItemTypeViewCards } from "@/components/ItemDetail/type-views/ItemTypeViewCards"
import { WorkingNowBanner } from "@/components/ItemDetail/chrome/WorkingNowBanner"
import { CompletionDialog } from "@/components/Completion/CompletionDialog"
import { upgradeTaskToOperation } from "@/components/Operations"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { isClearedFromWork } from "@/lib/completion-status"
import { isOperation } from "@/lib/operations"
import type { ItemType, ItemTypeCapabilities, ItemTypeDefinition, Task } from "@/lib/types"
import {
  ArrowLeft,
  CheckCircle,
  MoreHorizontal,
  Rocket,
  Save,
  Timer,
  TimerOff,
  Trash,
  Undo2,
} from "lucide-react"

type TypePick = { itemId: string | undefined; typeId: string | null }

export function ItemDetailPageFascia({
  task,
  isEditing,
  setIsEditing,
  touchDraft,
  setTask,
  originalTask,
  getDraft,
  subscribeDraft,
  requestClose,
  handleSave,
  handleReopen,
  caps,
  actualDurationRef,
  handleComplete,
  handleMissed,
  handleDelete,
  reviewOpen,
  setReviewOpen,
  itemTypesAssigned,
  activeTypeId,
  primaryTypeId,
  setTypePick,
  setEditingItemType,
  commitDraft,
  setItemSettingsOpen,
}: {
  task: Task
  isEditing: boolean
  setIsEditing: Dispatch<SetStateAction<boolean>>
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  originalTask: Task | null
  getDraft: () => Task | null
  subscribeDraft: (listener: () => void) => () => void
  requestClose: () => void
  handleSave: () => void
  handleReopen: () => void
  caps: ItemTypeCapabilities
  actualDurationRef: MutableRefObject<string>
  handleComplete: () => void
  handleMissed: () => void
  handleDelete: () => void
  reviewOpen: boolean
  setReviewOpen: Dispatch<SetStateAction<boolean>>
  itemTypesAssigned: ItemTypeDefinition[]
  activeTypeId: string
  primaryTypeId: ItemType
  setTypePick: Dispatch<SetStateAction<TypePick>>
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
  commitDraft: (next: Task) => Task
  setItemSettingsOpen: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <div className="id-fascia">
      <WorkingNowBanner itemId={task.id} />
      <div className="id-fascia-row">
        <Button variant="outline" size="icon" className="id-btn id-btn-icon" aria-label="Back" onClick={requestClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="id-mark">
          <span className="id-power-lamp is-on" aria-hidden />
          <FasciaOrb
            id={task.id}
            icon={task.icon}
            onPick={isEditing ? (icon) => setTask((prev) => (prev ? { ...prev, icon } : prev)) : undefined}
          />
          <h1 className="id-title">
            {isEditing ? (
              <IsolatedInput
                value={task.description}
                onLiveChange={(description) => touchDraft({ description, title: description })}
                onCommit={(description) =>
                  setTask((prev) => (prev ? { ...prev, description, title: description } : prev))
                }
                className="id-title-input"
                placeholder="Item name"
              />
            ) : (
              task.description
            )}
          </h1>
        </div>
        <div className="id-key-row">
          <div className="id-save-cluster">
            <ItemSaveFlag originalTask={originalTask} getDraft={getDraft} subscribeDraft={subscribeDraft} />
            {isEditing ? (
              <>
                <Button variant="outline" className="id-btn id-btn-secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button className="id-btn id-btn-primary" onClick={handleSave} title="Cmd/Ctrl+S">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </>
            ) : (
              <Button className="id-btn id-btn-primary" onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
          {task.completed && caps.completable && (
            <Button variant="outline" className="id-btn id-btn-reopen" onClick={handleReopen} title="Mark incomplete: undo Complete and keep everything else">
              <Undo2 className="h-4 w-4" />
              Mark incomplete
            </Button>
          )}
          {!isClearedFromWork(task) && caps.completable && (
            <>
              {caps.duration && (
              <IsolatedInput
                type="number"
                placeholder="Actual minutes"
                value=""
                onLiveChange={(v) => {
                  actualDurationRef.current = v
                }}
                onCommit={(v) => {
                  actualDurationRef.current = v
                }}
                className="id-duration"
              />
              )}
              <Button variant="outline" className="id-btn id-btn-primary" onClick={handleComplete}>
                <CheckCircle className="h-4 w-4" />
                Complete
              </Button>
              <Button
                variant="outline"
                className="id-btn id-btn-secondary"
                onClick={handleMissed}
                title="Too late — file as a missed opportunity"
              >
                <TimerOff className="h-4 w-4" />
                Missed
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            className="id-btn id-btn-danger id-btn-quiet"
          >
            <Trash className="h-4 w-4" />
            Delete
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="id-btn id-btn-icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={isOperation(task)}
                onClick={() => upgradeTaskToOperation(task.id)}
              >
                <Rocket className="h-4 w-4 mr-2" />
                {isOperation(task) ? "Already an Operation" : "Upgrade to Operation"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ItemDoneBanner task={task} onReopen={handleReopen} onEditReview={() => setReviewOpen(true)} />
        {reviewOpen ? <CompletionDialog taskId={task.id} basePoints={0} edit onClose={() => setReviewOpen(false)} /> : null}
      <div className="id-fascia-row id-meta">
        {itemTypesAssigned.length > 1 ? (
          <ItemTypeViewCards
            types={itemTypesAssigned}
            activeId={activeTypeId}
            primaryId={String(primaryTypeId)}
            onSelect={(typeId) => setTypePick({ itemId: task.id, typeId })}
            onEdit={setEditingItemType}
          />
        ) : null}
        <Badge variant={task.completed ? "default" : "secondary"} className="id-chip">
          {task.completed ? "Completed" : task.stage}
        </Badge>
        <InboxClarifyKey task={task} getDraft={getDraft} commitDraft={commitDraft} />
        <ItemSettingsKey onClick={() => setItemSettingsOpen(true)} />
        {task.actualDuration && (
          <Badge variant="outline" className="id-chip">
            <Timer className="h-3 w-3" />
            Took {task.actualDuration}m
          </Badge>
        )}
      </div>
    </div>
  )
}
