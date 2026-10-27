"use client"

/**
 * components/Home/Tracking/log-shelf-dialog.tsx — One Tracking log shelf, opened out.
 *
 * Spent keeps its own dialog (budget and import). Every other shelf uses this
 * page: the same rows, at a size you can read, still opened and removed the
 * same way.
 */
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function LogShelfDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trk95 trk-dialog trk-shelf-dialog sm:max-w-xl max-h-[85vh] overflow-y-auto"
        data-ui-name={`${title} detail`}
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="trk-shelf-body">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
