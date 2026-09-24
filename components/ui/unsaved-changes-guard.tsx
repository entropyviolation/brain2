/**
 * components/ui/unsaved-changes-guard.tsx — House unsaved-changes confirm
 *
 * If a popup has unsaved edits, cancel / close / × / overlay must prompt:
 * Save changes, Cancel (stay), Exit without saving. Clean editors close
 * immediately. Pair with `lib/unsaved-changes.ts` snapshot compare.
 */
"use client"

import { useCallback, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import "./unsaved-changes.css"

export type UnsavedGuardOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDirty: boolean
  onSave?: () => void | boolean | Promise<void | boolean>
  onDiscard?: () => void
}

export type UnsavedPromptProps = {
  open: boolean
  onSave: () => void
  onStay: () => void
  onDiscard: () => void
  canSave?: boolean
}

export function unsavedDismissProps(requestClose: () => void) {
  return {
    onPointerDownOutside: (event: Event) => {
      event.preventDefault()
      requestClose()
    },
    onInteractOutside: (event: Event) => {
      event.preventDefault()
      requestClose()
    },
    onEscapeKeyDown: (event: KeyboardEvent) => {
      event.preventDefault()
      requestClose()
    },
  }
}

export function useUnsavedGuard({
  open,
  onOpenChange,
  isDirty,
  onSave,
  onDiscard,
}: UnsavedGuardOptions) {
  const [promptOpen, setPromptOpen] = useState(false)

  const forceClose = useCallback(() => {
    setPromptOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const requestClose = useCallback(() => {
    if (!open) return
    if (!isDirty) {
      forceClose()
      return
    }
    setPromptOpen(true)
  }, [open, isDirty, forceClose])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true)
        return
      }
      requestClose()
    },
    [onOpenChange, requestClose],
  )

  const stay = useCallback(() => {
    setPromptOpen(false)
  }, [])

  const saveAndClose = useCallback(async () => {
    if (onSave) {
      const result = await onSave()
      if (result === false) return
    }
    forceClose()
  }, [onSave, forceClose])

  const discardAndClose = useCallback(() => {
    onDiscard?.()
    forceClose()
  }, [onDiscard, forceClose])

  const prompt: UnsavedPromptProps = {
    open: promptOpen,
    onSave: () => {
      void saveAndClose()
    },
    onStay: stay,
    onDiscard: discardAndClose,
    canSave: Boolean(onSave),
  }

  return {
    handleOpenChange,
    requestClose,
    forceClose,
    promptOpen,
    prompt,
  }
}

export function UnsavedChangesDialog({ open, onSave, onStay, onDiscard, canSave = true }: UnsavedPromptProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onStay() }}>
      <DialogContent
        className="w95-confirm"
        hideClose
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          onStay()
        }}
      >
        <DialogHeader className="w95-confirm-caption">
          <DialogTitle>Unsaved changes</DialogTitle>
        </DialogHeader>
        <div className="w95-confirm-body">
          <DialogDescription>
            You have unsaved changes. Are you sure you want to close this window?
          </DialogDescription>
          <div className="w95-confirm-actions">
            {canSave ? (
              <button type="button" data-default="true" onClick={onSave}>
                Save changes
              </button>
            ) : null}
            <button type="button" onClick={onStay}>
              Cancel
            </button>
            <button type="button" onClick={onDiscard}>
              Exit without saving
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
