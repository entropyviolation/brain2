/**
 * components/Lab/BimFlow/flow-runs.tsx — Every past run, of this view or of all of them, replayable
 *
 * Left: the runs, newest first. A scope switch picks this view or every view;
 * a source switch picks Run-button runs, test runs, or both; a node filter keeps
 * only the runs that went through that node. Right: the picked run replayed step
 * by step (the graph as it was, the path lit, a card per step, the full output of
 * a clicked step). A Run-button run can also open its dry-run preview. Runs are
 * kept on this device (`lib/bim-flow/run-history.ts`, `lib/bim-flow/tests.ts`).
 * Each run names where it started: the bench, BIM's LLM tab Suggest button, or the tests. A Suggest
 * run also lists what it suggested, with the person's verdict and reason
 * (`lib/bim-flow/suggestion-verdicts.ts`).
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { stepRec, testColor, type InputRun, type TestResult } from "@/lib/bim-flow/tests"
import { loadNotes, ORIGIN_LABEL, originOf, saveNotes, type RunOrigin, type SavedRun } from "@/lib/bim-flow/run-history"
import { loadVerdicts, type Verdict } from "@/lib/bim-flow/suggestion-verdicts"
import type { Flow } from "@/lib/bim-flow/types"
import { Replay } from "./flow-tests"

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
const COLOR = "#4fb3ff"

const snippet = (f: Final) => {
  const t = f.answers[0]?.text ?? (f.error ? `Error: ${f.error}` : f.blocks.length ? `${f.blocks.length} block${f.blocks.length === 1 ? "" : "s"}: ${f.blocks[0]}` : f.proposals[0] ?? "No final output")
  return t.length > 110 ? t.slice(0, 110) + "…" : t
}

/** What a run ended with, the same shape for both kinds. */
interface Final {
  answers: { text: string; confidence: string; draft?: string; facts: string[]; evidence: string[] }[]
  blocks: string[]
  proposals: string[]
  error?: string
}

const clock = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** A kept Run-button run or a kept test run, in one shape. */
interface Row {
  id: string
  at: string
  kind: "run" | "test"
  origin: RunOrigin
  viewId: string
  view: string
  model: string
  label: string
  title: string
  ms: number
  errs: number
  color: string
  flow: Flow
  inputs: InputRun[]
  final: Final
  saved?: SavedRun
}

type Scope = "view" | "all"
type Source = "all" | "run" | "button" | "test"

