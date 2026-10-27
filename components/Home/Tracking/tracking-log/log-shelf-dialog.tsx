"use client"

/**
 * components/Home/Tracking/tracking-log/log-shelf-dialog.tsx — One Tracking log shelf, opened out.
 *
 * Spent keeps its own dialog (budget and import). Every other shelf uses this
 * page: the same rows, at a size you can read, still opened and removed the
 * same way. A log shelf can widen the day with Today / This week / This month /
 * All / Custom. That range lasts for this open and returns to Today on close.
 * Counts and Telegram pass children and do not show the range.
 */
import { useEffect, useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  entriesForLogShelf,
  logShelfDateBounds,
  type LogBookEntry,
  type LogShelfRange,
} from "@/components/Home/Tracking/tracking-log-model"

const RANGES: { id: LogShelfRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
]

export function LogShelfRangeBar({
  range,
  onRange,
  from,
  to,
  onFrom,
  onTo,
  anchor,
}: {
  range: LogShelfRange
  onRange: (range: LogShelfRange) => void
  from: string
  to: string
  onFrom: (value: string) => void
  onTo: (value: string) => void
  anchor: Date
}) {
  return (
    <div className="trk-shelf-range">
      <div className="trk-span-switch" role="toolbar" aria-label="Shelf dates">
        {RANGES.map((row) => (
          <button
            key={row.id}
            type="button"
            aria-pressed={range === row.id}
            onClick={() => {
              if (row.id === "custom" && !from) {
                const key = formatLocalDateKey(anchor)
                onFrom(key)
                onTo(to || key)
              }
              onRange(row.id)
            }}
          >
            {row.label}
          </button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="trk-shelf-custom">
          <label>
            From
            <input type="date" aria-label="From" value={from} onChange={(event) => onFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" aria-label="To" value={to} onChange={(event) => onTo(event.target.value)} />
          </label>
        </div>
      ) : null}
    </div>
  )
}

export function useLogShelfRange(open: boolean, anchor: Date) {
  const [range, setRange] = useState<LogShelfRange>("today")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  useEffect(() => {
    if (open) return
    setRange("today")
    setFrom("")
    setTo("")
  }, [open])
  const bounds = logShelfDateBounds(range, anchor, { from, to })
  return { range, setRange, from, setFrom, to, setTo, bounds, showDate: range !== "today" }
}

export function LogShelfDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  anchor,
  entries,
  renderEntry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  /** When set with `entries`, the dialog filters those rows. Otherwise `children` is the page. */
  anchor?: Date
  entries?: readonly LogBookEntry[]
  renderEntry?: (entry: LogBookEntry, showDate: boolean) => ReactNode
}) {
  const ranged = Boolean(anchor && entries && renderEntry)
  const shelf = useLogShelfRange(open && ranged, anchor ?? new Date())
  const shown = ranged ? entriesForLogShelf(entries ?? [], shelf.bounds) : []

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
        {ranged && anchor ? (
          <LogShelfRangeBar
            range={shelf.range}
            onRange={shelf.setRange}
            from={shelf.from}
            to={shelf.to}
            onFrom={shelf.setFrom}
            onTo={shelf.setTo}
            anchor={anchor}
          />
        ) : null}
        <div className="trk-shelf-body">
          {ranged ? (
            shown.length === 0 ? (
              shelf.showDate ? <p className="trk-shelf-empty">Nothing logged in this range.</p> : children
            ) : (
              <div className="trk-log">
                {shown.map((entry) => renderEntry!(entry, shelf.showDate))}
              </div>
            )
          ) : (
            children
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
