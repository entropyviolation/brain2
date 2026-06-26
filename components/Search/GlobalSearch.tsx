"use client"

/**
 * components/Search/GlobalSearch.tsx — Phase 6a global command-palette search.
 *
 * A dialog-based search palette. It reads all items from the task repository
 * (plus lists/folders from the task store), runs the pure ranked search in
 * `lib/search.ts`, and renders the ranked hits with full keyboard navigation
 * (Up/Down to move, Enter to select, Esc to close). Selecting a result calls
 * `onSelect({ id, kind })` and closes the palette; the parent decides what
 * "open this result" means (see README).
 *
 * Advanced options (collapsible) let the user choose which kinds of records to
 * search (folders, lists, items), whether to include hidden items, and whether
 * to match titles only or any text value within a record.
 *
 * No shadcn `command` primitive exists in `components/ui/`, so this is built on
 * the `dialog` + `input` primitives with a hand-rolled, accessible results list.
 */
import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { searchItems, displayTitle, type SearchResult } from "@/lib/search"
import type { Item, Task, List, Folder } from "@/lib/types"

/** The kind of record a search hit refers to. */
export type SearchEntryKind = "item" | "list" | "folder"

/** What `onSelect` receives so the parent can route to the right destination. */
export interface SearchSelection {
  id: string
  kind: SearchEntryKind
}

/** A ranked hit annotated with the kind of record it represents. */
interface CombinedResult {
  kind: SearchEntryKind
  result: SearchResult<Item>
}

export interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the selected record's id + kind when the user picks a result. */
  onSelect: (selection: SearchSelection) => void
  /** Max results to render. Default: 20. */
  limit?: number
}

/** Whether an item is hidden and should be excluded from search results unless
 * the user opts to include hidden items. An item counts as hidden when it is
 * explicitly hidden from To-Do lists, or when it is a completed task. */
function isHidden(item: Item): boolean {
  const task = item as Partial<Task>
  if (task.hiddenFromTodo) return true
  const isTask = item.type === undefined || item.type === "task"
  if (isTask && task.completed) return true
  return false
}

/** Adapt a list/folder to the generic `Item` shape so it can be ranked by the
 * same search. The name becomes the title; the description (if any) becomes a
 * free-text attribute so it only matches when searching "any value within". */
function toSearchableItem(record: List | Folder): Item {
  return {
    id: record.id,
    title: record.name,
    createdAt: record.createdAt,
    attributes: record.description ? { description: record.description } : undefined,
  }
}

const KIND_LABEL: Record<SearchEntryKind, string> = {
  item: "item",
  list: "list",
  folder: "folder",
}

export function GlobalSearch({ open, onOpenChange, onSelect, limit = 20 }: GlobalSearchProps) {
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [advancedOpen, setAdvancedOpen] = React.useState(false)

  // Advanced options.
  const [includeFolders, setIncludeFolders] = React.useState(true)
  const [includeLists, setIncludeLists] = React.useState(true)
  const [includeItems, setIncludeItems] = React.useState(true)
  const [includeHidden, setIncludeHidden] = React.useState(false)
  const [titleOnly, setTitleOnly] = React.useState(false)

  const listRef = React.useRef<HTMLUListElement>(null)

  // Snapshot the records whenever the palette opens so results are stable while
  // typing (and we don't re-read the stores on every keystroke).
  const [items, setItems] = React.useState<Item[]>([])
  const [categories, setLists] = React.useState<List[]>([])
  const [folders, setFolders] = React.useState<Folder[]>([])
  React.useEffect(() => {
    if (open) {
      const state = useTaskStore.getState()
      setItems(taskRepository.getAll())
      setLists(state.lists)
      setFolders(state.folders)
      setQuery("")
      setActiveIndex(0)
    }
  }, [open])

  const results = React.useMemo<CombinedResult[]>(() => {
    const opts = { titleOnly }
    const combined: CombinedResult[] = []

    if (includeFolders) {
      for (const r of searchItems(query, folders.map(toSearchableItem), opts)) {
        combined.push({ kind: "folder", result: r })
      }
    }
    if (includeLists) {
      for (const r of searchItems(query, categories.map(toSearchableItem), opts)) {
        combined.push({ kind: "list", result: r })
      }
    }
    if (includeItems) {
      const searchable = includeHidden ? items : items.filter((item) => !isHidden(item))
      for (const r of searchItems(query, searchable, opts)) {
        combined.push({ kind: "item", result: r })
      }
    }

    // Merge the per-kind ranked lists into one, best-first, then cap.
    combined.sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score
      const at = displayTitle(a.result.item)
      const bt = displayTitle(b.result.item)
      if (at !== bt) return at < bt ? -1 : 1
      return a.result.item.id < b.result.item.id ? -1 : 1
    })
    return combined.slice(0, Math.max(0, limit))
  }, [query, items, categories, folders, includeFolders, includeLists, includeItems, includeHidden, titleOnly, limit])

  // Keep the active index within bounds as results change.
  React.useEffect(() => {
    setActiveIndex((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)))
  }, [results.length])

  const select = React.useCallback(
    (index: number) => {
      const hit = results[index]
      if (!hit) return
      onSelect({ id: hit.result.item.id, kind: hit.kind })
      onOpenChange(false)
    },
    [results, onSelect, onOpenChange]
  )

  function onKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      select(activeIndex)
    }
  }

  // Keep the active row scrolled into view.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search items</DialogTitle>
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            placeholder="Search folders, lists, tasks, tags, notes…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Search items"
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="mt-1 flex items-center gap-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
              Advanced
            </CollapsibleTrigger>
            <CollapsibleContent className="px-1 pb-1 pt-2">
              <div className="flex flex-col gap-3 text-xs text-muted-foreground">
                <div className="flex flex-col gap-1.5">
                  <span className="font-medium text-foreground">Search in</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    <CheckOption label="Folders" checked={includeFolders} onChange={setIncludeFolders} />
                    <CheckOption label="Lists" checked={includeLists} onChange={setIncludeLists} />
                    <CheckOption label="Items" checked={includeItems} onChange={setIncludeItems} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-medium text-foreground">Match</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    <CheckOption label="Title only" checked={titleOnly} onChange={setTitleOnly} />
                    <CheckOption label="Include hidden items" checked={includeHidden} onChange={setIncludeHidden} />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-1" role="listbox">
          {query.trim().length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search across all folders, lists, and items.
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</li>
          ) : (
            results.map((hit, index) => (
              <li
                key={`${hit.kind}:${hit.result.item.id}`}
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                  index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                    {KIND_LABEL[hit.kind]}
                  </span>
                  <span className="truncate">{displayTitle(hit.result.item)}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {hit.result.matchedOn.map((field) => (
                    <span
                      key={field}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                    >
                      {field}
                    </span>
                  ))}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>{results.length > 0 ? `${results.length} result${results.length === 1 ? "" : "s"}` : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
      {label}
    </label>
  )
}
