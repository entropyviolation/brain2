/**
 * components/Home/Tracking/block-pen-section.tsx — Pens on one painted block
 *
 * One multi-select, like adding lists to an item. Chips show every pen on the
 * block. The primary chip (filled star, **Primary**) paints the grid. Every
 * other chip still counts toward habits, tags, operations, and goals. Click a
 * hollow star to make that pen primary; × removes a pen (removing the primary
 * promotes the next one). Double-click a chip to open that pen's settings.
 *
 * One search box adds pens: type to filter this view's pens, then **Add**
 * (extra) or **Primary** on a row. A name that does not exist offers
 * **Create** with a color, again as an extra or as primary. Enter adds the top
 * row (or creates) as an extra; Escape clears. Focus with nothing typed lists
 * recent pens. A block with no primary yet takes the first added pen as
 * primary.
 *
 * On Company blocks with two or more pens, **Name this group** makes a group
 * pen whose details are those people (`addPenGroup`), and the block becomes
 * that group with each person ticked as detail.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { assignedPenIds } from "@/lib/time-entries"
import { ancestorChain } from "@/lib/pen-tree"
import { orderPens, type PenSortMode } from "@/lib/pen-sort"
import { PEN_PALETTE, stablePenColor, type TrackPen, type TrackTag } from "@/lib/time-tracking-store"
import { PEN_COLOR_OPEN_TITLE } from "@/components/Home/Tracking/open-pen-settings"
import { inkOnFill } from "@/components/Home/Tracking/trk-instrument"
import "./tracking-chrome.css"

const SUGGEST_LIMIT = 12

function PenChip({
  pen,
  primary,
  canRemove,
  onPrimary,
  onRemove,
  onOpenPen,
}: {
  pen: TrackPen
  primary: boolean
  canRemove: boolean
  onPrimary: (id: string) => void
  onRemove: (id: string) => void
  onOpenPen?: (id: string) => void
}) {
  const ink = inkOnFill(pen.color)
  return (
    <span
      className="trk-blockpen-chip"
      data-block-pen={primary ? "primary" : "secondary"}
      style={{ background: pen.color, color: ink }}
      title={`${pen.name}${primary ? " — primary (grid color)" : ""}. ${PEN_COLOR_OPEN_TITLE}`}
      onDoubleClick={(event) => {
        event.preventDefault()
        onOpenPen?.(pen.id)
      }}
    >
      <button
        type="button"
        data-no95
        className="trk-blockpen-star"
        aria-pressed={primary}
        aria-label={primary ? `${pen.name} is primary` : `Make ${pen.name} primary`}
        title={primary ? "Primary — paints the grid" : "Make primary"}
        onClick={() => onPrimary(pen.id)}
      >
        {primary ? "★" : "☆"}
      </button>
      {pen.image ? (
        <span
          className="trk-pen-bead"
          style={{ backgroundColor: pen.color, backgroundImage: `url("${pen.image}")`, backgroundSize: "cover" }}
          aria-hidden
        />
      ) : null}
      <span className="trk-blockpen-name">{pen.name}</span>
      {primary ? <span className="trk-blockpen-tag">Primary</span> : null}
      {canRemove ? (
        <button
          type="button"
          data-no95
          className="trk-blockpen-x"
          aria-label={`Remove ${pen.name}`}
          title="Remove from this block"
          onClick={() => onRemove(pen.id)}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

export function BlockPenSection({
  pens,
  tags = [],
  primaryId,
  secondaryPenIds,
  onPrimary,
  onSecondaries,
  onCreate,
  onOpenPen,
  sortMode = "recent",
  onNameGroup,
}: {
  pens: TrackPen[]
  tags?: TrackTag[]
  primaryId: string
  secondaryPenIds: string[]
  onPrimary: (id: string) => void
  onSecondaries: (ids: string[]) => void
  /** Create a pen in this view. Return its id so it can land as primary or extra. */
  onCreate: (name: string, color: string) => string | void
  onOpenPen?: (id: string) => void
  sortMode?: PenSortMode
  /** Company blocks only: name the pens on this block as one group pen. */
  onNameGroup?: (name: string, color: string, memberIds: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [newColor, setNewColor] = useState<string | null>(null)
  const [groupName, setGroupName] = useState<string | null>(null)
  const [groupColor, setGroupColor] = useState(PEN_PALETTE[0])
  const inputRef = useRef<HTMLInputElement>(null)

  const byId = useMemo(() => new Map(pens.map((p) => [p.id, p])), [pens])
  const assigned = assignedPenIds({ penId: primaryId, secondaryPenIds }).filter((id) => byId.has(id))
  const hasPrimary = byId.has(primaryId)
  const onBlock = new Set(assigned)
  const needle = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!needle) return orderPens(pens.filter((p) => !onBlock.has(p.id)), sortMode === "tree" ? "recent" : sortMode).slice(0, SUGGEST_LIMIT)
    const hit = pens.filter((pen) => {
      if (pen.name.toLowerCase().includes(needle)) return true
      const path = ancestorChain(pens, pen.id).map((p) => p.name).join(" ")
      if (path.toLowerCase().includes(needle)) return true
      return tags.some((t) => pen.tags?.includes(t.id) && t.name.toLowerCase().includes(needle))
    })
    return orderPens(hit, sortMode === "tree" ? "recent" : sortMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, pens, tags, sortMode, assigned.join("|")])

  const exact = pens.some((p) => p.name.trim().toLowerCase() === needle)
  const canCreate = Boolean(needle) && !exact
  const createColor = newColor ?? (needle ? stablePenColor(needle) : PEN_PALETTE[0])

  const reset = () => {
    setQuery("")
    setNewColor(null)
  }

  const makePrimary = (id: string) => {
    if (id === primaryId) return
    const rest = assigned.filter((x) => x !== id)
    onPrimary(id)
    onSecondaries(rest)
  }

  const addExtra = (id: string) => {
    if (!hasPrimary) {
      makePrimary(id)
      return
    }
    if (onBlock.has(id)) return
    onSecondaries([...secondaryPenIds.filter((x) => x !== id && x !== primaryId), id])
  }

  const remove = (id: string) => {
    if (id === primaryId) {
      const [next, ...rest] = assigned.filter((x) => x !== id)
      if (!next) return
      onPrimary(next)
      onSecondaries(rest)
      return
    }
    onSecondaries(secondaryPenIds.filter((x) => x !== id))
  }

  const create = (as: "primary" | "extra") => {
    const name = query.trim()
    if (!name) return
    const id = onCreate(name, createColor)
    reset()
    if (!id) return
    if (as === "primary") makePrimary(id)
    else addExtra(id)
  }

  const add = (id: string, as: "primary" | "extra") => {
    if (as === "primary") makePrimary(id)
    else addExtra(id)
    reset()
    inputRef.current?.focus()
  }

  const showList = open || Boolean(needle)
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault()

  return (
    <div className="trk-section space-y-1.5">
      <Label className="trk-section-title" htmlFor="block-pen-search">
        Pen
      </Label>
      <p className="trk-help">
        ★ Primary paints the grid. Every other pen here still counts toward its habits, tags, and goals. Click ☆ to
        switch the primary. Double-click a pen to open it.
      </p>
      <div className="trk-blockpen-chips" role="group" aria-label="Pens on this block">
        {assigned.length === 0 ? <span className="trk-help">No pen yet. Add one below.</span> : null}
        {assigned.map((id) => {
          const pen = byId.get(id)!
          return (
            <PenChip
              key={id}
              pen={pen}
              primary={id === primaryId}
              canRemove={id !== primaryId || assigned.length > 1}
              onPrimary={makePrimary}
              onRemove={remove}
              onOpenPen={onOpenPen}
            />
          )
        })}
      </div>

      <div className="trk-blockpen-picker">
        <Input
          ref={inputRef}
          id="block-pen-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              const top = results.find((p) => !onBlock.has(p.id))
              if (top && (!canCreate || top.name.toLowerCase().startsWith(needle))) add(top.id, "extra")
              else if (canCreate) create("extra")
            } else if (e.key === "Escape" && (query || open)) {
              e.preventDefault()
              e.stopPropagation()
              reset()
              inputRef.current?.blur()
            }
          }}
          placeholder="Add a pen — type to search or create…"
          aria-label="Add a pen"
          autoComplete="off"
          className="trk-search"
        />
        {showList ? (
          <ul className="trk-blockpen-results" aria-label="Pen results" onMouseDown={keepFocus}>
            {results.map((pen) => {
              const path = ancestorChain(pens, pen.id).slice(0, -1).map((p) => p.name).join(" › ")
              const isPrimary = pen.id === primaryId
              const isExtra = !isPrimary && onBlock.has(pen.id)
              return (
                <li key={pen.id} className="trk-blockpen-result" data-on-block={onBlock.has(pen.id) ? "true" : undefined}>
                  <button
                    type="button"
                    data-no95
                    className="trk-blockpen-result-main"
                    disabled={onBlock.has(pen.id)}
                    onClick={() => add(pen.id, "extra")}
                    title={onBlock.has(pen.id) ? "Already on this block" : `Add ${pen.name}`}
                  >
                    <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
                    {path ? <span className="trk-blockpen-path">{path} ›</span> : null}
                    <span className="trk-blockpen-result-name">{pen.name}</span>
                    {isPrimary ? <span className="trk-blockpen-state">primary</span> : null}
                    {isExtra ? <span className="trk-blockpen-state">on block</span> : null}
                  </button>
                  {!onBlock.has(pen.id) ? (
                    <button
                      type="button"
                      className="trk-blockpen-act"
                      aria-label={`Add ${pen.name}`}
                      onClick={() => add(pen.id, "extra")}
                    >
                      + Add
                    </button>
                  ) : null}
                  {!isPrimary ? (
                    <button
                      type="button"
                      className="trk-blockpen-act"
                      aria-label={`Use ${pen.name} as primary`}
                      onClick={() => add(pen.id, "primary")}
                    >
                      ★ Primary
                    </button>
                  ) : null}
                </li>
              )
            })}
            {needle && results.length === 0 && !canCreate ? <li className="trk-help">No pens match.</li> : null}
            {canCreate ? (
              <li className="trk-blockpen-result trk-blockpen-create">
                <ColorSwatch value={createColor} onChange={setNewColor} aria-label="New pen color" size="sm" />
                <span className="trk-blockpen-result-name">
                  Create “{query.trim()}”
                </span>
                <button type="button" className="trk-blockpen-act" onClick={() => create("extra")}>
                  + Add
                </button>
                <button type="button" className="trk-blockpen-act" onClick={() => create("primary")}>
                  ★ Primary
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {onNameGroup && assigned.length >= 2 ? (
        groupName === null ? (
          <button
            type="button"
            className="trk-blockpen-group-open"
            onClick={() => {
              setGroupName("")
              setGroupColor(stablePenColor(assigned.join("|")))
            }}
            title="Make one pen for these people, with each of them as its detail"
          >
            Name this group…
          </button>
        ) : (
          <div className="trk-blockpen-group" role="group" aria-label="Name this group">
            <ColorSwatch value={groupColor} onChange={setGroupColor} aria-label="Group color" size="sm" />
            <Input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && groupName.trim()) {
                  e.preventDefault()
                  onNameGroup(groupName.trim(), groupColor, assigned)
                  setGroupName(null)
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  e.stopPropagation()
                  setGroupName(null)
                }
              }}
              placeholder="Group name, e.g. Band"
              aria-label="Group name"
              className="trk-search flex-1"
            />
            <button
              type="button"
              className="trk-blockpen-act"
              disabled={!groupName.trim()}
              onClick={() => {
                onNameGroup(groupName.trim(), groupColor, assigned)
                setGroupName(null)
              }}
            >
              Save group
            </button>
            <button type="button" className="trk-blockpen-act" onClick={() => setGroupName(null)}>
              Cancel
            </button>
            <p className="trk-help w-full">
              {assigned.map((id) => byId.get(id)?.name).join(", ")} become the group&apos;s detail. This block becomes
              the group with each of them ticked.
            </p>
          </div>
        )
      ) : null}
    </div>
  )
}
