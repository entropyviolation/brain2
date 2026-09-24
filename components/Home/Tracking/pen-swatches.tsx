/**
 * components/Home/Tracking/pen-swatches.tsx — Searchable pen picker
 *
 * Pens sit as beads on a photographed well. Search flattens
 * matches with their path. Recent / A–Z / Tree is chosen by the palette;
 * a query always flattens. Creating a pen lives here so Log activity does
 * not bounce you back to the grid. The palette keeps this row hidden until
 * **New pen**; dialogs still show it whenever `onCreate` is passed.
 * `expanded` (palette only) unwraps the bead row; dialogs leave it open.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { ancestorChain } from "@/lib/pen-tree"
import { orderPens, orderedChildren, type PenSortMode } from "@/lib/pen-sort"
import { PEN_PALETTE, type TrackPen, type TrackTag } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

function PenBead({
  pen,
  selected,
  path,
  tags,
  indent = 0,
  onSelect,
}: {
  pen: TrackPen
  selected: boolean
  path?: string
  tags: TrackTag[]
  indent?: number
  onSelect: (id: string) => void
}) {
  const penTags = tags.filter((t) => pen.tags?.includes(t.id))
  const title = path ? `${path} › ${pen.name}` : penTags.length ? `${pen.name} · tags: ${penTags.map((t) => t.name).join(", ")}` : pen.name
  return (
    <span className="trk-pen-slot">
      <button
        type="button"
        data-no95
        data-selected={selected ? "true" : "false"}
        onClick={() => onSelect(pen.id)}
        title={title}
        className="trk-pen"
        data-indent={indent ? "true" : "false"}
        style={{
          background: pen.color,
          marginLeft: indent ? indent * 10 : undefined,
        }}
      >
        <span
          className="trk-pen-bead"
          style={{
            background: pen.color,
            backgroundImage: pen.image ? `url("${pen.image}")` : undefined,
            backgroundSize: "cover",
          }}
          aria-hidden
        />
        {path ? <span className="trk-pen-meta">{path} ›</span> : null}
        <span className="trk-pen-name">{pen.name}</span>
      {pen.variants && pen.variants.length > 0 && (
        <span className="trk-pen-meta" title={`${pen.variants.length} detail options`}>
          {pen.variants.length}
        </span>
      )}
      {penTags.length > 0 && (
        <span className="flex gap-0.5" aria-hidden>
          {penTags.map((t) => (
            <span
              key={t.id}
              className="inline-block h-1.5 w-1.5 rounded-full ring-1 ring-white/70"
              style={{ background: t.color }}
            />
          ))}
        </span>
      )}
      </button>
    </span>
  )
}

export function PenSwatches({
  pens,
  tags = [],
  selectedId,
  onSelect,
  onCreate,
  sortMode = "recent",
  searchPlaceholder = "Search pens…",
  compact: _compact = false,
  expanded = true,
  showCreator,
  onDismissCreator,
}: {
  pens: TrackPen[]
  tags?: TrackTag[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate?: (name: string, color: string) => void
  sortMode?: PenSortMode
  searchPlaceholder?: string
  compact?: boolean
  /** Palette well: false clips to one bead row. Dialogs keep the default wrap. */
  expanded?: boolean
  /** Palette: false until **New pen**. Dialogs omit this and keep the row. */
  showCreator?: boolean
  onDismissCreator?: () => void
}) {
  const [query, setQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PEN_PALETTE[0])
  const nameRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()
  const creatorOpen = Boolean(onCreate) && showCreator !== false

  useEffect(() => {
    if (showCreator === true) nameRef.current?.focus()
  }, [showCreator])

  const matches = useMemo(() => {
    if (!needle) return null
    const hit = pens.filter((pen) => {
      if (pen.name.toLowerCase().includes(needle)) return true
      if (pen.variants?.some((v) => v.name.toLowerCase().includes(needle))) return true
      const path = ancestorChain(pens, pen.id)
        .map((p) => p.name)
        .join(" ")
      if (path.toLowerCase().includes(needle)) return true
      const penTags = tags.filter((t) => pen.tags?.includes(t.id))
      return penTags.some((t) => t.name.toLowerCase().includes(needle))
    })
    return orderPens(hit, sortMode === "tree" ? "recent" : sortMode)
  }, [needle, pens, tags, sortMode])

  const create = (name: string, color = newColor) => {
    const trimmed = name.trim()
    if (!trimmed || !onCreate) return
    onCreate(trimmed, color)
    setNewName("")
    setQuery("")
    const idx = PEN_PALETTE.indexOf(color)
    setNewColor(PEN_PALETTE[(idx >= 0 ? idx + 1 : 0) % PEN_PALETTE.length])
  }

  const renderTree = (pen: TrackPen, indent: number) => {
    const kids = orderedChildren(pens, pen.id, sortMode)
    return (
      <div key={pen.id} className="contents">
        <PenBead
          pen={pen}
          selected={selectedId === pen.id}
          tags={tags}
          indent={indent}
          onSelect={onSelect}
        />
        {kids.map((child) => renderTree(child, indent + 1))}
      </div>
    )
  }

  const listed =
    matches ??
    (sortMode === "tree"
      ? orderedChildren(pens, null, "tree")
      : orderPens(pens, sortMode))

  return (
    <div className="trk95 trk-swatches min-w-0 flex-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search pens"
        className="trk-search"
      />
      <div
        className={expanded ? "trk-pen-well" : "trk-pen-well trk-pen-well-collapsed"}
        data-expanded={expanded ? "true" : "false"}
      >
        <div className="trk-pen-row">
          {matches
            ? matches.map((pen) => {
                const path = ancestorChain(pens, pen.id)
                  .slice(0, -1)
                  .map((p) => p.name)
                  .join(" › ")
                return (
                  <PenBead
                    key={pen.id}
                    pen={pen}
                    selected={selectedId === pen.id}
                    path={path || undefined}
                    tags={tags}
                    onSelect={onSelect}
                  />
                )
              })
            : sortMode === "tree"
              ? listed.map((pen) => renderTree(pen, 0))
              : listed.map((pen) => (
                  <PenBead
                    key={pen.id}
                    pen={pen}
                    selected={selectedId === pen.id}
                    tags={tags}
                    onSelect={onSelect}
                  />
                ))}
          {matches?.length === 0 && (
            <span className="trk-miss">
              No pens match “{query}”.
              {onCreate && query.trim() && (
                <button type="button" onClick={() => create(query, newColor)}>
                  Create “{query.trim()}”
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      {creatorOpen && (
        <span
          className="trk-new-pen"
          onBlur={(e) => {
            const next = e.relatedTarget as HTMLElement | null
            if (!next || e.currentTarget.contains(next)) return
            if (next.getAttribute("aria-label") === "New pen") return
            setNewName("")
            onDismissCreator?.()
          }}
        >
          <ColorSwatch value={newColor} onChange={setNewColor} aria-label="New pen color" size="sm" />
          <Input
            ref={nameRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                create(newName)
              }
              if (e.key === "Escape") {
                e.preventDefault()
                setNewName("")
                onDismissCreator?.()
              }
            }}
            placeholder="New pen…"
            aria-label="New pen name"
            className="trk-search flex-1"
          />
          <button
            type="button"
            className="trk-micro"
            onClick={() => create(newName)}
            disabled={!newName.trim()}
            title="Add pen"
          >
            <Plus />
            <span className="sr-only">Add pen</span>
          </button>
        </span>
      )}
    </div>
  )
}
