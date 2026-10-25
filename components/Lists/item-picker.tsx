/**
 * components/Lists/item-picker.tsx — Searchable item catalog
 *
 * The item twin of `list-picker.tsx`. A native or Radix `<select>` of every
 * item becomes one long unreadable menu. This is a search field over a
 * bounded, full-width row list. Single chooses one id. Multi ticks several.
 * Thousands of items stay capped; the rest ask the person to keep typing.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { iconFor } from "@/components/Icons"
import "./list-picker.css"

const BROWSE_CAP = 60
const SEARCH_CAP = 40

export interface ItemChoice {
  id: string
  title: string
  icon?: string
  hint?: string
}

function rankTitle(title: string, needle: string): number {
  if (title.startsWith(needle)) return 0
  if (title.includes(` ${needle}`)) return 1
  if (title.includes(needle)) return 2
  return -1
}

function PickerChrome({
  search,
  onSearch,
  searchLabel,
  placeholder,
  compact,
  onEnter,
  children,
  selectedCount,
}: {
  search: string
  onSearch: (value: string) => void
  searchLabel: string
  placeholder: string
  compact: boolean
  onEnter: () => void
  children: ReactNode
  selectedCount: number
}) {
  return (
    <div className={`catalog-picker border rounded-md ${compact ? "text-sm" : ""}`}>
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                onEnter()
              }
            }}
            placeholder={placeholder}
            aria-label={searchLabel}
            className="h-8 pl-8"
          />
        </div>
      </div>
      <div className={`list-picker-body p-1 ${compact ? "max-h-40" : "max-h-64"}`}>{children}</div>
      {selectedCount > 0 && !compact ? (
        <div className="px-2 pb-2">
          <Label className="text-[10px] text-muted-foreground">Selected ({selectedCount})</Label>
        </div>
      ) : null}
    </div>
  )
}

function useWindow<T>(items: T[], needle: string, textOf: (item: T) => string) {
  return useMemo(() => {
    const q = needle.trim().toLowerCase()
    const pool = q ? items.filter((item) => textOf(item).toLowerCase().includes(q)) : items
    const cap = q ? SEARCH_CAP : BROWSE_CAP
    const ranked = [...pool].sort((a, b) => {
      if (!q) return textOf(a).localeCompare(textOf(b))
      const ar = rankTitle(textOf(a).toLowerCase(), q)
      const br = rankTitle(textOf(b).toLowerCase(), q)
      return ar - br || textOf(a).length - textOf(b).length || textOf(a).localeCompare(textOf(b))
    })
    return { shown: ranked.slice(0, cap), hidden: Math.max(0, ranked.length - cap) }
  }, [items, needle, textOf])
}

export function ItemPicker({
  choices,
  selected,
  onChange,
  mode = "single",
  compact = false,
  searchLabel = "Search items",
  placeholder = "Search items…",
  emptyLabel = "No items match.",
}: {
  choices: ItemChoice[]
  selected: string[]
  onChange: (ids: string[]) => void
  mode?: "single" | "multi"
  compact?: boolean
  searchLabel?: string
  placeholder?: string
  emptyLabel?: string
}) {
  const [search, setSearch] = useState("")
  const textOf = useMemo(() => (choice: ItemChoice) => `${choice.title} ${choice.hint ?? ""}`, [])
  const { shown, hidden } = useWindow(choices, search, textOf)
  const byId = useMemo(() => new Map(choices.map((choice) => [choice.id, choice])), [choices])
  const shownIds = useMemo(() => new Set(shown.map((choice) => choice.id)), [shown])
  const pinned = selected
    .map((id) => byId.get(id))
    .filter((choice): choice is ItemChoice => !!choice && !shownIds.has(choice.id))

  const toggle = (id: string) => {
    if (mode === "multi") onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    else onChange(selected.includes(id) ? [] : [id])
  }

  const rows = [...pinned, ...shown]
  const pickFirst = () => {
    const first = rows[0]
    if (first) toggle(first.id)
  }

  return (
    <div className="catalog-field">
      <PickerChrome
        search={search}
        onSearch={setSearch}
        searchLabel={searchLabel}
        placeholder={placeholder}
        compact={compact}
        onEnter={pickFirst}
        selectedCount={selected.length}
      >
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">{emptyLabel}</p>
        ) : (
          rows.map((choice) => {
            const on = selected.includes(choice.id)
            const rowClass = `list-picker-row w-full px-2 py-1.5 text-sm rounded hover:bg-muted/60${on ? " bg-muted" : ""}`
            const body = (
              <>
                <img
                  src={iconFor(choice.id, choice.icon)}
                  alt=""
                  width={18}
                  height={18}
                  draggable={false}
                  style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
                />
                <span className="truncate">{choice.title}</span>
                {choice.hint ? <span className="truncate text-xs text-muted-foreground">{choice.hint}</span> : null}
              </>
            )
            if (mode === "multi") {
              return (
                <label key={choice.id} className={rowClass}>
                  <Checkbox checked={on} onCheckedChange={() => toggle(choice.id)} aria-label={choice.title} />
                  {body}
                </label>
              )
            }
            return (
              <button key={choice.id} type="button" className={rowClass} onClick={() => toggle(choice.id)}>
                {body}
              </button>
            )
          })
        )}
        {hidden > 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">{hidden} more — keep typing</p>
        ) : null}
      </PickerChrome>
    </div>
  )
}

/** Searchable choice list when the options are plain strings (a long selection attribute). */
export function StringPicker({
  options,
  selected,
  onChange,
  mode = "single",
  compact = true,
  searchLabel = "Search options",
  placeholder = "Search…",
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  mode?: "single" | "multi"
  compact?: boolean
  searchLabel?: string
  placeholder?: string
}) {
  const [search, setSearch] = useState("")
  const textOf = useMemo(() => (option: string) => option, [])
  const { shown, hidden } = useWindow(options, search, textOf)
  const shownSet = useMemo(() => new Set(shown), [shown])
  const q = search.trim().toLowerCase()
  const pinned = selected.filter((option) => options.includes(option) && !shownSet.has(option) && (!q || option.toLowerCase().includes(q)))
  const rows = [...pinned, ...shown.filter((option) => !pinned.includes(option))]

  const toggle = (option: string) => {
    if (mode === "multi") onChange(selected.includes(option) ? selected.filter((x) => x !== option) : [...selected, option])
    else onChange(selected.includes(option) ? [] : [option])
  }

  return (
    <div className="catalog-field">
      <PickerChrome
        search={search}
        onSearch={setSearch}
        searchLabel={searchLabel}
        placeholder={placeholder}
        compact={compact}
        onEnter={() => {
          const first = rows[0]
          if (first) toggle(first)
        }}
        selectedCount={selected.length}
      >
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">No options match.</p>
        ) : (
          rows.map((option) => {
            const on = selected.includes(option)
            const rowClass = `list-picker-row w-full px-2 py-1.5 text-sm rounded hover:bg-muted/60${on ? " bg-muted" : ""}`
            if (mode === "multi") {
              return (
                <label key={option} className={rowClass}>
                  <Checkbox checked={on} onCheckedChange={() => toggle(option)} aria-label={option} />
                  <span className="truncate">{option}</span>
                </label>
              )
            }
            return (
              <button key={option} type="button" className={rowClass} onClick={() => toggle(option)}>
                <span className="truncate">{option}</span>
              </button>
            )
          })
        )}
        {hidden > 0 ? <p className="text-xs text-muted-foreground px-2 py-1">{hidden} more — keep typing</p> : null}
      </PickerChrome>
    </div>
  )
}
