/**
 * components/Lab/IdeaSwarm/NodeInspector.tsx — Everything about one node: its knobs, its prompt, what it made, how it scored
 *
 * Model, temperature and token cap are on every model node, with a line on when to move the temperature. The Readers
 * node also edits the lenses (turn off, reword, give one its own model or temperature, add your own). Outputs are listed
 * as they came, with whether a quote is really in the passage and each list's score against the gold set.
 */
"use client"

import { useState } from "react"
import { KEYPHRASE_METHODS } from "@/lib/keyphrase"
import { BASELINE_PROMPT, INSIGHT_PROMPT, LONE_PROMPT, SYNTH_PROMPT, TEMPERATURE_ADVICE } from "@/lib/idea-swarm/lenses"
import type { Score } from "@/lib/idea-swarm/score"
import type { Config, Item, Knob, Lens, StageOut } from "@/lib/idea-swarm/types"
import type { NodeId } from "./PipelineGraph"

type Set = (f: (c: Config) => Config) => void

export function ScoreChip({ s, label }: { s?: Score | null; label?: string }) {
  if (!s) return null
  return (
    <span className="is-score" title={`coverage ${s.coverage.toFixed(2)} (found what you wanted) · precision ${s.precision.toFixed(2)} (worth reading) · against “${s.version}”, ${s.gold} gold items`}>
      {label ? <em>{label}</em> : null}F {s.f.toFixed(2)}<small> cov {s.coverage.toFixed(2)} · prec {s.precision.toFixed(2)}</small>
    </span>
  )
}

function KnobEditor({ knob, models, advice, onChange }: { knob: Knob; models: string[]; advice?: string; onChange: (k: Knob) => void }) {
  const list = models.includes(knob.model) ? models : [knob.model, ...models]
  return (
    <div className="is-knobs">
      <label>Model
        <select value={knob.model} onChange={(e) => onChange({ ...knob, model: e.target.value })}>{list.filter((m) => !/embed/i.test(m)).map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label>Temperature <b>{knob.temperature.toFixed(2)}</b>
        <input type="range" min="0" max="1.5" step="0.05" value={knob.temperature} onChange={(e) => onChange({ ...knob, temperature: Number(e.target.value) })} />
      </label>
      <label>Max tokens
        <input type="number" min="100" max="4000" step="50" value={knob.maxTokens} onChange={(e) => onChange({ ...knob, maxTokens: Number(e.target.value) || knob.maxTokens })} />
      </label>
      {advice ? <p className="is-advice">{advice}</p> : null}
    </div>
  )
}

function PromptEditor({ value, base, onChange }: { value: string; base: string; onChange: (v: string) => void }) {
  return (
    <label className="is-prompt">Instruction
      <textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)} />
      {value !== base ? <button type="button" onClick={() => onChange(base)}>Reset to default</button> : null}
    </label>
  )
}

