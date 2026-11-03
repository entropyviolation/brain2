/**
 * components/ItemDetail/tabs/time/ItemPenTime.tsx — Pens on an item, and the time they add up to
 *
 * Phase 5 of `docs/TODO_REDESIGN.md`. `ItemPenLinksField` edits `Task.penLinks`
 * (the same list **Remember for this task** writes; the first link is the clock
 * pen, and **clock** on another chip moves it first). `ItemTrackedTime` reads `trackedTimeForItem` (`lib/tracked-time.ts`):
 * the total, an est-vs-tracked bar, and the counted blocks. A task's Time tab
 * passes `editableTime` and renders `ItemTimeLedger` instead: the same blocks,
 * their objectives, and session logs, all correctable. Edits to pens and logs
 * go through the shell's draft. Block clocks go through the time grid.
 */
"use client"

import { useMemo, useState } from "react"
import { Link2, Plus, X } from "lucide-react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ancestorChains, isDescendant } from "@/lib/pen-tree"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { findPen, partsMinutes, timeTrio, trackedTimeForItem } from "@/lib/tracked-time"
import type { Task } from "@/lib/types"
import { ItemTimeLedger } from "@/components/ItemDetail/tabs/time/ItemTimeLedger"
import { PenChainVisual } from "@/components/Home/Tracking/pen-chain-visual"
import { PEN_COLOR_OPEN_TITLE, openPenSettings, penColorDoubleClick } from "@/components/Home/Tracking/open-pen-settings"
import "./item-pen-time.css"

type PenLink = { scopeId: string; penId: string }

/** Put `penId` first. The first link is the clock pen (`clockPenFor`). Same list when it already is. */
export function withClockPen(links: PenLink[] | undefined, penId: string): PenLink[] | undefined {
  const list = links ?? []
  const hit = list.find((link) => link.penId === penId)
  if (!hit || list[0]?.penId === penId) return links
  return [hit, ...list.filter((link) => link.penId !== penId)]
}

/** How many counted blocks the Time panel lists before "+ N more". */
export const ITEM_BLOCKS_SHOWN = 12

