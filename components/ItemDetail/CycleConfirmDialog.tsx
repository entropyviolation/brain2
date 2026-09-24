"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface CycleConfirmDialogProps {
  open: boolean
  cycleLabel: string
  onDismiss: () => void
}

/** Win95 confirm: explain the loop; the dependency is already refused. */
export function CycleConfirmDialog({ open, cycleLabel, onDismiss }: CycleConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss() }}>
      <DialogContent className="fm98-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This would loop</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>Adding that dependency would close a cycle. The graph cannot run until the loop is broken.</p>
              <p className="item-cycle-path" aria-label="Dependency cycle">
                {cycleLabel}
              </p>
              <p>The dependency was not added.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={onDismiss}>OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
