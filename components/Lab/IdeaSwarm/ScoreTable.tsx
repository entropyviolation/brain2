/**
 * components/Lab/IdeaSwarm/ScoreTable.tsx — Every node's output against the gold set, and every run against every other
 *
 * Top: the current run, one row per output (each key-phrase method, each reader, the pooled readers, the medoids, the
 * written cards, the gems, the swarm result, the single careful call) with coverage, precision and F. Bottom: a matrix of
 * runs by the main outputs, so a change of model, temperature or threshold shows as a change of number.
 */
"use client"

import { useState } from "react"
import { hits, targetsOf, type Score } from "@/lib/idea-swarm/score"
import type { Run } from "@/lib/idea-swarm/types"

const bar = (x: number) => <span className="is-bar"><i style={{ width: `${Math.max(0, Math.min(1, x)) * 100}%` }} /></span>
const MAIN: Array<[string, string]> = [["keyphrases:textrank", "TextRank"], ["keyphrases:yake", "YAKE"], ["agents:all", "Readers pooled"], ["cluster:medoids", "Medoids"], ["synth", "Cards"], ["lone", "Gems"], ["final", "Swarm"], ["baseline", "One call"]]

export function ScoreTable({ run, runs, scores, allScores, onPick, hasGold }: {
  run: Run | null
  runs: Run[]
  scores: Record<string, Score | null>
  allScores: Record<string, Record<string, Score | null>>
  onPick: (id: string) => void
  hasGold: boolean
}) {
  const [cutoff, setCutoff] = useState(0.85)
  if (!run) return <p className="is-empty">Run the pipeline first.</p>
  if (!hasGold) return <p className="is-empty">No gold answers yet for this passage. Open the Gold tab and write what you would accept, or fill it from a run and edit.</p>
  if (!Object.keys(scores).length) return <p className="is-empty">Scoring every output against your gold…</p>
  const rows = targetsOf(run)
  const best = Math.max(0, ...rows.map((r) => scores[r.key]?.f ?? 0))
  return (
    <div className="is-scores">
      <label className="is-cutoff">A match is similarity ≥ <b>{cutoff.toFixed(2)}</b>
        <input type="range" min="0.6" max="0.98" step="0.01" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} />
        <small>Embedding similarity on one topic is compressed (most pairs land 0.7 to 0.9), so raise this until the numbers separate.</small>
      </label>
      <table className="is-table">
        <thead><tr><th>Output</th><th>Coverage</th><th>Precision</th><th>F</th><th>Covered</th><th>Useful</th><th>Items</th><th>Matched version</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const s = scores[r.key]
            return (
              <tr key={r.key} className={s && s.f === best && best > 0 ? "is-best" : ""}>
                <td>{r.label}</td>
                {s ? <><td>{bar(s.coverage)} {s.coverage.toFixed(2)}</td><td>{bar(s.precision)} {s.precision.toFixed(2)}</td><td><b>{s.f.toFixed(2)}</b></td><td>{hits(s, cutoff).covered}/{s.gold}</td><td>{hits(s, cutoff).useful}/{s.n}</td><td>{s.n}</td><td>{s.version}</td></> : <td colSpan={7} className="is-muted">no gold for “{r.field}”</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="is-advice">Coverage: did it find what you wanted. Precision: is each thing it said close to something you wanted. Scores are embedding similarity, which rewards shared words and cannot tell a true claim from a false one: rank setups with it, then read the output.</p>
      <h4>All runs on this passage · F score</h4>
      <div className="is-scroll">
        <table className="is-table is-matrix">
          <thead><tr><th>Run</th>{MAIN.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={r.id === run.id ? "is-current" : ""} onClick={() => onPick(r.id)}>
                <td><b>{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b> <small>{r.config.name} · readers {r.config.agents.knob.model.split(":")[0]} t{r.config.agents.knob.temperature} · cards {r.config.synth.knob.model.split(":")[0]} t{r.config.synth.knob.temperature} · ≥{r.config.cluster.threshold}{r.note ? ` · ${r.note}` : ""}</small></td>
                {MAIN.map(([k]) => <td key={k}>{allScores[r.id]?.[k] ? allScores[r.id]![k]!.f.toFixed(2) : <span className="is-muted">–</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
