"use client"

/**
 * Default view Sort plate: a nameplate, a milled picker (item fields, then this
 * list's attributes), and a direction key (absent on Custom order, which has none).
 * The picker is the house menu, not the OS popup: a sunken milled face with a
 * black caret, and a metal list portaled onto the shared menu layer with a navy
 * highlight — the same as the Habits Sort and this window's folder menu.
 * Persists through `onChange` (List.defaultView.sort). See DEFAULT_VIEW.md.
 */
import type React from "react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MENU_LAYER_Z } from "@/components/ui/menu-layer"
import { DEFAULT_LIST_ITEM_SORT, defaultSortDir, type ListItemSortOption } from "@/lib/list-item-sort"
import type { ListItemSort, ListItemSortKey } from "@/lib/types"

function dirCaption(key: ListItemSortKey, dir: ListItemSort["dir"]): string {
  if (key === "added" || key === "created" || key === "scheduled" || key === "deadline") {
    return dir === "desc" ? "Newest first" : "Oldest first"
  }
  if (key === "title" || key === "type") return dir === "asc" ? "A to Z" : "Z to A"
  return dir === "asc" ? "Lowest first" : "Highest first"
}

export function ListSortControl({
  sort,
  options,
  onChange,
}: {
  sort: ListItemSort | undefined
  options: ListItemSortOption[]
  onChange: (sort: ListItemSort | undefined) => void
}) {
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [box, setBox] = useState<{ top: number; left: number; minWidth: number } | null>(null)

  const current = sort ?? DEFAULT_LIST_ITEM_SORT
  const selected = options.find((o) => o.key === current.key) ?? options[0]
  const selectedKey = selected?.key ?? "custom"
  const isCustom = selectedKey === "custom"
  const flip = current.dir === "asc" ? "desc" : "asc"
  const firstAttr = options.findIndex((o) => o.group === "attribute")

  const pick = (key: ListItemSortKey) => {
    setOpen(false)
    buttonRef.current?.focus()
    if (key === selectedKey) return
    onChange(key === "custom" ? undefined : { key, dir: defaultSortDir(key) })
  }

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      const menuH = menuRef.current?.offsetHeight ?? 0
      const top = menuH && spaceBelow < menuH + 8 && rect.top > spaceBelow ? rect.top - menuH - 2 : rect.bottom + 2
      setBox({ top, left: rect.left, minWidth: rect.width })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.key === selectedKey)))
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener("mousedown", onPointer)
    return () => window.removeEventListener("mousedown", onPointer)
  }, [open, options, selectedKey])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault()
      setOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      setActive(e.key === "Home" ? 0 : options.length - 1)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const o = options[active]
      if (o) pick(o.key)
    }
  }

  return (
    <div className="fm-sortbar" data-testid="list-sort">
      <span className="fm-sortbar-plate" aria-hidden>
        Sort
      </span>
      <button
        ref={buttonRef}
        type="button"
        data-no95
        role="combobox"
        className="fm-sortbar-select"
        aria-label="Sort by"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-${active}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="fm-sortbar-select-label">{selected?.label ?? "Custom order"}</span>
        <span className="fm-sortbar-select-caret" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              aria-label="Sort by"
              className="fm-sort-menu"
              data-menu-layer=""
              style={{
                position: "fixed",
                top: box?.top ?? -9999,
                left: box?.left ?? -9999,
                minWidth: box?.minWidth,
                zIndex: MENU_LAYER_Z,
              }}
            >
              {options.map((o, i) => (
                <div key={o.key} role="presentation">
                  {i === firstAttr ? (
                    <div className="fm-sort-menu-group" role="presentation">
                      Attributes
                    </div>
                  ) : null}
                  <div
                    id={`${menuId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={o.key === selectedKey}
                    data-active={i === active || undefined}
                    className="fm-sort-menu-option"
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o.key)}
                  >
                    <span className="fm-sort-menu-tick" aria-hidden />
                    {o.label}
                  </div>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
      {isCustom ? null : (
        <button
          type="button"
          data-no95
          className="fm-sortbar-dir"
          aria-label={`${dirCaption(current.key, current.dir)} (switch to ${dirCaption(current.key, flip).toLowerCase()})`}
          title={dirCaption(current.key, current.dir)}
          data-dir={current.dir}
          onClick={() => onChange({ key: current.key, dir: flip })}
        >
          <svg viewBox="0 0 12 14" width="12" height="14" aria-hidden>
            <path className="fm-sortbar-dir-up" d="M3.5 1 L6.5 5 H4.6 V13 H2.4 V5 H0.5 Z" />
            <path className="fm-sortbar-dir-down" d="M8.5 13 L5.5 9 H7.4 V1 H9.6 V9 H11.5 Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
