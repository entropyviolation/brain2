/**
 * components/ItemDetail/ItemPenTime.tsx — Pens on an item, and the time they add up to
 *
 * Phase 5 of `docs/TODO_REDESIGN.md`. `ItemPenLinksField` edits `Task.penLinks`
 * (the same list **Remember for this task** writes; the first link is the clock
 * pen). `ItemTrackedTime` reads `trackedTimeForItem` (`lib/tracked-time.ts`):
 * the total, an est-vs-tracked bar, and the counted blocks. Both shells use it:
 * the popup's Time tab and the page's Scheduling tab. Edits go through the
 * shell's draft, like every other field.
 */
"use client"

import { useMemo, useState } from "react"
import { Link2, Plus, X } from "lucide-react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { findPen, trackedTimeForItem } from "@/lib/tracked-time"
import type { Task } from "@/lib/types"
import "./item-pen-time.css"

type PenLink = { scopeId: string; penId: string }

/** How many counted blocks the Time panel lists before "+ N more". */
export const ITEM_BLOCKS_SHOWN = 12

export function ItemPenLinksField({
  penLinks,
  onChange,
  readOnly = false,
}: {
  penLinks: PenLink[] | undefined
  onChange: (next: PenLink[] | undefined) => void
  readOnly?: boolean
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState("")
  const links = penLinks ?? []
  const linked = new Set(links.map((l) => l.penId))

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows: { scopeId: string; scopeName: string; penId: string; name: string; color: string; used: number }[] = []
    for (const scope of scopes) {
      for (const pen of scope.pens) {
        if (linked.has(pen.id)) continue
        if (needle && !pen.name.toLowerCase().includes(needle) && !scope.name.toLowerCase().includes(needle)) continue
        rows.push({ scopeId: scope.id, scopeName: scope.name, penId: pen.id, name: pen.name, color: pen.color, used: pen.lastUsedAt ?? 0 })
      }
    }
    return rows.sort((a, b) => b.used - a.used || a.name.localeCompare(b.name)).slice(0, 8)
    // `linked` is derived from `links`; keyed on the list itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes, query, penLinks])

  const remove = (penId: string) => {
    const next = links.filter((l) => l.penId !== penId)
    onChange(next.length ? next : undefined)
  }
  const add = (link: PenLink) => {
    onChange([...links, link])
    setQuery("")
    setPicking(false)
  }

  return (
    <div className="ipt-pens" data-ui-name="Item pens">
      <div className="ipt-chips">
        {links.length === 0 && <span className="ipt-quiet">No pen linked. Time painted with a linked pen counts here.</span>}
        {links.map((link, i) => {
          const pen = findPen(scopes, link.penId)
          return (
            <span key={link.penId} className="ipt-chip" title={i === 0 ? "Clock pen: ▶ paints with this one" : undefined}>
              <span className="ipt-dot" style={{ background: pen?.color ?? "transparent" }} aria-hidden />
              {pen?.name ?? "Missing pen"}
              {i === 0 && links.length > 1 && <span className="ipt-quiet"> · clock</span>}
              {!readOnly && (
                <button type="button" className="ipt-x" aria-label={`Unlink ${pen?.name ?? "pen"}`} onClick={() => remove(link.penId)}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )
        })}
        {!readOnly && !picking && (
          <button type="button" className="ipt-add" onClick={() => setPicking(true)}>
            <Plus className="h-3 w-3" /> Link pen
          </button>
        )}
      </div>
      {picking && (
        <div className="ipt-picker">
          <input
            autoFocus
            className="ipt-search"
            placeholder="Find a pen…"
            aria-label="Find a pen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                setPicking(false)
              } else if (e.key === "Enter" && options[0]) {
                e.preventDefault()
                add({ scopeId: options[0].scopeId, penId: options[0].penId })
              }
            }}
          />
          <ul className="ipt-options" role="listbox" aria-label="Pens">
            {options.length === 0 && <li className="ipt-quiet">No pens match.</li>}
            {options.map((o) => (
              <li key={o.penId}>
                <button type="button" role="option" aria-selected={false} onClick={() => add({ scopeId: o.scopeId, penId: o.penId })}>
                  <span className="ipt-dot" style={{ background: o.color }} aria-hidden />
                  {o.name}
                  <span className="ipt-quiet"> · {o.scopeName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ItemTrackedTime({ task }: { task: Pick<Task, "id" | "penLinks" | "timeLogs" | "estimatedDuration"> }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [showAll, setShowAll] = useState(false)
  const tracked = useMemo(() => trackedTimeForItem(task, entries), [task, entries])
  const est = task.estimatedDuration ?? 0
  const left = est > 0 ? est - tracked.total : 0
  const fill = est > 0 ? Math.min(1, tracked.total / est) : 0
  const blocks = showAll ? tracked.entries : tracked.entries.slice(0, ITEM_BLOCKS_SHOWN)

  return (
    <div className="ipt-time" data-ui-name="Item tracked time">
      <p className="ipt-total">
        <strong>{formatDuration(tracked.total)}</strong> tracked
        {est > 0 && (left >= 0 ? <> · {formatDuration(left)} est left</> : <> · {formatDuration(-left)} past est</>)}
      </p>
      {est > 0 && (
        <div
          className={`ipt-bar${left < 0 ? " is-over" : ""}`}
          role="meter"
          aria-label="Tracked against estimate"
          aria-valuemin={0}
          aria-valuemax={est}
          aria-valuenow={Math.min(tracked.total, est)}
        >
          <span style={{ width: `${fill * 100}%` }} />
        </div>
      )}
      {tracked.total > 0 && (
        <p className="ipt-quiet ipt-parts">
          {[
            tracked.penMinutes > 0 && `${formatDuration(tracked.penMinutes)} by pen`,
            tracked.clockMinutes > 0 && `${formatDuration(tracked.clockMinutes)} on the clock`,
            tracked.logMinutes > 0 && `${formatDuration(tracked.logMinutes)} logged`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {blocks.length > 0 && (
        <ul className="ipt-blocks">
          {blocks.map((e) => {
            const pen = findPen(scopes, e.penId)
            return (
              <li key={e.id}>
                <span className="ipt-dot" style={{ background: pen?.color ?? "transparent" }} aria-hidden />
                <span className="ipt-block-name">{e.title || pen?.name || "Block"}</span>
                <span className="ipt-quiet">
                  {e.date} {minutesToLabel(e.startMin)}–{minutesToLabel(e.endMin)} · {formatDuration(e.endMin - e.startMin)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {tracked.entries.length > ITEM_BLOCKS_SHOWN && (
        <button type="button" className="ipt-add" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `+ ${tracked.entries.length - ITEM_BLOCKS_SHOWN} more`}
        </button>
      )}
    </div>
  )
}

/** The Pens field and the tracked total, as one bay. Shells pass their draft setters. */
export function ItemPenTimeSection({
  task,
  onPenLinksChange,
  readOnly,
}: {
  task: Pick<Task, "id" | "penLinks" | "timeLogs" | "estimatedDuration">
  onPenLinksChange: (next: Task["penLinks"]) => void
  readOnly?: boolean
}) {
  return (
    <div className="ipt-section space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Pens and tracked time
      </h3>
      <ItemPenLinksField penLinks={task.penLinks} onChange={onPenLinksChange} readOnly={readOnly} />
      <ItemTrackedTime task={task} />
    </div>
  )
}
