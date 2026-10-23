/**
 * components/Analytics/AttributesView.tsx — Typed attribute distributions
 *
 * Fixed mosaics/histograms from schemas that already exist. Not a chart builder.
 * Tile grid (periodic taxonomy), fill rate, numeric summary and bins added in
 * the Library redesign. Docs: `docs/analytics/library-attributes.md`.
 */
"use client"

import { useMemo, useState } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import { itemsOfType } from "@/lib/item-types"
import type { AttributeDefinition, AttributeValue } from "@/lib/types"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { CanvasTitle, StudioSelect, StudioBars, StudioReadout } from "./studio-kit"
import { LibPlate, LibSearch, fmt } from "./library-kit"
import { bins, summarize } from "./library-stats"

type Def = { key: string; name: string; def: AttributeDefinition; source: { kind: "type" | "list"; id: string; name: string } }

const TYPE_SYMBOL: Record<string, string> = { number: "#", selection: "◉", boolean: "✓", goal: "◎" }

function flattenDefs(
  types: { id: string; name: string; attributes?: AttributeDefinition[] }[],
  lists: { id: string; name: string; itemAttributes?: AttributeDefinition[] }[],
): Def[] {
  const out: Def[] = []
  const seen = new Set<string>()
  for (const type of types) {
    for (const def of type.attributes ?? []) {
      if (seen.has(def.id)) continue
      if (!["number", "selection", "boolean", "goal"].includes(def.type)) continue
      seen.add(def.id)
      out.push({ key: def.id, name: `${def.name} · ${type.name}`, def, source: { kind: "type", id: type.id, name: type.name } })
    }
  }
  for (const list of lists) {
    for (const def of list.itemAttributes ?? []) {
      if (seen.has(def.id)) continue
      if (!["number", "selection", "boolean", "goal"].includes(def.type)) continue
      seen.add(def.id)
      out.push({ key: def.id, name: `${def.name} · ${list.name}`, def, source: { kind: "list", id: list.id, name: list.name } })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function numeric(value: AttributeValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value && typeof value === "object" && "current" in value) {
    const n = Number((value as { current?: number }).current)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function labelOf(value: AttributeValue | undefined): string | null {
  if (value === true) return "yes"
  if (value === false) return "no"
  if (typeof value === "string" && value) return value
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ") || null
  return null
}

export function AttributesView() {
  const types = useItemTypeStore((s) => s.types)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const defs = useMemo(() => flattenDefs(types, lists), [types, lists])
  const [attrId, setAttrId] = useState("")
  const [query, setQuery] = useState("")

  // Per attribute: who could carry it (items of the type, or on the list), and who does.
  const tiles = useMemo(
    () =>
      defs.map((d) => {
        const eligible =
          d.source.kind === "type"
            ? itemsOfType(d.source.id, tasks, lists, types)
            : tasks.filter((t) => t.lists?.includes(d.source.id))
        const filled = eligible.filter((t) => {
          const raw = t.attributes?.[d.def.id]
          return raw !== undefined && raw !== null && raw !== ""
        })
        const counts = new Map<string, number>()
        for (const t of filled) {
          const raw = t.attributes?.[d.def.id]
          const k = d.def.type === "number" || d.def.type === "goal" ? String(numeric(raw) ?? "") : labelOf(raw) ?? ""
          if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        const spark = [...counts.values()].sort((a, b) => b - a).slice(0, 8)
        return { ...d, eligible: eligible.length, filled: filled.length, spark }
      }),
    [defs, tasks, lists, types],
  )
  // Filled attributes first, so the grid leads with what has data.
  const shownTiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? tiles.filter((t) => t.name.toLowerCase().includes(q)) : tiles)
      .slice()
      .sort((a, b) => b.filled - a.filled || a.name.localeCompare(b.name))
  }, [tiles, query])
  // No pick yet: open on the attribute with the most values, not the first by name.
  const selected =
    defs.find((d) => d.key === attrId) ?? tiles.reduce<(typeof tiles)[number] | undefined>((best, t) => (!best || t.filled > best.filled ? t : best), undefined)
  const selectedTile = tiles.find((t) => t.key === selected?.key)

  const rows = useMemo(() => {
    if (!selected) return { bars: [] as { name: string; value: number }[], ids: [] as string[], values: [] as number[], distinct: 0 }
    const counts = new Map<string, number>()
    const ids: string[] = []
    for (const task of tasks) {
      const raw = task.attributes?.[selected.def.id]
      if (raw === undefined || raw === null || raw === "") continue
      if (selected.def.type === "number" || selected.def.type === "goal") {
        const n = numeric(raw)
        if (n === null) continue
        const bucket = selected.def.type === "goal" ? String(Math.round(n)) : String(n)
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
        ids.push(task.id)
      } else {
        const name = labelOf(raw)
        if (!name) continue
        counts.set(name, (counts.get(name) ?? 0) + 1)
        ids.push(task.id)
      }
    }
    const isNumeric = selected.def.type === "number" || selected.def.type === "goal"
    // Numbers read along their scale; labels read by frequency.
    const bars = [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (isNumeric ? Number(a.name) - Number(b.name) : b.value - a.value))
      .slice(0, isNumeric ? 40 : 20)
    const values = isNumeric
      ? tasks.map((t) => numeric(t.attributes?.[selected.def.id])).filter((v): v is number => v !== null)
      : []
    return { bars, ids, values, distinct: counts.size }
  }, [selected, tasks])

  const stats = summarize(rows.values)
  const binned = bins(rows.values, 10)

  return (
    <div className="an-canvas an-stack" data-testid="attributes-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Attributes"
            help="Number, selection, yes/no and goal fields from item-type and list schemas. Fill rate = items that carry a value ÷ items that could (items of that type, or on that list). Text and date fields are not charted."
          />
          <p className="an-canvas-kicker">Distributions from type and list schemas. Not a custom chart builder.</p>
        </div>
        {defs.length > 0 && (
          <StudioSelect label="Attribute" value={selected?.key ?? ""} onChange={setAttrId}>
            {defs.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </StudioSelect>
        )}
      </header>
      {defs.length === 0 ? (
        <ChartFrame empty emptySentence="No number, selection, boolean, or goal attributes to chart." />
      ) : rows.bars.length === 0 ? (
        <ChartFrame empty emptySentence={`No values for “${selected?.def.name}” yet.`} />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Values" value={rows.ids.length} note={`${rows.distinct} distinct`} />
            {selectedTile ? (
              <StudioReadout
                label="Fill rate"
                value={selectedTile.eligible ? `${Math.round((selectedTile.filled / selectedTile.eligible) * 100)}%` : "—"}
                note={`${selectedTile.filled} of ${selectedTile.eligible} could`}
                tip={`Items of ${selectedTile.source.kind === "type" ? "type" : "list"} ${selectedTile.source.name} with a value.`}
              />
            ) : null}
            {stats.n > 0 ? (
              <>
                <StudioReadout label="Mean" value={fmt(stats.mean)} note={`SD ${fmt(stats.sd)}`} />
                <StudioReadout label="Median" value={fmt(stats.median)} note={`IQR ${fmt(stats.q1)}–${fmt(stats.q3)}`} />
                <StudioReadout label="Range" value={`${fmt(stats.min)}–${fmt(stats.max)}`} />
              </>
            ) : null}
          </div>
          <StudioBars rows={rows.bars} max={Math.max(...rows.bars.map((b) => b.value), 1)} unit="" />
          {binned.length > 1 && rows.distinct > 12 ? (
            <LibPlate title="Binned" note="Ten equal-width bins from min to max, so many distinct numbers read as one shape.">
              <StudioBars
                rows={binned.map((b) => ({ name: `${fmt(b.lo, 1)}–${fmt(b.hi, 1)}`, value: b.n }))}
                max={Math.max(...binned.map((b) => b.n), 1)}
                unit=""
              />
            </LibPlate>
          ) : null}
          <OpenInListsButton taskIds={rows.ids} />
        </>
      )}
      {defs.length > 0 && (
        <LibPlate
          title="Attribute table"
          note="Every chartable attribute as a tile: symbol for its kind (# number, ◉ selection, ✓ yes/no, ◎ goal), where it comes from, a spark of its top values, and its fill rate. Click a tile to chart it above."
          tools={<LibSearch value={query} onChange={setQuery} label="Search attributes" />}
        >
          <div className="lib-tiles">
            {shownTiles.map((t) => {
              const peak = Math.max(1, ...t.spark)
              const rate = t.eligible ? Math.round((t.filled / t.eligible) * 100) : 0
              return (
                <button
                  key={t.key}
                  type="button"
                  className="lib-tile"
                  aria-pressed={t.key === selected?.key}
                  title={`${t.name}: ${t.filled} of ${t.eligible} items filled`}
                  onClick={() => setAttrId(t.key)}
                >
                  <span className="lib-tile-sym" aria-hidden>
                    {TYPE_SYMBOL[t.def.type] ?? "·"}
                  </span>
                  <span className="lib-tile-name">{t.def.name}</span>
                  <span className="lib-tile-src">
                    {t.source.kind === "type" ? "type" : "list"} · {t.source.name}
                  </span>
                  <span className="lib-tile-spark" aria-hidden>
                    {t.spark.map((v, i) => (
                      <span key={i} style={{ height: `${(v / peak) * 100}%` }} />
                    ))}
                  </span>
                  <span className="lib-tile-fill">{t.eligible ? `${rate}% filled` : "no items yet"}</span>
                </button>
              )
            })}
          </div>
        </LibPlate>
      )}
    </div>
  )
}
