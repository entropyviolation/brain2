/**
 * components/ui/unsaved-changes-guard.tsx — House unsaved-changes confirm
 *
 * If a popup has unsaved edits, cancel / close / × / overlay must prompt:
 * Save changes, Cancel (stay), Exit without saving. Clean editors close
 * immediately. Pair with `lib/unsaved-changes.ts` snapshot compare.
 * `guardAction(fn)` covers every other way out (open another item, go to a
 * list): clean runs `fn` now; dirty asks first, then runs `fn` after Save or
 * Exit without saving. `isDirty` may be a function so the check reads the
 * live draft at call time instead of a render-time boolean.
 * Look: milled fascia (`.w95-confirm` in unsaved-changes.css) — CRT title,
 * brushed bay, metal keys. docs/DESIGN_STYLE.md#milled-fascia
 */
"use client"

import { useCallback, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import "./unsaved-changes.css"

export type UnsavedGuardOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A boolean, or a function read at the moment someone tries to leave. */
  isDirty: boolean | (() => boolean)
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
  const pendingRef = useRef<(() => void) | null>(null)
  // Opening the prompt moves focus out of the host dialog, which fires its
  // interact-outside → requestClose. Keep the first pending action.
  const promptOpenRef = useRef(false)
  const showPrompt = useCallback((next: boolean) => {
    promptOpenRef.current = next
    setPromptOpen(next)
  }, [])

  const readDirty = useCallback(
    () => (typeof isDirty === "function" ? isDirty() : isDirty),
    [isDirty],
  )

  const forceClose = useCallback(() => {
    pendingRef.current = null
    showPrompt(false)
    onOpenChange(false)
  }, [onOpenChange, showPrompt])

  const guardAction = useCallback(
    (action: () => void) => {
      if (promptOpenRef.current) return
      if (!readDirty()) {
        pendingRef.current = null
        action()
        return
      }
      pendingRef.current = action
      showPrompt(true)
    },
    [readDirty, showPrompt],
  )

  const requestClose = useCallback(() => {
    if (!open) return
    guardAction(forceClose)
  }, [open, guardAction, forceClose])

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

  const runPending = useCallback(() => {
    const action = pendingRef.current ?? forceClose
    pendingRef.current = null
    showPrompt(false)
    action()
  }, [forceClose, showPrompt])

  const stay = useCallback(() => {
    pendingRef.current = null
    showPrompt(false)
  }, [showPrompt])

  const saveAndClose = useCallback(async () => {
    if (onSave) {
      const result = await onSave()
      if (result === false) return
    }
    runPending()
  }, [onSave, runPending])

  const discardAndClose = useCallback(() => {
    onDiscard?.()
    runPending()
  }, [onDiscard, runPending])

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
    guardAction,
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
        </div>
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
      </DialogContent>
    </Dialog>
  )
}
