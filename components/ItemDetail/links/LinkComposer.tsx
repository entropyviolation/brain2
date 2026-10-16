/**
 * components/ItemDetail/links/LinkComposer.tsx — Say a link as a sentence
 *
 * "Elijah [is a member of ▾] [Foxtide] [Link]". The relation box lists the
 * relations made for this item's type first, then open ones, then the
 * person's own; typing a new phrase offers Create, which asks for the
 * reverse phrase (or Same both ways) and writes the relation vocabulary at
 * once. The link itself goes on the draft (`onAdd`), so Save covers it.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { getRelationDef, relationLabel, type RelationDef } from "@/lib/links"
import { createRelationPair, guessInverseLabel, relationFamily, relationsFor } from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"
import { LinkTargetSearch } from "@/components/ItemDetail/links/LinkTargetSearch"

interface LinkComposerProps {
  sourceId: string
  sourceTitle: string
  sourceTypeId: string
  /** (relation, targetId) pairs already on the draft. */
  existing: { relation: string; targetId: string }[]
  onAdd: (relation: string, targetId: string) => void
}

const DEFAULT_RELATION: Record<string, string> = { person: "friends-with" }

export function LinkComposer({ sourceId, sourceTitle, sourceTypeId, existing, onAdd }: LinkComposerProps) {
  const [relation, setRelation] = useState(() => DEFAULT_RELATION[sourceTypeId] ?? "related")
  const [targetId, setTargetId] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [flash, setFlash] = useState("")
  const def = getRelationDef(relation)

  const confirm = (pickedId = targetId) => {
    if (!pickedId) return
    if (existing.some((row) => row.relation === relation && row.targetId === pickedId)) {
      setFlash("Already linked that way.")
      return
    }
    onAdd(relation, pickedId)
    setTargetId(null)
    setFlash("")
  }

  return (
    <div className="space-y-2">
      <div className="rl-composer" data-testid="link-composer">
        <span className="rl-subject" title={sourceTitle}>
          {sourceTitle}
        </span>
        <RelationCombobox
          value={relation}
          sourceTypeId={sourceTypeId}
          onPick={(id) => {
            setRelation(id)
            setCreating(null)
          }}
          onCreate={(text) => setCreating(text)}
        />
        <LinkTargetSearch
          sourceId={sourceId}
          toTypes={def?.toTypes}
          excludeIds={existing.filter((row) => row.relation === relation).map((row) => row.targetId)}
          value={targetId}
          onChange={setTargetId}
          onEnter={(id) => confirm(id)}
        />
        <button type="button" className="id-btn id-btn-primary" disabled={!targetId} onClick={() => confirm()}>
          <Plus className="h-4 w-4" aria-hidden />
          Link
        </button>
      </div>
      {flash ? <p className="rl-note" role="status">{flash}</p> : null}
      {creating !== null ? (
        <NewRelationForm
          initialLabel={creating}
          sourceTypeId={sourceTypeId}
          onCancel={() => setCreating(null)}
          onCreated={(id) => {
            setRelation(id)
            setCreating(null)
          }}
        />
      ) : null}
    </div>
  )
}

