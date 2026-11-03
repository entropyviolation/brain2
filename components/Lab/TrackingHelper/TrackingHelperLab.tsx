/**
 * components/Lab/TrackingHelper/TrackingHelperLab.tsx — See and tune the Tracking BIMBY's pipelines
 *
 * Left: its five stages (route, tokenize, wire, place, where) and its Blueprint facts. Middle: the editable
 * parts of the selected stage. Right: type an account, run it, and read each stage's time, prompt and output.
 * The flow is the `HelperFlow` the chat in Tracking reads (`trackinghelper-flow-v1`), so a change here is
 * live there. Runs write nothing to Tracking.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { helperBlueprint, HELPER_STAGES } from "@/lib/agents/adapters/tracking-helper"
import { builtinBlueprints } from "@/lib/agents/registry"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { buildContext } from "@/lib/tracking-helper/accept"
import { clockText } from "@/lib/tracking-helper/clock"
import { loadFlow, saveFlow, starterFlow, WIRE_SYSTEM, type HelperFlow, type WireExample } from "@/lib/tracking-helper/flow"
import { learnedPlace } from "@/lib/tracking-helper/places"
import { routeOf, runHelper, type HelperRun } from "@/lib/tracking-helper/run"
import { tokenize } from "@/lib/tracking-helper/tokens"
import type { TraceStage } from "@/lib/tracking-helper/types"
import { systemText } from "@/lib/tracking-helper/wire"
import { AgentRail } from "../Agents/AgentRail"
import { agentLabHref } from "../Agents/agent-href"
import { CopyReportButton } from "../Agents/CopyReportButton"
import { GapQuestionsWell } from "./GapQuestionsWell"
import "../BimFlow/bim-flow.css"
import "./tracking-helper-lab.css"

const AGENTS = builtinBlueprints()

const TRY = [
  "Friday I walked Ocean Beach from 4:30 to about 5, then did dishes until 6:19",
  "yesterday scrolled from 9 to 10:15, then worked on foxtide until noon",
  "actually the walk ended at 4:45",
  "what can you do?",
]

type StageId = (typeof HELPER_STAGES)[number]["id"]

const regexProblem = (pattern: string): string | null => {
  try {
    new RegExp(pattern, "i")
    return null
  } catch (e) {
    return e instanceof Error ? e.message : "not a pattern"
  }
}

const jsonProblem = (raw: string): string | null => {
  try {
    JSON.parse(raw)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : "not JSON"
  }
}

export function TrackingHelperLab() {
  const [flow, setFlow] = useState<HelperFlow>(starterFlow)
  const [loaded, setLoaded] = useState(false)
  const [stage, setStage] = useState<StageId>("wire")
  const [text, setText] = useState(TRY[0]!)
  const [running, setRunning] = useState<"model" | "rules" | null>(null)
  const [run, setRun] = useState<HelperRun | null>(null)
  const [ranMs, setRanMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<string[] | null>(null)
  const [open, setOpen] = useState<TraceStage["stage"] | null>(null)

  useEffect(() => {
    setFlow(loadFlow())
    setLoaded(true)
    void listOllamaModels().then(setModels)
  }, [])
  useEffect(() => {
    if (loaded) saveFlow(flow)
  }, [flow, loaded])

  const blueprint = useMemo(() => helperBlueprint(flow), [flow])
  const patch = <K extends keyof HelperFlow>(key: K, value: Partial<HelperFlow[K]>) => setFlow((f) => ({ ...f, [key]: { ...(f[key] as object), ...value } }))
  const traceOf = (id: StageId) => run?.trace.find((t) => t.stage === id)
  const slowest = Math.max(1, ...(run?.trace.map((t) => t.ms) ?? [1]))

  const go = async (mode: "model" | "rules" = "model") => {
    if (!text.trim() || running) return
    setRunning(mode)
    setError(null)
    const t0 = Date.now()
    try {
      const crew = mode === "model" ? await chatCrew().catch(() => null) : null
      const ladder = flow.wire.ladder.length ? flow.wire.ladder : crew?.extract ?? []
      const out = await runHelper({ text, flow, ctx: buildContext(), call: crew ? ollamaCall(crew.main, undefined, { fresh: true }) : null, ladder, pending: null })
      setRun(out)
      setRanMs(Date.now() - t0)
      setOpen(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The run failed")
    } finally {
      setRunning(null)
    }
  }

  const setExample = (i: number, next: Partial<WireExample>) => patch("wire", { examples: flow.wire.examples.map((x, j) => (j === i ? { ...x, ...next } : x)) })
  const routeNow = text.trim() ? routeOf(text, flow, null) : null
  const tokenized = useMemo(() => tokenize(text), [text])
  const ctx = useMemo(() => buildContext(), [])
  const wirePrompt = useMemo(() => systemText(flow), [flow])
  const learned = useMemo(() => {
    const names = [...new Set(ctx.history.filter((r) => r.scopeId === "activity").map((r) => r.pen))].filter(Boolean)
    return names.map((n) => ({ n, l: learnedPlace(n, ctx.history) })).filter((x) => x.l).slice(0, 40)
  }, [ctx])

  return (
    <div className="bf-lab th-lab">
      <header className="bf-top">
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/")}>
          ← Brain2
        </button>
        <b className="bf-title">TRACKING · BIMBY</b>
        <span className="bf-k">rev {flow.rev}</span>
        <span className={`bf-lamp ${models ? "is-on" : "is-off"}`} title={models ? "Ollama answering" : "Ollama not answering; the Helper falls back to rules"} />
        <span className="bf-k">{models ? `${models.length} models` : "rules only"}</span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/lab/bim-flow")}>
          BIM flow lab
        </button>
        <button type="button" data-no95 className="bf-cap" onClick={() => { if (confirm("Replace this flow with the starter flow? Your edits here are lost.")) setFlow(starterFlow()) }}>
          Starter flow
        </button>
        <span className="bf-k">saved on this device · live in Tracking</span>
      </header>

      <AgentRail agents={AGENTS} activeId="tracking-helper" onPick={(a) => {
          if (a.id === "tracking-helper") return
          window.location.href = agentLabHref(a) ?? "/lab/bim-flow"
        }} />

      <div className="bf-main th-main">
        <section className="th-stages" aria-label="Stages">
          <ol className="th-list">
            {HELPER_STAGES.map((s, i) => {
              const t = traceOf(s.id)
              return (
                <li key={s.id}>
                  <button type="button" data-no95 className={`th-stage${stage === s.id ? " is-on" : ""}`} onClick={() => setStage(s.id)} aria-pressed={stage === s.id}>
                    <span className="th-stage-n">{i + 1}</span>
                    <span className="th-stage-main">
                      <b>{s.label}</b>
                      <small>{s.does}</small>
                      {t ? <span className="th-bar" style={{ width: `${Math.max(4, (t.ms / slowest) * 100)}%` }} title={`${t.ms} ms`} /> : null}
                    </span>
                    <span className={`th-cost is-${s.cost}`}>{s.cost === "code" ? "code" : "model"}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          <dl className="th-facts">
            <dt>Purpose</dt>
            <dd>{blueprint.purpose}</dd>
            <dt>Reads memory</dt>
            <dd>{blueprint.memory.reads.join(", ") || "none"}</dd>
            <dt>Tools</dt>
            <dd>{blueprint.tools.map((t) => t.name).join(", ")}</dd>
            <dt>May propose</dt>
            <dd>{blueprint.door.proposes.join(", ")} · written by {blueprint.door.surface} after Add</dd>
            <dt>Limits</dt>
            <dd>
              {blueprint.limits.maxCalls} model call · {blueprint.limits.maxTokens} tokens · {blueprint.models.localOnly ? "stays on this machine" : "may leave this machine"}
            </dd>
          </dl>
        </section>

        <section className="bf-inspector th-inspector" aria-label="Stage settings">
          {stage === "route" ? (
            <>
              <b className="bf-k">1 · Route · code</b>
              <p className="th-help">Decides what a message is before any model runs. Patterns are case-insensitive regular expressions.</p>
              <label className="bf-field">
                <span>A message that starts like this revises the blocks on screen</span>
                <input className="bf-input" value={flow.route.revise} onChange={(e) => patch("route", { revise: e.target.value })} spellCheck={false} />
                {regexProblem(flow.route.revise) ? <em className="th-bad">{regexProblem(flow.route.revise)}</em> : null}
              </label>
              <label className="bf-field">
                <span>A message like this, with no time in it, is a question about the Helper</span>
                <input className="bf-input" value={flow.route.question} onChange={(e) => patch("route", { question: e.target.value })} spellCheck={false} />
                {regexProblem(flow.route.question) ? <em className="th-bad">{regexProblem(flow.route.question)}</em> : null}
              </label>
              <p className="th-live">
                The text in the box on the right would route as <b>{routeNow ?? "—"}</b>
                {routeNow === "revise" ? " (if blocks were on screen; here there are none, so it is read as log)" : ""}.
              </p>
            </>
          ) : stage === "tokenize" ? (
            <>
              <b className="bf-k">2 · Tokenize · code</b>
              <p className="th-help">Tags every time, day, and length so the model points at tags instead of writing times. Nothing here is tunable; this is what it makes of your text.</p>
              <table className="th-table">
                <tbody>
                  {tokenized.tokens.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.raw}</td>
                      <td>{t.kind === "clock" ? t.cue : t.kind === "dur" ? `${t.minutes} min` : ""}</td>
                    </tr>
                  ))}
                  {!tokenized.tokens.length ? <tr><td>No tags in this text.</td></tr> : null}
                </tbody>
              </table>
              <pre className="bf-pre">{tokenized.marked || "(type an account on the right)"}</pre>
            </>
          ) : stage === "wire" ? (
            <>
              <b className="bf-k">3 · Wire · one model call</b>
              <p className="th-help">The only model call. It lists each thing done, in order, pointing at tags. It never writes a time.</p>
              <label className="bf-field">
                <span>
                  System prompt
                  {flow.wire.system !== WIRE_SYSTEM ? (
                    <button type="button" data-no95 className="th-link" onClick={() => patch("wire", { system: WIRE_SYSTEM })}>
                      reset to shipped
                    </button>
                  ) : null}
                </span>
                <textarea className="bf-input th-area" rows={9} value={flow.wire.system} onChange={(e) => patch("wire", { system: e.target.value })} spellCheck={false} />
              </label>
              <label className="bf-field">
                <span>Extra lines (appended; survives a reset of the prompt)</span>
                <textarea className="bf-input th-area" rows={2} value={flow.wire.extra} onChange={(e) => patch("wire", { extra: e.target.value })} spellCheck={false} />
              </label>
              <div className="bf-grid">
                <label className="bf-field">
                  <span>Models, smallest first (empty = crew)</span>
                  <input className="bf-input" list="th-models" value={flow.wire.ladder.join(", ")} onChange={(e) => patch("wire", { ladder: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                  <datalist id="th-models">{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                </label>
                <label className="bf-field">
                  <span>Max tokens</span>
                  <input className="bf-input" type="number" min={100} max={4000} step={50} value={flow.wire.maxTokens} onChange={(e) => patch("wire", { maxTokens: Math.max(100, Number(e.target.value) || 900) })} />
                </label>
              </div>
              <details>
                <summary>The system text the model sees ({wirePrompt.length} characters)</summary>
                <pre className="bf-pre">{wirePrompt}</pre>
              </details>
              <div className="bf-field">
                <span>
                  Examples · {flow.wire.examples.length}
                  <button type="button" data-no95 className="th-link" onClick={() => patch("wire", { examples: [...flow.wire.examples, { text: "", json: JSON.stringify({ segments: [] }) }] })}>
                    + add
                  </button>
                </span>
                {flow.wire.examples.map((ex, i) => (
                  <div key={i} className="th-example">
                    <textarea className="bf-input th-area" rows={3} value={ex.text} placeholder="Tagged text, as the model sees it" onChange={(e) => setExample(i, { text: e.target.value })} spellCheck={false} />
                    <textarea className="bf-input th-area" rows={3} value={ex.json} placeholder="The answer, as JSON" onChange={(e) => setExample(i, { json: e.target.value })} spellCheck={false} />
                    <div className="th-example-foot">
                      {jsonProblem(ex.json) ? <em className="th-bad">JSON: {jsonProblem(ex.json)}</em> : <em className="th-good">JSON ok</em>}
                      <button type="button" data-no95 className="th-link" onClick={() => patch("wire", { examples: flow.wire.examples.filter((_, j) => j !== i) })}>
                        remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : stage === "place" ? (
            <>
              <b className="bf-k">4 · Place · code</b>
              <p className="th-help">Turns tags into minutes and fills a missing edge from the neighbouring blocks. Anything it had to guess is marked estimated.</p>
              <label className="bf-field">
                <span>Minutes given to a block whose end was never said</span>
                <input className="bf-input" type="number" min={5} max={240} step={5} value={flow.place.openMin} onChange={(e) => patch("place", { openMin: Math.max(5, Number(e.target.value) || 30) })} />
              </label>
              <label className="th-check">
                <input type="checkbox" checked={flow.place.learnPlaces} onChange={(e) => patch("place", { learnPlaces: e.target.checked })} />
                Learn a missing place from my own Activity and Location history
              </label>
              <p className="th-help">
                Fixed in code: clocks climb through the day (an unmarked 5:55 after 5 pm is 5:55 pm); a block with no start begins where the one before ended; one with no end finishes where the next begins; a firm word near a clock keeps it certain, a hedge word makes it estimated, a dash joins a range.
              </p>
            </>
          ) : (
            <>
              <b className="bf-k">5 · Where · code</b>
              <p className="th-help">Fills a missing place from what usually happens there in your history. It only runs when learning places is on (stage 4). A place the text names is never overwritten.</p>
              <p className="th-live">Learning places is <b>{flow.place.learnPlaces ? "on" : "off"}</b>.</p>
              <p className="th-help">Learned from {ctx.history.length} tracked rows: where each activity usually happened (at least 2 sightings and 60%). Chores with no history are assumed Home.</p>
              <table className="th-table">
                <tbody>
                  {learned.map((x) => (
                    <tr key={x.n}>
                      <td>{x.n}</td>
                      <td>{x.l!.name}</td>
                      <td>×{x.l!.seen}</td>
                    </tr>
                  ))}
                  {!learned.length ? <tr><td>Nothing learned yet.</td></tr> : null}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="bf-inspector th-try" aria-label="Try it">
          <b className="bf-k">Try it · description to timeblock pipeline</b>
          <CopyReportButton
            report={
              run
                ? {
                    agent: "Tracking BIMBY · description to timeblock pipeline",
                    where: "lib/tracking-helper/ (flow.ts, run.ts, wire.ts, assemble.ts, accept.ts)",
                    input: text,
                    summary: `route ${run.route} · ${run.blocks.length} blocks · ${ranMs} ms${run.model ? ` · ${run.model}` : ""}${run.fallback ? ` · rules only: ${run.fallback}` : ""}`,
                    stages: run.trace,
                    result: [
                      ...run.blocks.map((b) => `${b.activity} ${b.startMin != null ? clockText(b.startMin) : "?"}–${b.endMin != null ? clockText(b.endMin) : "?"}${b.place ? ` @ ${b.place.name} (${b.place.source})` : ""}`),
                      ...(run.unplaced.length ? [`no time for: ${run.unplaced.join(", ")}`] : []),
                    ],
                  }
                : null
            }
          />
          <textarea className="bf-input th-area" rows={4} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go("model") }} spellCheck={false} />
          <div className="bf-row">
            <button type="button" data-no95 className="bf-cap" disabled={!!running || !text.trim()} onClick={() => void go("model")}>
              {running === "model" ? "Running…" : "Run with model ⌘↵"}
            </button>
            <button type="button" data-no95 className="bf-cap" disabled={!!running || !text.trim()} onClick={() => void go("rules")}>
              Run rules only
            </button>
            {TRY.map((t) => (
              <button key={t} type="button" data-no95 className="th-link" onClick={() => setText(t)} title={t}>
                {t.slice(0, 22)}…
              </button>
            ))}
          </div>
          {error ? <pre className="bf-pre is-error">{error}</pre> : null}

          {run ? (
            <>
              <p className="th-live">
                route <b>{run.route}</b> · {run.blocks.length} blocks · {ranMs} ms{run.model ? ` · ${run.model}` : ""}
                {run.fallback ? ` · rules only: ${run.fallback}` : ""}
              </p>
              <ol className="th-trace">
                {run.trace.map((t) => (
                  <li key={t.stage} className="bf-step">
                    <button type="button" data-no95 className="th-trace-head" onClick={() => setOpen(open === t.stage ? null : t.stage)} aria-expanded={open === t.stage}>
                      <b>{t.stage}</b>
                      <span>{t.note}</span>
                      <span className="th-ms">{t.ms} ms</span>
                    </button>
                    {open === t.stage ? (
                      <>
                        {t.prompt ? <pre className="bf-pre">{t.prompt}</pre> : null}
                        <pre className="bf-pre">{JSON.stringify(t.output, null, 2)}</pre>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
              <ul className="th-blocks">
                {run.blocks.map((b) => (
                  <li key={b.id}>
                    <b>{b.activity}</b> {b.startMin != null ? clockText(b.startMin) : "?"}–{b.endMin != null ? clockText(b.endMin) : "?"}
                    {b.startCert === "estimated" || b.endCert === "estimated" ? <span className="bf-est"> estimated</span> : null}
                    {b.place ? <span className="bf-k"> · {b.place.name} ({b.place.source})</span> : null}
                  </li>
                ))}
                {run.unplaced.length ? <li className="bf-k">no time for: {run.unplaced.join(", ")}</li> : null}
              </ul>
            </>
          ) : (
            <p className="th-help">Run an account to see each stage's time, the prompt the model saw, and the blocks it would propose. Nothing is written to Tracking.</p>
          )}
        </section>

        <GapQuestionsWell onUseSeed={setText} />
      </div>
    </div>
  )
}
