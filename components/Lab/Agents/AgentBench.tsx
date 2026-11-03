/**
 * components/Lab/Agents/AgentBench.tsx — Score ways of answering the same lines, and compare runs
 *
 * The experiment room for BIMBIES with a closed tool list. Pick variants (a free code baseline, one small model,
 * a swarm), run them on the same labelled lines, read a scorecard, and compare any two runs to see which lines
 * flipped. Cases and the last runs are kept in this browser only. The engine is `lib/agents/bench.ts`;
 * plan: `docs/AGENT_LAB_PLAN.md` §6 and `docs/BIMBY_IDEAS.md`. Nothing here writes to the vault.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { compareCards, confusions, runSuite, trimHistory, type BenchCase, type Scorecard, type Variant } from "@/lib/agents/bench"
import { LISTS_CASES } from "@/lib/agents/bench-cases"
import { keywordBaseline, singleModelVariant, swarmVariant, type ClosedList } from "@/lib/agents/bench-variants"
import { TOOLS } from "@/lib/lists-helper/tools"
import type { SwarmVoter } from "@/lib/swarm-vote/run"
import "./agent-bench.css"

const LIST: ClosedList = {
  actions: TOOLS.map((t) => t.name),
  does: TOOLS.map((t) => t.does),
  system: `You choose which tools could do what the person asks. Rank the tools below, most fitting first, and leave out tools that do not fit.\n${TOOLS.map((t) => `- ${t.name}: ${t.does}`).join("\n")}`,
}
const CASES_KEY = "brain2:agent-bench:cases:v1"
const CARDS_KEY = "brain2:agent-bench:cards:v1"
const family = (m: string) => m.split(/[:/-]/)[0] ?? m

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage can be blocked; the room still works for this visit */
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const when = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
const label = (c: Scorecard) => `${c.label} · ${pct(c.passRate)} of ${c.n} · ${when(c.at)}`

