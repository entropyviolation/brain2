/**
 * components/Analytics/relations/RelationsLibrary.tsx — Relations tab (LINKS_REDESIGN L2.1)
 *
 * Every relation: label ⇄ inverse, scope, usage, origin. Grouped by family,
 * or as the hierarchy tree (`parent`, root `related`). Archived rows fold.
 * A row opens its sheet (L2.2, merge L2.3). Also: Schematic (L2.4), Rules
 * (L3.5), and Inbox (snapshot export, proposal import, review; L8.1–8.2).
 */
"use client"

import { useMemo, useState } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { allRelations } from "@/lib/relation-registry"
import { buildLattice, LATTICE_ROOT } from "@/lib/graph/relation-lattice"
import { relationUsage } from "@/lib/graph/relation-usage"
import type { RelationDef, RelationFamily } from "@/lib/links"
import { GraphInbox } from "./GraphInbox"
import { RelationSchematic } from "./RelationSchematic"
import { RelationSheet } from "./RelationSheet"
import { RuleEditor } from "./RuleEditor"
import { LibSearch } from "../library-kit"
import { StudioCheck } from "../studio-kit"
import "./relations-library.css"

const VIEW_LABEL = { list: "By family", tree: "Tree", schematic: "Schematic", rules: "Rules", inbox: "Inbox" } as const

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
  const [view, setView] = useState<"list" | "tree" | "schematic" | "rules" | "inbox">("list")
  const [openId, setOpenId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [query, setQuery] = useState("")
  const [usedOnly, setUsedOnly] = useState(false)
  // Families the person folded or unfolded; others follow the default below.
  const [toggled, setToggled] = useState<Set<string>>(new Set())

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
      <li
        key={def.id}
        className="rel-row"
        data-testid={`relation-row-${def.id}`}
        data-open={openId === def.id ? "true" : undefined}
        style={{ paddingLeft: 8 + depth * 16, cursor: "pointer" }}
        onClick={() => setOpenId(def.id)}
      >
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

  const q = query.trim().toLowerCase()
  const matches = (d: RelationDef) =>
    (!usedOnly || (usage.get(d.id) ?? 0) > 0) &&
    (!q || d.label.toLowerCase().includes(q) || (d.inverseLabel ?? "").toLowerCase().includes(q) || d.id.toLowerCase().includes(q))
  const families = FAMILY_ORDER.map((fam) => {
    const all = live.filter((d) => (d.family ?? "other") === fam)
    const links = all.reduce((sum, d) => sum + (usage.get(d.id) ?? 0), 0)
    return { fam, all, links, shown: all.filter(matches).sort((a, b) => a.label.localeCompare(b.label)) }
  }).filter((f) => f.all.length > 0)
  // Families start open (nothing hidden by default). A search opens every match.
  const isOpen = (f: (typeof families)[number]) => q !== "" || usedOnly || !toggled.has(f.fam)
  const flip = (fam: string) =>
    setToggled((prev) => {
      const next = new Set(prev)
      if (next.has(fam)) next.delete(fam)
      else next.add(fam)
      return next
    })
  const maxFam = Math.max(1, ...families.map((f) => f.all.length))

  const listView = () => (
    <>
      <div className="rel-tools">
        <LibSearch value={query} onChange={setQuery} label="Search relations" />
        <StudioCheck id="rel-used-only" checked={usedOnly} onChange={setUsedOnly} title="Hide relations no link uses yet">
          Used only
        </StudioCheck>
        <button
          type="button"
          className="an-chip"
          onClick={() => setToggled(toggled.size ? new Set() : new Set(families.map((f) => f.fam)))}
        >
          {toggled.size ? "Unfold all" : "Fold all"}
        </button>
      </div>
      {/* Family strip: width = relations in the family, ink = links that use them. */}
      <div className="rel-fam-strip" role="list" aria-label="Relation families">
        {families.map((f) => (
          <button
            key={f.fam}
            type="button"
            role="listitem"
            className="rel-fam"
            style={{ flexGrow: f.all.length, minWidth: 40 + (f.all.length / maxFam) * 40 }}
            aria-pressed={isOpen(f)}
            title={`${f.fam}: ${f.all.length} relation${f.all.length === 1 ? "" : "s"}, ${f.links} link${f.links === 1 ? "" : "s"}. Click to fold or unfold.`}
            onClick={() => flip(f.fam)}
          >
            <span className="rel-fam-name">{f.fam}</span>
            <span className="tabular-nums">
              {f.all.length} · {f.links} link{f.links === 1 ? "" : "s"}
            </span>
          </button>
        ))}
      </div>
      {families.map((f) => {
        if (!f.shown.length) return null
        const open = isOpen(f)
        return (
          <section key={f.fam} className="rel-group" aria-label={`${f.fam} relations`}>
            <h3 className="rel-group-head">
              <button type="button" className="rel-group-toggle" aria-expanded={open} onClick={() => flip(f.fam)}>
                {open ? "▾" : "▸"} {f.fam} <span className="tabular-nums">{f.shown.length}</span>
                {f.links ? <span className="tabular-nums"> · {f.links} links</span> : null}
              </button>
            </h3>
            {open ? <ul className="rel-list">{f.shown.map((d) => row(d))}</ul> : null}
          </section>
        )
      })}
      {(q || usedOnly) && families.every((f) => f.shown.length === 0) ? (
        <p className="an-chart-empty">No relations match.</p>
      ) : null}
    </>
  )

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
          {(["list", "tree", "schematic", "rules", "inbox"] as const).map((v) => (
            <button key={v} type="button" className="an-chip" aria-pressed={view === v} onClick={() => setView(v)}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </header>
      {openId ? <RelationSheet id={openId} onClose={() => setOpenId(null)} /> : null}
      {view === "list" ? listView() : null}
      {view === "tree" ? treeView() : null}
      {view === "schematic" ? <RelationSchematic defs={live} onOpen={setOpenId} /> : null}
      {view === "rules" ? <RuleEditor /> : null}
      {view === "inbox" ? <GraphInbox /> : null}
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
