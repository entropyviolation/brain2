/**
 * components/Analytics/relations/RelationsLibrary.tsx — Relations tab (LINKS_REDESIGN L2.1)
 *
 * Every relation: label ⇄ inverse, scope, usage, origin. Grouped by family,
 * or as the hierarchy tree (`parent`, root `related`). Archived rows fold.
 */
"use client"

import { useMemo, useState } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { allRelations } from "@/lib/relation-registry"
import { buildLattice, LATTICE_ROOT } from "@/lib/graph/relation-lattice"
import { relationUsage } from "@/lib/graph/relation-usage"
import type { RelationDef, RelationFamily } from "@/lib/links"
import "./relations-library.css"

const FAMILY_ORDER: RelationFamily[] = ["family", "friend", "romance", "work", "group", "place", "task", "evidence", "other"]

export function relationOrigin(def: RelationDef): "built-in" | "seed" | "yours" | "proposed" {
  if (def.origin?.startsWith("model:") || def.origin?.startsWith("import:")) return "proposed"
  if (def.custom || def.origin === "person") return "yours"
  if (def.origin === "seed") return "seed"
  return "built-in"
}

export function RelationsLibrary() {
  const relations = useItemTypeStore((s) => s.relations)
  const overrides = useItemTypeStore((s) => s.relationOverrides)
  const types = useItemTypeStore((s) => s.types)
  const tasks = useTaskStore((s) => s.tasks)
  const [view, setView] = useState<"list" | "tree">("list")
  const [showArchived, setShowArchived] = useState(false)

  // Store slices are deps so the registry read refreshes on change.
  const defs = useMemo(() => allRelations(), [relations, overrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const usage = relationUsage(tasks)
  const typeName = (ids?: string[]) =>
    ids?.length ? ids.map((id) => types.find((t) => t.id === id)?.name ?? id).join(", ") : "any"

  const live = defs.filter((d) => !d.archived)
  const archived = defs.filter((d) => d.archived)

  const row = (def: RelationDef, depth = 0) => {
    const origin = relationOrigin(def)
    const n = usage.get(def.id) ?? 0
    return (
      <li key={def.id} className="rel-row" data-testid={`relation-row-${def.id}`} style={{ paddingLeft: 8 + depth * 16 }}>
        <span className="rel-label">
          {def.label}
          {def.inverse !== def.id ? <span className="rel-inverse"> ⇄ {def.inverseLabel}</span> : <span className="rel-inverse"> (both ways)</span>}
        </span>
        <span className="rel-scope">
          {typeName(def.fromTypes)} → {typeName(def.toTypes)}
        </span>
        <span className="rel-usage tabular-nums" title={`${n} link${n === 1 ? "" : "s"}`}>
          {n}
        </span>
        <span className="rel-origin" data-origin={origin}>
          {origin}
        </span>
      </li>
    )
  }

  const listView = () =>
    FAMILY_ORDER.map((fam) => {
      const inFam = live.filter((d) => (d.family ?? "other") === fam).sort((a, b) => a.label.localeCompare(b.label))
      if (!inFam.length) return null
      return (
        <section key={fam} className="rel-group" aria-label={`${fam} relations`}>
          <h3 className="rel-group-head">
            {fam} <span className="tabular-nums">{inFam.length}</span>
          </h3>
          <ul className="rel-list">{inFam.map((d) => row(d))}</ul>
        </section>
      )
    })

  const treeView = () => {
    const lattice = buildLattice(live)
    const byId = new Map(live.map((d) => [d.id, d]))
    const children = new Map<string, RelationDef[]>()
    for (const d of live) {
      const p = lattice.parentOf(d.id)
      if (p === undefined) continue
      children.set(p, [...(children.get(p) ?? []), d])
    }
    const out: React.ReactNode[] = []
    const walk = (id: string, depth: number) => {
      for (const d of (children.get(id) ?? []).sort((a, b) => a.label.localeCompare(b.label))) {
        out.push(row(d, depth))
        walk(d.id, depth + 1)
      }
    }
    const root = byId.get(LATTICE_ROOT)
    if (root) out.push(row(root, 0))
    walk(LATTICE_ROOT, 1)
    return <ul className="rel-list" aria-label="Relation tree">{out}</ul>
  }

  return (
    <div className="rel-library" data-testid="relations-library">
      <header className="an-library-head">
        <div>
          <p className="an-canvas-title">Relations</p>
          <p className="an-canvas-kicker">{`${live.length} relation${live.length === 1 ? "" : "s"} · ${archived.length} archived`}</p>
        </div>
        <div className="an-library-filters" role="group" aria-label="Relation view">
          {(["list", "tree"] as const).map((v) => (
            <button key={v} type="button" className="an-chip" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === "list" ? "By family" : "Tree"}
            </button>
          ))}
        </div>
      </header>
      {view === "list" ? listView() : treeView()}
      {archived.length > 0 && (
        <section className="rel-group">
          <button type="button" className="an-chip" aria-expanded={showArchived} onClick={() => setShowArchived((o) => !o)}>
            Archived · {archived.length}
          </button>
          {showArchived && <ul className="rel-list">{archived.map((d) => row(d))}</ul>}
        </section>
      )}
    </div>
  )
}
