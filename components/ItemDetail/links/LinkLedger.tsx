/**
 * components/ItemDetail/links/LinkLedger.tsx — Every link, grouped by how it reads
 *
 * Groups by the relation as read from this item. A row shows the orb, a
 * direction glyph (→ this item says it, ← the other item says it, ⇄ both),
 * the title, the type, and its keys:
 * - own link (→ or ⇄): Remove (draft).
 * - the other side only (←): Confirm writes the reciprocal on this draft,
 *   so the pair reads ⇄ after Save.
 * - derived (dotted, e.g. from a Relation word): Pin stores a real link;
 *   Dismiss hides it on this item.
 */
"use client"

import { useMemo } from "react"
import { iconFor } from "@/components/Icons/Icon"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { EgoEdge } from "@/lib/link-graph"
import type { Task } from "@/lib/types"

const GLYPH: Record<EgoEdge["direction"], string> = { out: "→", in: "←", mutual: "⇄", derived: "⋯" }
const DIRECTION_WORD: Record<EgoEdge["direction"], string> = {
  out: "this item says it",
  in: "the other item says it",
  mutual: "both say it",
  derived: "suggested",
}

interface LinkLedgerProps {
  edges: EgoEdge[]
  byId: Map<string, Task>
  typeName: (task: Task) => string
  activeKey: string | null
  onActive: (key: string | null) => void
  editable: boolean
  onOpenItem: (id: string) => void
  onRemove: (linkId: string) => void
  onConfirm: (edge: EgoEdge) => void
  onDismiss: (edge: EgoEdge) => void
}

export function LinkLedger({
  edges,
  byId,
  typeName,
  activeKey,
  onActive,
  editable,
  onOpenItem,
  onRemove,
  onConfirm,
  onDismiss,
}: LinkLedgerProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; family: string; derived: boolean; rows: EgoEdge[] }>()
    for (const edge of edges) {
      const derived = edge.direction === "derived"
      const key = `${derived ? "~" : ""}${edge.label}`
      const group = map.get(key) ?? { label: edge.label, family: edge.family, derived, rows: [] }
      group.rows.push(edge)
      map.set(key, group)
    }
    return [...map.values()].sort((a, b) => Number(a.derived) - Number(b.derived) || a.label.localeCompare(b.label))
  }, [edges])

  if (edges.length === 0) {
    return <p className="rl-note">No links yet.</p>
  }

  return (
    <div className="rl-ledger" aria-label="Links">
      {groups.map((group) => (
        <section key={`${group.derived}-${group.label}`} data-family={group.family}>
          <h4 className="rl-group-plate">
            <span className="rl-dot" aria-hidden />
            {group.derived ? `Suggested · ${group.label}` : group.label}
          </h4>
          <ul className="rl-rows">
            {group.rows.map((edge) => {
              const other = byId.get(edge.otherId)
              const title = other ? itemTitleOrUntitled(other) : "Item no longer here"
              return (
                <li
                  key={edge.key}
                  className="rl-row"
                  data-direction={edge.direction}
                  data-family={edge.family}
                  data-active={activeKey === edge.key}
                  data-testid="link-row"
                  onMouseEnter={() => onActive(edge.key)}
                  onMouseLeave={() => onActive(null)}
                >
                  <img src={iconFor(edge.otherId, other?.icon)} alt="" data-orb />
                  <span className="rl-dir" title={DIRECTION_WORD[edge.direction]} aria-label={DIRECTION_WORD[edge.direction]}>
                    {GLYPH[edge.direction]}
                  </span>
                  <button
                    type="button"
                    className="rl-row-title"
                    title={`Open ${title}`}
                    disabled={!other}
                    onClick={() => onOpenItem(edge.otherId)}
                  >
                    {title}
                  </button>
                  {other ? <span className="rl-type">{typeName(other)}</span> : <span />}
                  <span className="rl-actions">
                    {editable && edge.direction === "in" ? (
                      <button
                        type="button"
                        className="id-btn"
                        title={`Add “${edge.label} ${title}” here too`}
                        onClick={() => onConfirm(edge)}
                      >
                        Confirm
                      </button>
                    ) : null}
                    {editable && edge.direction === "derived" ? (
                      <>
                        <button type="button" className="id-btn" onClick={() => onConfirm(edge)}>
                          Pin
                        </button>
                        <button type="button" className="id-btn" onClick={() => onDismiss(edge)}>
                          Dismiss
                        </button>
                      </>
                    ) : null}
                    {editable && edge.outLinkId ? (
                      <button
                        type="button"
                        className="id-btn id-btn-quiet"
                        aria-label={`Remove link ${title}`}
                        onClick={() => onRemove(edge.outLinkId!)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
