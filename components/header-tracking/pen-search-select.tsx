/**
 * Searchable pen field for one tracking view.
 * The closed control is the current value. Opening it lists every pen on that
 * view, above the dialog scroll, and a new name is created with `ensureScopePen`.
 */
"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ensureScopePen } from "@/lib/tracking-presence"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

type MenuBox = {
  top: number
  left: number
  width: number
  maxHeight: number
  position: "absolute" | "fixed"
}

function measureMenu(anchor: HTMLElement): { box: MenuBox; target: HTMLElement } {
  const rect = anchor.getBoundingClientRect()
  const dialog = anchor.closest("[role='dialog']") as HTMLElement | null
  const width = Math.min(288, Math.max(rect.width, 220))
  const spaceBelow = window.innerHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12
  const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
  const maxHeight = Math.max(140, Math.min(280, (openUp ? spaceAbove : spaceBelow) - 8))
  if (!dialog) {
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4
    return { box: { top, left, width, maxHeight, position: "fixed" }, target: document.body }
  }
  const host = dialog.getBoundingClientRect()
  const left = Math.max(8, Math.min(rect.left - host.left - dialog.clientLeft, dialog.clientWidth - width - 8))
  const rawTop = openUp
    ? rect.top - host.top - dialog.clientTop - maxHeight - 4
    : rect.bottom - host.top - dialog.clientTop + 4
  return {
    box: { top: Math.max(8, rawTop), left, width, maxHeight, position: "absolute" },
    target: dialog,
  }
}

export function PenSearchSelect({
  scopeId,
  value,
  onValue,
  label,
}: {
  scopeId: string
  value: string
  onValue: (name: string) => void
  label: string
}) {
  const pens = useTimeTrackingStore((s) => s.scopes.find((scope) => scope.id === scopeId)?.pens ?? [])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [box, setBox] = useState<MenuBox | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  function place() {
    const anchor = buttonRef.current
    if (!anchor) return
    const next = measureMenu(anchor)
    setBox(next.box)
    setTarget(next.target)
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const close = (event: PointerEvent) => {
      const node = event.target as Node
      if (buttonRef.current?.contains(node) || menuRef.current?.contains(node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("resize", place)
    window.addEventListener("scroll", onScroll, true)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", onScroll, true)
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!needle) return pens
    return pens.filter((pen) => pen.name.toLowerCase().includes(needle))
  }, [pens, needle])
  const exact = pens.some((pen) => pen.name.trim().toLowerCase() === needle)

  function choose(name: string) {
    onValue(name)
    setOpen(false)
  }

  function addNew() {
    const trimmed = query.trim()
    if (!trimmed) return
    ensureScopePen(scopeId, trimmed)
    choose(trimmed)
  }

  const menu =
    open && box && target
      ? createPortal(
          <div
            ref={menuRef}
            className="htk-menu-pop"
            data-testid="htk-pen-menu"
            style={{
              position: box.position,
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
            }}
          >
            <input
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label={label}
              value={query}
              placeholder="Search or add"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul id={listId} className="htk-menu" role="listbox" aria-label={`${label} values`}>
              {matches.map((pen) => (
                <li key={pen.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={pen.name === value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(pen.name)}
                  >
                    <span className="htk-swatch" style={{ background: pen.color }} aria-hidden />
                    {pen.name}
                  </button>
                </li>
              ))}
              {query.trim() && !exact ? (
                <li role="presentation">
                  <button type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={addNew}>
                    Add {query.trim()}
                  </button>
                </li>
              ) : null}
              {matches.length === 0 && !query.trim() ? <li className="htk-hint">None yet</li> : null}
            </ul>
          </div>,
          target,
        )
      : null

  return (
    <div className="htk-search">
      <button
        ref={buttonRef}
        type="button"
        className="htk-value"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Choose ${label}`}
        onClick={() => {
          setQuery("")
          setOpen((current) => !current)
        }}
      >
        {value.trim() || "Choose"}
      </button>
      {menu}
    </div>
  )
}
