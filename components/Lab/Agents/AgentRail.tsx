/**
 * components/Lab/Agents/AgentRail.tsx — A row of every agent, shared by the labs
 *
 * One chip per Blueprint: a glyph for its kind of mind (graph, pipeline, policy), its name, and its
 * revision. The lab that hosts the rail says what a click does. Reads only Blueprints (`lib/agents/`);
 * it runs and saves nothing. Plan: `docs/AGENT_LAB_PLAN.md` §4.
 */
"use client"

import type { Blueprint, MindKind } from "@/lib/agents/blueprint"
import "./agent-rail.css"

/** The silhouette of a mind kind: nodes and wires, beads on a rail, or weighted bars. */
export function MindGlyph({ kind }: { kind: MindKind }) {
  return (
    <svg className="ag-glyph" viewBox="0 0 20 14" width="20" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
      {kind === "graph" ? (
        <>
          <path d="M4 7 L10 3 M4 7 L10 11 M10 3 L16 7 M10 11 L16 7" />
          <circle cx="4" cy="7" r="2" fill="currentColor" />
          <circle cx="10" cy="3" r="1.7" fill="currentColor" />
          <circle cx="10" cy="11" r="1.7" fill="currentColor" />
          <circle cx="16" cy="7" r="2" fill="currentColor" />
        </>
      ) : kind === "pipeline" ? (
        <>
          <path d="M2 7 H18" />
          {[3, 7, 11, 15, 18].map((x) => (
            <circle key={x} cx={x} cy="7" r="1.8" fill="currentColor" />
          ))}
        </>
      ) : (
        <>
          <path d="M2 3 H16 M2 7 H11 M2 11 H7" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

export const MIND_LABEL: Record<MindKind, string> = { graph: "graph", pipeline: "pipeline", policy: "policy" }

export function AgentRail({ agents, activeId, onPick }: { agents: Blueprint[]; activeId?: string | null; onPick: (agent: Blueprint) => void }) {
  return (
    <nav className="ag-rail" aria-label="Agents">
      <span className="ag-rail-k">Agents · {agents.length}</span>
      <div className="ag-rail-scroll">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            data-no95
            className={`ag-chip${a.id === activeId ? " is-active" : ""}`}
            aria-current={a.id === activeId ? "true" : undefined}
            title={`${a.name} — ${MIND_LABEL[a.mind.kind]} · rev ${a.rev}\n${a.purpose}`}
            onClick={() => onPick(a)}
          >
            <MindGlyph kind={a.mind.kind} />
            <span className="ag-chip-name">{a.name}</span>
            <span className="ag-chip-rev">{a.mind.kind}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