export function AgentBench() {
  const [models, setModels] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [chosen, setChosen] = useState<Record<string, boolean>>({ "code-keywords": true })
  const [mine, setMine] = useState<BenchCase[]>([])
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [cards, setCards] = useState<Scorecard[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [a, setA] = useState<string>("")
  const [b, setB] = useState<string>("")
  const [draft, setDraft] = useState({ input: "", expect: LIST.actions[0]!, tags: "" })
  const stop = useRef<AbortController | null>(null)

  useEffect(() => {
    setMine(load<BenchCase[]>(CASES_KEY, []))
    setCards(load<Scorecard[]>(CARDS_KEY, []))
    void listOllamaModels().then((m) => setModels(m ?? []))
  }, [])

  const cases = useMemo(() => [...LISTS_CASES, ...mine].filter((c) => !off[c.id]), [mine, off])
  const voters = (): SwarmVoter[] =>
    Object.entries(picked).flatMap(([model, n]) =>
      Array.from({ length: n }, (_, i) => ({
        voter: { id: `${model}#${i + 1}`, family: family(model) },
        call: ollamaCall(model, undefined, { fresh: true }),
        model,
        system: i === 0 ? LIST.system : `${LIST.system}\nPhrasing ${i + 1}: think about what the person wants changed before you rank.`,
      })),
    )
  const variants = (): Variant[] => {
    const vs = voters()
    const out: Variant[] = [keywordBaseline(LIST)]
    for (const m of Object.keys(picked).filter((k) => picked[k]! > 0)) out.push(singleModelVariant(m, ollamaCall(m, undefined, { fresh: true }), LIST))
    if (vs.length > 1) {
      out.push(swarmVariant(`swarm:${vs.length}`, `Swarm of ${vs.length}`, LIST, vs))
      out.push(swarmVariant(`swarm-clear:${vs.length}`, `Swarm of ${vs.length}, clear only`, LIST, vs, { declineOnSplit: true, about: "Answers only when the vote is clear; a split is a decline, which the person would settle with keys." }))
    }
    return out
  }
  const options = variants()

  async function run() {
    const todo = options.filter((v) => chosen[v.id])
    if (!todo.length || !cases.length) return
    const ctl = new AbortController()
    stop.current = ctl
    let next = cards
    for (const v of todo) {
      setBusy(v.label)
      setProgress(0)
      const card = await runSuite(v, cases, { signal: ctl.signal, onRow: (_r, done) => setProgress(done) })
      if (ctl.signal.aborted) break
      next = trimHistory([card, ...next])
      setCards(next)
      setOpen(card.at + card.variantId)
    }
    save(CARDS_KEY, next)
    setBusy(null)
  }

  function addCase() {
    if (!draft.input.trim()) return
    const c: BenchCase = { id: `mine-${Date.now().toString(36)}`, input: draft.input.trim(), expect: draft.expect, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean) }
    const next = [...mine, c]
    setMine(next)
    save(CASES_KEY, next)
    setDraft({ ...draft, input: "" })
  }
  function dropCase(id: string) {
    const next = mine.filter((c) => c.id !== id)
    setMine(next)
    save(CASES_KEY, next)
  }

  const keyOf = (c: Scorecard) => c.at + c.variantId
  const cardA = cards.find((c) => keyOf(c) === a)
  const cardB = cards.find((c) => keyOf(c) === b)
  const cmp = cardA && cardB ? compareCards(cardA, cardB) : null
  const total = Object.values(picked).reduce((x, y) => x + y, 0)

  return (
    <div className="ab-lab" data-ui-name="Agent bench" data-ui-docs="components/Lab/Agents/README.md">
      <h1>Agent bench</h1>
      <p className="ab-note">
        Ask different ways of answering the same lines, then score them. The question here is the Lists BIMBY&apos;s: which tool does this line mean? Nothing is written.
      </p>

      <section aria-label="Voters">
        <h2>Models{total ? ` · ${total} voter${total === 1 ? "" : "s"}` : ""}</h2>
        {models === null && <p className="ab-note">Looking for local models…</p>}
        {models?.length === 0 && <p className="ab-note">No local models found. The code baseline still runs.</p>}
        <ul className="ab-models">
          {models?.map((m) => (
            <li key={m}>
              <span>{m}</span>
              <button type="button" aria-label={`fewer ${m}`} onClick={() => setPicked({ ...picked, [m]: Math.max(0, (picked[m] ?? 0) - 1) })}>−</button>
              <b>{picked[m] ?? 0}</b>
              <button type="button" aria-label={`more ${m}`} onClick={() => setPicked({ ...picked, [m]: Math.min(10, (picked[m] ?? 0) + 1) })}>+</button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Variants">
        <h2>Variants to run</h2>
        <ul className="ab-variants">
          {options.map((v) => (
            <li key={v.id}>
              <label>
                <input type="checkbox" checked={!!chosen[v.id]} onChange={(e) => setChosen({ ...chosen, [v.id]: e.target.checked })} /> <b>{v.label}</b>
              </label>
              <span className="ab-note">{v.about}</span>
            </li>
          ))}
        </ul>
        <button type="button" disabled={!!busy || !cases.length || !options.some((v) => chosen[v.id])} onClick={() => void run()}>
          {busy ? `${busy} · ${progress}/${cases.length}` : `Run on ${cases.length} lines`}
        </button>{" "}
        {busy && <button type="button" onClick={() => stop.current?.abort()}>Stop</button>}
      </section>

      <section aria-label="Cases">
        <h2>Lines · {cases.length} of {LISTS_CASES.length + mine.length}</h2>
        <ul className="ab-cases">
          {[...LISTS_CASES, ...mine].map((c) => (
            <li key={c.id} className={off[c.id] ? "is-off" : undefined}>
              <input type="checkbox" aria-label={`use ${c.id}`} checked={!off[c.id]} onChange={(e) => setOff({ ...off, [c.id]: !e.target.checked })} />
              <span className="ab-in">{c.input}</span>
              <code>{c.expect}</code>
              {c.tags?.length ? <span className="ab-tags">{c.tags.join(" · ")}</span> : null}
              {c.id.startsWith("mine-") && <button type="button" aria-label={`remove ${c.id}`} onClick={() => dropCase(c.id)}>×</button>}
            </li>
          ))}
        </ul>
        <div className="ab-add">
          <input value={draft.input} onChange={(e) => setDraft({ ...draft, input: e.target.value })} placeholder="A line a person might type" aria-label="New line" />
          <select value={draft.expect} onChange={(e) => setDraft({ ...draft, expect: e.target.value })} aria-label="Right tool">
            {LIST.actions.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="tags, comma" aria-label="Tags" />
          <button type="button" disabled={!draft.input.trim()} onClick={addCase}>Add line</button>
        </div>
      </section>

      <section aria-label="Scorecards">
        <h2>Scorecards · {cards.length}</h2>
        {!cards.length && <p className="ab-note">Run a variant to see a scorecard here. The last five runs of each variant are kept.</p>}
        {cards.map((c) => (
          <article key={keyOf(c)} className="ab-card">
            <button type="button" className="ab-head" aria-expanded={open === keyOf(c)} onClick={() => setOpen(open === keyOf(c) ? null : keyOf(c))}>
              <b>{c.label}</b> <span>{when(c.at)}</span>
              <span className="ab-score">{c.passed}/{c.n} · {pct(c.passRate)}</span>
              <span className="ab-note">
                {Math.round(c.totalMs / Math.max(1, c.n))} ms/line{c.declined ? ` · ${c.declined} declined` : ""}{c.errors ? ` · ${c.errors} errors` : ""}
                {c.rightWhenSure !== null ? ` · right when sure ${pct(c.rightWhenSure)} (${c.sure})` : ""}
              </span>
            </button>
            {open === keyOf(c) && (
              <div className="ab-body">
                {Object.keys(c.byTag).length > 0 && (
                  <p className="ab-note">
                    {Object.entries(c.byTag).map(([t, s]) => `${t} ${s.passed}/${s.n}`).join(" · ")}
                  </p>
                )}
                {confusions(c).length > 0 && (
                  <p className="ab-note">
                    Mixed up: {confusions(c).slice(0, 5).map((x) => `${x.expect} → ${x.pick}${x.count > 1 ? ` ×${x.count}` : ""}`).join(" · ")}
                  </p>
                )}
                <table className="ab-table">
                  <thead><tr><th /><th>Line</th><th>Right</th><th>Got</th><th>ms</th></tr></thead>
                  <tbody>
                    {c.rows.map((r) => (
                      <tr key={r.caseId} className={r.pass ? "is-pass" : "is-miss"}>
                        <td>{r.pass ? "✓" : "✗"}</td>
                        <td>{r.input}{r.note || r.error ? <small>{r.error ?? r.note}</small> : null}</td>
                        <td><code>{r.expect}</code></td>
                        <td><code>{r.pick ?? "—"}</code></td>
                        <td>{r.ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </section>

      {cards.length > 1 && (
        <section aria-label="Compare">
          <h2>Compare two runs</h2>
          <div className="ab-add">
            <select value={a} onChange={(e) => setA(e.target.value)} aria-label="Run A">
              <option value="">Before…</option>
              {cards.map((c) => <option key={keyOf(c)} value={keyOf(c)}>{label(c)}</option>)}
            </select>
            <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Run B">
              <option value="">After…</option>
              {cards.map((c) => <option key={keyOf(c)} value={keyOf(c)}>{label(c)}</option>)}
            </select>
          </div>
          {cmp && cardA && (
            <div className="ab-cmp">
              <p>
                <b>{cmp.delta >= 0 ? "+" : ""}{Math.round(cmp.delta * 100)} points</b> over {cmp.shared} shared lines · {cmp.deltaMs >= 0 ? "+" : ""}{cmp.deltaMs} ms total
              </p>
              {([["Gained", cmp.gained], ["Lost", cmp.lost], ["Still wrong", cmp.stuck]] as const).map(([name, ids]) => (
                <p key={name}>
                  <b>{name} · {ids.length}</b>
                  {ids.map((id) => <small key={id}>{cardA.rows.find((r) => r.caseId === id)?.input}</small>)}
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
