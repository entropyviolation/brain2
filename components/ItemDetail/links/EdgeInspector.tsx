/**
 * components/ItemDetail/links/EdgeInspector.tsx — One edge as a property
 * sheet (LINKS_REDESIGN §9.3, §13; L3.4 proof card, L6.3 inspector):
 * relation, direction, order, checks, and for a derived edge the rule
 * sentence and each step, each step opening its item.
 */
"use client"

import { relationLabel } from "@/lib/links"
import { ruleSentence, type RelationRule } from "@/lib/graph/relation-rules"
import type { DerivedEdge } from "@/lib/graph/ego-reason"
import type { EgoEdge } from "@/lib/link-graph"

const ORDER: Record<EgoEdge["direction"], string> = { out: "recorded here", in: "recorded on the other item", mutual: "recorded both ways", derived: "derived" }

export function EdgeInspector({
  edge,
  centerTitle,
  title,
  rules,
  note,
  onOpen,
  onClose,
}: {
  edge: EgoEdge
  centerTitle: string
  title: (id: string) => string
  rules: readonly RelationRule[]
  note?: string
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const proof = "proof" in edge ? (edge as DerivedEdge).proof : undefined
  const rule = proof?.ruleId ? rules.find((r) => r.id === proof.ruleId) : undefined
  return (
    <section className="rl-inspector" aria-label="Edge" data-testid="edge-inspector">
      <header className="rl-inspector-head">
        <span>
          {centerTitle} {edge.label ?? relationLabel(edge.relation)} {title(edge.otherId)}
        </span>
        <button type="button" className="rl-key" onClick={onClose}>
          Close
        </button>
      </header>
      <dl className="rl-inspector-grid">
        <dt>Relation</dt>
        <dd>{relationLabel(edge.relation)}</dd>
        <dt>Order</dt>
        <dd>{ORDER[edge.direction]}</dd>
        {edge.derivedFrom ? (
          <>
            <dt>From</dt>
            <dd>{rule ? rule.label : edge.derivedFrom}</dd>
          </>
        ) : null}
        {note ? (
          <>
            <dt>Check</dt>
            <dd>{note}</dd>
          </>
        ) : null}
      </dl>
      {proof ? (
        <div className="rl-proof" data-testid="proof-card">
          <p className="rl-proof-rule">{rule ? ruleSentence(rule, relationLabel) : `${relationLabel(edge.relation)} carries over (transitive).`}</p>
          <ol>
            {proof.steps.map((s, i) => (
              <li key={i}>
                <button type="button" className="rl-key" onClick={() => onOpen(s.from)}>
                  {title(s.from)}
                </button>{" "}
                {relationLabel(s.relation)}{" "}
                <button type="button" className="rl-key" onClick={() => onOpen(s.to)}>
                  {title(s.to)}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
