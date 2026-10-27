/**
 * components/Analytics/ItemTypesLibrary.tsx — Browse every created item type
 *
 * Analytics Library surface: sort, count, and drill into items. Settings still
 * edits types; this is the catalog. Open in Lists is the loop.
 */
"use client"

import { useMemo, useState } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { itemsOfType } from "@/lib/item-types"
import { displayTitle } from "@/lib/search"
import { iconFor } from "@/components/Icons/Icon"
import { ItemTypeEditor } from "@/components/ItemTypes/ItemTypeEditor"
import type { ItemTypeDefinition } from "@/lib/types"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { openItemsInLists } from "./open-in-lists"
import { RelationsLibrary } from "./relations/RelationsLibrary"
import { NativeSelect } from "@/components/ui/native-select"
import { StudioBars, StudioReadout, inkOnFill } from "./studio-kit"
import { LibPlate, LibSearch, fmt } from "./library-kit"
import { shannon } from "./library-stats"

type SortKey = "name" | "count" | "kind"
type KindFilter = "all" | "system" | "catalog" | "user"

function typeKind(type: ItemTypeDefinition): Exclude<KindFilter, "all"> {
  if (type.kind === "catalog") return "catalog"
  if (type.builtin || type.kind === "system") return "system"
  return "user"
}

function kindWeight(type: ItemTypeDefinition): number {
  const k = typeKind(type)
  return k === "system" ? 0 : k === "catalog" ? 1 : 2
}

function kindLabel(type: ItemTypeDefinition): string {
  const k = typeKind(type)
  if (k === "system") return "System"
  if (k === "catalog") return "Catalog"
  return "User"
}

/** Types and Relations side by side (LINKS_REDESIGN L2.1). */
export function ItemTypesLibrary() {
  const [tab, setTab] = useState<"types" | "relations">("types")
  return (
    <>
      <div className="an-library-filters" role="tablist" aria-label="Library section">
        {(["types", "relations"] as const).map((t) => (
          <button key={t} type="button" role="tab" className="an-chip" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "types" ? "Types" : "Relations"}
          </button>
        ))}
      </div>
      {tab === "types" ? <TypesCatalog /> : <RelationsLibrary />}
    </>
  )
}

