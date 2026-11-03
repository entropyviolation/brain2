/**
 * components/Lab/TrackingHelper/helper-tests.tsx — Test the Tracking Helper's flow
 *
 * Mounted under the lab on `/lab/tracking-helper`. A case is an account, the day it was told, the rows it must
 * become, and the model's recorded WIRE answer (`lib/tracking-helper/tests.ts`). **Replay** runs the code stages on
 * the recording: no model, exact. **Live** asks the model again with the flow as saved in the lab: how a prompt
 * change is judged. Cases run on an empty vault so a learned place never changes an answer. New cases come from
 * a run saved with its rows.
 */
"use client"

import { useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { loadFlow } from "@/lib/tracking-helper/flow"
import { runHelper, type HelperRun } from "@/lib/tracking-helper/run"
import { compare, loadTests, replay, rowOf, rowText, saveMine, type HelperTest, type TestResult } from "@/lib/tracking-helper/tests"
import type { Wiring } from "@/lib/tracking-helper/types"
import "./helper-tests.css"

const EMPTY = { activityPens: [], locationPens: [], history: [] }
type Done = TestResult & { mode: string; ms: number }

async function live(text: string, now: Date): Promise<HelperRun> {
  const flow = loadFlow()
  const crew = await chatCrew().catch(() => null)
  const ladder = flow.wire.ladder.length ? flow.wire.ladder : crew?.extract ?? []
  return runHelper({ text, flow, ctx: { ...EMPTY, now }, call: crew ? ollamaCall(crew.main, undefined, { fresh: true }) : null, ladder })
}

export function HelperTests() {
  const [tests, setTests] = useState<HelperTest[]>(() => loadTests())
  const [done, setDone] = useState<Record<string, Done>>({})
  const [busy, setBusy] = useState("")
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [draft, setDraft] = useState<HelperRun | null>(null)

  async function runOne(t: HelperTest, mode: "replay" | "live") {
    const t0 = Date.now()
    const r = mode === "replay" ? replay(t, EMPTY) : compare((await live(t.text, new Date(t.now))).blocks.map(rowOf), t.expect)
    setDone((p) => ({ ...p, [t.id]: { ...r, mode, ms: Date.now() - t0 } }))
  }

  async function all(mode: "replay" | "live") {
    setBusy(mode)
    try {
      for (const t of tests) if (mode === "live" || t.wiring) await runOne(t, mode)
    } finally {
      setBusy("")
    }
  }

  async function tryText() {
    setBusy("try")
    try {
      setDraft(await live(text, new Date()))
    } finally {
      setBusy("")
    }
  }

  function save() {
    if (!draft || !name.trim()) return
    const wiring = draft.trace.find((s) => s.stage === "wire")?.output as Wiring | undefined
    const next = [...tests, { id: `mine-${Date.now().toString(36)}`, name: name.trim(), text: draft.text, now: new Date().toISOString(), ...(wiring ? { wiring } : {}), expect: draft.blocks.map(rowOf) }]
    setTests(next)
    saveMine(next)
    setName("")
  }

  return (
    <section className="tht" aria-label="Tracking Helper tests">
      <h2>Tests</h2>
      <p>Replay runs the code stages on a recorded model answer. Live asks the model again with the saved flow.</p>
      <div className="tht-row">
        <button type="button" data-no95="" disabled={!!busy} onClick={() => void all("replay")}>Replay all</button>
        <button type="button" data-no95="" disabled={!!busy} onClick={() => void all("live")}>{busy === "live" ? "Running…" : "Run all live"}</button>
      </div>
      <ul className="tht-list">
        {tests.map((t) => {
          const r = done[t.id]
          return (
            <li key={t.id} data-pass={r ? (r.pass ? "1" : "0") : ""}>
              <div className="tht-row">
                <b>{r ? (r.pass ? "PASS" : "FAIL") : "—"}</b>
                <span className="tht-name">{t.name}</span>
                {t.wiring ? <button type="button" data-no95="" disabled={!!busy} onClick={() => void runOne(t, "replay")}>Replay</button> : null}
                <button type="button" data-no95="" disabled={!!busy} onClick={() => void runOne(t, "live")}>Live</button>
                <button type="button" data-no95="" onClick={() => setText(t.text)}>Load text</button>
              </div>
              {r ? <pre>{r.pass ? `${r.mode} ok · ${r.ms} ms · ${r.got.length} blocks` : r.diff.join("\n") || r.got.map(rowText).join("\n")}</pre> : null}
            </li>
          )
        })}
      </ul>
      <h3>New case</h3>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an account, run it live, and save the rows you accept as a test." aria-label="Account for a new test" />
      <div className="tht-row">
        <button type="button" data-no95="" disabled={!text.trim() || !!busy} onClick={() => void tryText()}>{busy === "try" ? "Running…" : "Run live"}</button>
        {draft ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this test" aria-label="Test name" />
            <button type="button" data-no95="" disabled={!name.trim()} onClick={save}>Save as test</button>
          </>
        ) : null}
      </div>
      {draft ? <pre>{draft.blocks.map((b) => rowText(rowOf(b))).join("\n") || "No blocks found."}</pre> : null}
    </section>
  )
}
