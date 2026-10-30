"use client"

/**
 * components/Home/Tracking/tracking-log/spending-dialog.tsx — Money, opened from the Spent shelf.
 *
 * The book itself is `money-book.tsx`, the same one the Money widget opens.
 * This day, the month, accounts, debts, bills, a budget, plans, gigs, and a
 * statement. Kind id and the Spent shelf stay; the label here is Money.
 */
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoneyBook } from "@/components/Home/Tracking/tracking-log/money-book"

export function SpendingDialog({
  open,
  onOpenChange,
  dayLabel,
  ledger,
  anchor = new Date(),
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayLabel: string
  /** The selected day's spend summary bars. Stays that day while the list widens. */
  ledger: ReactNode
  anchor?: Date
  /** Older callers passed spend rows. The book reads the tracking log itself. */
  rows?: readonly unknown[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="trk95 trk-dialog trk-spending sm:max-w-3xl max-h-[85vh] overflow-y-auto"
        data-ui-name="Money"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head">
          <DialogTitle>Money</DialogTitle>
          <DialogDescription>{dayLabel}. Earnings, spending, debts, bills, and statements.</DialogDescription>
        </DialogHeader>
        <MoneyBook open={open} anchor={anchor} ledger={ledger} />
      </DialogContent>
    </Dialog>
  )
}
