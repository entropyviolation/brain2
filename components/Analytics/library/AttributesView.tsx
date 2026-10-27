/**
 * components/Analytics/AttributesView.tsx — Typed attribute distributions
 *
 * Fixed mosaics/histograms from schemas that already exist. Not a chart builder.
 */
"use client"

import { useMemo, useState } from "react"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, AttributeValue } from "@/lib/types"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { StudioSelect, StudioBars } from "./studio-kit"

function flattenDefs(
  types: { id: string; name: string; attributes?: AttributeDefinition[] }[],
  lists: { name: string; itemAttributes?: AttributeDefinition[] }[],
): { key: string; name: string; def: AttributeDefinition }[] {
  const out: { key: string; name: string; def: AttributeDefinition }[] = []
  const seen = new Set<string>()
  for (const type of types) {
    for (const def of type.attributes ?? []) {
      if (seen.has(def.id)) continue
      if (!["number", "selection", "boolean", "goal"].includes(def.type)) continue
      seen.add(def.id)
      out.push({ key: def.id, name: `${def.name} · ${type.name}`, def })
    }
  }
  for (const list of lists) {
    for (const def of list.itemAttributes ?? []) {
      if (seen.has(def.id)) continue
      if (!["number", "selection", "boolean", "goal"].includes(def.type)) continue
      seen.add(def.id)
      out.push({ key: def.id, name: `${def.name} · ${list.name}`, def })
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
  const [attrId, setAttrId] = useState(defs[0]?.key ?? "")
  const selected = defs.find((d) => d.key === attrId) ?? defs[0]

  const rows = useMemo(() => {
    if (!selected) return { bars: [] as { name: string; value: number }[], ids: [] as string[] }
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
    const bars = [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
    return { bars, ids }
  }, [selected, tasks])

  return (
    <div className="an-canvas an-stack" data-testid="attributes-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Attributes</p>
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
          <StudioBars rows={rows.bars} max={Math.max(...rows.bars.map((b) => b.value), 1)} unit="" />
          <OpenInListsButton taskIds={rows.ids} />
        </>
      )}
    </div>
  )
}