function TypesCatalog() {
  const types = useItemTypeStore((s) => s.types)
  const addType = useItemTypeStore((s) => s.addType)
  const updateType = useItemTypeStore((s) => s.updateType)
  const deleteType = useItemTypeStore((s) => s.deleteType)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)

  const [sort, setSort] = useState<SortKey>("count")
  const [kind, setKind] = useState<KindFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ItemTypeDefinition | null | undefined>(undefined)
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const counted = types.map((type) => {
      const items = itemsOfType(type.id as string, tasks, lists, types)
      const listCount = lists.filter((l) => l.itemTypeId === type.id).length
      return { type, items, listCount, count: items.length }
    })
    const q = query.trim().toLowerCase()
    const filtered = counted.filter(
      (r) =>
        (kind === "all" || typeKind(r.type) === kind) &&
        (!q || r.type.name.toLowerCase().includes(q) || (r.type.description ?? "").toLowerCase().includes(q)),
    )
    return filtered.sort((a, b) => {
      if (sort === "count") return b.count - a.count || a.type.name.localeCompare(b.type.name)
      if (sort === "kind") {
        return kindWeight(a.type) - kindWeight(b.type) || a.type.name.localeCompare(b.type.name)
      }
      return a.type.name.localeCompare(b.type.name)
    })
  }, [kind, lists, query, sort, tasks, types])

  const selected = rows.find((r) => r.type.id === selectedId) ?? rows[0] ?? null
  const totalItems = rows.reduce((s, r) => s + r.count, 0)
  const inUse = rows.filter((r) => r.count > 0).length
  const spread = shannon(rows.map((r) => r.count))
  const top = rows.reduce<(typeof rows)[number] | null>((best, r) => (!best || r.count > best.count ? r : best), null)
  // Schema coverage: share of the selected type's items that carry each attribute.
  const coverage = selected
    ? (selected.type.attributes ?? []).map((def) => {
        const filled = selected.items.filter((item) => {
          const raw = (item as { attributes?: Record<string, unknown> }).attributes?.[def.id]
          return raw !== undefined && raw !== null && raw !== "" && !(Array.isArray(raw) && raw.length === 0)
        }).length
        return { name: def.name, value: selected.count ? Math.round((filled / selected.count) * 100) : 0 }
      })
    : []

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (type: ItemTypeDefinition) => {
    setEditing(type)
    setEditorOpen(true)
  }

  const handleSave = (def: ItemTypeDefinition) => {
    if (types.some((t) => t.id === def.id)) updateType(def)
    else addType(def)
  }

  const handleDelete = (type: ItemTypeDefinition) => {
    if (type.builtin) return
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Delete the "${type.name}" item type? Items of this type keep their data.`)
    if (!ok) return
    deleteType(type.id as string)
    if (editing?.id === type.id) {
      setEditorOpen(false)
      setEditing(undefined)
    }
    if (selectedId === type.id) setSelectedId(null)
  }

  return (
    <div className="an-library" data-testid="item-types-library">
      <header className="an-library-head">
        <div>
          <p className="an-canvas-title">Item Types</p>
          <p className="an-canvas-kicker">
            {`${types.length} type${types.length === 1 ? "" : "s"} · ${totalItems} item${
              totalItems === 1 ? "" : "s"
            } in this filter · Settings still edits schemas`}
          </p>
        </div>
        <div className="an-library-tools">
          <label className="an-library-field">
            Sort
            <NativeSelect
              aria-label="Sort item types"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="count">By count</option>
              <option value="name">By name</option>
              <option value="kind">By kind</option>
            </NativeSelect>
          </label>
          <div className="an-library-filters" role="group" aria-label="Filter item types">
            {(["all", "system", "catalog", "user"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="an-chip"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <LibSearch value={query} onChange={setQuery} label="Search types" />
          <button type="button" className="an-chip" onClick={openNew}>
            New type
          </button>
        </div>
      </header>

      {rows.length > 0 && (
        <div className="an-readouts">
          <StudioReadout label="In use" value={`${inUse}/${rows.length}`} note="types with items" />
          <StudioReadout
            label="Top type"
            value={top && totalItems ? `${Math.round((top.count / totalItems) * 100)}%` : "—"}
            note={top ? top.type.name : undefined}
            tip="Share of items (in this filter) held by the biggest type. An item that matches two types counts in both."
          />
          <StudioReadout
            label="Evenness"
            value={fmt(spread.evenness)}
            note={`H = ${fmt(spread.bits)} bits`}
            tip="Pielou J of items across types. 1 = items spread evenly; near 0 = one type holds nearly all."
          />
        </div>
      )}

      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No item types in this filter." />
      ) : (
        <>
          <div className="an-mosaic" role="list" aria-label="Item types by count">
            {rows.map((row) => {
              const active = selected?.type.id === row.type.id
              return (
                <button
                  key={row.type.id as string}
                  type="button"
                  className={`an-mosaic-cell${active ? " is-active" : ""}${row.count ? "" : " is-empty"}`}
                  style={{
                    flexGrow: row.count,
                    background: row.type.color || "#1e3a4c",
                    color: inkOnFill(row.type.color || "#1e3a4c"),
                  }}
                  onClick={() => setSelectedId(row.type.id as string)}
                  title={`${row.type.name}: ${row.count} items`}
                >
                  <img src={iconFor(row.type.id as string, row.type.icon)} alt="" width={22} height={22} />
                  <span className="an-mosaic-name">{row.type.name}</span>
                  <span className="an-mosaic-count">{row.count}</span>
                </button>
              )
            })}
          </div>

          <div className="an-library-split">
            <ul className="an-type-list">
              {rows.map((row) => {
                const active = selected?.type.id === row.type.id
                return (
                  <li key={row.type.id as string}>
                    <button
                      type="button"
                      className={`an-type-row${active ? " is-active" : ""}`}
                      onClick={() => setSelectedId(row.type.id as string)}
                    >
                      <span
                        className="an-type-swatch"
                        style={{ background: row.type.color || "#94a3b8" }}
                        aria-hidden
                      />
                      <img src={iconFor(row.type.id as string, row.type.icon)} alt="" width={18} height={18} />
                      <span className="an-type-name">{row.type.name}</span>
                      <span className="an-type-kind">{kindLabel(row.type)}</span>
                      <span className="an-type-count tabular-nums">
                        {`${row.count} item${row.count === 1 ? "" : "s"}${
                          row.listCount ? ` · ${row.listCount} list${row.listCount === 1 ? "" : "s"}` : ""
                        }`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {selected && (
              <section className="an-type-detail" aria-label={`${selected.type.name} items`}>
                <header>
                  <p className="an-type-detail-title">{selected.type.name}</p>
                  <p className="an-canvas-kicker">
                    {kindLabel(selected.type)}
                    {selected.type.description ? ` · ${selected.type.description}` : ""}
                  </p>
                </header>
                <div className="an-type-detail-actions">
                  <button type="button" className="an-chip" onClick={() => openEdit(selected.type)}>
                    Edit type
                  </button>
                  {!selected.type.builtin && (
                    <button type="button" className="an-chip" onClick={() => handleDelete(selected.type)}>
                      Delete
                    </button>
                  )}
                  <OpenInListsButton
                    taskIds={selected.items.map((item) => item.id)}
                    label={`Open ${selected.count} item(s) in Lists`}
                  />
                </div>
                {coverage.length > 0 && selected.count > 0 ? (
                  <LibPlate title="Schema coverage" note="Share of this type's items that carry each attribute.">
                    <StudioBars rows={coverage} max={100} />
                  </LibPlate>
                ) : null}
                {selected.items.length === 0 ? (
                  <p className="an-chart-empty">No items use this type yet.</p>
                ) : (
                  <ul className="an-type-items">
                    {selected.items
                      .slice()
                      .sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)))
                      .slice(0, 40)
                      .map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => openItemsInLists({ taskIds: [item.id] })}
                          >
                            {displayTitle(item)}
                          </button>
                        </li>
                      ))}
                    {selected.items.length > 40 && (
                      <li className="an-canvas-kicker">+{selected.items.length - 40} more in Lists</li>
                    )}
                  </ul>
                )}
              </section>
            )}
          </div>
        </>
      )}

      <ItemTypeEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditing(undefined)
        }}
        type={editing === undefined ? undefined : editing}
        existingIds={types.map((t) => t.id as string)}
        onSave={handleSave}
        onDelete={editing && !editing.builtin ? () => handleDelete(editing) : undefined}
        onNavigateType={(type) => {
          setSelectedId(type.id as string)
          openEdit(type)
        }}
        allTypes={types}
      />
    </div>
  )
}
