/**
 * components/Lab/HabitHelper/HabitsBimbyLab.tsx — See and tune the Habits BIMBY's flow
 *
 * Left: its five stages (route, tag, match, compute, propose) and its Blueprint facts. Middle: the editable
 * parts of the selected stage. Right: type a message, run it on your own habits or on the test habits, and read
 * each stage's time, prompt and output. The flow is the `HabitsBimbyFlow` the chat in Habits reads
 * (`habithelper-flow-v1`), so a change here is live there. Runs write nothing to Habits.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { HABITS_BIMBY_STAGES, habitsBimbyBlueprint } from "@/lib/agents/adapters/habit-helper"
import { agentLabHref } from "../Agents/agent-href"
import { builtinBlueprints } from "@/lib/agents/registry"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { buildContext } from "@/lib/habit-helper/accept"
import { loadFlow, MATCH_SYSTEM, saveFlow, starterFlow, type HabitsBimbyFlow, type MatchExample } from "@/lib/habit-helper/flow"
import { nudges, whyQueue } from "@/lib/habit-helper/history"
import { habitLines, systemText } from "@/lib/habit-helper/match"
import { routeOf, runHabitsBimby, type HabitsBimbyRun } from "@/lib/habit-helper/run"
import { tagText } from "@/lib/habit-helper/tags"
import { fixtureCtx } from "@/lib/habit-helper/tests"
import type { BimbyContext, TraceStage } from "@/lib/habit-helper/types"
import { AgentRail } from "../Agents/AgentRail"
import "../BimFlow/bim-flow.css"
import "../TrackingHelper/tracking-helper-lab.css"

const AGENTS = builtinBlueprints()

const TRY = [
  "daily habits completed - drank water, read 10 pages, stretched",
  "walked for 30 minutes then ate a chocolate bar…",
  "I didn't go outside today because I woke up too late and it was dark",
  "yesterday I read 20 pages",
  "I read for a while this morning",
  "Give relevant shorthand names to all of my daily habits that don't already have them",
]

type StageId = (typeof HABITS_BIMBY_STAGES)[number]["id"]

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

const ROUTE_FIELDS: { key: keyof HabitsBimbyFlow["route"]; label: string }[] = [
  { key: "shorthand", label: "Asks for shorthand names (code suggests them)" },
  { key: "reasons", label: "Asks for the reasons on a habit" },
  { key: "nudge", label: "Asks what is left today" },
  { key: "question", label: "A question about the BIMBY" },
  { key: "skip", label: "While a why-question is open: passes on it" },
]

export function HabitsBimbyLab() {
  const [flow, setFlow] = useState<HabitsBimbyFlow>(starterFlow)
  const [loaded, setLoaded] = useState(false)
  const [stage, setStage] = useState<StageId>("match")
  const [text, setText] = useState(TRY[0]!)
  const [onFixture, setOnFixture] = useState(true)
  const [running, setRunning] = useState<"model" | "rules" | null>(null)
  const [run, setRun] = useState<HabitsBimbyRun | null>(null)
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

  const ctx: BimbyContext = useMemo(() => (onFixture ? fixtureCtx(new Date().toISOString()) : buildContext()), [onFixture])
  const blueprint = useMemo(() => habitsBimbyBlueprint(flow), [flow])
  const patch = <K extends keyof HabitsBimbyFlow>(key: K, value: Partial<HabitsBimbyFlow[K]>) => setFlow((f) => ({ ...f, [key]: { ...(f[key] as object), ...value } }))
  const traceOf = (id: StageId) => run?.trace.find((t) => t.stage === id)
  const slowest = Math.max(1, ...(run?.trace.map((t) => t.ms) ?? [1]))

  const go = async (mode: "model" | "rules" = "model") => {
    if (!text.trim() || running) return
    setRunning(mode)
    setError(null)
    const t0 = Date.now()
    try {
      const crew = mode === "model" ? await chatCrew().catch(() => null) : null
      const ladder = flow.match.ladder.length ? flow.match.ladder : crew?.extract ?? []
      setRun(await runHabitsBimby({ text, flow, ctx, call: crew ? ollamaCall(crew.main, undefined, { fresh: true }) : null, ladder, pending: null }))
      setRanMs(Date.now() - t0)
      setOpen(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The run failed")
    } finally {
      setRunning(null)
    }
  }

  const setExample = (i: number, next: Partial<MatchExample>) => patch("match", { examples: flow.match.examples.map((x, j) => (j === i ? { ...x, ...next } : x)) })
  const routeNow = text.trim() ? routeOf(text, flow, null) : null
  const tagged = useMemo(() => tagText(text, new Date()), [text])
  const prompt = useMemo(() => systemText(flow), [flow])
  const asks = useMemo(() => whyQueue(ctx, flow, []), [ctx, flow])
  const open_ = useMemo(() => nudges(ctx), [ctx])

  return (
    <div className="bf-lab th-lab">
      <header className="bf-top">
        <button type="button" data-no95 className="bf-cap" onClick={() => (window.location.href = "/")}>
          ← Brain2
        </button>
        <b className="bf-title">HABITS · BIMBY</b>
        <span className="bf-k">rev {flow.rev}</span>
        <span className={`bf-lamp ${models ? "is-on" : "is-off"}`} title={models ? "Ollama answering" : "Ollama not answering; the BIMBY falls back to rules"} />
        <span className="bf-k">{models ? `${models.length} models` : "rules only"}</span>
        <span className="bf-sep" />
        <button type="button" data-no95 className="bf-cap" onClick={() => { if (confirm("Replace this flow with the starter flow? Your edits here are lost.")) setFlow(starterFlow()) }}>
          Starter flow
        </button>
        <span className="bf-k">saved on this device · live in Habits</span>
      </header>

      <AgentRail agents={AGENTS} activeId="habit-helper" onPick={(a) => (a.id === "habit-helper" ? undefined : (window.location.href = agentLabHref(a) ?? "/lab/bim-flow"))} />

      <div className="bf-main th-main">
        <section className="th-stages" aria-label="Stages">
          <ol className="th-list">
            {HABITS_BIMBY_STAGES.map((s, i) => {
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
            <dt>Tools</dt>
            <dd>{blueprint.tools.map((t) => t.name).join(", ")}</dd>
            <dt>May propose</dt>
            <dd>{blueprint.door.proposes.join(", ")} · written after Accept</dd>
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
              <p className="th-help">Decides what a message is before any model runs. Patterns are case-insensitive. Anything else logs habits; while a why-question is open, anything else is the answer.</p>
              {ROUTE_FIELDS.map((f) => (
                <label key={f.key} className="bf-field">
                  <span>{f.label}</span>
                  <input className="bf-input" value={flow.route[f.key]} onChange={(e) => patch("route", { [f.key]: e.target.value })} spellCheck={false} />
                  {regexProblem(flow.route[f.key]) ? <em className="th-bad">{regexProblem(flow.route[f.key])}</em> : null}
                </label>
              ))}
              <p className="th-live">The text on the right routes as <b>{routeNow ?? "—"}</b>.</p>
            </>
          ) : stage === "tag" ? (
            <>
              <b className="bf-k">2 · Tag · code</b>
              <p className="th-help">Cuts the message into clauses and tags amounts (hours become minutes), days, negations and reasons. Nothing here is tunable; this is what it makes of your text.</p>
              <table className="th-table">
                <tbody>
                  {tagged.tags.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.raw}</td>
                      <td>{t.kind === "amount" ? `${t.amount} ${t.unit || "(bare)"}${t.adds ? " · adds" : ""}` : t.kind === "day" ? t.day : t.kind === "because" ? `“${t.reason}”` : "negation"}</td>
                    </tr>
                  ))}
                  {!tagged.tags.length ? <tr><td>No tags in this text.</td></tr> : null}
                </tbody>
              </table>
              <pre className="bf-pre">{tagged.marked || "(type a message on the right)"}</pre>
            </>
          ) : stage === "match" ? (
            <>
              <b className="bf-k">3 · Match · one model call</b>
              <p className="th-help">The only model call. Each field is an enum of ids that exist, so it can point at a habit and a tag but never invent one.</p>
              <label className="bf-field">
                <span>
                  System prompt
                  {flow.match.system !== MATCH_SYSTEM ? (
                    <button type="button" data-no95 className="th-link" onClick={() => patch("match", { system: MATCH_SYSTEM })}>
                      reset to shipped
                    </button>
                  ) : null}
                </span>
                <textarea className="bf-input th-area" rows={9} value={flow.match.system} onChange={(e) => patch("match", { system: e.target.value })} spellCheck={false} />
              </label>
              <label className="bf-field">
                <span>Extra lines (appended; survives a reset of the prompt)</span>
                <textarea className="bf-input th-area" rows={2} value={flow.match.extra} onChange={(e) => patch("match", { extra: e.target.value })} spellCheck={false} />
              </label>
              <div className="bf-grid">
                <label className="bf-field">
                  <span>Models, smallest first (empty = crew)</span>
                  <input className="bf-input" list="hh-models" value={flow.match.ladder.join(", ")} onChange={(e) => patch("match", { ladder: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                  <datalist id="hh-models">{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                </label>
                <label className="bf-field">
                  <span>Max tokens</span>
                  <input className="bf-input" type="number" min={100} max={4000} step={50} value={flow.match.maxTokens} onChange={(e) => patch("match", { maxTokens: Math.max(100, Number(e.target.value) || 600) })} />
                </label>
              </div>
              <details>
                <summary>The system text the model sees ({prompt.length} characters)</summary>
                <pre className="bf-pre">{prompt}</pre>
              </details>
              <details>
                <summary>The habit lines it sees ({ctx.habits.length} habits, {onFixture ? "test habits" : "yours"})</summary>
                <pre className="bf-pre">{habitLines(ctx.habits)}</pre>
              </details>
              <div className="bf-field">
                <span>
                  Examples · {flow.match.examples.length}
                  <button type="button" data-no95 className="th-link" onClick={() => patch("match", { examples: [...flow.match.examples, { habits: "", text: "", json: JSON.stringify({ items: [] }) }] })}>
                    + add
                  </button>
                </span>
                {flow.match.examples.map((ex, i) => (
                  <div key={i} className="th-example">
                    <textarea className="bf-input th-area" rows={3} value={ex.habits} placeholder="Habit lines" onChange={(e) => setExample(i, { habits: e.target.value })} spellCheck={false} />
                    <textarea className="bf-input th-area" rows={2} value={ex.text} placeholder="Tagged text, as the model sees it" onChange={(e) => setExample(i, { text: e.target.value })} spellCheck={false} />
                    <textarea className="bf-input th-area" rows={3} value={ex.json} placeholder="The answer, as JSON" onChange={(e) => setExample(i, { json: e.target.value })} spellCheck={false} />
                    <div className="th-example-foot">
                      {jsonProblem(ex.json) ? <em className="th-bad">JSON: {jsonProblem(ex.json)}</em> : <em className="th-good">JSON ok</em>}
                      <button type="button" data-no95 className="th-link" onClick={() => patch("match", { examples: flow.match.examples.filter((_, j) => j !== i) })}>
                        remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : stage === "compute" ? (
            <>
              <b className="bf-k">4 · Compute · code</b>
              <p className="th-help">
                Fixed in code: an amount converts to the habit's unit (an hour is 60 min; a habit in hours divides by 60); a unit the habit does not count, or no amount, sets the goal and says so; “another” or “more” adds to the cell; a day word resolves by calendar and a day still ahead is refused; a miss keeps the “because” words exactly, else the whole sentence; a miss on a done cell is refused; a clause whose words score two habits the same is asked, whatever the model said.
              </p>
              <b className="bf-k">Why-questions</b>
              <div className="bf-grid">
                <label className="bf-field">
                  <span>Questions a day</span>
                  <input className="bf-input" type="number" min={0} max={10} value={flow.ask.maxQuestions} onChange={(e) => patch("ask", { maxQuestions: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
                <label className="bf-field">
                  <span>Look back (days)</span>
                  <input className="bf-input" type="number" min={2} max={30} value={flow.ask.window} onChange={(e) => patch("ask", { window: Math.max(2, Number(e.target.value) || 7) })} />
                </label>
                <label className="bf-field">
                  <span>Misses that make it worth asking</span>
                  <input className="bf-input" type="number" min={1} max={30} value={flow.ask.threshold} onChange={(e) => patch("ask", { threshold: Math.max(1, Number(e.target.value) || 3) })} />
                </label>
              </div>
              <p className="th-help">It would ask, in order ({onFixture ? "test habits have no history" : "your habits"}):</p>
              <ul className="th-blocks">
                {asks.map((q) => <li key={q.habitId}>{q.text}</li>)}
                {!asks.length ? <li className="bf-k">nothing to ask</li> : null}
              </ul>
            </>
          ) : (
            <>
              <b className="bf-k">5 · Propose · code</b>
              <p className="th-help">Each change is a row: habit, day, old → new, and the words it came from. The value, reason or name can be retyped. Nothing is written until Accept or Accept all. On open, the chat lists today's open habits with one nudge each, from the habit's own record.</p>
              <ul className="th-blocks">
                {open_.map((n) => <li key={n.habitId}><b>{n.habit}</b> {n.text}</li>)}
                {!open_.length ? <li className="bf-k">every habit done or marked today</li> : null}
              </ul>
            </>
          )}
        </section>

        <section className="bf-inspector th-try" aria-label="Try it">
          <b className="bf-k">Try it</b>
          <textarea className="bf-input th-area" rows={4} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go("model") }} spellCheck={false} />
          <label className="th-check">
            <input type="checkbox" checked={onFixture} onChange={(e) => setOnFixture(e.target.checked)} />
            Run on the test habits (off: on your own daily habits; still writes nothing)
          </label>
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
                route <b>{run.route}</b> · {run.proposals.length} proposals · {run.asks.length} asks · {ranMs} ms{run.model ? ` · ${run.model}` : ""}
                {run.fallback ? ` · rules only: ${run.fallback}` : ""}
              </p>
              <pre className="bf-pre">{run.reply}</pre>
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
                {run.proposals.map((p) => (
                  <li key={p.id}>
                    <b>{p.habit}</b> {p.day ?? ""} · {p.from} → {p.kind === "missed" ? `missed “${p.write?.missReason}”` : p.to}
                    {p.why ? <span className="bf-k"> · {p.why}</span> : null}
                  </li>
                ))}
                {run.asks.map((a) => (
                  <li key={a.id} className="bf-k">ask: “{a.words}” → {a.options.map((o) => o.name).join(" or ")}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="th-help">Run a message to see each stage's time, the prompt the model saw, and the changes it would propose. Nothing is written to Habits.</p>
          )}
        </section>
      </div>
    </div>
  )
}