function RelationCombobox({
  value,
  sourceTypeId,
  onPick,
  onCreate,
}: {
  value: string
  sourceTypeId: string
  onPick: (id: string) => void
  onCreate: (text: string) => void
}) {
  const custom = useItemTypeStore((s) => s.relations)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sections = useMemo(() => {
    const choices = relationsFor(sourceTypeId)
    const q = query.trim().toLowerCase()
    const match = (def: RelationDef) => !q || def.label.toLowerCase().includes(q) || def.id.includes(q)
    return [
      { title: sourceTypeId === "person" ? "For people" : `For ${sourceTypeId}`, rows: choices.forType.filter(match) },
      { title: "Yours", rows: choices.yours.filter(match) },
      { title: "Any item", rows: choices.any.filter(match) },
    ].filter((section) => section.rows.length > 0)
    // `custom` re-runs the registry read after a new relation is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTypeId, query, custom])

  const flat = sections.flatMap((section) => section.rows)
  const typed = query.trim()
  const canCreate = typed.length > 0 && !flat.some((def) => def.label.toLowerCase() === typed.toLowerCase())
  const total = flat.length + (canCreate ? 1 : 0)

  const choose = (index: number) => {
    if (index < flat.length) onPick(flat[index].id)
    else if (canCreate) onCreate(typed)
    setOpen(false)
    setQuery("")
  }

  let rowIndex = -1
  return (
    <div className="rl-field" data-family={relationFamily(value)}>
      <input
        type="text"
        role="combobox"
        aria-label="Relation"
        aria-expanded={open}
        value={open ? query : relationLabel(value)}
        placeholder={relationLabel(value)}
        onFocus={() => {
          setOpen(true)
          setQuery("")
          setHighlight(0)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setHighlight(0)
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((h) => Math.min(total - 1, h + 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((h) => Math.max(0, h - 1))
          } else if (event.key === "Enter" && open && total > 0) {
            event.preventDefault()
            choose(highlight)
            ;(event.target as HTMLInputElement).blur()
          } else if (event.key === "Escape" && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {open && total > 0 ? (
        <div className="rl-menu" role="listbox" aria-label="Relations">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="rl-menu-head">{section.title}</div>
              {section.rows.map((def) => {
                rowIndex += 1
                const index = rowIndex
                return (
                  <button
                    key={def.id}
                    type="button"
                    role="option"
                    aria-selected={def.id === value}
                    className="rl-menu-row"
                    data-family={relationFamily(def.id)}
                    data-highlight={index === highlight}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      choose(index)
                    }}
                  >
                    <span className="rl-dot" aria-hidden />
                    {def.label}
                    {def.inverse !== def.id ? <span className="rl-menu-meta">↔ {def.inverseLabel}</span> : null}
                  </button>
                )
              })}
            </div>
          ))}
          {canCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="rl-menu-row"
              data-highlight={highlight === flat.length}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(flat.length)
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create “{typed}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function NewRelationForm({
  initialLabel,
  sourceTypeId,
  onCancel,
  onCreated,
}: {
  initialLabel: string
  sourceTypeId: string
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const types = useItemTypeStore((s) => s.types)
  const addRelations = useItemTypeStore((s) => s.addRelations)
  const [label, setLabel] = useState(initialLabel)
  const [inverseLabel, setInverseLabel] = useState(() => guessInverseLabel(initialLabel))
  const [symmetric, setSymmetric] = useState(() => / with$/i.test(initialLabel.trim()))
  const [fromType, setFromType] = useState(sourceTypeId)
  const [toType, setToType] = useState("")

  const create = () => {
    const defs = createRelationPair({
      label,
      inverseLabel: symmetric ? undefined : inverseLabel,
      symmetric,
      fromTypes: fromType ? [fromType] : undefined,
      toTypes: toType ? [toType] : undefined,
    })
    if (defs.length === 0) return
    addRelations(defs)
    onCreated(defs[0].id)
  }

  return (
    <form
      className="rl-new"
      aria-label="New relation"
      onSubmit={(event) => {
        event.preventDefault()
        create()
      }}
    >
      <label>
        Reads as
        <input type="text" aria-label="Relation phrase" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      </label>
      <label>
        From the other side
        <input
          type="text"
          aria-label="Reverse phrase"
          value={symmetric ? label : inverseLabel}
          disabled={symmetric}
          placeholder="has member, is the child of…"
          onChange={(e) => setInverseLabel(e.target.value)}
        />
      </label>
      <label>
        From
        <select aria-label="From type" value={fromType} onChange={(e) => setFromType(e.target.value)}>
          <option value="">Any item</option>
          {types.map((type) => (
            <option key={type.id} value={type.id as string}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        To
        <select aria-label="To type" value={toType} onChange={(e) => setToType(e.target.value)}>
          <option value="">Any item</option>
          {types.map((type) => (
            <option key={type.id} value={type.id as string}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label className="rl-new-check">
        <input type="checkbox" checked={symmetric} onChange={(e) => setSymmetric(e.target.checked)} />
        Same both ways
      </label>
      <div className="rl-new-keys">
        <button type="button" className="id-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="id-btn id-btn-primary" disabled={!label.trim() || (!symmetric && !inverseLabel.trim())}>
          Create relation
        </button>
      </div>
    </form>
  )
}
