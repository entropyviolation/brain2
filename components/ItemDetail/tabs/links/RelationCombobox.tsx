/**
 * components/ItemDetail/links/RelationCombobox.tsx — Pick the relation word
 * in the Links composer (PD 6.2).
 *
 * A text box that searches every relation this item can use, in sections:
 * "For {type}" (relations scoped to this item's or the target's type), "Any"
 * (built-ins open to every type), "Yours" (custom). Archived ones are hidden.
 * When the typed phrase is not an exact label, the last row is
 * **Create "{typed}"**, which hands the phrase to `onCreate`. ↑ ↓ Enter Esc.
 */
"use client"

import { useId, useMemo, useState } from "react"
import { relationLabel, type RelationDef } from "@/lib/links"
import { relationsFor } from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"

type Row =
  | { kind: "relation"; def: RelationDef; section: string }
  | { kind: "create"; phrase: string }

export function RelationCombobox({
  value,
  onChange,
  onCreate,
  fromTypeId,
  fromTypeName,
  toTypeId,
}: {
  value: string
  onChange: (relationId: string) => void
  onCreate: (phrase: string) => void
  fromTypeId?: string
  fromTypeName?: string
  /** The chosen target's type, when a target is picked. */
  toTypeId?: string
}) {
  const listId = useId()
  // Re-read when custom relations change (the registry is fed from this store).
  const custom = useItemTypeStore((s) => s.relations)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const open = query !== null

  const rows = useMemo<Row[]>(() => {
    const q = (query ?? "").trim().toLowerCase()
    const defs = relationsFor(fromTypeId, toTypeId).filter((def) => !q || def.label.toLowerCase().includes(q))
    const scoped = defs.filter((def) => !def.custom && (def.fromTypes?.length || def.toTypes?.length))
    const any = defs.filter((def) => !def.custom && !def.fromTypes?.length && !def.toTypes?.length)
    const yours = defs.filter((def) => def.custom)
    const out: Row[] = [
      ...scoped.map((def) => ({ kind: "relation" as const, def, section: `For ${fromTypeName ?? "this type"}` })),
      ...any.map((def) => ({ kind: "relation" as const, def, section: "Any" })),
      ...yours.map((def) => ({ kind: "relation" as const, def, section: "Yours" })),
    ]
    const typed = (query ?? "").trim()
    if (typed && !defs.some((def) => def.label.toLowerCase() === typed.toLowerCase())) {
      out.push({ kind: "create", phrase: typed })
    }
    return out
    // `custom` is not read here, but a change means the registry changed: a new relation shows at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fromTypeId, fromTypeName, toTypeId, custom])

  const choose = (row: Row | undefined) => {
    if (!row) return
    if (row.kind === "create") onCreate(row.phrase)
    else onChange(row.def.id)
    setQuery(null)
  }

  return (
    <div className="rl-combo">
      <input
        type="text"
        role="combobox"
        aria-label="Relation"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="rl-field"
        value={open ? (query ?? "") : relationLabel(value)}
        placeholder={relationLabel(value)}
        onFocus={() => {
          setQuery("")
          setActive(0)
        }}
        onBlur={() => setQuery(null)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (!open) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActive((i) => Math.min(rows.length - 1, i + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (event.key === "Enter") {
            event.preventDefault()
            choose(rows[active])
          } else if (event.key === "Escape") {
            event.stopPropagation()
            setQuery(null)
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
      {open && rows.length > 0 ? (
        <ul id={listId} role="listbox" className="rl-menu" aria-label="Relations">
          {rows.map((row, i) => {
            const prev = rows[i - 1]
            const heading =
              row.kind === "relation" && (prev?.kind !== "relation" || prev.section !== row.section)
                ? row.section
                : null
            return (
              <li key={row.kind === "create" ? "create" : row.def.id} role="presentation">
                {heading ? <div className="rl-menu-head">{heading}</div> : null}
                <div
                  role="option"
                  aria-selected={i === active}
                  className="rl-menu-row"
                  data-active={i === active ? "true" : undefined}
                  data-create={row.kind === "create" ? "true" : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(row)
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  {row.kind === "create" ? `Create "${row.phrase}"` : row.def.label}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
