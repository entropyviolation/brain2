// Page-only dialogs for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { AttributeSettingsDialog } from "@/components/ItemDetail/AttributeSettingsDialog"
import { CycleConfirmDialog } from "@/components/ItemDetail/CycleConfirmDialog"
import { ItemSettingsPanel } from "@/components/ItemDetail/ItemSettingsPanel"
import type { ItemDetailDraft } from "@/components/ItemDetail/useItemDetailDraft"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { markMissedOpportunity } from "@/lib/services/completion-service"
import type { ItemTypeDefinition, Task } from "@/lib/types"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"

export function ItemDetailPageDialogs({
  itemSettingsOpen,
  setItemSettingsOpen,
  task,
  lists,
  isTask,
  patchItem,
  cycleLabel,
  setCycleLabel,
  editingItemType,
  setEditingItemType,
  itemTypes,
  onSaveItemType,
  onDeleteItemType,
  openItem,
  missAsk,
  setMissAsk,
}: {
  itemSettingsOpen: boolean
  setItemSettingsOpen: Dispatch<SetStateAction<boolean>>
  task: Task
  lists: ItemDetailDraft["lists"]
  isTask: boolean
  patchItem: (patch: Partial<Task>) => void
  cycleLabel: string | null
  setCycleLabel: Dispatch<SetStateAction<string | null>>
  editingItemType: ItemTypeDefinition | null
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
  itemTypes: ItemTypeDefinition[]
  onSaveItemType: (def: ItemTypeDefinition) => void
  onDeleteItemType: (() => void) | undefined
  openItem: (id: string) => void
  missAsk: boolean
  setMissAsk: Dispatch<SetStateAction<boolean>>
}) {
  const settingsHost = useRef<HTMLDivElement>(null)
  const attributeLock = useRef(false)
  const [attributeSettingsId, setAttributeSettingsId] = useState<string | null>(null)

  return (
    <>
    <Dialog
      open={itemSettingsOpen}
      onOpenChange={(next) => {
        if (!next && attributeLock.current) return
        setItemSettingsOpen(next)
      }}
    >
      <DialogContent
        ref={settingsHost}
        className="id95-dialog id95 z-[90] sm:max-w-xl max-h-[85vh] overflow-hidden !flex flex-col"
        overlayClassName="z-[90]"
        data-ui-name="Item settings"
        onPointerDownOutside={(event) => {
          const target = event.target as Element | null
          if (target?.closest?.("[data-ui-name='Attribute settings']")) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          const target = event.target as Element | null
          if (target?.closest?.("[data-ui-name='Attribute settings']")) event.preventDefault()
        }}
      >
        <div className="id-settings-host">
          <ItemSettingsPanel
            task={task}
            lists={lists}
            isTask={isTask}
            showLinks={false}
            onPatch={patchItem}
            onOpenAttribute={(id) => {
              attributeLock.current = true
              setAttributeSettingsId(id)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
    <AttributeSettingsDialog
      attributeId={attributeSettingsId}
      open={attributeSettingsId != null}
      container={settingsHost.current}
      onOpenChange={(next) => {
        if (!next) {
          attributeLock.current = false
          setAttributeSettingsId(null)
        }
      }}
      draftTask={task}
      onPatchDraft={patchItem}
    />
    <CycleConfirmDialog
      open={!!cycleLabel}
      cycleLabel={cycleLabel ?? ""}
      onDismiss={() => setCycleLabel(null)}
    />

    <ItemTypeEditor
      open={!!editingItemType}
      onOpenChange={(open) => {
        if (!open) setEditingItemType(null)
      }}
      type={editingItemType}
      existingIds={itemTypes.map((t) => t.id as string)}
      allTypes={itemTypes}
      onSave={onSaveItemType}
      onNavigateType={(t) => setEditingItemType(t)}
      onDelete={onDeleteItemType}
      onOpenItem={(id) => {
        setEditingItemType(null)
        openItem(id)
      }}
    />
    <MissReasonDialog
      open={missAsk}
      subject={itemTitleOrUntitled(task)}
      onResolve={(reason) => {
        setMissAsk(false)
        if (task) markMissedOpportunity(task.id, undefined, reason)
      }}
    />
    </>
  )
}
