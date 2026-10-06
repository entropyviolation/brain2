/**
 * components/Home/Tracking/pen-parent-picker.tsx — Searchable Counts-as control
 *
 * Native `<select>` was an ugly system menu that hid "Ocean Beach counts as
 * San Diego" behind a flat list. This is a sunken Win95 field: type to filter,
 * pick a parent in this view, or **Create new pen** so this one can nest under
 * a parent that does not exist yet. The create row is a dark inset name field
 * (same voice as the pen Name well) that fills the row beside the swatch and
 * Create, so the letters stay readable while you type. Several parents can
 * be ticked; the first one is the display parent **Show as** follows.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Input } from "@/components/ui/input"
import { ancestorChain } from "@/lib/pen-tree"
import { PEN_PALETTE, type TrackPen } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

function pathOf(tree: TrackPen[], penId: string): string {
  return ancestorChain(tree, penId)
    .slice(0, -1)
    .map((p) => p.name)
    .join(" › ")
}

function matchesNeedle(tree: TrackPen[], pen: TrackPen, needle: string): boolean {
  if (pen.name.toLowerCase().includes(needle)) return true
  return ancestorChain(tree, pen.id)
    .map((p) => p.name)
    .join(" ")
    .toLowerCase()
    .includes(needle)
}

export function PenParentPicker({
  pens,
  treePens,
  parentId,
  parentIds,
  currentName,
  onSelect,
  onCreate,
}: {
  pens: TrackPen[]
  /** Full view, including ancestors of `pens`, so path labels and search stay honest. */
  treePens?: TrackPen[]
  /** Display parent. Used when `parentIds` is omitted (older call sites). */
  parentId?: string
  parentIds?: string[]
  currentName: string
  onSelect: (ids: string[]) => void
  onCreate: (name: string, color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PEN_PALETTE[2])
  const root = useRef<HTMLDivElement>(null)

  const tree = treePens ?? pens
  const selectedIds = parentIds ?? (parentId ? [parentId] : [])
  const selectedPens = selectedIds
    .map((id) => tree.find((pen) => pen.id === id) ?? pens.find((pen) => pen.id === id))
    .filter((pen): pen is TrackPen => Boolean(pen))
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!needle) return pens
    return pens.filter((p) => matchesNeedle(tree, p, needle))
  }, [pens, tree, needle])
  const selectedPath = selectedPens[0] ? pathOf(tree, selectedPens[0].id) : ""

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const label = selectedPens.length
    ? selectedPens.length === 1
      ? selectedPath
        ? `${selectedPens[0].name} · ${selectedPath}`
        : selectedPens[0].name
      : selectedPens.map((pen, index) => (index === 0 ? `${pen.name} (display)` : pen.name)).join(" · ")
    : `Nothing — top-level ${currentName || "pen"}`

  const create = () => {
    const name = newName.trim() || query.trim()
    if (!name) return
    onCreate(name, newColor)
    setNewName("")
    setQuery("")
    setCreating(false)
    setOpen(false)
    const idx = PEN_PALETTE.indexOf(newColor)
    setNewColor(PEN_PALETTE[(idx >= 0 ? idx + 1 : 0) % PEN_PALETTE.length])
  }

  return (
    <div ref={root} className="trk-parent-menu">
      <button
        type="button"
        aria-label="Counts as"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="trk-parent-trigger"
      >
        {selectedPens[0] ? (
          <span className="trk-chain-bead" style={{ background: selectedPens[0].color }} aria-hidden />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="trk-parent-list" role="listbox">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pens…"
            aria-label="Search parent pens"
            className="mb-1 h-7 text-sm"
            autoFocus
          />
          <button
            type="button"
            role="option"
            aria-selected={selectedIds.length === 0}
            data-active={selectedIds.length === 0 ? "true" : undefined}
            className="trk-parent-option"
            onClick={() => {
              onSelect([])
              setOpen(false)
            }}
          >
            Nothing — this is a top-level {currentName || "pen"}
          </button>
          {matches.map((pen) => {
            const path = pathOf(tree, pen.id)
            return (
              <button
                key={pen.id}
                type="button"
                role="option"
                aria-selected={selectedIds.includes(pen.id)}
                data-active={selectedIds.includes(pen.id) ? "true" : undefined}
                className="trk-parent-option"
                onClick={() => {
                  if (selectedIds.includes(pen.id)) onSelect(selectedIds.filter((id) => id !== pen.id))
                  else onSelect([...selectedIds, pen.id])
                }}
              >
                <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{pen.name}</span>
                  {path ? <span className="trk-parent-path">{path}</span> : null}
                  {selectedIds[0] === pen.id ? <span className="trk-parent-path">display</span> : null}
                </span>
              </button>
            )
          })}
          {matches.length === 0 && query.trim() && (
            <p className="px-2 py-1 text-[11px]">No pens match “{query.trim()}”.</p>
          )}
          {creating ? (
            <div className="trk-parent-create">
              <ColorSwatch value={newColor} onChange={setNewColor} aria-label="New parent color" size="sm" />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New parent pen…"
                aria-label="New parent pen name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    create()
                  }
                }}
              />
              <button type="button" className="trk-parent-create-add" onClick={create} disabled={!(newName.trim() || query.trim())}>
                Create
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="trk-parent-option mt-1 border-t border-[#808080]"
              onClick={() => {
                setCreating(true)
                if (query.trim()) setNewName(query.trim())
              }}
            >
              Create new pen…
            </button>
          )}
        </div>
      )}
    </div>
  )
}