export function FlowRuns({ flowId, flowName, history, results, nameOf, flowOf, onOpenOutput, onDelete, onClose }: {
  flowId: string
  flowName: string
  history: SavedRun[]
  results: TestResult[]
  nameOf: (id: string) => string
  flowOf: (id: string) => Flow
  onOpenOutput: (r: SavedRun) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [scope, setScope] = useState<Scope>("view")
  const [source, setSource] = useState<Source>("all")
  const [node, setNode] = useState("")
  const [pick, setPick] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  useEffect(() => {
    setNotes(loadNotes())
    setVerdicts(loadVerdicts())
  }, [])
  const setNote = (id: string, text: string) =>
    setNotes((n) => {
      const next = { ...n }
      if (text.trim()) next[id] = text
      else delete next[id]
      saveNotes(next)
      return next
    })

  const all = useMemo<Row[]>(() => {
    const runs: Row[] = history.map((x) => ({
      id: x.id, at: x.at, kind: "run", origin: originOf(x), viewId: x.flowId, view: x.flowName, model: x.model, label: x.inputLabel, title: x.inputLabel,
      ms: x.run.ms, errs: x.run.messages.reduce((n, m) => n + m.steps.filter((s) => s.error).length, 0), color: COLOR, flow: x.flow, saved: x,
      final: {
        answers: x.run.messages.flatMap((m) => m.answers.map((a) => ({ text: a.text, confidence: a.confidence, draft: a.draft, facts: a.facts, evidence: a.evidence.map((e, i) => `${a.used.includes(i + 1) ? "★ " : ""}${e.when} · ${e.source}: ${e.text}`) }))),
        blocks: x.run.blocks.map((b) => `${clock(b.start)}–${clock(b.end)} ${b.activity}${b.estimated ? " (est.)" : ""}`),
        proposals: x.run.messages.flatMap((m) => m.proposals.map((p) => p.summary)),
        error: x.run.messages.flatMap((m) => m.steps.filter((st) => st.error).map((st) => st.error!))[0],
      },
      inputs: x.run.messages.slice(0, 40).map((m) => ({ input: m.message.text.slice(0, 300), steps: m.steps.map((s) => stepRec(x.flow, s)) })),
    }))
    const tests: Row[] = results.map((t) => {
      const inputs = t.output.runs ?? []
      return {
        id: t.id, at: t.at, kind: "test", origin: "tests", viewId: t.flowId, view: nameOf(t.flowId), model: t.model, label: t.inputLabel, title: t.name,
        ms: t.ms, errs: t.status === "pass" ? 0 : t.status === "review" ? 0 : Math.max(1, inputs.reduce((n, r) => n + r.steps.filter((s) => s.error).length, 0)),
        color: testColor(t.testId), flow: flowOf(t.flowId), inputs,
        final: { answers: t.output.answers, blocks: t.output.blocks, proposals: t.output.proposals, error: t.output.error },
      }
    })
    return [...runs, ...tests].sort((a, b) => b.at.localeCompare(a.at))
  }, [history, results, nameOf, flowOf])

  const inScope = all.filter((x) => (scope === "all" || x.viewId === flowId) && (source === "all" || (source === "button" ? x.origin === "brain2-button" : source === "run" ? x.kind === "run" && x.origin !== "brain2-button" : x.kind === source)))
  const nodeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of inScope) {
      const seen = new Set(x.inputs.flatMap((i) => i.steps.map((s) => s.label)))
      for (const l of seen) m.set(l, (m.get(l) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [inScope])
  const shown = node ? inScope.filter((x) => x.inputs.some((i) => i.steps.some((s) => s.label === node))) : inScope

  useEffect(() => {
    if (node && !nodeCounts.some(([l]) => l === node)) setNode("")
  }, [nodeCounts, node])
  useEffect(() => {
    if (!shown.some((x) => x.id === pick)) setPick(shown[0]?.id ?? null)
  }, [shown, pick])
  const r = shown.find((x) => x.id === pick) ?? null

  return (
    <div className="bf-pv" role="dialog" aria-label="Runs">
      <header className="bf-pv-top">
        <b className="bf-title">RUNS</b>
        <span className="bf-pv-flag">NOTHING WRITTEN</span>
        <span className="bf-k">{scope === "view" ? flowName : "all views"} · {shown.length} of {all.length} kept</span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={onClose}>Close</button>
      </header>
      <div className="bf-pv-cols bf-tests-cols">
        <section className="bf-pv-well">
          <div className="bf-row">
            <button type="button" data-no95 className={scope === "view" ? "is-go" : ""} onClick={() => setScope("view")}>This view</button>
            <button type="button" data-no95 className={scope === "all" ? "is-go" : ""} onClick={() => setScope("all")}>All views</button>
          </div>
          <div className="bf-row">
            {(["all", "run", "button", "test"] as Source[]).map((s) => (
              <button key={s} type="button" data-no95 className={source === s ? "is-go" : ""} onClick={() => setSource(s)}>{s === "all" ? "All" : s === "run" ? "Bench" : s === "button" ? "Brain2 button" : "Tests"}</button>
            ))}
          </div>
          <select className="bf-input on-mill" value={node} onChange={(e) => setNode(e.target.value)} aria-label="Node filter">
            <option value="">Any node</option>
            {nodeCounts.map(([l, n]) => <option key={l} value={l}>{l} ({n})</option>)}
          </select>
          {shown.length === 0 ? <i className="bf-pv-none">{all.length === 0 ? "No runs yet. Press Run on the main screen." : "No runs match."}</i> : null}
          {shown.map((x) => (
            <button key={x.id} type="button" data-no95 className={`bf-test-row${pick === x.id ? " is-on" : ""}`} onClick={() => setPick(x.id)}>
              <span className="bf-test-swatch" style={{ background: x.color }} />
              <span className={`bf-status is-${x.errs ? "fail" : "pass"}`}>{x.errs ? "err" : "ok"}</span>
              <span>{x.kind === "test" ? `TEST · ${x.title}` : `${x.origin === "brain2-button" ? "BRAIN2 BUTTON · " : ""}${when(x.at)} · ${x.inputs.length} input${x.inputs.length === 1 ? "" : "s"}`}</span>
              <span className="bf-why">{scope === "all" || x.kind === "test" ? `${x.view} · ` : ""}{when(x.at)} · {x.model} · {(x.ms / 1000).toFixed(1)}s{notes[x.id] ? " · ✎ note" : ""}</span>
              <span className="bf-run-snip">{snippet(x.final)}</span>
            </button>
          ))}
        </section>
        <section className="bf-pv-well bf-tests-runs">
          {r ? (
            <>
              <div className="bf-row">
                <span className="bf-k">{r.kind === "test" ? "Test" : "Run"} · {r.view} · {when(r.at)} · {r.model}</span>
                {r.saved ? <button type="button" data-no95 className="is-go" onClick={() => onOpenOutput(r.saved!)}>Open output</button> : null}
                {r.saved ? <button type="button" data-no95 onClick={() => { if (confirm("Delete this kept run?")) onDelete(r.id) }}>Delete</button> : null}
              </div>
              <div className="bf-why">{r.kind === "test" ? `${r.title} · ${r.label}` : r.label}</div>
              <div className="bf-k">{ORIGIN_LABEL[r.origin]}</div>
              <FinalAnswer final={r.final} />
              {r.saved?.suggestions?.length ? <SuggestionVerdicts suggestions={r.saved.suggestions} verdicts={verdicts} /> : null}
              <label className="bf-k" htmlFor="bf-run-note">My note on this run</label>
              <textarea id="bf-run-note" key={r.id} className="bf-input bf-run-note" rows={3} placeholder="What was right, wrong, or worth trying next…" defaultValue={notes[r.id] ?? ""} onBlur={(e) => setNote(r.id, e.target.value)} />
              {r.inputs.length ? (
                <div className="bf-run-body" style={{ ["--bf-test" as string]: r.color }}>
                  <Replay key={r.id} id={r.id} color={r.color} runs={r.inputs} flow={r.flow} />
                </div>
              ) : <i className="bf-pv-none">This run kept no step-by-step record.</i>}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}

/** The answer the run ended with, large, then what else it produced. */
function FinalAnswer({ final: f }: { final: Final }) {
  const none = !f.answers.length && !f.blocks.length && !f.proposals.length && !f.error
  return (
    <div className="bf-final">
      <span className="bf-k">Final answer</span>
      {f.error ? <pre className="bf-pre is-error">{f.error}</pre> : null}
      {f.answers.map((a, i) => (
        <div key={i} className="bf-answer">
          <div className="bf-answer-line">{a.text}</div>
          <span className={`bf-chip is-conf-${a.confidence}`}>confidence: {a.confidence}</span>
          {a.draft && a.draft !== a.text ? <div className="bf-why">Draft before the check: {a.draft}</div> : null}
          {a.facts.length ? <details><summary>Counted by code ({a.facts.length})</summary>{a.facts.map((x, j) => <div key={j} className="bf-why">{x}</div>)}</details> : null}
          {a.evidence.length ? <details><summary>Evidence read ({a.evidence.length})</summary>{a.evidence.map((x, j) => <div key={j} className="bf-why">{x}</div>)}</details> : null}
        </div>
      ))}
      {f.blocks.length ? <div><span className="bf-k">Blocks</span>{f.blocks.map((b, i) => <div key={i}>{b}</div>)}</div> : null}
      {f.proposals.length ? <div><span className="bf-k">Suggested</span>{f.proposals.map((p, i) => <div key={i}>{p}</div>)}</div> : null}
      {none ? <i className="bf-pv-none">This run produced no answer, blocks or suggestions.</i> : null}
    </div>
  )
}

/** A Suggest run's suggestions, each with what the person said about it. */
function SuggestionVerdicts({ suggestions, verdicts }: { suggestions: NonNullable<SavedRun["suggestions"]>; verdicts: Verdict[] }) {
  const byId = new Map(verdicts.map((v) => [v.suggestionId, v]))
  const counts = { accepted: 0, rejected: 0, open: 0 }
  for (const x of suggestions) counts[byId.get(x.id)?.verdict ?? "open"]++
  return (
    <details className="bf-final" open>
      <summary>
        Suggested ({suggestions.length}) · {counts.accepted} accepted · {counts.rejected} rejected · {counts.open} undecided
      </summary>
      {suggestions.map((x) => {
        const v = byId.get(x.id)
        return (
          <div key={x.id} className="bf-answer">
            <div>
              <span className={`bf-status is-${v?.verdict === "rejected" ? "fail" : v ? "pass" : "review"}`}>{v?.verdict ?? "open"}</span> {x.kind} · {x.title} · {x.detail}
            </div>
            {v?.reason ? <div className="bf-answer-line">{v.verdict === "rejected" ? "Why wrong: " : "Note: "}{v.reason}</div> : null}
            <div className="bf-why">{x.why}</div>
            {x.evidence.map((e, i) => <div key={i} className="bf-why">&gt; {e}</div>)}
          </div>
        )
      })}
    </details>
  )
}
