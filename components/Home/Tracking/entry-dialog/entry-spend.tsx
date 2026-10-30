/**
 * components/Home/Tracking/entry-dialog/entry-spend.tsx — Amount, what, and source
 *
 * Replaces the display name on a spend block. The parent keeps that condition.
 * The datalist id stays `entry-spend-sources`. No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { spendSourceOptions } from "@/lib/spend"
import type { TimeEntry } from "@/lib/time-entries"

export function EntrySpend({
  amountText,
  spentOn,
  spentSource,
  spendError,
  allEntries,
  onAmount,
  onSpentOn,
  onSource,
}: {
  amountText: string
  spentOn: string
  spentSource: string
  spendError: string
  allEntries: TimeEntry[]
  onAmount: (value: string) => void
  onSpentOn: (value: string) => void
  onSource: (value: string) => void
}) {
  return (
    <div className="trk-section trk-spend-edit">
      <Label htmlFor="entry-spend-amount" className="trk-section-title">
        Amount
      </Label>
      <Input
        id="entry-spend-amount"
        aria-label="Amount"
        inputMode="decimal"
        value={amountText}
        onChange={(e) => onAmount(e.target.value)}
      />
      <Label htmlFor="entry-spend-on" className="trk-section-title">
        Spent on
      </Label>
      <Input
        id="entry-spend-on"
        aria-label="Spent on"
        value={spentOn}
        onChange={(e) => onSpentOn(e.target.value)}
      />
      <Label htmlFor="entry-spend-source" className="trk-section-title">
        Source
      </Label>
      <Input
        id="entry-spend-source"
        aria-label="Source"
        list="entry-spend-sources"
        value={spentSource}
        onChange={(e) => onSource(e.target.value)}
      />
      <datalist id="entry-spend-sources">
        {spendSourceOptions(allEntries).map((source) => (
          <option key={source} value={source} />
        ))}
      </datalist>
      <p className="trk-help">
        {spendError || "Dollars and cents. The source is where the money came from."}
      </p>
    </div>
  )
}
