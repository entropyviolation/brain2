/**
 * components/Lab/IdeaSwarm/IdeaSwarmLab.tsx — The Idea Lab: many weak readers, clustered, written up by a strong model, scored against gold
 *
 * One page to build, run and judge an idea-extraction setup. Left: the passage and the saved runs. Middle: the pipeline
 * diagram (a box per node; click one to open its knobs and outputs), the map of ideas, the gold editor, the score tables.
 * Every node keeps its own model, temperature and prompt. Configs, passages, gold sets and runs live in this browser
 * (`lib/idea-swarm/store.ts`); nothing is written to the vault. Engine: `lib/idea-swarm/`, `lib/keyphrase/`.
 */
"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { ollamaEmbedder } from "@/lib/idea-swarm/embed"
import { defaultConfig } from "@/lib/idea-swarm/lenses"
import { runPipeline } from "@/lib/idea-swarm/pipeline"
import { scoreRun, type Score } from "@/lib/idea-swarm/score"
import { allOf, dropOne, putOne } from "@/lib/idea-swarm/store"
import { STAGES, type Config, type Gold, type Item, type Passage, type Run, type StageId, type StageOut } from "@/lib/idea-swarm/types"
import { BookLab } from "./BookLab"
import { ClusterMap } from "./ClusterMap"
import { textFromFile } from "./file-text"
import { GoldEditor } from "./GoldEditor"
import { NodeInspector } from "./NodeInspector"
import { PipelineGraph, type NodeId } from "./PipelineGraph"
import { ScoreTable } from "./ScoreTable"
import "./idea-swarm.css"

const DRAFT_KEY = "brain2:idea-swarm:draft:v1"
const UI_KEY = "brain2:idea-swarm:ui:v1"
type Ui = { pid?: string; runId?: string | null; tab?: string; node?: string; side?: boolean }
const SAMPLE: Passage = {
  id: "sample",
  title: "Sample · feedback loops (written for this lab)",
  at: "",
  text: `A thermostat is the simplest example of a feedback loop. It measures the room, compares the measurement with a target, and acts to shrink the difference. The cleverness is not in the heater but in the comparison: the system is defined by the gap between what is and what is wanted. A loop that reduces the gap is called balancing, and it is why a house stays at twenty degrees through a cold night.

A reinforcing loop does the opposite: it grows the thing it measures. Money earns interest, interest becomes money that earns more interest. Reinforcing loops explain booms and panics, but they never run forever. Sooner or later a balancing loop appears, often as a limit nobody planned for, such as a market running out of buyers or a plant running out of soil.

Most trouble comes from delay. If the thermostat reported the temperature an hour late, the heater would overshoot, then the cold reading would arrive and it would undershoot, swinging around the target without ever settling. People do the same when they steer a project by last quarter's numbers. The lesson is not to act faster, but to know how long your information takes to arrive and to act with that lag in mind.

A further point is easy to miss. The target itself can drift. If a team lowers its standard whenever it falls short, the gap closes by moving the goal and not by improving the work. Systems thinkers call this eroding goals, and they treat it as one of the most common ways a balancing loop quietly stops balancing.`,
}

const load = <T,>(k: string): T | null => { try { const r = window.localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null } catch { return null } }
const save = (k: string, v: unknown) => { try { window.localStorage.setItem(k, JSON.stringify(v)) } catch { /* the lab still works this visit */ } }

type Tab = "pipeline" | "map" | "gold" | "scores" | "book"

