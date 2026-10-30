/**
 * components/Lab/BimFlow/flow-tests.tsx — The test sheet: what each test says now, and what it said before
 *
 * Left: the tests, each with its latest result. Right: the picked test's runs,
 * newest first, with the answer, the evidence lines the model read (★ marks the
 * ones it says it used), the facts code counted, the blocks and suggestions,
 * and the node-by-node trace. Runs are kept on this device (`bimflow-tests-v1`).
 */
"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { flowDef } from "@/lib/bim-flow/flows"
import { TESTS, testColor, type InputRun, type StepRec, type TestResult } from "@/lib/bim-flow/tests"
import type { Flow } from "@/lib/bim-flow/types"
import { FlowCanvas, stepGlyph } from "./flow-canvas"

/** What a running test is doing right now, fed by the engine's start/finish hooks. */
export interface LiveTest {
  testId: string
  index: number
  current: string | null
  since: number
  done: StepRec[]
}

const tint = (id: string) => ({ "--bf-test": testColor(id) }) as CSSProperties

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

interface Props {
  /** The view open on the main screen, so its tests lead the list. */
  activeId: string
  activeName: string
  results: TestResult[]
  running: boolean
  progress: string
  live: LiveTest | null
  flowOf: (id: string) => Flow
  onRun: (ids: string[]) => void
  onStop: () => void
  onClose: () => void
  /** The first-pass 22 tests, rerun together after a change. */
  coreIds: string[]
  /** Name of this setup, stored on every result it makes. Blank = the models' names. */
  label: string
  onLabel: (label: string) => void
}

