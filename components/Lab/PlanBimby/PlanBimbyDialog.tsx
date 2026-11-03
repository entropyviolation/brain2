/**
 * components/Lab/PlanBimby/PlanBimbyDialog.tsx — The Plan BIMBY in a popup, for the Home Plan toolbar
 *
 * The panel loads the first time the popup opens, so a closed door costs nothing on first paint.
 */
"use client"

import { lazy, Suspense } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const Panel = lazy(() => import("./PlanBimbyPanel").then((mod) => ({ default: mod.PlanBimbyPanel })))

export function PlanBimbyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-white p-0 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <DialogTitle className="sr-only">Plan BIMBY</DialogTitle>
        {open && (
          <Suspense fallback={<p className="p-3 text-sm">Loading…</p>}>
            <Panel />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  )
}
