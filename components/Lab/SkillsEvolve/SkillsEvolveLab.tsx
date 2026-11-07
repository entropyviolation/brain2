/**
 * components/Lab/SkillsEvolve/SkillsEvolveLab.tsx — Try the Skills evolver on an agent's experience
 *
 * Pick an agent that has a skill bank, see its success rate per category (weak ones first), and run `evolve` to get
 * proposed skills. Proposals are shown only; nothing is saved to the bank. Accepting is a separate step in the
 * agent's own lab. Engine: `lib/skills/`.
 */
"use client"

import { useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { loadBank } from "@/lib/skills/bank"
import { loadExperiences } from "@/lib/skills/experience"
import { evolve, statsByCategory, weakCategories, type Evolved } from "@/lib/skills/evolve"
import { LISTS_HELPER_SKILLS, TRACKING_HELPER_SKILLS } from "@/lib/skills/seeds"
import "../bimby-lab.css"

const AGENTS = [
  { id: "tracking-helper", name: "Tracking BIMBY", seeds: TRACKING_HELPER_SKILLS },
  { id: "lists-helper", name: "Lists BIMBY", seeds: LISTS_HELPER_SKILLS },
]

export function SkillsEvolveLab() {
  const [agentId, setAgentId] = useState(AGENTS[0]!.id)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<Evolved | null>(null)

  const agent = AGENTS.find((a) => a.id === agentId)!
  const experiences = loadExperiences(agentId)
  const bank = loadBank(agentId, agent.seeds)
  const stats = statsByCategory(experiences)
  const weak = new Set(weakCategories(experiences).map((w) => w.category))

  async function go() {
    setBusy(true)
    const crew = await chatCrew().catch(() => null)
    setOut(await evolve({ experiences, bank, call: crew ? ollamaCall(crew.main) : null, ladder: crew?.pick ?? [] }))
    setBusy(false)
  }

  return (
    <div className="bl-lab">
      <a className="bl-back" href="/lab/agents">← Agent lab</a>
      <h1>Skills evolver</h1>
      <p className="bl-note">Grows an agent&apos;s skills only where it is weak. Proposals are shown here and not saved; a person accepts them.</p>

      <section>
        <h2>Agent</h2>
        <select value={agentId} onChange={(e) => { setAgentId(e.target.value); setOut(null) }} aria-label="Agent">
          {AGENTS.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <p className="bl-note">{experiences.length} experiences · {bank.skills.length} skills in the bank on this device</p>
      </section>

      <section>
        <h2>Success by category</h2>
        {stats.length === 0 ? <p className="bl-note">No experiences yet. Corrections to this agent fill them.</p> : (
          <table className="bl-table">
            <thead><tr><th>Category</th><th>Cases</th><th>Success</th><th /></tr></thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.category}><td>{s.category}</td><td>{s.n}</td><td>{Math.round(s.rate * 100)}%</td><td>{weak.has(s.category) ? "weak" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" disabled={busy || experiences.length === 0} onClick={() => void go()}>{busy ? "Working…" : "Propose skills"}</button>
      </section>

      {out && (
        <section>
          <h2>{out.proposals.length} proposed{out.model ? ` by ${out.model}` : ""}</h2>
          {out.fallback && <p className="bl-note">Plain lessons answered: {out.fallback}.</p>}
          {out.proposals.length === 0 && <p className="bl-note">Nothing weak enough, or nothing new to teach.</p>}
          <ul className="bl-list">
            {out.proposals.map((s) => (
              <li key={s.id}><b>{s.name}</b> ({s.category}): {s.principle} <span className="bl-dim">When: {s.whenToApply}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