export function FlowTests({ activeId, activeName, results, running, progress, live, flowOf, onRun, onStop, onClose, coreIds, label, onLabel }: Props) {
  const mine = TESTS.filter((t) => t.flowId === activeId)
  const others = TESTS.filter((t) => t.flowId !== activeId)
  const [pick, setPick] = useState((mine[0] ?? TESTS[0]!).id)
  const [openRun, setOpenRun] = useState<string | null>(null)
  const runs = results.filter((r) => r.testId === pick)
  const latest = (id: string) => results.find((r) => r.testId === id)
  const test = TESTS.find((t) => t.id === pick)!

  // Follow the test that is running, so its colors are the ones on screen.
  useEffect(() => {
    if (live) setPick(live.testId)
  }, [live?.testId])

  const row = (t: (typeof TESTS)[number]) => {
    const r = latest(t.id)
    return (
      <button key={t.id} type="button" data-no95 style={tint(t.id)} className={`bf-test-row${pick === t.id ? " is-on" : ""}`} onClick={() => setPick(t.id)}>
        <span className="bf-test-swatch" />
        <span className={`bf-status is-${live?.testId === t.id ? "review" : r?.status ?? "none"}`}>{live?.testId === t.id ? "running" : r ? r.status : "not run"}</span>
        <span>{t.name}</span>
        <span className="bf-why">{t.flowId === activeId ? "THIS VIEW · " : ""}{flowDef(t.flowId).name}{r ? ` · ${when(r.at)}` : ""}</span>
      </button>
    )
  }

  return (
    <div className="bf-pv" role="dialog" aria-label="Tests">
      <header className="bf-pv-top">
        <b className="bf-title">TESTS</b>
        <span className="bf-pv-flag">NOTHING WRITTEN</span>
        <span className="bf-k">{results.length} runs kept</span>
        <span className="bf-progress">{progress}</span>
        <span className="bf-sep" />
        {running ? (
          <button type="button" data-no95 onClick={onStop}>Stop</button>
        ) : (
          <>
            {mine.length ? <button type="button" data-no95 className="is-go" onClick={() => onRun(mine.map((t) => t.id))}>Run {mine.length} for {activeName}</button> : null}
            <input className="bf-input" value={label} placeholder="name this setup (optional)" aria-label="Setup name" onChange={(e) => onLabel(e.target.value)} />
            <button type="button" data-no95 className={mine.length ? "" : "is-go"} onClick={() => onRun(coreIds)}>Run the {coreIds.length}</button>
            <button type="button" data-no95 onClick={() => onRun(TESTS.map((t) => t.id))}>Run all {TESTS.length}</button>
          </>
        )}
        <button type="button" data-no95 className="bf-cap" onClick={onClose}>Close</button>
      </header>

      <div className="bf-pv-cols bf-tests-cols">
        <section className="bf-pv-well">
          <Scoreboard results={results} coreIds={coreIds} />
          <span className="bf-k">For this view · {activeName}</span>
          {mine.length === 0 ? <i className="bf-pv-none">No tests are written for this view yet. They run on the graph as it is now.</i> : null}
          {mine.map(row)}
          <span className="bf-k">Other views</span>
          {others.map(row)}
        </section>

        <section className="bf-pv-well bf-tests-runs" style={tint(test.id)}>
          <div className="bf-row">
            <span className="bf-k">{test.name}</span>
            <button type="button" data-no95 disabled={running} onClick={() => onRun([test.id])}>Run this</button>
          </div>
          <div className="bf-why">
            {test.flowId === activeId ? "THIS VIEW · " : "OTHER VIEW · "}{flowDef(test.flowId).name} · {test.input.kind === "question" || test.input.kind === "paste" ? `"${test.input.text.split("\n")[0]}"` : "latest BIM day"}
          </div>
          {test.expect ? <div className="bf-why">Should: {test.expect}</div> : null}
          {live && live.testId === test.id ? <LivePanel live={live} flow={flowOf(test.flowId)} /> : null}
          {runs.length === 0 && !(live && live.testId === test.id) ? <i className="bf-pv-none">no runs yet</i> : null}
          {runs.map((r, i) => (
            <article key={r.id} className="bf-run-card">
              <button type="button" data-no95 className="bf-run-head" onClick={() => setOpenRun(openRun === r.id ? null : r.id)}>
                <span className={`bf-status is-${r.status}`}>{r.status}</span>
                <span>{when(r.at)}</span>
                <span className="bf-why">{r.label ?? r.model} · {r.inputLabel} · {(r.ms / 1000).toFixed(1)}s{i === 0 ? " · latest" : ""}</span>
              </button>
              {runs[i + 1] && runs[i + 1]!.label !== r.label ? <div className="bf-why">vs {runs[i + 1]!.label ?? runs[i + 1]!.model}: {runs[i + 1]!.status} → {r.status} · {(runs[i + 1]!.ms / 1000).toFixed(1)}s → {(r.ms / 1000).toFixed(1)}s · checks {passed(runs[i + 1]!)} → {passed(r)}</div> : null}
              {r.output.answers[0] ? <div className="bf-answer-line">{r.output.answers[0].text}</div> : null}
              {r.output.error ? <pre className="bf-pre is-error">{r.output.error}</pre> : null}
              {r.checks.map((c, j) => <div key={j} className={c.ok ? "bf-ok" : "bf-bad"}>{c.ok ? "✓" : "✗"} {c.label}</div>)}
              {r.notes.map((n, j) => <div key={j} className="bf-why">{n}</div>)}
              {openRun === r.id || (i === 0 && openRun === null) ? <RunBody r={r} flow={flowOf(r.flowId)} /> : null}
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}

const passed = (r: TestResult) => `${r.checks.filter((c) => c.ok).length}/${r.checks.length}`

/** One line per setup: how its latest result for each of the core tests scored, and how long they took. */
function Scoreboard({ results, coreIds }: { results: TestResult[]; coreIds: string[] }) {
  const labels = [...new Set(results.map((r) => r.label ?? r.model))]
  if (labels.length === 0) return null
  const rows = labels.map((label) => {
    const latest = coreIds.map((id) => results.find((r) => r.testId === id && (r.label ?? r.model) === label))
    const have = latest.filter((r): r is TestResult => !!r)
    return {
      label,
      ran: have.length,
      pass: have.filter((r) => r.status === "pass").length,
      fail: have.filter((r) => r.status === "fail" || r.status === "error").length,
      review: have.filter((r) => r.status === "review").length,
      checks: have.reduce((a, r) => a + r.checks.filter((c) => c.ok).length, 0),
      of: have.reduce((a, r) => a + r.checks.length, 0),
      secs: have.reduce((a, r) => a + r.ms, 0) / 1000,
    }
  })
  return (
    <div className="bf-score">
      <span className="bf-k">Setups · the {coreIds.length} core tests, newest result each</span>
      {rows.map((x) => (
        <div key={x.label} className="bf-why" title={x.label}>
          <b>{x.label}</b>: {x.ran}/{coreIds.length} ran · checks {x.checks}/{x.of} · {x.pass} pass {x.fail} fail {x.review} review · {x.secs.toFixed(0)}s
        </div>
      ))}
    </div>
  )
}

function LivePanel({ live, flow }: { live: LiveTest; flow: Flow }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [])
  const node = flow.nodes.find((n) => n.id === live.current)
  const glyphs = Object.fromEntries(live.done.map((st) => [st.nodeId, stepGlyph({ kind: st.kind as never }, st)]))
  return (
    <div className="bf-live">
      <div className="bf-live-now">
        <span className="bf-dot is-pulse" />
        <b>Step {live.done.length + 1}</b>
        <span>{node ? node.label : "starting…"}</span>
        <span className="bf-why">{((Date.now() - live.since) / 1000).toFixed(1)}s{live.index > 0 ? ` · input ${live.index + 1}` : ""}</span>
      </div>
      <FlowCanvas
        key={`${live.testId}-live`}
        flow={flow}
        fit
        readOnly
        selectedNodeId={null}
        selectedEdgeId={null}
        trace={null}
        glow={{ color: testColor(live.testId), current: live.current, done: live.done.map((d) => d.nodeId), failed: live.done.filter((d) => d.error).map((d) => d.nodeId), glyphs }}
        onSelectNode={() => {}}
        onSelectEdge={() => {}}
        onMove={() => {}}
        onConnect={() => {}}
      />
      <Ribbon steps={live.done} />
    </div>
  )
}

/** The steps of one run, left to right. A bar under each is its share of the time. */
function Ribbon({ steps, pick, onPick }: { steps: StepRec[]; pick?: number | null; onPick?: (i: number) => void }) {
  const max = Math.max(1, ...steps.map((s) => s.ms))
  const total = steps.reduce((a, s) => a + s.ms, 0)
  return (
    <div className="bf-ribbon">
      {steps.map((st, i) => (
        <button
          key={i}
          type="button"
          data-no95
          disabled={!onPick}
          onClick={() => onPick?.(i)}
          title={st.label}
          className={`bf-step${st.error ? " is-err" : ""}${pick === i ? " is-on" : ""}${st.ms > 2000 && st.ms > total * 0.4 ? " is-slow" : ""}`}
        >
          <span className="bf-step-n">{i + 1} · {st.kind.toUpperCase()}{st.port !== "out" ? ` · ${st.port}` : ""}</span>
          <span className="bf-step-l">{st.label}</span>
          <span className="bf-step-g">{stepGlyph({ kind: st.kind as never }, st)}</span>
          <span className="bf-step-bar" style={{ width: `${Math.max(4, (st.ms / max) * 100)}%` }} />
          <span className="bf-why">{(st.ms / 1000).toFixed(1)}s</span>
        </button>
      ))}
    </div>
  )
}

const pretty = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2))

/** Every step of one run: the path lit on the graph, a ribbon, and the full output of the step you click. */
export function Replay({ id, color, runs, flow }: { id: string; color: string; runs: InputRun[]; flow: Flow }) {
  const [which, setWhich] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const cur = runs[which]
  if (!cur) return null
  const steps = cur.steps
  const sel = pick != null ? steps[pick] : null
  const firstErr = steps.findIndex((s) => s.error)
  const glyphs = Object.fromEntries(steps.map((st) => [st.nodeId, stepGlyph({ kind: st.kind as never }, st)]))
  return (
    <div className="bf-live">
      {runs.length > 1 ? (
        <div className="bf-row">
          <span className="bf-k">Input</span>
          {runs.map((x, i) => (
            <button key={i} type="button" data-no95 className={which === i ? "is-go" : ""} title={x.input} onClick={() => { setWhich(i); setPick(null) }}>
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}
      <div className="bf-why">“{cur.input}” · {steps.length} steps · {(steps.reduce((a, s) => a + s.ms, 0) / 1000).toFixed(1)}s{firstErr >= 0 ? ` · stopped at step ${firstErr + 1}` : ""}</div>
      <FlowCanvas
        key={`${id}-${which}`}
        flow={flow}
        fit
        readOnly
        selectedNodeId={null}
        selectedEdgeId={null}
        trace={null}
        glow={{ color, current: sel?.nodeId ?? null, done: steps.map((s) => s.nodeId), failed: steps.filter((s) => s.error).map((s) => s.nodeId), glyphs }}
        onSelectNode={(id) => { const i = steps.findIndex((s) => s.nodeId === id); if (i >= 0) setPick(i) }}
        onSelectEdge={() => {}}
        onMove={() => {}}
        onConnect={() => {}}
      />
      <Ribbon steps={steps} pick={pick} onPick={setPick} />
      {sel ? (
        <div className="bf-step-detail">
          <b>{pick! + 1}. {sel.label} <span className="bf-why">{sel.kind} · {sel.port} · {(sel.ms / 1000).toFixed(1)}s</span></b>
          {sel.error ? <pre className="is-error">{sel.error}</pre> : null}
          {sel.prompt ? (
            <details>
              <summary>What the model was asked</summary>
              <pre>{sel.prompt}</pre>
            </details>
          ) : null}
          <span className="bf-k">Output</span>
          <pre>{pretty(sel.output)}</pre>
        </div>
      ) : (
        <i className="bf-pv-none">Click a step to read its full output.</i>
      )}
    </div>
  )
}

function RunBody({ r, flow }: { r: TestResult; flow: Flow }) {
  const o = r.output
  return (
    <div className="bf-run-body" style={tint(r.testId)}>
      {o.runs?.length ? <Replay id={r.id} color={testColor(r.testId)} runs={o.runs} flow={flow} /> : null}
      {o.answers.map((a, i) => (
        <div key={i} className="bf-answer">
          <span className={`bf-chip is-conf-${a.confidence}`}>confidence: {a.confidence}</span>
          {a.draft && a.draft !== a.text ? <div className="bf-why">Draft before the check: {a.draft}</div> : null}
          {a.facts.length ? (
            <details open>
              <summary>Counted by code ({a.facts.length})</summary>
              {a.facts.map((f, j) => <div key={j} className="bf-why">{f}</div>)}
            </details>
          ) : null}
          <details>
            <summary>Evidence the model read ({a.evidence.length})</summary>
            {a.evidence.map((e, j) => <div key={j} className="bf-why">{e}</div>)}
          </details>
        </div>
      ))}
      {o.blocks.length ? <div><span className="bf-k">Blocks</span>{o.blocks.map((b, i) => <div key={i}>{b}</div>)}</div> : null}
      {o.proposals.length ? <div><span className="bf-k">Suggested</span>{o.proposals.map((p, i) => <div key={i}>{p}</div>)}</div> : null}
      <details>
        <summary>Trace as text (first input)</summary>
        {o.trace.map((t, i) => <div key={i} className="bf-why">{t}</div>)}
      </details>
    </div>
  )
}
