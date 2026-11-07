/**
 * components/Lab/CriticBimby/CriticBimbyLab.tsx — Try the Critic BIMBY on a plan line
 *
 * Type a plan sentence, read it with the plain rules, and see the second look: the free checks, or the model layer
 * when a critic model is installed. Also: the gold-plan bench, qualifying a model, and the ledger of what people did
 * with past warnings. Writes nothing except the bench result the Critic already stores per device (`qualifyModel`).
 * Engine: `lib/critic-bimby/`.
 */
"use client"

import { useEffect, useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { runBench, formatBench } from "@/lib/critic-bimby/bench"
import { gateFor } from "@/lib/critic-bimby/gate"
import { loadLedger, rates } from "@/lib/critic-bimby/ledger"
import { qualifyModel } from "@/lib/critic-bimby/qualify"
import { critiqueWithModel, HOST, traceLines } from "@/lib/critic-bimby/run"
import type { Critique } from "@/lib/critic-bimby/types"
import { critiquePlan } from "@/lib/critic-bimby/verdict"
import { PLAN_EXAMPLE, parseByRules } from "@/lib/plan-bimby/parse"
import type { PlanDraft } from "@/lib/plan-bimby/types"
import "../bimby-lab.css"

export function CriticBimbyLab() {
  const [line, setLine] = useState<string>(PLAN_EXAMPLE.text)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [critique, setCritique] = useState<Critique | null>(null)
  const [ladder, setLadder] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [benchText, setBenchText] = useState("")
  const [qualMsg, setQualMsg] = useState("")
  const [ledgerRates, setLedgerRates] = useState<ReturnType<typeof rates> | null>(null)

  useEffect(() => {
    void chatCrew().then((c) => setLadder(c?.critic ?? [])).catch(() => setLadder([]))
    setLedgerRates(rates(loadLedger()))
  }, [])

  function read(): PlanDraft {
    const r = parseByRules(line)
    const d: PlanDraft = { ...r, source: line, by: "rules" }
    setDraft(d)
    return d
  }

  function checkFree() {
    const d = read()
    setCritique(critiquePlan(d))
  }

  async function checkModel() {
    const d = read()
    setBusy(true)
    const crew = await chatCrew().catch(() => null)
    const c = await critiqueWithModel({ draft: d, call: crew ? ollamaCall(crew.main) : null, ladder: crew?.critic ?? [], force: true }).catch(() => critiquePlan(d))
    setCritique(c)
    setBusy(false)
  }

  async function qualify() {
    const model = ladder[0]
    if (!model) return
    setBusy(true)
    setQualMsg(`Running the bench on ${model}…`)
    try {
      const q = await qualifyModel(ollamaCall(model, undefined, { fresh: true }), model, (done, total) => setQualMsg(`${model}: ${done}/${total}`))
      setQualMsg(`${model}: ${q.result.ready ? "passed" : "did not pass"}`)
    } catch {
      setQualMsg(`${model}: the bench failed to run`)
    }
    setBusy(false)
  }

  const gate = ladder[0] ? gateFor(HOST, ladder[0]) : null

  return (
    <div className="bl-lab">
      <a className="bl-back" href="/lab/agents">← Agent lab</a>
      <h1>Critic BIMBY</h1>
      <p className="bl-note">The second look at a plan. It says what does not match your words and never edits or writes.</p>

      <section>
        <h2>A plan line</h2>
        <textarea value={line} onChange={(e) => setLine(e.target.value)} rows={3} aria-label="Plan line" />
        <div className="bl-row">
          <button type="button" disabled={busy || !line.trim()} onClick={checkFree}>Check (free)</button>
          <button type="button" disabled={busy || !line.trim()} onClick={() => void checkModel()}>Check with a model</button>
        </div>
      </section>

      {draft && (
        <section>
          <h2>Read by the rules: {draft.items.length} rows</h2>
          <ul className="bl-list">
            {draft.items.map((i) => (
              <li key={i.id}>{i.title}{i.minutes ? ` · ${i.minutes} min` : ""}{i.link ? ` · link ${i.link.kind}` : ""}</li>
            ))}
            {draft.remarks.map((r) => (
              <li key={r} className="bl-dim">aside: {r}</li>
            ))}
          </ul>
        </section>
      )}

      {critique && (
        <section>
          <h2>{critique.verdict} · {critique.trust} · {critique.ms} ms</h2>
          {critique.findings.length === 0 && <p className="bl-note">Nothing found.</p>}
          <table className="bl-table">
            <tbody>
              {critique.findings.map((f, i) => (
                <tr key={i}>
                  <td>{f.kind}</td><td>{f.strength} ({f.by})</td><td>{f.reason}{f.quote ? ` “${f.quote}”` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="bl-list bl-dim">
            {traceLines(critique).map((t) => (<li key={t}>{t}</li>))}
          </ul>
        </section>
      )}

      <section>
        <h2>Bench</h2>
        <div className="bl-row">
          <button type="button" onClick={() => setBenchText(formatBench(runBench()))}>Run the free bench</button>
          <button type="button" disabled={busy || !ladder[0]} onClick={() => void qualify()}>
            Qualify {ladder[0] ?? "a model"}
          </button>
        </div>
        {!ladder[0] && <p className="bl-note">No critic model found. Start Ollama to qualify one.</p>}
        {qualMsg && <p className="bl-note">{qualMsg}</p>}
        {gate && <p className="bl-note">Stored gate for {ladder[0]}: {gate.ready ? "ready" : "not ready"} ({gate.at.slice(0, 10)})</p>}
        {benchText && <pre>{benchText}</pre>}
      </section>

      <section>
        <h2>Ledger on this device</h2>
        {ledgerRates && ledgerRates.total > 0 ? (
          <p className="bl-note">
            {ledgerRates.total} plans · {ledgerRates.catches} catches · {ledgerRates.misses} misses · {ledgerRates.falseAlarms} false alarms
            {ledgerRates.catchRate !== null ? ` · catch rate ${Math.round(ledgerRates.catchRate * 100)}%` : ""}
            {ledgerRates.falseAlarmRate !== null ? ` · false alarms ${Math.round(ledgerRates.falseAlarmRate * 100)}% of fails` : ""}
          </p>
        ) : (
          <p className="bl-note">Nothing yet. Plans made with the Plan BIMBY fill it.</p>
        )}
      </section>
    </div>
  )
}
