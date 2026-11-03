/**
 * components/Lab/Agents/AgentsDesk.tsx — The Agents desk tab
 *
 * A solid board: every agent in a list on the left, the picked one's purpose, named pipelines and
 * lab link on the right. Reads only Blueprints (`lib/agents/`). The full `/lab/agents` rooms are still
 * planned (`docs/AGENT_LAB_PLAN.md`); until then this is the way in.
 */
"use client"

import { useMemo, useState } from "react"
import { listBlueprints } from "@/lib/agents/registry"
import { MindGlyph, MIND_LABEL } from "./AgentRail"
import { OVERCOME_ID } from "@/lib/agents/adapters/overcome-bimby"
import { OvercomeBimbyPopup } from "../OvercomeBimby/OvercomeBimbyPopup"
import { agentLabHref } from "./agent-href"
import "./agents-desk.css"

export function AgentsDesk() {
  const agents = useMemo(() => listBlueprints(), [])
  const [overcomeOpen, setOvercomeOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(agents[0]?.id ?? null)
  const active = agents.find((a) => a.id === activeId) ?? null
  const href = active ? (agentLabHref(active) ?? "/lab/bim-flow") : null

  return (
    <section className="ad-desk" data-ui-name="Agents" data-ui-docs="components/Lab/Agents/README.md">
      <nav className="ad-list" aria-label="Agents">
        <span className="ad-k">Agents · {agents.length}</span>
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            data-no95
            className={`ad-row${a.id === activeId ? " is-active" : ""}`}
            aria-current={a.id === activeId ? "true" : undefined}
            onClick={() => setActiveId(a.id)}
          >
            <MindGlyph kind={a.mind.kind} />
            <span>{a.name}</span>
            <span className="ad-tag">{MIND_LABEL[a.mind.kind]}</span>
          </button>
        ))}
      </nav>
      {active ? (
        <article className="ad-detail" aria-label={active.name}>
          <header className="ad-head">
            <h2>{active.name}</h2>
            <span className="ad-k">
              {MIND_LABEL[active.mind.kind]} · rev {active.rev}
            </span>
          </header>
          <p className="ad-purpose">{active.purpose}</p>
          {active.mind.kind === "pipeline" && active.mind.pipelines?.length ? (
            <ul className="ad-pipes" aria-label="Pipelines">
              {active.mind.pipelines.map((p) => (
                <li key={p.id} className={`ad-pipe${p.status === "planned" ? " is-planned" : ""}`} data-testid={`pipeline-${p.id}`}>
                  <div className="ad-pipe-top">
                    <b>{p.name}</b>
                    <span className={`ad-badge${p.status === "planned" ? " is-planned" : ""}`}>{p.status}</span>
                    {p.asTool ? <span className="ad-meta">tool {p.asTool}</span> : null}
                    {p.plan ? <span className="ad-meta">{p.plan}</span> : null}
                  </div>
                  <p>{p.does}</p>
                  {p.stages.length ? (
                    <ol className="ad-stages" aria-label="Stages">
                      {p.stages.map((s, i) => (
                        <li key={`${s.label}-${i}`}>{s.label}</li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ad-actions">
            {active.id === OVERCOME_ID ? (
              <button type="button" data-no95 className="ad-key is-primary" onClick={() => setOvercomeOpen(true)} data-testid="agents-open-popup">
                Open popup
              </button>
            ) : null}
            {href ? (
              <a className={`ad-key${active.id === OVERCOME_ID ? "" : " is-primary"}`} href={href} data-testid="agents-open-lab">
                Open lab
              </a>
            ) : null}
            <a className="ad-key" href="/lab/agents" data-testid="agents-open-bench">
              Agent bench: score and compare ways of answering the same lines
            </a>
          </div>
        </article>
      ) : null}
      {overcomeOpen ? <OvercomeBimbyPopup onClose={() => setOvercomeOpen(false)} /> : null}
    </section>
  )
}