export function ItemPenLinksField({
  penLinks,
  onChange,
  readOnly = false,
  onMakeClock,
  parent,
  chain = false,
}: {
  penLinks: PenLink[] | undefined
  onChange: (next: PenLink[] | undefined) => void
  readOnly?: boolean
  /** Move this pen first so ▶ paints with it. Defaults to `onChange(withClockPen(...))`. */
  onMakeClock?: (penId: string) => void
  /** A new pen made here counts as this one (same view), until pen settings say otherwise. */
  parent?: PenLink
  /**
   * Task card: draw the clock pen's counts-as chain. Ancestors come from the
   * pen tree and are not written into `penLinks`. Item detail leaves this off.
   */
  chain?: boolean
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState("")
  const links = penLinks ?? []
  const linked = new Set(links.map((l) => l.penId))
  const parentPen = parent && scopes.find((sc) => sc.id === parent.scopeId)?.pens.find((p) => p.id === parent.penId)

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
  const makeClock = (penId: string) => {
    if (onMakeClock) onMakeClock(penId)
    else {
      const next = withClockPen(links, penId)
      if (next && next !== links) onChange(next)
    }
  }

  const clock = links[0]
  const clockScope = clock ? scopes.find((scope) => scope.id === clock.scopeId) : undefined
  const tree = clockScope?.pens ?? []
  const chains = clock && chain ? ancestorChains(tree, clock.penId) : []
  const showChain = chain && chains.some((path) => path.length > 1)
  const hidden = new Set<string>()
  if (showChain && clock) {
    hidden.add(clock.penId)
    for (const path of chains) for (const pen of path) if (pen.id !== clock.penId) hidden.add(pen.id)
    for (const link of links) {
      if (link.penId === clock.penId) continue
      if (isDescendant(tree, clock.penId, link.penId) || isDescendant(tree, link.penId, clock.penId)) hidden.add(link.penId)
    }
  }

  return (
    <div className="ipt-pens" data-ui-name="Item pens">
      {showChain && clock ? (
        <PenChainVisual
          variant="row"
          pens={tree}
          penId={clock.penId}
          linkedIds={linked}
          onUnlink={readOnly ? undefined : remove}
          onMakeClock={(penId) => makeClock(penId)}
          onOpenPen={(penId) => openPenSettings(links.find((link) => link.penId === penId)?.scopeId ?? clock.scopeId, penId)}
        />
      ) : null}
      <div className="ipt-chips">
        {links.length === 0 && <span className="ipt-quiet">No pen linked. Link one and new paint from the clock counts here.</span>}
        {links.map((link, i) => {
          if (hidden.has(link.penId)) return null
          const pen = findPen(scopes, link.penId)
          return (
            <span
              key={link.penId}
              className={`ipt-chip${i === 0 ? " is-clock" : ""}`}
              title={`${i === 0 ? "Clock pen: ▶ paints with this one. " : ""}${PEN_COLOR_OPEN_TITLE}`}
              onDoubleClick={penColorDoubleClick(link.scopeId, link.penId)}
            >
              <span className="ipt-dot" style={{ background: pen?.color ?? "transparent" }} aria-hidden />
              {pen?.name ?? "Missing pen"}
              <button
                type="button"
                className="ipt-clock"
                aria-pressed={i === 0}
                disabled={i === 0 || (readOnly && !onMakeClock)}
                aria-label={i === 0 ? `Clock pen ${pen?.name ?? "pen"}` : `Make ${pen?.name ?? "pen"} the clock pen`}
                title={i === 0 ? "Play paints with this pen" : "Paint with this pen when play is clicked"}
                onClick={() => makeClock(link.penId)}
              >
                clock
              </button>
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
            data-draft=""
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
            {options.length === 0 && !query.trim() && <li className="ipt-quiet">No pens match.</li>}
            {scopes[0] && !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase()) && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  title={`New pen${parentPen ? ` counting as ${parentPen.name}` : ""}, then open its settings`}
                  onClick={() => {
                    const scopeId = parentPen ? parent!.scopeId : scopes[0].id
                    const penId = addPen(scopeId, {
                      name: query.trim() || "New pen",
                      color: `hsl(${Math.round(Math.random() * 360)} 45% 50%)`,
                      ...(parentPen ? { parentId: parentPen.id, parentIds: [parentPen.id] } : {}),
                    })
                    add({ scopeId, penId })
                    openPenSettings(scopeId, penId)
                  }}
                >
                  <Plus className="h-3 w-3" /> {query.trim() ? `New pen “${query.trim()}”` : "Create a new pen"}
                </button>
              </li>
            )}
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

export function ItemTrackedTime({
  task,
}: {
  task: Pick<Task, "id" | "penLinks" | "timeLogs" | "estimatedDuration"> & Partial<Pick<Task, "subtasks">>
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [showAll, setShowAll] = useState(false)
  const tracked = useMemo(() => trackedTimeForItem(task, entries, { penScope: "tagged" }), [task, entries])
  const est = task.estimatedDuration ?? 0
  const left = est > 0 ? est - tracked.total : 0
  // est · parts · spent (Phase 6, R6); only when there are steps, else the line above says it all.
  const parts = partsMinutes(task.subtasks)
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
      {parts > 0 && (
        <p className="ipt-quiet ipt-trio" aria-label="Estimate, parts and time spent">
          {timeTrio(est, parts, tracked.total)}
        </p>
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
      {tracked.penPoolMinutes > 0 && (
        <p className="ipt-quiet ipt-parts" title="Time on the linked pen that is not tagged with this item. Not counted above.">
          pen overall {formatDuration(tracked.penPoolMinutes)} (not tagged to this)
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

/**
 * Pens, plus either the read-only total or the task ledger.
 * `editableTime` is the task Time tab: blocks, objectives, and logs can be corrected.
 */
export function ItemPenTimeSection({
  task,
  onPenLinksChange,
  onPatch,
  readOnly,
  editableTime = false,
}: {
  task: Task
  onPenLinksChange: (next: Task["penLinks"]) => void
  onPatch?: (patch: Partial<Task>) => void
  readOnly?: boolean
  editableTime?: boolean
}) {
  return (
    <div className="ipt-section space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Pens and tracked time
      </h3>
      <ItemPenLinksField penLinks={task.penLinks} onChange={onPenLinksChange} readOnly={readOnly} />
      {editableTime && onPatch ? (
        <ItemTimeLedger task={task} onPatch={onPatch} readOnly={readOnly} />
      ) : (
        <ItemTrackedTime task={task} />
      )}
    </div>
  )
}
