/**
 * components/Home/Tracking/pen-parent-picker.tsx — Searchable Counts-as control
 *
 * Native `<select>` was an ugly system menu that hid "Ocean Beach counts as
 * San Diego" behind a flat list. This is a sunken Win95 field: type to filter,
 * pick a parent in this view, or **Create new pen** so this one can nest under
 * a parent that does not exist yet. One parent only — multiselect / parallel
 * counts-as chains are documented as planned, not implemented.
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
  currentName,
  onSelect,
  onCreate,
}: {
  pens: TrackPen[]
  /** Full view, including ancestors of `pens`, so path labels and search stay honest. */
  treePens?: TrackPen[]
  parentId?: string
  currentName: string
  onSelect: (id: string | null) => void
  onCreate: (name: string, color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(PEN_PALETTE[2])
  const root = useRef<HTMLDivElement>(null)

  const tree = treePens ?? pens
  const selected = tree.find((p) => p.id === parentId) ?? pens.find((p) => p.id === parentId)
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!needle) return pens
    return pens.filter((p) => matchesNeedle(tree, p, needle))
  }, [pens, tree, needle])
  const selectedPath = selected ? pathOf(tree, selected.id) : ""

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const label = selected
    ? selectedPath
      ? `${selected.name} · ${selectedPath}`
      : selected.name
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
        {selected ? (
          <span className="trk-chain-bead" style={{ background: selected.color }} aria-hidden />
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
            aria-selected={!parentId}
            data-active={!parentId ? "true" : undefined}
            className="trk-parent-option"
            onClick={() => {
              onSelect(null)
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
                aria-selected={pen.id === parentId}
                data-active={pen.id === parentId ? "true" : undefined}
                className="trk-parent-option"
                onClick={() => {
                  onSelect(pen.id)
                  setOpen(false)
                }}
              >
                <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{pen.name}</span>
                  {path ? <span className="trk-parent-path">{path}</span> : null}
                </span>
              </button>
            )
          })}
          {matches.length === 0 && query.trim() && (
            <p className="px-2 py-1 text-[11px]">No pens match “{query.trim()}”.</p>
          )}
          {creating ? (
            <div className="mt-1 flex items-center gap-1 border-t border-[#808080] pt-1">
              <ColorSwatch value={newColor} onChange={setNewColor} aria-label="New parent color" size="sm" />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New parent pen…"
                aria-label="New parent pen name"
                className="h-7 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    create()
                  }
                }}
              />
              <button type="button" className="trk-parent-option w-auto shrink-0" onClick={create} disabled={!(newName.trim() || query.trim())}>
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
