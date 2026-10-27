/**
 * components/ItemDetail/tabs/links/LinkLedger.tsx — Every link around this item,
 * as text (PD 6.3). The full-text twin of the radial plate.
 *
 * Groups by relation as read from this item. Each row: orb, title, type
 * plate, direction glyph (→ out, ← in, ⇄ mutual, ⋯ derived), and actions:
 * - out / mutual → **Remove** (`onRemove(outLinkId)`: only this item's own
 *   link; a mutual row becomes in-only).
 * - in only → **Confirm** (`onConfirm(relation, otherId)`: adds the
 *   reciprocal on this draft, so the pair is mutual after Save) and
 *   **Open {name}** (the host's guarded `openItem`).
 * - derived → **Pin** (`onPin`, a real link) and **Dismiss** (`onDismiss(key)`;
 *   the host stores it in `Task.dismissedLinkSuggestions`).
 * All of these are draft edits. Empty: one muted line.
 */
"use client"

import { getRelationDef } from "@/lib/relation-registry"
import { useMemo } from "react"
import { iconFor } from "@/components/Icons/Icon"
import type { LinkItemFacts } from "@/components/ItemDetail/tabs/links/link-items"
import type { EdgeDirection, EgoEdge } from "@/lib/link-graph"
import { relationLabel } from "@/lib/links"
import "./rich-links.css"

export const DIRECTION_GLYPH: Record<EdgeDirection, string> = {
  out: "→",
  in: "←",
  mutual: "⇄",
  derived: "⋯",
}

export const DIRECTION_WORD: Record<EdgeDirection, string> = {
  out: "outgoing",
  in: "incoming",
  mutual: "mutual",
  derived: "suggested",
}

/** How an edge reads as a phrase: a derived edge's free label wins. */
export function edgePhrase(edge: Pick<EgoEdge, "relation" | "label">): string {
  return edge.label ?? relationLabel(edge.relation)
}

/** Drop derived edges the person dismissed. */
export function visibleEdges(edges: readonly EgoEdge[], dismissed: readonly string[] | undefined): EgoEdge[] {
  if (!dismissed?.length) return [...edges]
  const hide = new Set(dismissed)
  return edges.filter((edge) => edge.direction !== "derived" || !hide.has(edge.key))
}

export function LinkLedger({
  edges,
  factsFor,
  onRemove,
  onConfirm,
  onOpen,
  onPin,
  onDismiss,
  selectedKey,
  flashKey,
  onSelect,
  onWhy,
  notes,
}: {
  edges: readonly EgoEdge[]
  factsFor: (id: string) => LinkItemFacts | null
  onRemove: (linkId: string) => void
  onConfirm: (relation: string, otherId: string) => void
  onOpen?: (id: string) => void
  onPin: (relation: string, otherId: string) => void
  onDismiss: (key: string) => void
  selectedKey?: string | null
  /** A row to flash once (a refused duplicate). */
  flashKey?: string | null
  onSelect?: (key: string) => void
  /** Derived rule edges: open the proof card. */
  onWhy?: (key: string) => void
  /** Check lines by edge key (L5.2), neutral ink. */
  notes?: ReadonlyMap<string, string>
}) {
  const groups = useMemo(() => {
    const map = new Map<string, EgoEdge[]>()
    for (const edge of edges) {
      const phrase = edgePhrase(edge)
      const list = map.get(phrase) ?? []
      list.push(edge)
      map.set(phrase, list)
    }
    return [...map.entries()]
  }, [edges])

  if (edges.length === 0) {
    return <p className="rl-empty">No links yet.</p>
  }

  return (
    <div className="rl-ledger" aria-label="Links ledger" role="region">
      {groups.map(([phrase, rows]) => (
        <section key={phrase} className="rl-ledger-group" aria-label={phrase}>
          <h4 className="rl-ledger-head">{phrase}</h4>
          <ul className="rl-ledger-list">
            {rows.map((edge) => {
              const facts = factsFor(edge.otherId)
              const title = facts?.title ?? "Missing item"
              return (
                <li
                  key={edge.key}
                  className="rl-ledger-row"
                  data-testid="link-ledger-row"
                  data-key={edge.key}
                  data-direction={edge.direction}
                  data-selected={selectedKey === edge.key ? "true" : undefined}
                  data-flash={flashKey === edge.key.split("#")[0] || flashKey === edge.key ? "true" : undefined}
                  onClick={() => onSelect?.(edge.key)}
                >
                  <img className="rl-orb-20" data-orb src={iconFor(edge.otherId, facts?.icon)} alt="" draggable={false} />
                  <span className="rl-ledger-title">{title}</span>
                  {facts?.typeName ? <span className="rl-typeplate">{facts.typeName}</span> : null}
                  <span
                    className="rl-dir"
                    aria-label={DIRECTION_WORD[edge.direction]}
                    title={DIRECTION_WORD[edge.direction]}
                  >
                    {DIRECTION_GLYPH[edge.direction]}
                  </span>
                  {notes?.get(edge.key) ? (
                    <span className="rl-check" data-testid="link-check" title={notes.get(edge.key)}>
                      check
                    </span>
                  ) : null}
                  <span className="rl-ledger-actions">
                    {onOpen && facts && facts.openable !== false ? (
                      <button
                        type="button"
                        className="rl-key"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpen(edge.otherId)
                        }}
                      >
                        Open {title}
                      </button>
                    ) : null}
                    {(edge.direction === "out" || edge.direction === "mutual") && edge.outLinkId ? (
                      <button
                        type="button"
                        className="rl-key"
                        aria-label={`Remove link to ${title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemove(edge.outLinkId!)
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                    {edge.direction === "in" && getRelationDef(edge.inLink?.relation ?? edge.relation)?.reciprocity !== "quiet" ? (
                      <>
                        <button
                          type="button"
                          className="rl-key"
                          title={`Add "${edgePhrase(edge)} ${title}" here too`}
                          aria-label={`Confirm link to ${title}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onConfirm(edge.relation, edge.otherId)
                          }}
                        >
                          Confirm
                        </button>
                      </>
                    ) : null}
                    {edge.direction === "derived" ? (
                      <>
                        {onWhy && "proof" in edge ? (
                          <button
                            type="button"
                            className="rl-key"
                            aria-label={`Why is ${title} here?`}
                            onClick={(event) => {
                              event.stopPropagation()
                              onWhy(edge.key)
                            }}
                          >
                            why?
                          </button>
                        ) : null}
                        {edge.derivedFrom === "structure" ? null : (
                        <button
                          type="button"
                          className="rl-key"
                          aria-label={`Pin link to ${title}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onPin(edge.relation, edge.otherId)
                          }}
                        >
                          Pin
                        </button>
                        )}
                        <button
                          type="button"
                          className="rl-key"
                          aria-label={`Dismiss suggestion ${title}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onDismiss(edge.key)
                          }}
                        >
                          Dismiss
                        </button>
                      </>
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
