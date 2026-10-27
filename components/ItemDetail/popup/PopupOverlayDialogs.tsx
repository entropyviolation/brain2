/**
 * components/ItemDetail/popup/PopupOverlayDialogs.tsx
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * The dialogs stacked on the item: settings, attribute settings, unsaved changes, cycle, type editor, and missed. Render only. Locks and refs stay in the shell.
 */
"use client"

import type { RefObject } from "react"
import type { ItemTypeDefinition, List, Task } from "@/lib/types"
import { AttributeSettingsDialog } from "@/components/ItemDetail/AttributeSettingsDialog"
import { CycleConfirmDialog } from "@/components/ItemDetail/CycleConfirmDialog"
import { ItemSettingsPanel } from "@/components/ItemDetail/ItemSettingsPanel"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { UnsavedChangesDialog, type UnsavedPromptProps } from "@/components/ui/unsaved-changes-guard"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { markMissedOpportunity } from "@/lib/services/completion-service"

export function PopupOverlayDialogs({
  itemSettingsOpen,
  attributeLock,
  settingsLock,
  setItemSettingsOpen,
  settingsHost,
  detailRef,
  task,
  lists,
  isTask,
  patchItem,
  setAttributeSettingsId,
  attributeSettingsId,
  guard,
  cycleLabel,
  setCycleLabel,
  editingItemType,
  setEditingItemType,
  itemTypes,
  handleSaveItemType,
  deleteItemType,
  openItem,
  missAsk,
  setMissAsk,
  onClose,
}: {
  itemSettingsOpen: boolean
  attributeLock: { current: boolean }
  settingsLock: { current: boolean }
  setItemSettingsOpen: (open: boolean) => void
  settingsHost: RefObject<HTMLDivElement | null>
  detailRef: RefObject<HTMLDivElement | null>
  task: Task
  lists: List[]
  isTask: boolean
  patchItem: (patch: Partial<Task>) => void
  setAttributeSettingsId: (id: string | null) => void
  attributeSettingsId: string | null
  guard: { prompt: UnsavedPromptProps }
  cycleLabel: string | null
  setCycleLabel: (label: string | null) => void
  editingItemType: ItemTypeDefinition | null
  setEditingItemType: (type: ItemTypeDefinition | null) => void
  itemTypes: ItemTypeDefinition[]
  handleSaveItemType: (def: ItemTypeDefinition) => void
  deleteItemType: (id: string) => void
  openItem: (id: string) => void
  missAsk: boolean
  setMissAsk: (ask: boolean) => void
  onClose: () => void
}) {
  return (
    <>
      <Dialog
        open={itemSettingsOpen}
        onOpenChange={(next) => {
          if (!next && attributeLock.current) return
          settingsLock.current = next
          setItemSettingsOpen(next)
        }}
      >
        <DialogContent
          ref={settingsHost}
          container={detailRef.current}
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
              showLinks
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
        container={settingsHost.current ?? detailRef.current}
        onOpenChange={(next) => {
          if (!next) {
            attributeLock.current = false
            setAttributeSettingsId(null)
          }
        }}
        draftTask={task}
        onPatchDraft={patchItem}
      />
      <UnsavedChangesDialog {...guard.prompt} />

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
        onSave={handleSaveItemType}
        onNavigateType={(t) => setEditingItemType(t)}
        onDelete={
          editingItemType && !editingItemType.builtin
            ? () => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(`Delete the "${editingItemType.name}" item type? Items keep their data.`)
                ) {
                  return
                }
                deleteItemType(editingItemType.id as string)
                setEditingItemType(null)
              }
            : undefined
        }
        onOpenItem={(id) => {
          setEditingItemType(null)
          openItem(id)
        }}
      />
      <MissReasonDialog
        open={missAsk}
        subject={task ? itemTitleOrUntitled(task) : ""}
        onResolve={(reason) => {
          setMissAsk(false)
          if (task) markMissedOpportunity(task.id, undefined, reason)
          onClose()
        }}
      />
    </>
  )
}
