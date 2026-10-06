"use client"

/**
 * components/Search/GlobalSearch.tsx — global command-palette search.
 *
 * One dialog, mounted from `app/page.tsx`. It snapshots items, lists, and
 * folders when it opens (and again if the vault finishes hydrating while it
 * is open), runs the ranked search in `lib/search.ts`, and renders the hits.
 * Up/Down move, Enter opens, Esc closes. Selecting a result calls
 * `onSelect({ id, kind })` and closes the palette; the page routes items to
 * the detail popup and folders/lists into Lists.
 *
 * Advanced options choose which kinds to search, whether completed / hidden
 * items are included, and whether to match titles only.
 *
 * Chrome lives in `search-chrome.css` (`.b2-search`): milled fascia, sunken
 * query well, phosphor lamp on the active row. Ranking math stays in
 * `lib/search.ts`.
 */
import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { getBuiltinItemTypes, getItemType } from "@/lib/item-types"
import { formatDateDisplay } from "@/lib/date-utils"
import { searchItems, displayTitle, type SearchResult } from "@/lib/search"
import type { Item, Task, List, Folder, ItemTypeDefinition } from "@/lib/types"
import "./search-chrome.css"

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

const LISTBOX_ID = "b2-search-results"

/** Whether an item is hidden and should be excluded unless the user opts in.
 * Hidden means explicitly hidden from To-Do, or a completed task. */
function isHidden(item: Item): boolean {
  const task = item as Partial<Task>
  if (task.hiddenFromTodo) return true
  const isTask = item.type === undefined || item.type === "task"
  if (isTask && task.completed) return true
  return false
}

/** Adapt a list/folder so the same ranker can score it. The name is the title;
 * the description is an attribute so it only matches when searching any value. */
