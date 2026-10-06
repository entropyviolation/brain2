/**
 * components/Home/Tracking/pen-swatches.tsx — Searchable pen picker
 *
 * Pens sit as named beads in a plain sunken well. Search flattens matches
 * with their path. Recent / A–Z / Tree is chosen by the palette; a query
 * always flattens. **+ New pen** sits under the well. The palette shows that
 * row whenever the well is expanded. Collapsed, it appears only when a search
 * misses, labeled **Create new pen**, with the query already in the name.
 * Dialogs always show the row. `expanded` (palette only) unwraps the beads.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { PEN_COLOR_OPEN_TITLE } from "@/components/Home/Tracking/open-pen-settings"
import { inkOnFill } from "@/components/Home/Tracking/trk-instrument"
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
  onOpenPen,
}: {
  pen: TrackPen
  selected: boolean
  path?: string
  tags: TrackTag[]
  indent?: number
  onSelect: (id: string) => void
  onOpenPen?: (id: string) => void
}) {
  const penTags = tags.filter((t) => pen.tags?.includes(t.id))
  const title = path ? `${path} › ${pen.name}` : penTags.length ? `${pen.name} · tags: ${penTags.map((t) => t.name).join(", ")}` : pen.name
  const ink = inkOnFill(pen.color)
  return (
    <span className="trk-pen-slot">
      <button
        type="button"
        data-no95
        data-selected={selected ? "true" : "false"}
        data-dark={ink === "#ffffff" ? "true" : "false"}
        data-ink={ink === "#ffffff" ? "light" : "dark"}
        onClick={() => onSelect(pen.id)}
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpenPen?.(pen.id)
        }}
        title={onOpenPen ? `${title}. ${PEN_COLOR_OPEN_TITLE}` : title}
        className="trk-pen"
        data-indent={indent ? "true" : "false"}
        style={{
          background: pen.color,
          color: ink,
          marginLeft: indent ? indent * 10 : undefined,
        }}
      >
        {pen.image ? (
          <span
            className="trk-pen-bead"
            style={{
              backgroundColor: pen.color,
              backgroundImage: `url("${pen.image}")`,
              backgroundSize: "cover",
            }}
            aria-hidden
          />
        ) : null}
        {path ? <span className="trk-pen-meta">{path} ›</span> : null}
        <span className="trk-pen-name">{pen.name}</span>
      {pen.variants && pen.variants.length > 0 && (
        <span className="trk-pen-count" title={`${pen.variants.length} detail options`}>
          {pen.variants.length}
        </span>
      )}
      {penTags.length > 0 && (
        <span className="trk-pen-tags" aria-hidden>
          {penTags.map((t) => (
            <span key={t.id} style={{ background: t.color }} />
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
  onOpenPen,
  sortMode = "recent",
  searchPlaceholder = "Search pens…",
  compact: _compact = false,
  expanded = true,
  creator = "always",
}: {
  pens: TrackPen[]
  tags?: TrackTag[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate?: (name: string, color: string) => void
  /** Double-click a bead to open that pen. */
  onOpenPen?: (id: string) => void
  sortMode?: PenSortMode
  searchPlaceholder?: string
  compact?: boolean
  /** Palette well: false clips to one bead row. Dialogs keep the default wrap. */
  expanded?: boolean
  /**
   * `always` — the **+ New pen** row stays under the well (expanded palette
   * and dialogs). `on-miss` — collapsed palette: the row appears only when
   * the search matches nothing, labeled **Create new pen**.
   */
  creator?: "always" | "on-miss"
}) {
  const [query, setQuery] = useState("")
  const [newName, setNewName] = useState("")
  const [nameDirty, setNameDirty] = useState(false)
  const [newColor, setNewColor] = useState(PEN_PALETTE[0])
  const nameRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()

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

  const miss = Boolean(needle && matches && matches.length === 0)
  const creatorOpen = Boolean(onCreate) && (creator === "always" || miss)

  useEffect(() => {
    if (nameDirty) return
    setNewName(miss ? query.trim() : "")
  }, [miss, nameDirty, query])

  const create = (name: string, color = newColor) => {
    const trimmed = name.trim()
    if (!trimmed || !onCreate) return
    onCreate(trimmed, color)
    setNewName("")
    setNameDirty(false)
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
          onOpenPen={onOpenPen}
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
                    onOpenPen={onOpenPen}
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
                    onOpenPen={onOpenPen}
                  />
                ))}
          {matches?.length === 0 && !onCreate && (
            <span className="trk-miss">No pens match “{query}”.</span>
          )}
        </div>
      </div>
      {creatorOpen && (
        <span className="trk-new-pen">
          <ColorSwatch value={newColor} onChange={setNewColor} aria-label="New pen color" size="sm" />
          <Input
            ref={nameRef}
            value={newName}
            onChange={(e) => {
              setNameDirty(true)
              setNewName(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                create(newName)
              }
              if (e.key === "Escape") {
                e.preventDefault()
                setNameDirty(false)
                setNewName(miss ? query.trim() : "")
              }
            }}
            placeholder="New pen…"
            aria-label="New pen name"
            className="trk-search flex-1"
          />
          <button
            type="button"
            className="trk-new-pen-add"
            onClick={() => create(newName)}
            disabled={!newName.trim()}
          >
            {creator === "on-miss" ? "Create new pen" : "+ New pen"}
          </button>
        </span>
      )}
    </div>
  )
}