function LensEditor({ lens, models, onChange, onDrop }: { lens: Lens; models: string[]; onChange: (l: Lens) => void; onDrop: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`is-lens${lens.on ? "" : " is-off"}`}>
      <div className="is-lens-row">
        <input type="checkbox" checked={lens.on} onChange={(e) => onChange({ ...lens, on: e.target.checked })} aria-label={`${lens.label} on`} />
        <input className="is-lens-name" value={lens.label} onChange={(e) => onChange({ ...lens, label: e.target.value })} aria-label="Lens name" />
        {lens.model || lens.temperature !== undefined ? <small className="is-chip">own {lens.model ?? "model"}{lens.temperature !== undefined ? ` · t ${lens.temperature}` : ""}</small> : null}
        <button type="button" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</button>
      </div>
      {open ? (
        <div className="is-lens-edit">
          <textarea rows={3} value={lens.prompt} onChange={(e) => onChange({ ...lens, prompt: e.target.value })} />
          <label>Own model
            <select value={lens.model ?? ""} onChange={(e) => onChange({ ...lens, model: e.target.value || undefined })}><option value="">same as readers</option>{models.filter((m) => !/embed/i.test(m)).map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label>Own temperature {lens.temperature !== undefined ? <b>{lens.temperature.toFixed(2)}</b> : <em>same as readers</em>}
            <input type="range" min="0" max="1.5" step="0.05" value={lens.temperature ?? 0.7} onChange={(e) => onChange({ ...lens, temperature: Number(e.target.value) })} />
            {lens.temperature !== undefined ? <button type="button" onClick={() => onChange({ ...lens, temperature: undefined })}>Use readers' temperature</button> : null}
          </label>
          <button type="button" onClick={onDrop}>Delete this lens</button>
        </div>
      ) : null}
    </li>
  )
}

function Outputs({ items, scoreOf }: { items: Item[]; scoreOf?: (i: Item) => string | undefined }) {
  if (!items.length) return null
  return (
    <ol className="is-out">
      {items.map((i) => (
        <li key={i.id}>
          <span>{i.text}</span>
          <small>
            {i.lens ? <span className="is-chip">{i.lens}</span> : null}
            {i.method ? <span className="is-chip">{i.method}{i.note ? ` ${i.note}` : ""}</span> : null}
            {i.grounded === true ? <span className="is-chip is-yes" title={i.quote}>quote ✓</span> : i.grounded === false ? <span className="is-chip is-no" title={i.quote}>quote ✗</span> : null}
            {i.note && !i.method ? <em>{i.note}</em> : null}
            {scoreOf?.(i)}
          </small>
        </li>
      ))}
    </ol>
  )
}

export function NodeInspector({ node, config, set, models, stage, passageLen, scores }: {
  node: NodeId
  config: Config
  set: Set
  models: string[]
  stage?: StageOut
  passageLen: number
  scores: Record<string, Score | null | undefined>
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const head = (title: string, about: string, on?: { value: boolean; change: (v: boolean) => void }) => (
    <header className="is-insp-head">
      <div><h3>{title}</h3><p>{about}</p></div>
      {on ? <label className="is-onoff"><input type="checkbox" checked={on.value} onChange={(e) => on.change(e.target.checked)} /> on</label> : null}
    </header>
  )
  const meta = stage ? (
    <p className="is-stage-meta">
      {stage.status === "error" ? <b className="is-bad">{stage.error}</b> : stage.status === "skipped" ? <>skipped: {stage.note}</> : <>{stage.items.length} out · {stage.calls} call{stage.calls === 1 ? "" : "s"} · {(stage.ms / 1000).toFixed(1)}s{stage.note ? ` · ${stage.note}` : ""}</>}
    </p>
  ) : <p className="is-stage-meta">Not run yet.</p>
  const prompt = stage?.prompt ? (
    <>
      <button type="button" className="is-linkish" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "Hide" : "Show"} the prompt sent</button>
      {showPrompt ? <pre className="is-pre">{stage.prompt}</pre> : null}
    </>
  ) : null

  if (node === "passage") return <section className="is-insp">{head("Passage", "What every node reads. Pick or paste it on the left. Local models see about 4,000 characters well; the context window is fixed at 4,096 tokens.")}<p className="is-stage-meta">{passageLen.toLocaleString()} characters{passageLen > 5500 ? " — long: the readers may not see all of it" : ""}</p></section>

  if (node === "result") return <section className="is-insp">{head("Result", "What the swarm hands on: one card per real cluster, plus any hidden gems. Compare it with the single careful call on the Scores tab.")}</section>

  if (node === "keyphrases") {
    const byMethod = (m: string) => (stage?.items ?? []).filter((i) => i.method === m)
    return (
      <section className="is-insp">
        {head("Key phrases", "No model, instant, deterministic. A free baseline, and the topics for the next node.", { value: config.keyphrases.on, change: (v) => set((c) => ({ ...c, keyphrases: { ...c.keyphrases, on: v } })) })}
        <div className="is-checks">
          {KEYPHRASE_METHODS.map((m) => (
            <label key={m.id} title={m.about}><input type="checkbox" checked={config.keyphrases.methods.includes(m.id)} onChange={(e) => set((c) => ({ ...c, keyphrases: { ...c.keyphrases, methods: e.target.checked ? [...c.keyphrases.methods, m.id] : c.keyphrases.methods.filter((x) => x !== m.id) } }))} /> {m.label}</label>
          ))}
        </div>
        <label>Phrases per method <input type="number" min="3" max="30" value={config.keyphrases.top} onChange={(e) => set((c) => ({ ...c, keyphrases: { ...c.keyphrases, top: Number(e.target.value) || 12 } }))} /></label>
        <label className="is-check"><input type="checkbox" checked={config.keyphrases.feed} onChange={(e) => set((c) => ({ ...c, keyphrases: { ...c.keyphrases, feed: e.target.checked } }))} /> Tell each reader the topics found (the first method's)</label>
        {meta}
        <div className="is-cols">{config.keyphrases.methods.map((m) => (
          <div key={m}><h4>{KEYPHRASE_METHODS.find((x) => x.id === m)?.label} <ScoreChip s={scores[`keyphrases:${m}`]} /></h4><ol className="is-plain">{byMethod(m).map((i) => <li key={i.id}>{i.text}</li>)}</ol></div>
        ))}</div>
      </section>
    )
  }

  if (node === "topicInsight") {
    const k = config.topicInsight
    return (
      <section className="is-insp">
        {head("Insight on topics", "Key phrases → the passage + those topics → what insight does the passage give onto each?", { value: k.on, change: (v) => set((c) => ({ ...c, topicInsight: { ...c.topicInsight, on: v } })) })}
        <KnobEditor knob={k.knob} models={models} advice={TEMPERATURE_ADVICE.topicInsight} onChange={(knob) => set((c) => ({ ...c, topicInsight: { ...c.topicInsight, knob } }))} />
        <PromptEditor value={k.prompt} base={INSIGHT_PROMPT} onChange={(prompt) => set((c) => ({ ...c, topicInsight: { ...c.topicInsight, prompt } }))} />
        {meta}{prompt}<h4>Output <ScoreChip s={scores.topicInsight} /></h4><Outputs items={stage?.items ?? []} />
      </section>
    )
  }

  if (node === "agents") {
    const a = config.agents
    return (
      <section className="is-insp">
        {head("Readers", "Many weak models, each reading the same passage through a different lens. Prompt diversity beats sampling diversity.")}
        <KnobEditor knob={a.knob} models={models} advice={TEMPERATURE_ADVICE.agents} onChange={(knob) => set((c) => ({ ...c, agents: { ...c.agents, knob } }))} />
        <div className="is-knobs">
          <label>Ideas per reader <input type="number" min="1" max="8" value={a.perAgent} onChange={(e) => set((c) => ({ ...c, agents: { ...c.agents, perAgent: Number(e.target.value) || 4 } }))} /></label>
          <label>Samples per lens <input type="number" min="1" max="6" value={a.samples} onChange={(e) => set((c) => ({ ...c, agents: { ...c.agents, samples: Number(e.target.value) || 1 } }))} /></label>
          <label>Calls at once <input type="number" min="1" max="8" value={a.parallel} onChange={(e) => set((c) => ({ ...c, agents: { ...c.agents, parallel: Number(e.target.value) || 1 } }))} /></label>
        </div>
        <h4>Lenses <small>{a.lenses.filter((l) => l.on).length} on, {a.lenses.filter((l) => l.on).length * a.samples} calls</small></h4>
        <ul className="is-lenses">
          {a.lenses.map((l, i) => (
            <LensEditor key={l.id} lens={l} models={models} onChange={(n) => set((c) => ({ ...c, agents: { ...c.agents, lenses: c.agents.lenses.map((x, k) => (k === i ? n : x)) } }))} onDrop={() => set((c) => ({ ...c, agents: { ...c.agents, lenses: c.agents.lenses.filter((_, k) => k !== i) } }))} />
          ))}
        </ul>
        <button type="button" onClick={() => set((c) => ({ ...c, agents: { ...c.agents, lenses: [...c.agents.lenses, { id: `mine${Date.now().toString(36)}`, label: "My lens", prompt: "Describe what to look for.", on: true }] } }))}>Add a lens</button>
        {meta}{prompt}<h4>Output <ScoreChip s={scores["agents:all"]} label="pooled " /></h4>
        <Outputs items={stage?.items ?? []} scoreOf={() => undefined} />
      </section>
    )
  }

  if (node === "cluster") {
    const k = config.cluster
    return (
      <section className="is-insp">
        {head("Embed + cluster", "Each idea becomes a vector (an embedding model, no chat model); ideas closer than the threshold on average are one cluster. No count to guess.")}
        <div className="is-knobs">
          <label>Embedding model <input value={config.embed.model} onChange={(e) => set((c) => ({ ...c, embed: { model: e.target.value } }))} /></label>
          <label>Similarity threshold <b>{k.threshold.toFixed(2)}</b>
            <input type="range" min="0.3" max="0.95" step="0.01" value={k.threshold} onChange={(e) => set((c) => ({ ...c, cluster: { ...c.cluster, threshold: Number(e.target.value) } }))} />
          </label>
          <label>Smallest real cluster <input type="number" min="2" max="8" value={k.minSize} onChange={(e) => set((c) => ({ ...c, cluster: { ...c.cluster, minSize: Number(e.target.value) || 2 } }))} /></label>
          <p className="is-advice">Higher = more, tighter clusters and more lone ideas. Lower = fewer, broader clusters. Tune it with “Re-run without the readers” — it reuses their answers. See the Map tab.</p>
        </div>
        {meta}<h4>Medoids: the nearest real answer to each centre <ScoreChip s={scores["cluster:medoids"]} /></h4><Outputs items={stage?.items ?? []} />
      </section>
    )
  }

  const ex = config.extra?.find((x) => x.id === node)
  if (ex) {
    const upd = (f: Partial<typeof ex>) => set((c) => ({ ...c, extra: (c.extra ?? []).map((x) => (x.id === ex.id ? { ...x, ...f } : x)) }))
    const sources = ["passage", "keyphrases", "topicInsight", "agents", "cluster", "synth", "lone", "baseline", "result", ...(config.extra ?? []).filter((x) => x.id !== ex.id).map((x) => x.id)]
    return (
      <section className="is-insp">
        {head(ex.label, "A node you added. It reads one other node's output and reports ideas of its own; it runs after the built-in nodes and is saved with the run.", { value: ex.on, change: (v) => upd({ on: v }) })}
        <label>Name <input value={ex.label} onChange={(e) => upd({ label: e.target.value })} /></label>
        <label>Reads from
          <select value={ex.from} onChange={(e) => upd({ from: e.target.value })}>{sources.map((m) => <option key={m} value={m}>{config.extra?.find((x) => x.id === m)?.label ?? m}</option>)}</select>
        </label>
        <KnobEditor knob={ex.knob} models={models} onChange={(knob) => upd({ knob })} />
        <label className="is-prompt">Instruction<textarea rows={6} value={ex.prompt} onChange={(e) => upd({ prompt: e.target.value })} /></label>
        <button type="button" onClick={() => set((c) => ({ ...c, extra: (c.extra ?? []).filter((x) => x.id !== ex.id) }))}>Delete this node</button>
        {meta}{prompt}<h4>Output</h4><Outputs items={stage?.items ?? []} />
      </section>
    )
  }

  const writer = node === "synth" ? { key: "synth" as const, title: "Cards", about: "A strong model reads every member of a cluster and writes one idea card. Compare its card with the medoid on the Map tab: which sits closer to the centre?", base: SYNTH_PROMPT, advice: TEMPERATURE_ADVICE.synth, score: scores.synth }
    : node === "lone" ? { key: "lone" as const, title: "Lone gems", about: "Ideas only one reader had. A strong model looks for hidden gems among them: correct, specific, non-obvious, quoting the passage.", base: LONE_PROMPT, advice: TEMPERATURE_ADVICE.lone, score: scores.lone }
    : { key: "baseline" as const, title: "One careful call", about: "The fair comparison: one call to one model with the whole passage. Does the swarm beat this?", base: BASELINE_PROMPT, advice: TEMPERATURE_ADVICE.baseline, score: scores.baseline }
  const k = config[writer.key]
  return (
    <section className="is-insp">
      {head(writer.title, writer.about, { value: k.on, change: (v) => set((c) => ({ ...c, [writer.key]: { ...c[writer.key], on: v } })) })}
      <KnobEditor knob={k.knob} models={models} advice={writer.advice} onChange={(knob) => set((c) => ({ ...c, [writer.key]: { ...c[writer.key], knob } }))} />
      {writer.key === "lone" ? <label className="is-check"><input type="checkbox" checked={config.lone.groundedOnly} onChange={(e) => set((c) => ({ ...c, lone: { ...c.lone, groundedOnly: e.target.checked } }))} /> Only lone ideas whose quote is really in the passage</label> : null}
      <PromptEditor value={k.prompt} base={writer.base} onChange={(prompt) => set((c) => ({ ...c, [writer.key]: { ...c[writer.key], prompt } }))} />
      {meta}{prompt}<h4>Output <ScoreChip s={writer.score} /></h4><Outputs items={stage?.items ?? []} />
    </section>
  )
}
