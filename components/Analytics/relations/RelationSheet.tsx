/**
 * components/Analytics/relations/RelationSheet.tsx — One relation's sheet
 * (LINKS_REDESIGN §8, L2.2 + L2.3 merge). Custom relations write through
 * `updateRelation`; built-ins and seeds through `relationOverrides` (ids,
 * labels, inverses, scope stay read-only). "Same both ways" on an existing
 * pair is read-only: it would change stored meaning. Merge sets `aliasOf`
 * and archives; links keep their stored id; Undo clears it.
 */
"use client"

import { useMemo, useState } from "react"
import { NativeSelect } from "@/components/ui/native-select"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { allRelations, getRelationDef, rawRelationDef } from "@/lib/relation-registry"
import { useTaskStore } from "@/lib/task-store"
import type { RelationDef, RelationReciprocity, RelationTraits } from "@/lib/links"

const TRAIT_LINES: { key: "transitive" | "acyclic"; line: string }[] = [
  { key: "transitive", line: "Carries over: a → b → c means a → c." },
  { key: "acyclic", line: "Never loops back to where it started." },
]

export function mergeRefusal(from: RelationDef, into: RelationDef): string | null {
  if (!from.custom) return "Only your own relations can be merged."
  if (from.id === into.id) return "Pick another relation."
  const clash = (a?: string[], b?: string[]) => !!a?.length && !!b?.length && !a.some((t) => b.includes(t))
  if (clash(from.fromTypes, into.fromTypes) || clash(from.toTypes, into.toTypes)) return "Their scopes do not meet."
  return null
}

export function RelationSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const relations = useItemTypeStore((s) => s.relations)
  const overrides = useItemTypeStore((s) => s.relationOverrides)
  const updateRelation = useItemTypeStore((s) => s.updateRelation)
  const setOverride = useItemTypeStore((s) => s.setRelationOverride)
  const merge = useItemTypeStore((s) => s.mergeRelation)
  const unmerge = useItemTypeStore((s) => s.unmergeRelation)
  const tasks = useTaskStore((s) => s.tasks)
  const defs = useMemo(() => allRelations(), [relations, overrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const raw = rawRelationDef(id)
  const def = getRelationDef(id)
  const [mergeInto, setMergeInto] = useState("")
  if (!def || !raw) return null
  const custom = !!raw.custom
  const patch = (p: Partial<RelationDef>) => (custom ? updateRelation({ ...raw, ...p }) : setOverride(id, p))
  const traits: RelationTraits = def.traits ?? {}
  const setTrait = (t: Partial<RelationTraits>) => {
    const next = { ...traits, ...t } as Record<string, unknown>
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === 0 || next[k] === false) delete next[k]
    patch({ traits: next as RelationTraits })
  }
  const usage = tasks.flatMap((t) => (t.links ?? []).filter((l) => l.relation === id).map((l) => ({ t, l }))).slice(0, 20)
  const count = tasks.reduce((n, t) => n + (t.links ?? []).filter((l) => l.relation === id).length, 0)
  const target = mergeInto ? getRelationDef(mergeInto) : undefined
  const refusal = target ? mergeRefusal(raw, target) : null

  return (
    <section className="rel-sheet" aria-label={`Relation ${def.label}`} data-testid="relation-sheet">
      <header className="rel-sheet-head">
        <strong>{def.label}</strong>
        <button type="button" className="an-chip" onClick={onClose}>
          Close
        </button>
      </header>
      <dl className="rel-sheet-grid">
        <dt>Id</dt>
        <dd>
          <code>{id}</code>
        </dd>
        <dt>Label</dt>
        <dd>{custom ? <input aria-label="Label" defaultValue={raw.label} onBlur={(e) => e.target.value.trim() && patch({ label: e.target.value.trim() })} /> : def.label}</dd>
        <dt>Inverse</dt>
        <dd>{def.inverse === id ? "same both ways" : custom ? <input aria-label="Inverse label" defaultValue={raw.inverseLabel} onBlur={(e) => e.target.value.trim() && patch({ inverseLabel: e.target.value.trim() })} /> : def.inverseLabel}</dd>
        <dt>Parent</dt>
        <dd>
          <NativeSelect aria-label="Parent relation" value={def.parent ?? "related"} onChange={(e) => patch({ parent: e.target.value })}>
            {defs.filter((d) => d.id !== id && !d.archived).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </dd>
        <dt>Reciprocity</dt>
        <dd>
          <NativeSelect aria-label="Reciprocity" value={def.reciprocity ?? "ask"} onChange={(e) => patch({ reciprocity: e.target.value as RelationReciprocity })}>
            <option value="ask">ask (Confirm on in-only rows)</option>
            <option value="expect">expect (also suggest)</option>
            <option value="quiet">quiet (one-way fact)</option>
          </NativeSelect>
        </dd>
        <dt>Traits</dt>
        <dd className="rel-traits">
          {TRAIT_LINES.map(({ key, line }) => (
            <label key={key}>
              <input type="checkbox" checked={!!traits[key]} onChange={(e) => setTrait({ [key]: e.target.checked ? true : undefined })} /> {key}: {line}
            </label>
          ))}
          <label>
            At most <input aria-label="Functional" type="number" min={0} style={{ width: "4em" }} value={traits.functional ?? ""} onChange={(e) => setTrait({ functional: Number(e.target.value) || undefined })} /> targets per item
          </label>
          <label>
            At most <input aria-label="Inverse functional" type="number" min={0} style={{ width: "4em" }} value={traits.inverseFunctional ?? ""} onChange={(e) => setTrait({ inverseFunctional: Number(e.target.value) || undefined })} /> sources per item
          </label>
        </dd>
        <dt>Phrases</dt>
        <dd>
          <input aria-label="Phrases" placeholder="comma separated" defaultValue={(def.phrases?.forward ?? []).join(", ")} onBlur={(e) => patch({ phrases: { ...def.phrases, forward: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) } })} />
        </dd>
        <dt>Means</dt>
        <dd>
          <input aria-label="Description" defaultValue={def.description ?? ""} onBlur={(e) => patch({ description: e.target.value.trim() || undefined })} />
        </dd>
      </dl>
      {custom ? (
        raw.aliasOf ? (
          <p className="rel-merge">
            Reads as <strong>{getRelationDef(raw.aliasOf)?.label ?? raw.aliasOf}</strong>.{" "}
            <button type="button" className="an-chip" onClick={() => unmerge(id)}>
              Undo merge
            </button>
          </p>
        ) : (
          <p className="rel-merge">
            Read <em>{def.label}</em> as{" "}
            <NativeSelect aria-label="Merge into" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">…</option>
              {defs.filter((d) => d.id !== id && !d.archived && !d.aliasOf).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>{" "}
            {target ? (refusal ? <span className="rel-note">{refusal}</span> : <span className="rel-note">{count} link{count === 1 ? "" : "s"} will read differently. Stored ids stay.</span>) : null}{" "}
            <button type="button" className="an-chip" disabled={!target || !!refusal} onClick={() => merge(id, mergeInto)}>
              Merge
            </button>
          </p>
        )
      ) : null}
      <h4 className="rel-group-head">Used {count} times</h4>
      <ul className="rel-list">
        {usage.map(({ t, l }) => (
          <li key={l.id} className="rel-row rel-row-usage">
            {itemTitleOrUntitled(t)} → {itemTitleOrUntitled(tasks.find((x) => x.id === l.targetId))}
          </li>
        ))}
      </ul>
    </section>
  )
}