function toSearchableItem(record: List | Folder): Item {
  return {
    id: record.id,
    title: record.name,
    createdAt: record.createdAt,
    attributes: record.description ? { description: record.description } : undefined,
  }
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function typeLabel(kind: SearchEntryKind, item: Item, types: ItemTypeDefinition[]): string {
  if (kind === "folder") return "Folder"
  if (kind === "list") return "List"
  return getItemType(types, item.type).name
}

/** List membership for an item, or the parent folder for a list/folder. */
function placeCaption(
  kind: SearchEntryKind,
  item: Item,
  lists: List[],
  folders: Folder[],
): string | null {
  if (kind === "item") {
    const ids = (item as Partial<Task>).lists
    if (!ids?.length) return null
    const names = ids
      .map((id) => lists.find((list) => list.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    if (names.length === 0) return null
    if (names.length === 1) return names[0]
    return `${names[0]} +${names.length - 1}`
  }
  if (kind === "list") {
    return folders.find((folder) => folder.listIds.includes(item.id))?.name ?? null
  }
  const folder = folders.find((entry) => entry.id === item.id)
  if (!folder?.parentFolderId) return null
  return folders.find((entry) => entry.id === folder.parentFolderId)?.name ?? null
}

/** Scheduled date, else deadline, else the created date already on the record. */
function dateCaption(item: Item): string | null {
  const task = item as Partial<Task>
  const scheduled = asDate(task.scheduledDate)
  if (scheduled) return `sched ${formatDateDisplay(scheduled)}`
  const due = asDate(task.deadline)
  if (due) return `due ${formatDateDisplay(due)}`
  const created = asDate(item.createdAt)
  if (created) return formatDateDisplay(created)
  return null
}

function promptCopy(includeFolders: boolean, includeLists: boolean, includeItems: boolean): string {
  const parts = [
    includeFolders ? "folders" : null,
    includeLists ? "lists" : null,
    includeItems ? "items" : null,
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 0) return "Turn on folders, lists, or items under Advanced."
  if (parts.length === 1) return `Type to search ${parts[0]}.`
  if (parts.length === 2) return `Type to search ${parts[0]} and ${parts[1]}.`
  return "Type to search folders, lists, and items."
}

function isPaletteControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest("button, [role='checkbox'], a, label"))
}

export function GlobalSearch({ open, onOpenChange, onSelect, limit = 20 }: GlobalSearchProps) {
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [advancedOpen, setAdvancedOpen] = React.useState(false)

  const [includeFolders, setIncludeFolders] = React.useState(true)
  const [includeLists, setIncludeLists] = React.useState(true)
  const [includeItems, setIncludeItems] = React.useState(true)
  const [includeHidden, setIncludeHidden] = React.useState(false)
  const [titleOnly, setTitleOnly] = React.useState(false)

  const listRef = React.useRef<HTMLUListElement>(null)

  const [items, setItems] = React.useState<Item[]>([])
  const [categories, setLists] = React.useState<List[]>([])
  const [folders, setFolders] = React.useState<Folder[]>([])
  const [types, setTypes] = React.useState<ItemTypeDefinition[]>(() => getBuiltinItemTypes())

  // Snapshot on open so keystrokes don't re-read the store. If the vault is
  // still hydrating, pull again when it lands — otherwise the palette stays
  // empty over a catalog that arrived a moment later.
  React.useLayoutEffect(() => {
    if (!open) return
    let alive = true
    const pull = () => {
      if (!alive) return
      const state = useTaskStore.getState()
      setItems(taskRepository.getAll())
      setLists(state.lists)
      setFolders(state.folders)
      setTypes(useItemTypeStore.getState().types)
    }
    pull()
    setQuery("")
    setActiveIndex(0)
    const unsubs = [useTaskStore.persist.onFinishHydration(pull), useItemTypeStore.persist.onFinishHydration(pull)]
    return () => {
      alive = false
      for (const unsub of unsubs) unsub()
    }
  }, [open])

  const { results, hiddenOnly } = React.useMemo(() => {
    const opts = { titleOnly }
    const combined: CombinedResult[] = []

    if (includeFolders) {
      for (const result of searchItems(query, folders.map(toSearchableItem), opts)) {
        combined.push({ kind: "folder", result })
      }
    }
    if (includeLists) {
      for (const result of searchItems(query, categories.map(toSearchableItem), opts)) {
        combined.push({ kind: "list", result })
      }
    }
    if (includeItems) {
      const searchable = includeHidden ? items : items.filter((item) => !isHidden(item))
      for (const result of searchItems(query, searchable, opts)) {
        combined.push({ kind: "item", result })
      }
    }

    combined.sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score
      const at = displayTitle(a.result.item)
      const bt = displayTitle(b.result.item)
      if (at !== bt) return at < bt ? -1 : 1
      return a.result.item.id < b.result.item.id ? -1 : 1
    })

    let hiddenMatches = 0
    if (includeItems && !includeHidden && query.trim()) {
      const hidden = items.filter(isHidden)
      if (hidden.length > 0) {
        hiddenMatches = searchItems(query, hidden, { ...opts, limit: 1 }).length
      }
    }

    return { results: combined.slice(0, Math.max(0, limit)), hiddenOnly: hiddenMatches > 0 }
  }, [query, items, categories, folders, includeFolders, includeLists, includeItems, includeHidden, titleOnly, limit])

  // A new query or filter lands on the best hit. Same query with a new catalog
  // (vault hydration) only clamps the highlight into range.
  const highlightKey = `${query}\0${includeFolders}\0${includeLists}\0${includeItems}\0${includeHidden}\0${titleOnly}`
  const highlightKeyRef = React.useRef(highlightKey)
  React.useEffect(() => {
    if (highlightKeyRef.current !== highlightKey) {
      highlightKeyRef.current = highlightKey
      setActiveIndex(0)
      return
    }
    setActiveIndex((index) => (results.length === 0 ? 0 : Math.min(index, results.length - 1)))
  }, [highlightKey, results])

  const select = React.useCallback(
    (index: number) => {
      const hit = results[index]
      if (!hit) return
      onSelect({ id: hit.result.item.id, kind: hit.kind })
      onOpenChange(false)
    },
    [results, onSelect, onOpenChange],
  )

  const onPaletteKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (results.length === 0) return
        event.preventDefault()
        setActiveIndex((index) => {
          if (event.key === "ArrowDown") return (index + 1) % results.length
          return (index - 1 + results.length) % results.length
        })
        return
      }
      if (event.key !== "Enter" || event.nativeEvent.isComposing) return
      if (isPaletteControl(event.target)) return
      if (results.length === 0) return
      event.preventDefault()
      select(activeIndex)
    },
    [results.length, activeIndex, select],
  )

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, results])

  const queryEmpty = query.trim().length === 0
  const activeId = results.length > 0 ? `b2-search-opt-${activeIndex}` : undefined
  const emptyCopy = !includeFolders && !includeLists && !includeItems
    ? "Folders, lists, and items are turned off."
    : hiddenOnly
      ? "No results. Completed and hidden items are off."
      : "No results."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="b2-search"
        data-ui-name="Search"
        data-ui-docs="components/Search/README.md"
        onKeyDown={onPaletteKeyDown}
      >
        <div className="b2-search-caption">
          <span className="b2-search-power" aria-hidden />
          <DialogTitle>Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search folders, lists, and items. Arrow keys move, Enter opens, Escape closes.
          </DialogDescription>
        </div>

        <div className="b2-search-query">
          <Input
            autoFocus
            value={query}
            placeholder="Search folders, lists, tasks, tags, notes…"
            onChange={(event) => setQuery(event.target.value)}
            className="b2-search-field"
            role="combobox"
            aria-label="Search items"
            aria-expanded={results.length > 0}
            aria-controls={results.length > 0 ? LISTBOX_ID : undefined}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="b2-search-advanced-trigger">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-90")} />
              Advanced
            </CollapsibleTrigger>
            <CollapsibleContent className="b2-search-advanced">
              <div className="b2-search-advanced-group">
                <span className="b2-search-advanced-label">Search in</span>
                <div className="b2-search-checks">
                  <CheckOption label="Folders" checked={includeFolders} onChange={setIncludeFolders} />
                  <CheckOption label="Lists" checked={includeLists} onChange={setIncludeLists} />
                  <CheckOption label="Items" checked={includeItems} onChange={setIncludeItems} />
                </div>
              </div>
              <div className="b2-search-advanced-group">
                <span className="b2-search-advanced-label">Match</span>
                <div className="b2-search-checks">
                  <CheckOption label="Title only" checked={titleOnly} onChange={setTitleOnly} />
                  <CheckOption label="Include hidden items" checked={includeHidden} onChange={setIncludeHidden} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="b2-search-well">
          {queryEmpty ? (
            <p className="b2-search-empty" role="status">
              {promptCopy(includeFolders, includeLists, includeItems)}
            </p>
          ) : results.length === 0 ? (
            <p className="b2-search-empty" role="status">
              {emptyCopy}
            </p>
          ) : (
            <ul ref={listRef} id={LISTBOX_ID} className="b2-search-list" role="listbox" aria-label="Search results">
              {results.map((hit, index) => {
                const title = displayTitle(hit.result.item)
                const kind = typeLabel(hit.kind, hit.result.item, types)
                const meta = [placeCaption(hit.kind, hit.result.item, categories, folders), dateCaption(hit.result.item)]
                  .filter(Boolean)
                  .join(" · ")
                const active = index === activeIndex
                return (
                  <li
                    key={`${hit.kind}:${hit.result.item.id}`}
                    id={`b2-search-opt-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    title={`Matched ${hit.result.matchedOn.join(", ")}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(index)}
                    className={cn("b2-search-row", active && "is-active")}
                  >
                    <span className="b2-search-lamp" aria-hidden />
                    <span className="b2-search-kind">{kind}</span>
                    <span className="b2-search-title">{title}</span>
                    <span className="b2-search-meta">{meta}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="b2-search-status">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>{queryEmpty ? "" : `${results.length} shown`}</span>
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
    <label className="b2-search-check">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  )
}