export function IdeaSwarmLab() {
  const [models, setModels] = useState<string[] | null>(null)
  const [config, setConfig] = useState<Config>(() => defaultConfig([]))
  const [presets, setPresets] = useState<Config[]>([])
  const [passages, setPassages] = useState<Passage[]>([SAMPLE])
  const [pid, setPid] = useState("sample")
  const [golds, setGolds] = useState<Record<string, Gold>>({})
  const [runs, setRuns] = useState<Run[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [live, setLive] = useState<Record<string, StageOut>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [node, setNode] = useState<NodeId>("agents")
  const [tab, setTab] = useState<Tab>("pipeline")
  const [note, setNote] = useState("")
  const [progress, setProgress] = useState<{ stage: StageId; done: number; total: number } | null>(null)
  const [clock, setClock] = useState(0)
  const [scores, setScores] = useState<Record<string, Record<string, Score | null>>>({})
  const [book, setBook] = useState<{ name: string; text: string } | null>(null)
  const [slice, setSlice] = useState({ from: 0, len: 4000 })
  const [side, setSide] = useState(true)
  const [ready, setReady] = useState(false)
  const resumed = useRef(false)
  const stop = useRef<AbortController | null>(null)

  const passage = passages.find((p) => p.id === pid) ?? passages[0]!
  const gold = golds[passage.id] ?? null
  const mine = useMemo(() => runs.filter((r) => r.passageId === passage.id), [runs, passage.id])
  const finished = useMemo(() => mine.filter((r) => (r.status ?? "done") === "done"), [mine])
  const run = mine.find((r) => r.id === runId) ?? mine[0] ?? null

  // Stored things load on their own, so a stalled Ollama never hides your saved runs.
  useEffect(() => {
    void (async () => {
      const [ps, gs, rs, cs] = await Promise.all([allOf<Passage>("passages"), allOf<Gold>("golds"), allOf<Run>("runs"), allOf<Config>("configs")])
      if (ps.length) setPassages([SAMPLE, ...ps.sort((a, b) => a.at.localeCompare(b.at))])
      setGolds(Object.fromEntries(gs.map((g) => [g.passageId, g])))
      setRuns(rs.sort((a, b) => b.at.localeCompare(a.at)))
      setPresets(cs)
      const ui = load<Ui>(UI_KEY)
      if (ui?.pid && ps.some((p) => p.id === ui.pid)) setPid(ui.pid)
      if (ui?.runId && rs.some((x) => x.id === ui.runId)) setRunId(ui.runId)
      setReady(true)
    })()
  }, [])

  const lookForModels = useCallback(async () => {
    const m = await listOllamaModels()
    setModels(m ?? [])
    const draft = load<Config>(DRAFT_KEY)
    setConfig((c) => (draft ?? (m?.length ? defaultConfig(m) : c)))
  }, [])
  useEffect(() => { void lookForModels() }, [lookForModels])
  // Small windows give the canvas the room: the passage rail starts folded there.
  useEffect(() => {
    const ui = load<Ui>(UI_KEY)
    setSide(ui?.side ?? window.innerWidth >= 1500)
    if (ui?.tab && ["pipeline", "map", "gold", "scores", "book"].includes(ui.tab)) setTab(ui.tab as Tab)
    if (ui?.node) setNode(ui.node)
  }, [])
  useEffect(() => { if (ready) save(UI_KEY, { pid, runId, tab, node, side } satisfies Ui) }, [ready, pid, runId, tab, node, side])

  const setCfg = useCallback((f: (c: Config) => Config) => setConfig((c) => { const n = f(c); save(DRAFT_KEY, n); return n }), [])

  // Score the current passage's runs whenever the gold or the runs change.
  useEffect(() => {
    if (!gold || !finished.length) { setScores({}); return }
    let live = true
    const embed = ollamaEmbedder(config.embed.model)
    void (async () => {
      const next: Record<string, Record<string, Score | null>> = {}
      try {
        for (const r of finished.slice(0, 12)) next[r.id] = await scoreRun(r, gold, embed)
        if (live) setScores(next)
      } catch {
        if (live) setScores({})
      }
    })()
    return () => { live = false }
  }, [gold, finished, config.embed.model])

  const nodeScores = useMemo(() => {
    const s = run ? scores[run.id] ?? {} : {}
    const by: Partial<Record<NodeId, Score | null>> = { keyphrases: s[`keyphrases:${run?.config.keyphrases.methods[0]}`], topicInsight: s.topicInsight, agents: s["agents:all"], cluster: s["cluster:medoids"], synth: s.synth, lone: s.lone, baseline: s.baseline, result: s.final }
    return { by, flat: s }
  }, [run, scores])

  const stages: Record<string, StageOut | undefined> = busy ? live : { ...run?.stages, ...run?.extras }
  const running = busy ? [...STAGES, ...(config.extra ?? []).map((x) => x.id)].find((s) => !live[s]) ?? null : null

  /** Runs, or resumes an interrupted run. The run is saved when it starts, after every node and after every reader. */
  async function go(reuse: boolean, resume?: Run) {
    setError(null)
    if (!models?.length) { setError("No local model answered. Start Ollama, then reload."); return }
    const p = resume ? passages.find((x) => x.id === resume.passageId) : passage
    if (!p?.text.trim()) { setError("The passage is empty."); return }
    const cfg = resume ? resume.config : config
    const ctl = new AbortController()
    stop.current = ctl
    setBusy(true)
    const keep: Record<string, StageOut> = {}
    if (resume) for (const k of ["topicInsight", "agents"] as const) if (resume.stages[k]?.status === "done") keep[k] = resume.stages[k]!
    setLive(keep)
    setProgress(null)
    const began = Date.now()
    setClock(0)
    const tick = window.setInterval(() => setClock(Math.round((Date.now() - began) / 1000)), 1000)
    const reuseAgents = resume ? keep.agents : reuse ? run?.stages.agents : undefined
    let cp: Run = { id: resume?.id ?? `run-${Date.now().toString(36)}`, at: resume?.at ?? new Date().toISOString(), title: p.title, passageId: p.id, config: structuredClone(cfg), stages: keep, clusters: [], points: [], ms: 0, calls: 0, note: resume?.note ?? note.trim(), status: "running", readers: { ...resume?.readers }, extras: {} }
    const shelve = () => { void putOne("runs", cp); setRuns((rs) => (rs.some((x) => x.id === cp.id) ? rs.map((x) => (x.id === cp.id ? cp : x)) : [cp, ...rs])) }
    shelve()
    if (!resume) setRunId(cp.id)
    try {
      const out = await runPipeline(cfg, p, {
        call: ollamaCall(cfg.agents.knob.model, ctl.signal, { fresh: true }),
        embed: ollamaEmbedder(cfg.embed.model, ctl.signal),
        signal: ctl.signal,
        runId: cp.id,
        onStage: (s) => {
          setLive((l) => ({ ...l, [s.id]: s }))
          cp = (STAGES as readonly string[]).includes(s.id) ? { ...cp, stages: { ...cp.stages, [s.id]: s } } : { ...cp, extras: { ...cp.extras, [s.id]: s } }
          shelve()
        },
        onReader: (key: string, items: Item[]) => { cp = { ...cp, readers: { ...cp.readers, [key]: items } }; void putOne("runs", cp) },
        onProgress: (stage, done, total) => setProgress({ stage, done, total }),
        reuseAgents,
        reuseTopic: resume ? keep.topicInsight : undefined,
        readers: resume?.readers,
      })
      const done: Run = { ...out, note: cp.note, readers: cp.readers, status: ctl.signal.aborted ? "stopped" : "done" }
      await putOne("runs", done)
      setRuns((rs) => rs.map((x) => (x.id === done.id ? done : x)))
      setRunId(done.id)
      setNote("")
      const failed = STAGES.filter((s) => done.stages[s]?.status === "error").map((s) => `${s}: ${done.stages[s]!.error}`)
      if (failed.length) setError(failed.join(" · "))
    } catch (e) {
      cp = { ...cp, status: "stopped" }
      shelve()
      setError(ctl.signal.aborted ? "Stopped. What finished is kept in the runs list." : e instanceof Error ? e.message : String(e))
    } finally {
      window.clearInterval(tick)
      setBusy(false)
      setLive({})
      setProgress(null)
    }
  }

  // A refresh mid-run leaves a `running` record behind; pick it up where the saved nodes and readers left off.
  useEffect(() => {
    if (!ready || resumed.current || !models?.length) return
    const r = runs.find((x) => x.status === "running")
    resumed.current = true
    if (!r) return
    setPid(r.passageId)
    setRunId(r.id)
    void go(false, r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, models, runs])

  function addNode() {
    const x = { id: `x-${Date.now().toString(36)}`, label: "New node", from: node === "result" ? "result" : node, knob: { ...config.baseline.knob }, prompt: "Read this and report the ideas worth keeping that it implies.", on: true }
    setCfg((c) => ({ ...c, extra: [...(c.extra ?? []), x] }))
    setNode(x.id)
  }

  async function savePassage(p: Passage) {
    setPassages((ps) => ps.map((x) => (x.id === p.id ? p : x)))
    if (p.id !== "sample") await putOne("passages", p)
  }
  async function newPassage(title: string, text: string) {
    const p: Passage = { id: `ps-${Date.now().toString(36)}`, title, text, at: new Date().toISOString() }
    await putOne("passages", p)
    setPassages((ps) => [...ps, p])
    setPid(p.id)
  }
  async function upload(file: File) {
    try {
      const text = await textFromFile(file)
      if (text.length < 40) throw new Error("No words came out of that file.")
      setBook({ name: file.name.replace(/\.(pdf|txt|md)$/i, ""), text })
      setSlice({ from: 0, len: 4000 })
      await newPassage(`${file.name.replace(/\.(pdf|txt|md)$/i, "")} · chars 0–4000`, text.slice(0, 4000))
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.")
    }
  }
  async function takeSlice(from: number) {
    if (!book) return
    const f = Math.max(0, Math.min(from, book.text.length - 1))
    setSlice({ ...slice, from: f })
    await newPassage(`${book.name} · chars ${f}–${f + slice.len}`, book.text.slice(f, f + slice.len))
  }
  async function saveGold(g: Gold) {
    setGolds((x) => ({ ...x, [g.passageId]: g }))
    await putOne("golds", g)
  }
  async function savePreset() {
    const name = window.prompt("Name this setup", config.name)
    if (!name) return
    const p = { ...structuredClone(config), id: `cfg-${Date.now().toString(36)}`, name }
    await putOne("configs", p)
    setPresets((ps) => [...ps, p])
    setCfg((c) => ({ ...c, name }))
  }

  const installed = models ?? []
  const missing = [config.agents.knob.model, config.synth.knob.model, config.embed.model].filter((m) => models && !models.some((x) => x === m || x.startsWith(`${m}:`)))

  return (
    <div className="is-lab">
      <header className="is-top">
        <Link href="/" className="is-back" title="Back to the app">←</Link>
        <div className="is-title"><span className="is-logo" aria-hidden><i /><i /><i /></span><div><h1>Idea Lab</h1><p>weak readers → cluster → strong writer → score</p></div></div>
        <nav className="is-tabs" aria-label="Views">
          {(["pipeline", "map", "gold", "scores", "book"] as Tab[]).map((t) => <button key={t} type="button" aria-pressed={tab === t} className={tab === t ? "is-on" : ""} onClick={() => setTab(t)}>{{ pipeline: "Pipeline", map: "Map", gold: `Gold${gold ? ` · ${gold.versions.length}` : ""}`, scores: "Scores", book: "Book" }[t]}</button>)}
        </nav>
        <div className="is-top-right">
          <button type="button" className="is-ghost" onClick={() => setSide(!side)} aria-pressed={side} title="Show or hide the passage and runs">Passage &amp; runs</button>
          <select value="" onChange={(e) => { const p = presets.find((x) => x.id === e.target.value); if (p) setCfg(() => structuredClone(p)) }} aria-label="Load a saved setup">
            <option value="">Saved setups{presets.length ? ` (${presets.length})` : ""}</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" onClick={() => void savePreset()}>Save setup</button>
          <button type="button" className="is-ghost" onClick={() => setCfg(() => defaultConfig(installed))}>Defaults</button>
        </div>
      </header>

      {models && !models.length ? <p className="is-warn">No local model answered. Start Ollama (<code>ollama serve</code>), or free it if it is stuck (<code>ollama stop &lt;model&gt;</code>). <button type="button" onClick={() => void lookForModels()}>Look again</button></p> : null}
      {missing.length && models?.length ? <p className="is-warn">Not installed here: {[...new Set(missing)].join(", ")}. Pick another in the node, or <code>ollama pull</code> it.</p> : null}

      <div className={`is-body${side ? "" : " is-nosd"}`}>
        {side ? <aside className="is-side">
          <section>
            <h2>Passage</h2>
            <select value={passage.id} onChange={(e) => setPid(e.target.value)}>{passages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            {passage.id !== "sample" ? <input className="is-title-in" value={passage.title} onChange={(e) => void savePassage({ ...passage, title: e.target.value })} aria-label="Passage title" /> : null}
            <textarea rows={11} value={passage.text} readOnly={passage.id === "sample"} onChange={(e) => void savePassage({ ...passage, text: e.target.value })} aria-label="Passage text" />
            <small>{passage.text.length.toLocaleString()} characters{passage.text.length > 5500 ? " (long)" : ""}</small>
            <div className="is-row">
              <button type="button" onClick={() => void newPassage("Pasted passage", "")}>New</button>
              <label className="is-file">Upload PDF / text<input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = "" }} /></label>
              {passage.id !== "sample" ? <button type="button" onClick={() => { void dropOne("passages", passage.id); setPassages((ps) => ps.filter((x) => x.id !== passage.id)); setPid("sample") }}>Delete</button> : null}
            </div>
            {book ? (
              <div className="is-slice">
                <small>{book.name}: {book.text.length.toLocaleString()} characters</small>
                <div className="is-row">
                  <label>from <input type="number" step="500" min="0" value={slice.from} onChange={(e) => setSlice({ ...slice, from: Number(e.target.value) || 0 })} /></label>
                  <label>length <input type="number" step="500" min="500" max="6000" value={slice.len} onChange={(e) => setSlice({ ...slice, len: Number(e.target.value) || 4000 })} /></label>
                </div>
                <div className="is-row"><button type="button" onClick={() => void takeSlice(slice.from)}>Use this slice</button><button type="button" onClick={() => void takeSlice(slice.from + slice.len)}>Next slice ▸</button></div>
              </div>
            ) : null}
          </section>
          <section>
            <h2>Runs <small>{mine.length}</small></h2>
            <ul className="is-runs">
              {mine.slice(0, 30).map((r) => {
                const f = scores[r.id]?.final?.f ?? scores[r.id]?.synth?.f
                return (
                  <li key={r.id} className={r.id === run?.id ? "is-on" : ""}>
                    <button type="button" onClick={() => setRunId(r.id)}>
                      <b>{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>
                      <span>{r.config.agents.knob.model.split(":")[0]} t{r.config.agents.knob.temperature} → {r.config.synth.knob.model.split(":")[0]} t{r.config.synth.knob.temperature}</span>
                      <small>{r.calls} calls · {(r.ms / 1000).toFixed(0)}s{f !== undefined ? ` · F ${f.toFixed(2)}` : ""}{r.status === "running" ? " · interrupted" : r.status === "stopped" ? " · partial" : ""}{r.note ? ` · ${r.note}` : ""}</small>
                    </button>
                    <button type="button" className="is-x" aria-label="Delete run" onClick={() => { void dropOne("runs", r.id); setRuns((rs) => rs.filter((x) => x.id !== r.id)) }}>×</button>
                  </li>
                )
              })}
              {!mine.length ? <li className="is-muted">Nothing run on this passage yet.</li> : null}
            </ul>
            {run ? <button type="button" onClick={() => void navigator.clipboard?.writeText(JSON.stringify({ config: run.config, passage: passage.text, stages: run.stages, clusters: run.clusters, scores: scores[run.id] }, null, 2))}>Copy this run as JSON</button> : null}
          </section>
        </aside> : null}

        <div className="is-main">
          {!side ? <button type="button" className="is-sidetab" onClick={() => setSide(true)} title="Show the passage and runs">▸ Passage &amp; runs</button> : null}
          {error ? <p className="is-warn is-float">{error}</p> : null}
          {tab === "pipeline" ? (
            <div className="is-stage">
              <PipelineGraph config={config} stages={stages} running={running} progress={progress} selected={node} scores={nodeScores.by} onSelect={setNode} onToggle={(id, on) => setCfg((c) => (c.extra?.some((x) => x.id === id) ? { ...c, extra: c.extra.map((x) => (x.id === id ? { ...x, on } : x)) } : { ...c, [id]: { ...c[id as "synth"], on } }))} onAdd={addNode} />
              <aside className="is-insp-dock"><NodeInspector node={node} config={config} set={setCfg} models={installed} stage={stages[node]} passageLen={passage.text.length} scores={nodeScores.flat} /></aside>
            </div>
          ) : null}
          {tab === "book" ? <div className="is-page"><BookLab config={config} models={models} /></div> : null}
          {tab !== "pipeline" && tab !== "book" ? <div className="is-page">
          {tab === "map" ? (run ? <ClusterMap run={run} /> : <p className="is-empty">Run the pipeline to see the map.</p>) : null}
          {tab === "gold" ? <GoldEditor passageId={passage.id} gold={gold} run={run} onChange={(g) => void saveGold(g)} /> : null}
          {tab === "scores" ? <ScoreTable run={run} runs={finished.slice(0, 12)} scores={nodeScores.flat} allScores={scores} onPick={setRunId} hasGold={!!gold && gold.versions.some((v) => v.keyphrases.concat(v.insights, v.ideas, v.gems).some((x) => x.trim()))} /> : null}
          </div> : null}
          {tab !== "book" ? <div className="is-dock">
            <input className="is-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for this run: what are you trying?" aria-label="Run note" />
            {busy ? <span className="is-clock"><i />{running ? `${running}${progress && progress.stage === running ? ` ${progress.done}/${progress.total}` : ""} · ` : ""}{Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}</span> : null}
            {busy ? <button type="button" className="is-stop" onClick={() => stop.current?.abort()}>■ Stop</button> : (
              <>
                <button type="button" className="is-ghost" onClick={() => void go(true)} disabled={!run?.stages.agents?.items.length || !models?.length} title="Keep the readers' answers from the shown run; redo clustering, cards, gems and the baseline with the current settings">Re-run without readers</button>
                <button type="button" className="is-go" onClick={() => void go(false)} disabled={!models?.length}>▶ Run</button>
              </>
            )}
          </div> : null}
        </div>
      </div>
    </div>
  )
}

