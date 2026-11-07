/**
 * components/Lab/IdeaSwarm/GoldEditor.tsx — Write the answers you would accept, step by step, as many versions as you like
 *
 * A gold set is one or more versions; each version answers every step on its own (key phrases, insight on topics,
 * ideas, hidden gems), one item per line. Any step can be filled from what a node of the current run produced and then
 * edited, which is faster than writing from nothing. Scoring takes the best-matching version per node.
 */
"use client"

import { useState } from "react"
import { goldFromRun, targetsOf, type GoldField } from "@/lib/idea-swarm/score"
import type { Gold, GoldVersion, Run } from "@/lib/idea-swarm/types"

const STEPS: Array<{ field: GoldField; title: string; hint: string }> = [
  { field: "keyphrases", title: "1 · Key phrases", hint: "The terms and topics that matter most in this passage." },
  { field: "insights", title: "2 · Insight on topics", hint: "For each main topic: what the passage tells you about it. “topic: insight”." },
  { field: "ideas", title: "3 · Ideas", hint: "The idea cards you would want out of the swarm. “name: what is claimed”." },
  { field: "gems", title: "4 · Hidden gems", hint: "The non-obvious, easily-missed ideas. A good extractor finds these." },
]

const blank = (label: string): GoldVersion => ({ id: `v${Date.now().toString(36)}`, label, keyphrases: [], insights: [], ideas: [], gems: [] })

export function GoldEditor({ passageId, gold, run, onChange }: { passageId: string; gold: Gold | null; run: Run | null; onChange: (g: Gold) => void }) {
  const g: Gold = gold ?? { id: `gold-${passageId}`, passageId, versions: [blank("Version A")], at: new Date().toISOString() }
  const [vi, setVi] = useState(0)
  const v = g.versions[Math.min(vi, g.versions.length - 1)]!
  const save = (versions: GoldVersion[]) => onChange({ ...g, versions, at: new Date().toISOString() })
  const edit = (patch: Partial<GoldVersion>) => save(g.versions.map((x) => (x.id === v.id ? { ...x, ...patch } : x)))
  const targets = run ? targetsOf(run) : []
  const [fill, setFill] = useState<Record<string, string>>({})
  return (
    <div className="is-gold">
      <div className="is-gold-bar">
        {g.versions.map((x, i) => <button key={x.id} type="button" className={x.id === v.id ? "is-on" : ""} onClick={() => setVi(i)}>{x.label}</button>)}
        <button type="button" onClick={() => { save([...g.versions, blank(`Version ${String.fromCharCode(65 + g.versions.length)}`)]); setVi(g.versions.length) }}>+ Another acceptable answer</button>
        {run ? <button type="button" onClick={() => { save([...g.versions, goldFromRun(run, `From run ${g.versions.length + 1}`)]); setVi(g.versions.length) }} title="A new version prefilled from the current run's output">+ Start from this run</button> : null}
      </div>
      <div className="is-gold-name">
        <label>Name <input value={v.label} onChange={(e) => edit({ label: e.target.value })} /></label>
        {g.versions.length > 1 ? <button type="button" onClick={() => { save(g.versions.filter((x) => x.id !== v.id)); setVi(0) }}>Delete this version</button> : null}
      </div>
      <p className="is-advice">Several versions mean “any of these is right”: each node is scored against the version it matches best.</p>
      {STEPS.map((s) => {
        const options = targets.filter((t) => t.field === s.field)
        return (
          <label key={s.field} className="is-gold-step">
            <span><b>{s.title}</b> <small>{s.hint}</small></span>
            <textarea rows={s.field === "keyphrases" ? 3 : 5} value={v[s.field].join("\n")} onChange={(e) => edit({ [s.field]: e.target.value.split("\n") } as Partial<GoldVersion>)} />
            {options.length ? (
              <span className="is-fill">
                <select value={fill[s.field] ?? options[0]!.key} onChange={(e) => setFill({ ...fill, [s.field]: e.target.value })}>{options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
                <button type="button" onClick={() => { const t = options.find((o) => o.key === (fill[s.field] ?? options[0]!.key))!; edit({ [s.field]: t.texts } as Partial<GoldVersion>) }}>Fill from this run</button>
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}
