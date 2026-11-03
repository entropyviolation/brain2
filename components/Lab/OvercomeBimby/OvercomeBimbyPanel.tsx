/**
 * components/Lab/OvercomeBimby/OvercomeBimbyPanel.tsx — The Overcome executive dysfunction pipeline, as a chat
 *
 * SAY what you cannot start, read the push, then mark the tactic you tried (Started / Still stuck). Below: the resistance log.
 * The engine is `lib/overcome-bimby/`; this file only draws it.
 */
"use client"

import { useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { OVERCOME_FLOW_HREF } from "@/lib/overcome-bimby/flow"
import { tacticScoreboard } from "@/lib/overcome-bimby/experiment"
import { overcome, type OvercomeResult } from "@/lib/overcome-bimby/run"
import { useOvercomeStore } from "@/lib/overcome-bimby/store"
import { tacticById } from "@/lib/overcome-bimby/tactics"

const btn = "min-h-11 min-w-11 rounded border border-neutral-400 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-800"

export function OvercomeBimbyPanel() {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [rulesOnly, setRulesOnly] = useState(false)
  const [result, setResult] = useState<OvercomeResult | null>(null)
  const log = useOvercomeStore((s) => s.log)
  const mark = useOvercomeStore((s) => s.mark)
  const board = tacticScoreboard(log)
  const entry = result ? log.find((e) => e.id === result.entryId) : undefined

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const crew = rulesOnly ? null : await chatCrew().catch(() => null)
      setResult(await overcome({ explore: true, text, call: crew ? ollamaCall(crew.main) : null, extract: crew?.extract ?? [], prose: crew?.prose ?? [] }))
      setText("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4" data-ui-name="Overcome BIMBY" data-ui-docs="lib/overcome-bimby/README.md">
      <header className="pr-14">
        <h1 className="text-lg font-semibold">OVERCOME EXECUTIVE DYSFUNCTION</h1>
        <p className="text-sm opacity-70">Say what you cannot start. It logs the resistance, then pushes.</p>
        <a className="text-sm underline" href={OVERCOME_FLOW_HREF} data-testid="overcome-node-view">Open node view in the BIM flow lab: critique and keep</a>
      </header>
      <div className="flex flex-col gap-2">
        <textarea
          className="min-h-24 rounded border border-neutral-300 bg-transparent p-2 text-base dark:border-neutral-600"
          placeholder="i really have to finish those cds but i feel a lot of resistance, it was due a week ago"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send() }}
        />
        <div className="flex items-center gap-3">
          <button type="button" className={btn} disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? "Thinking…" : "Send"}</button>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={rulesOnly} onChange={(e) => setRulesOnly(e.target.checked)} /> Rules only</label>
        </div>
      </div>
      {result ? (
        <section className="space-y-2 rounded border border-neutral-300 p-3 dark:border-neutral-600" aria-label="Push">
          <p className="text-xs opacity-60">Heard ({result.readBy}): {result.reading.task} · {result.reading.barrier}{result.reading.overdueDays ? ` · ${result.reading.overdueDays} days overdue` : ""}</p>
          <p>{result.push.message}</p>
          <ul className="space-y-1">
            {result.push.tactics.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <b>{t.name}</b><span className="opacity-70">{t.do}</span>
                {entry?.tried?.tacticId === t.id ? (
                  <span className="text-xs">{entry.tried.outcome === "started" ? "Started" : "Still stuck"}</span>
                ) : (
                  <span className="ml-auto flex gap-1">
                    <button type="button" className={btn} onClick={() => mark(result.entryId, t.id, "started")}>Started</button>
                    <button type="button" className={btn} onClick={() => mark(result.entryId, t.id, "stuck")}>Still stuck</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {board.length ? (
        <section aria-label="Tactic tests">
          <h2 className="text-sm font-semibold">Tactic tests</h2>
          <ul className="mt-1 space-y-1 text-sm">
            {board.map((r) => (
              <li key={r.id} className="opacity-80">{r.name} · offered {r.offered} · started {r.started} · stuck {r.stuck}{r.rate === null ? " · untested" : ` · ${Math.round(r.rate * 100)}%`}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label="Resistance log">
        <h2 className="text-sm font-semibold">Resistance log · {log.length}</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {[...log].reverse().slice(0, 20).map((e) => (
            <li key={e.id} className="opacity-80">
              {new Date(e.at).toLocaleString()} · {e.reading.task} · {e.reading.barrier}
              {e.tried ? ` · ${tacticById(e.tried.tacticId)?.name ?? e.tried.tacticId}: ${e.tried.outcome === "started" ? "started" : "stuck"}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
