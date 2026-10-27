/**
 * components/Lists/lists-settings-nav.tsx — Library navigator in Lists settings
 *
 * One click selects. Command/Ctrl-click adds. Shift-click selects a range.
 * Drag reorders, or drops into a folder or list. Double-click opens that
 * folder or list. Order is the order you leave it in.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import type React from "react"
import { ExternalLink, GripVertical, Trash2 } from "lucide-react"
import type { Folder, List } from "@/lib/types"
import { folderFor, iconFor } from "@/components/Lists/lib/icon-utils"
import { isEditableFolder } from "@/lib/folder-tree"
import { isRemindersList } from "@/lib/reminders"
import { isPeopleIKnowList } from "@/lib/people-i-know"
import { isInstagramPeopleList } from "@/lib/instagram-lists"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import {
  filterNavRefs,
  insertionIndex,
  navContainer,
  navDropAllowed,
  navName,
  navPlaceKey,
  navPlacePath,
  navRefKey,
  placeNavItems,
  rowDropZone,
  sameNavPlace,
  searchNav,
  type NavDropZone,
  type NavKindFilter,
  type NavPlace,
  type NavRef,
} from "@/lib/lists-navigator"

interface NavRow {
  ref: NavRef
  place: NavPlace
  path: string
}

interface DragPayload {
  moving: NavRef[]
  source: NavPlace
}

const ROOT: NavPlace = { kind: "root" }
const FILTERS: { id: NavKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "folders", label: "Folders" },
  { id: "lists", label: "Lists" },
]

function placeOf(ref: NavRef): NavPlace {
  return { kind: ref.kind, id: ref.id }
}

export function ListsSettingsNav({
  lists,
  folders,
  itemCounts,
  onChange,
  onDeleteList,
  onDeleteFolder,
  onOpenInLists,
}: {
  lists: List[]
  folders: Folder[]
  itemCounts: Map<string, number>
  onChange: (lists: List[], folders: Folder[]) => void
  onDeleteList: (id: string) => void
  onDeleteFolder: (id: string) => void
  onOpenInLists: (ref: NavRef) => void
}) {
  const [trail, setTrail] = useState<NavPlace[]>([ROOT])
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<NavKindFilter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState(0)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<NavDropZone | null>(null)
  const dragRef = useRef<DragPayload | null>(null)
  const place = trail[trail.length - 1] ?? ROOT
  const searching = query.trim().length > 0

  const rows = useMemo<NavRow[]>(() => {
    if (searching) {
      return searchNav(lists, folders, query, filter).map((hit) => ({
        ref: hit.ref,
        place: hit.place,
        path: hit.path,
      }))
    }
    return filterNavRefs(navContainer(lists, folders, place), filter).map((ref) => ({
      ref,
      place,
      path: "",
    }))
  }, [searching, lists, folders, query, filter, place])

  const enter = (ref: NavRef) => {
    const next = placeOf(ref)
    setTrail((current) => {
      const existing = current.findIndex((item) => sameNavPlace(item, next))
      if (existing >= 0) return current.slice(0, existing + 1)
      return [...current, next]
    })
    setQuery("")
    setSelected(new Set())
    setAnchor(0)
  }

  const goTrail = (index: number) => {
    setTrail((current) => current.slice(0, index + 1))
    setQuery("")
    setSelected(new Set())
    setAnchor(0)
  }

  const applyMove = (moving: NavRef[], source: NavPlace, dest: NavPlace, index: number) => {
    if (!navDropAllowed(lists, folders, moving, source, dest)) return
    const next = placeNavItems(lists, folders, moving, source, dest, index)
    if (next.lists === lists && next.folders === folders) return
    onChange(next.lists, next.folders)
  }

  const movingFor = (row: NavRow): NavRef[] => {
    const key = navRefKey(row.ref)
    const keys = selected.has(key) ? selected : new Set([key])
    const container = navContainer(lists, folders, row.place)
    const moving = container.filter((ref) => keys.has(navRefKey(ref)))
    return moving.length > 0 ? moving : [row.ref]
  }

  const onRowClick = (event: React.MouseEvent, row: NavRow, index: number) => {
    const key = navRefKey(row.ref)
    if (event.shiftKey) {
      const start = Math.min(anchor, index)
      const end = Math.max(anchor, index)
      const next = new Set<string>()
      for (const item of rows.slice(start, end + 1)) {
        if (searching && !sameNavPlace(item.place, row.place)) continue
        next.add(navRefKey(item.ref))
      }
      if (next.size === 0) next.add(key)
      setSelected(next)
      return
    }
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setSelected(next)
      setAnchor(index)
      return
    }
    setSelected(new Set([key]))
    setAnchor(index)
  }

  const onDragStart = (event: React.DragEvent, row: NavRow) => {
    if ((event.target as HTMLElement).closest("[data-nav-action]")) {
      event.preventDefault()
      return
    }
    const moving = movingFor(row)
    dragRef.current = { moving, source: row.place }
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", moving.map(navRefKey).join("\n"))
    const key = navRefKey(row.ref)
    if (!selected.has(key)) setSelected(new Set([key]))
  }

  const zoneFor = (event: React.DragEvent, row: NavRow): NavDropZone | null => {
    const drag = dragRef.current
    if (!drag) return null
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const scheduledFolder = row.ref.kind === "folder" && isScheduledFolderId(row.ref.id)
    const canInto = !scheduledFolder && navDropAllowed(lists, folders, drag.moving, drag.source, placeOf(row.ref))
    const zone = rowDropZone(event.clientY, rect.top, rect.height, canInto)
    if (zone === "into") return "into"
    if (searching) return null
    if (!navDropAllowed(lists, folders, drag.moving, drag.source, row.place)) return null
    return zone
  }

  const onDragOverRow = (event: React.DragEvent, row: NavRow) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    const zone = zoneFor(event, row)
    const key = `${navPlaceKey(row.place)}:${navRefKey(row.ref)}`
    setDropKey(zone ? key : null)
    setDropZone(zone)
  }

  const onDropRow = (event: React.DragEvent, row: NavRow, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    const drag = dragRef.current
    const zone = zoneFor(event, row)
    setDropKey(null)
    setDropZone(null)
    dragRef.current = null
    if (!drag || !zone) return
    if (zone === "into") {
      const dest = placeOf(row.ref)
      applyMove(drag.moving, drag.source, dest, navContainer(lists, folders, dest).length)
      return
    }
    const full = navContainer(lists, folders, row.place)
    const visible = rows.filter((item) => sameNavPlace(item.place, row.place)).map((item) => item.ref)
    const visibleIndex = visible.findIndex((ref) => ref.kind === row.ref.kind && ref.id === row.ref.id)
    applyMove(drag.moving, drag.source, row.place, insertionIndex(full, visible, visibleIndex < 0 ? index : visibleIndex, zone))
  }

  const onWellDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const drag = dragRef.current
    setDropKey(null)
    setDropZone(null)
    dragRef.current = null
    if (!drag || searching) return
    applyMove(drag.moving, drag.source, place, navContainer(lists, folders, place).length)
  }

  const clearDrag = () => {
    dragRef.current = null
    setDropKey(null)
    setDropZone(null)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (rows.length === 0) return
    const current = rows.findIndex((row) => selected.has(navRefKey(row.ref)))
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      const next = current < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, current + step))
      setSelected(new Set([navRefKey(rows[next].ref)]))
      setAnchor(next)
      return
    }
    if (event.key === "Enter" && current >= 0) {
      event.preventDefault()
      enter(rows[current].ref)
    }
  }

  const crumb = trail.map((item, index) => ({
    place: item,
    label: item.kind === "root" ? "Library" : navName(lists, folders, { kind: item.kind, id: item.id }),
    index,
  }))

  return (
    <div className="lst-nav" data-testid="lists-nav">
      <div className="lst-nav-tools">
        <input
          data-testid="lists-nav-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search folders and lists"
          aria-label="Search folders and lists"
        />
        <div className="lst-nav-filters" role="group" aria-label="Show">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p
        className="lst-nav-help"
        title="Double-click a folder or list to open it. Drag to reorder, or drop onto a folder to file it. Command-click or Ctrl-click selects more than one."
      >
        Double-click to open. Drag to reorder or file. ⌘/Ctrl-click selects more than one.
      </p>
      <div className="lst-nav-crumb" aria-label="Library path">
        {crumb.map((item, index) => (
          <span key={navPlaceKey(item.place)} style={{ display: "contents" }}>
            {index > 0 ? <span className="lst-nav-sep">/</span> : null}
            <button
              type="button"
              aria-current={index === crumb.length - 1 ? "page" : undefined}
              onClick={() => goTrail(item.index)}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                const drag = dragRef.current
                clearDrag()
                if (!drag) return
                applyMove(drag.moving, drag.source, item.place, navContainer(lists, folders, item.place).length)
              }}
            >
              {item.label}
            </button>
          </span>
        ))}
      </div>
      <div
        className="lst-nav-well"
        role="listbox"
        aria-label="Folders and lists"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = "move"
        }}
        onDrop={onWellDrop}
      >
        {rows.length === 0 ? (
          <p className="lst-nav-empty">{searching ? "No matches." : "Nothing here."}</p>
        ) : (
          rows.map((row, index) => {
            const key = `${navPlaceKey(row.place)}:${navRefKey(row.ref)}`
            const record =
              row.ref.kind === "folder"
                ? folders.find((folder) => folder.id === row.ref.id)
                : lists.find((list) => list.id === row.ref.id)
            const name = record?.name ?? navName(lists, folders, row.ref)
            const selectedRow = selected.has(navRefKey(row.ref))
            const scheduled = row.ref.kind === "folder" && isScheduledFolderId(row.ref.id)
            const showDelete =
              !(row.ref.kind === "list" && record && (isRemindersList(record) || isPeopleIKnowList(record) || isInstagramPeopleList(record))) &&
              (row.ref.kind === "list" || isEditableFolder(row.ref.id))
            const inside = navContainer(lists, folders, placeOf(row.ref)).length
            const extraFolders =
              row.ref.kind === "list"
                ? folders.filter(
                    (folder) =>
                      folder.listIds.includes(row.ref.id) &&
                      !(row.place.kind === "folder" && folder.id === row.place.id),
                  )
                : []
            const meta =
              row.ref.kind === "folder"
                ? inside === 1
                  ? "1 inside"
                  : `${inside} inside`
                : [
                    `${itemCounts.get(row.ref.id) ?? 0} items`,
                    inside ? (inside === 1 ? "1 sublist" : `${inside} sublists`) : "",
                    extraFolders.length === 1
                      ? `also in ${extraFolders[0].name}`
                      : extraFolders.length > 1
                        ? `also in ${extraFolders.length} folders`
                        : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
            const dragging = dragRef.current?.moving.some((ref) => ref.kind === row.ref.kind && ref.id === row.ref.id)
            return (
              <div
                key={key}
                role="option"
                aria-selected={selectedRow}
                data-testid="lists-nav-row"
                data-nav-id={row.ref.id}
                className={[
                  "lst-nav-row",
                  selectedRow ? "is-selected" : "",
                  dragging ? "is-dragging" : "",
                  dropKey === key && dropZone ? `is-drop-${dropZone}` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable={!scheduled}
                onClick={(event) => onRowClick(event, row, index)}
                onDoubleClick={() => enter(row.ref)}
                onDragStart={(event) => onDragStart(event, row)}
                onDragOver={(event) => onDragOverRow(event, row)}
                onDrop={(event) => onDropRow(event, row, index)}
                onDragEnd={clearDrag}
              >
                <GripVertical className="lst-nav-grip" aria-hidden />
                <img
                  className="lst-nav-icon"
                  alt=""
                  src={
                    row.ref.kind === "folder"
                      ? record?.icon || folderFor(row.ref.id)
                      : iconFor(row.ref.id, record?.icon)
                  }
                />
                <span className="lst-nav-swatch" style={{ background: record?.color || "#94a3b8" }} />
                <span className="lst-nav-copy">
                  <span className="lst-nav-name">{name}</span>
                  <span className="lst-nav-meta">{meta}</span>
                  {row.path ? <span className="lst-nav-path">{row.path}</span> : null}
                </span>
                <span className="lst-nav-actions">
                  <button
                    type="button"
                    data-nav-action="open"
                    title="Open in Lists"
                    aria-label={`Open ${name} in Lists`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenInLists(row.ref)
                    }}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  {showDelete ? (
                    <button
                      type="button"
                      data-nav-action="delete"
                      title={row.ref.kind === "folder" ? "Delete folder" : "Delete list"}
                      aria-label={row.ref.kind === "folder" ? `Delete folder ${name}` : `Delete list ${name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (row.ref.kind === "folder") onDeleteFolder(row.ref.id)
                        else onDeleteList(row.ref.id)
                      }}
                      onDragStart={(event) => event.preventDefault()}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              </div>
            )
          })
        )}
      </div>
      <p className="lst-nav-count">
        {selected.size > 1 ? `${selected.size} selected · ` : ""}
        {searching ? `${rows.length} matches` : `${rows.length} here`}
      </p>
    </div>
  )
}
