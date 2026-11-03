/**
 * components/Lab/SwarmVote/SwarmVoteLab.tsx — Try the swarm vote on a line
 *
 * Pick the installed local models as voters, type a line, and see each ballot and the merged standings with
 * agreement, margin and verdict. The closed list is the Lists BIMBY's tools. Nothing is written: the swarm only
 * ranks. The engine is `lib/swarm-vote/`; plan: `docs/BIMBY_IDEAS.md` §1.
 */
"use client"

import { useEffect, useState } from "react"
import { LISTS_CASES } from "@/lib/agents/bench-cases"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { TOOLS } from "@/lib/lists-helper/tools"
import { collect, sweep, type Case, type SweepRow } from "@/lib/swarm-vote/bench"
import { rewordSplit, type RewordKey } from "@/lib/swarm-vote/reword"
import { runSwarm, type SwarmResult, type SwarmVoter } from "@/lib/swarm-vote/run"
import "./swarm-vote-lab.css"

const ACTIONS = TOOLS.map((t) => t.name)
const SYSTEM = `You choose which tools could do what the person asks. Rank the tools below, most fitting first, and leave out tools that do not fit.
${TOOLS.map((t) => `- ${t.name}: ${t.does}`).join("\n")}`
const FAMILY = (model: string) => model.split(/[:/-]/)[0] ?? model
/** Labelled lines for the replay bench: shared with the Agent bench (`lib/agents/bench-cases.ts`). */
const CASES: Case[] = LISTS_CASES.map((c) => ({ line: c.input, expected: c.expect }))
const EXAMPLE = "Book items that are also Task items shouldn't be Task"

export function SwarmVoteLab() {
  const [models, setModels] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [line, setLine] = useState(EXAMPLE)
  const [stopEarly, setStopEarly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SwarmResult | null>(null)
  const [keys, setKeys] = useState<RewordKey[]>([])
  const [benchRows, setBenchRows] = useState<SweepRow[] | null>(null)

  useEffect(() => {
    void listOllamaModels().then((m) => setModels(m ?? []))
  }, [])

  const count = (m: string) => picked[m] ?? 0
  const total = Object.values(picked).reduce((a, b) => a + b, 0)

  const buildVoters = (): SwarmVoter[] =>
    Object.entries(picked).flatMap(([model, n]) =>
      Array.from({ length: n }, (_, i) => ({
        voter: { id: `${model}#${i + 1}`, family: FAMILY(model) },
        call: ollamaCall(model, undefined, { fresh: true }),
        model,
        // Same model, different phrasing, so copies are not identical.
        system: i === 0 ? SYSTEM : `${SYSTEM}\nPhrasing ${i + 1}: think about what the person wants changed before you rank.`,
      })),
    )

  // The reword runs on one picked model (the last by name); a mid-size model is the plan, not enforced here.
  const rewordModel = () => Object.keys(picked).filter((m) => count(m) > 0).sort().at(-1)

  async function go() {
    const voters = buildVoters()
    if (!voters.length) return
    setBusy(true)
    setKeys([])
    const r = await runSwarm(voters, { actions: ACTIONS, system: SYSTEM, line, stopEarly })
    setResult(r)
    const m = rewordModel()
    setKeys(await rewordSplit(m ? ollamaCall(m, undefined, { fresh: true }) : null, line, r.tally, m))
    setBusy(false)
  }

  async function bench() {
    const voters = buildVoters()
    if (!voters.length) return
    setBusy(true)
    const rec = await collect(voters, CASES, ACTIONS, SYSTEM)
    const ns = [1, 3, 5, 10, 20].filter((n) => n <= voters.length)
    setBenchRows(sweep(rec, ns.length ? ns : [voters.length]))
    setBusy(false)
  }

  return (
    <div className="sv-lab">
      <h1>Swarm vote</h1>
      <p className="sv-note">Small models each rank the Lists BIMBY&apos;s tools for one line. Code merges the rankings. Nothing is written.</p>

      <section>
        <h2>Voters{total ? ` (${total})` : ""}</h2>
        {models === null && <p>Looking for local models…</p>}
        {models?.length === 0 && <p>No local models found. Start Ollama to vote.</p>}
        <ul className="sv-models">
          {models?.map((m) => (
            <li key={m}>
              <span>{m}</span>
              <button type="button" onClick={() => setPicked({ ...picked, [m]: Math.max(0, count(m) - 1) })} aria-label={`fewer ${m}`}>−</button>
              <b>{count(m)}</b>
              <button type="button" onClick={() => setPicked({ ...picked, [m]: Math.min(10, count(m) + 1) })} aria-label={`more ${m}`}>+</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <textarea value={line} onChange={(e) => setLine(e.target.value)} rows={2} aria-label="Line to vote on" />
        <label className="sv-check">
          <input type="checkbox" checked={stopEarly} onChange={(e) => setStopEarly(e.target.checked)} /> Stop once the lead cannot be passed
        </label>
        <button type="button" disabled={busy || !total || !line.trim()} onClick={() => void go()}>
          {busy ? "Working…" : "Vote"}
        </button>{" "}
        <button type="button" disabled={busy || !total} onClick={() => void bench()}>
          Replay bench ({CASES.length} lines)
        </button>
      </section>

      {result && (
        <section>
          <h2>
            {result.tally.verdict} · agreement {Math.round(result.tally.agreement * 100)}% · margin {Math.round(result.tally.margin * 100)}% ·{" "}
            {result.tally.voters} voters, {result.tally.families} families{result.stoppedEarly ? " · stopped early" : ""}
          </h2>
          <table className="sv-table">
            <thead>
              <tr><th>Action</th><th>Score</th><th>Listed</th><th>First</th></tr>
            </thead>
            <tbody>
              {result.tally.standings.map((s) => (
                <tr key={s.action}><td>{s.action}</td><td>{s.score}</td><td>{s.listedBy}</td><td>{s.firstBy}</td></tr>
              ))}
            </tbody>
          </table>
          {keys.length > 0 && (
            <>
              <h3>Split: which did you mean?</h3>
              <div className="sv-keys">
                {keys.map((k) => (
                  <button type="button" key={k.action} title={k.action} onClick={() => setLine(k.sentence)}>
                    {k.sentence}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>Ballots</h3>
          <ul className="sv-ballots">
            {result.ballots.map((b) => (
              <li key={b.voter.id}><code>{b.voter.id}</code> {b.ms} ms: {b.ranking.join(" › ") || "(nothing usable)"}</li>
            ))}
            {result.missed.map((id) => (
              <li key={id} className="sv-missed"><code>{id}</code> did not answer in time</li>
            ))}
          </ul>
        </section>
      )}
      {benchRows && (
        <section>
          <h2>Replay bench</h2>
          <table className="sv-table">
            <thead>
              <tr><th>Voters</th><th>Pick</th><th>Borda</th><th>Plurality</th><th>Clear</th><th>Right when clear</th></tr>
            </thead>
            <tbody>
              {benchRows.map((r) => (
                <tr key={`${r.pick}-${r.voters}`}>
                  <td>{r.voters}</td><td>{r.pick}</td><td>{pct(r.borda)}</td><td>{pct(r.plurality)}</td><td>{pct(r.clearRate)}</td><td>{pct(r.rightWhenClear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

const pct = (x: number) => `${Math.round(x * 100)}%`
